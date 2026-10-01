/**
 * tests/dropdownPopupSurface.test.ts — a dropdown's list wears the face and the
 * corners of the control that opened it.
 *
 * The two popups that open from a `cs-dropdown-control` (`.cs-combobox-menu`
 * and the Fold selector's `.cs-palette-menu`) were painted the window's colour
 * with a fixed 4px corner, so under a grey 8px field they read as a second
 * object stuck onto it. They now take the control's own face and Obsidian's
 * own input corners. What these tests pin is the *link*, not the colours: the
 * popup's face is literally the field's face, and that face is the same in every
 * state because a field never repaints its fill (it answers the pointer and
 * focus with its edge — see `inputPointerStability.test.ts`). The corners are
 * the same tokens the fields read, and every state that used to lean on the old
 * dark ground (selected rows, the sticky heading, the group divider, the colour
 * circles' cut-out ring, dimmed id text) is derived from the new face instead.
 *
 * Read from `styles.css` because the cascade itself is not observable here;
 * the computed numbers were checked once against Obsidian's real `app.css` (see
 * `docs/internals-docs/16-settings-ui-and-modals.md`, "Dropdown popups wear
 * their control's face").
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Rule {
	selectors: string[];
	decls: Map<string, string>;
}

/** Whitespace inside `color-mix(` … `)` depends on how the source is wrapped. */
function tidy(value: string): string {
	return value.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules: Rule[] = [];
const pattern = /([^{}]+)\{([^{}]*)\}/g;
let match: RegExpExecArray | null;
while ((match = pattern.exec(css)) !== null) {
	const decls = new Map<string, string>();
	for (const declaration of (match[2] ?? "").split(";")) {
		const colon = declaration.indexOf(":");
		if (colon < 0) continue;
		decls.set(declaration.slice(0, colon).trim(), tidy(declaration.slice(colon + 1)));
	}
	rules.push({
		selectors: (match[1] ?? "").trim().split(/,\s*\n/).map((s) => tidy(s)),
		decls,
	});
}

/** The value `selector` gets for `property`, asserting exactly one rule sets it. */
function valueOf(selector: string, property: string): string {
	const hits = rules.filter((rule) => rule.selectors.includes(selector) && rule.decls.has(property));
	assert.strictEqual(hits.length, 1, `expected one rule setting ${property} for ${selector}, found ${hits.length}`);
	return hits[0]!.decls.get(property)!;
}

/**
 * The light palette puts one of its swatches in front of a derivation: the value
 * is `var(<swatch>, <what it was before the palette>)`. Dark mode and a community
 * theme never declare the swatch, so what they get is the fallback — which is why
 * the rules below are asserted on the fallback, and the swatch is asserted by
 * name.
 */
function fallbackOf(value: string, swatch: string): string {
	const prefix = `var(${swatch}, `;
	assert.ok(value.startsWith(prefix) && value.endsWith(")"), `expected ${swatch} first, then the old value, in: ${value}`);
	return value.slice(prefix.length, -1);
}

const POPUPS = [".cs-combobox-menu", ".cs-palette-menu"];
const FACE = "var(--cs-menu-face)";
const DROPDOWN_BASE = ".cs-dropdown-control.cs-dropdown-control.cs-dropdown-control";

describe("dropdown popups wear their control's face", () => {
	it("are painted the control's own face, which no state of the control repaints", () => {
		const restingFace = "var(--cs-btn-face, var(--interactive-normal))";
		assert.strictEqual(valueOf(DROPDOWN_BASE, "background"), restingFace, "the control rests on the shared button face");
		for (const popup of POPUPS) {
			assert.strictEqual(valueOf(popup, "--cs-menu-face"), restingFace, `${popup} must define its face as the control's own`);
			assert.strictEqual(valueOf(popup, "background-color"), FACE, `${popup} must paint its face`);
		}
		// The two are the same grey in every state only while nothing repaints the
		// control: a hover, focus or open fill on a field would open a gap between
		// it and the list hanging from it. The shared base is the one and only rule
		// that paints a fill on a field.
		const painters = rules.filter(
			(rule) => rule.selectors.some((s) => /^\.cs-(dropdown|text)-control/.test(s))
				&& (rule.decls.has("background") || rule.decls.has("background-color")),
		);
		assert.strictEqual(painters.length, 1, "only the shared base paints a field's fill");
		assert.ok(painters[0]!.selectors.includes(DROPDOWN_BASE));
	});

	it("no longer paint the window's colour, which is what made them look like a second object", () => {
		for (const popup of POPUPS) {
			assert.ok(!valueOf(popup, "background-color").includes("--cs-surface"), popup);
		}
	});

	it("take the corners Obsidian gives a box taller than a line, not a fixed token", () => {
		// `--textarea-radius` is defined on mobile only (24px), where
		// `--input-radius` is a 44px pill that would clip the first row's text.
		const radius = "var(--textarea-radius, var(--input-radius, var(--radius-s)))";
		for (const popup of POPUPS) {
			assert.strictEqual(valueOf(popup, "border-radius"), radius, popup);
			assert.strictEqual(valueOf(popup, "corner-shape"), "var(--input-corner-shape, round)", popup);
		}
		// One concept, one expression: the import window's paste box is the other
		// multi-line surface and must not round differently from a list.
		assert.strictEqual(
			valueOf(".cs-import-paste-input.cs-text-control.cs-text-control.cs-text-control.cs-text-control", "border-radius"),
			radius,
		);
	});

	it("carry the open control's edge on into the list", () => {
		// An open field is drawn with the same thin edge as a hovered one (no
		// thicker border, no ring), and the list below it takes that very colour.
		const edge = "var(--cs-field-border-hover, var(--background-modifier-border-hover))";
		for (const popup of POPUPS) {
			assert.strictEqual(valueOf(popup, "border"), `1px solid ${edge}`, popup);
		}
	});
});

describe("every state that leaned on the old dark ground is derived from the new face", () => {
	const mix = /^color-mix\(in srgb, var\(--cs-menu-face\) (\d+)%, var\(--text-normal\)\)$/;

	it("steps selected rows away from the face toward the text colour, harder when also active", () => {
		// What dark mode and a community theme keep: the light palette's tint of
		// the accent sits in front of this and is left alone by them.
		for (const popup of POPUPS) {
			const selected = mix.exec(fallbackOf(valueOf(popup, "--cs-menu-row-selected"), "--cs-light-row-selected"));
			const active = mix.exec(fallbackOf(valueOf(popup, "--cs-menu-row-selected-active"), "--cs-light-row-selected-active"));
			assert.ok(selected && active, `${popup} must mix both selected fills from its face`);
			assert.ok(Number(active[1]) < Number(selected[1]), "selected + active must sit further from the face than selected alone");
		}
	});

	it("paints the selected states through those tokens", () => {
		assert.strictEqual(valueOf(".cs-combobox-option.is-selected", "background-color"), "var(--cs-menu-row-selected)");
		assert.strictEqual(valueOf(".cs-combobox-option.is-selected.is-active", "background-color"), "var(--cs-menu-row-selected-active)");
		assert.strictEqual(valueOf(".cs-palette-menu-item.is-selected", "background-color"), "var(--cs-menu-row-selected)");
		assert.strictEqual(
			valueOf(".cs-fold-menu .cs-palette-menu-item.is-selected:hover", "background-color"),
			"var(--cs-menu-row-selected-active)",
		);
	});

	it("keeps the sticky group heading on the menu's face and readable on it", () => {
		assert.strictEqual(valueOf(".cs-combobox-group-label", "background"), FACE);
		// `--text-faint` on the dark open face is 1.7:1.
		assert.strictEqual(valueOf(".cs-combobox-group-label", "color"), "var(--text-muted)");
	});

	it("draws the line between groups in the field's hover edge, since the resting border is the face's own colour", () => {
		// `--background-modifier-border` equals the resting face in dark and in
		// macOS light, so a divider in it would not show at all.
		const edge = "var(--cs-field-border-hover, var(--background-modifier-border-hover))";
		// The light palette's soft resting line goes first: under it the resting
		// border is no longer the face's own colour, so it can draw the divider.
		for (const popup of POPUPS) {
			assert.strictEqual(fallbackOf(valueOf(popup, "--cs-menu-divider"), "--cs-light-line"), edge, popup);
		}
		assert.strictEqual(
			valueOf(".cs-combobox-group + .cs-combobox-group", "border-top"),
			"1px solid var(--cs-menu-divider, var(--background-modifier-border))",
		);
	});

	it("repaints the colour circles' cut-out ring with the face", () => {
		assert.strictEqual(valueOf(".cs-combobox-menu .cs-color-circle", "box-shadow"), `0 0 0 1.5px ${FACE}`);
		assert.ok(
			rules.some((rule) => rule.selectors.includes(".cs-palette-menu .cs-color-circle") && rule.selectors.includes(".cs-combobox-menu .cs-color-circle")),
			"the Fold menu's circles share the rule",
		);
	});

	it("draws the transparent-swatch checkerboard from the face it sits on", () => {
		// The base rule derives both tones from the window surface; a swatch in a
		// popup would otherwise be a dark-on-grey checker that reads as a hole.
		const checker = valueOf(".cs-combobox-menu .cs-color-circle.is-transparent", "background-image");
		assert.match(checker, /var\(--cs-menu-face\) 0% 50%\)$/);
		assert.ok(!checker.includes("--cs-surface"), "the popup checkerboard must not name the window surface");
		assert.ok(
			rules.some((rule) => rule.selectors.includes(".cs-palette-menu .cs-color-circle.is-transparent")
				&& rule.selectors.includes(".cs-combobox-menu .cs-color-circle.is-transparent")),
			"the Fold menu shares the rule",
		);
	});

	it("dims an id's unmatched characters with muted text, inside dropdowns only", () => {
		assert.strictEqual(
			valueOf(".cs-combobox-menu .callout-studio-suggestion-id-dim", "color"),
			"color-mix(in srgb, var(--text-muted) 60%, transparent)",
		);
		// The base rule is the `[!` popover's too and keeps its own ground.
		assert.strictEqual(valueOf(".callout-studio-suggestion-id-dim", "color"), "var(--text-faint)");
	});
});
