/**
 * tests/dropdownPopupSurface.test.ts — a dropdown's list is drawn like
 * Obsidian's own menus.
 *
 * What this pins: the two lists that open from a `cs-dropdown-control` (the
 * shared `.cs-combobox-menu`, and the callout editor's Fold selector,
 * `.cs-palette-menu`) read every visible value from Obsidian's `--menu-*`
 * tokens, the way Obsidian's `.menu` does: the ground, the edge, the corners,
 * the shadow and the inner padding. Their rows are laid out like
 * `.menu-item`, and the chosen row is marked with a ✓ instead of a fill. Niv
 * decided on 2026-10-22 that every menu in the plugin should look the same as
 * Obsidian's.
 *
 * Why read `styles.css` as text: the cascade itself cannot be observed in the
 * fake DOM these tests run in. So the tests check that the rules name the
 * right tokens. The numbers those tokens resolve to were checked once against
 * Obsidian 1.14.4's real `app.css` (see
 * `docs/internals-docs/16-settings-ui-and-modals.md`, "Dropdown popups look
 * like Obsidian's menus").
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** One CSS rule: its selectors, and its declarations as property → value. */
interface Rule {
	selectors: string[];
	decls: Map<string, string>;
}

/** Whitespace inside `color-mix(` … `)` depends on how the source is wrapped. */
function tidy(value: string): string {
	return value.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

// The stylesheet with its comments removed, split into flat rules. The regex
// takes "selectors { declarations }" with no nested braces, which is enough:
// a rule inside `@media (…) { … }` is still found, only without its media
// condition.
const rawCss = readFileSync(join(process.cwd(), "styles.css"), "utf8");
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
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
	// `!` tells TypeScript "this is not undefined". The assertion above has
	// just proved that there is exactly one hit, and that it has the property.
	return hits[0]!.decls.get(property)!;
}

const POPUPS = [".cs-combobox-menu", ".cs-palette-menu"];
const ROWS = [".cs-combobox-option", ".cs-palette-menu-item"];
const FACE = "var(--cs-menu-face)";

describe("dropdown popups are drawn like Obsidian's menus", () => {
	it("stand on Obsidian's menu ground", () => {
		// `--menu-background` is `--background-secondary` unless a theme says
		// otherwise. `--cs-menu-face` names it once, for the few things inside a
		// list that have to repaint the very same colour.
		for (const popup of POPUPS) {
			assert.strictEqual(valueOf(popup, "--cs-menu-face"), "var(--menu-background, var(--background-secondary))", popup);
			assert.strictEqual(valueOf(popup, "background-color"), FACE, `${popup} must paint its face`);
		}
	});

	it("take the menu's edge, corners, shadow and blur from Obsidian's tokens", () => {
		for (const popup of POPUPS) {
			assert.strictEqual(
				valueOf(popup, "border"),
				"var(--menu-border-width, 1px) solid var(--menu-border-color, var(--background-modifier-border-hover))",
				popup,
			);
			assert.strictEqual(valueOf(popup, "border-radius"), "var(--menu-radius, var(--radius-m))", popup);
			assert.strictEqual(valueOf(popup, "corner-shape"), "var(--menu-corner-shape, var(--corner-shape, round))", popup);
			assert.strictEqual(valueOf(popup, "box-shadow"), "var(--menu-shadow, var(--shadow-s))", popup);
			assert.strictEqual(valueOf(popup, "backdrop-filter"), "var(--menu-backdrop-filter)", popup);
		}
	});

	it("keep the computer's 6px inner padding, even on a phone", () => {
		// Not `var(--menu-padding)`: a phone redefines that token for its menus'
		// bottom sheets, and these lists stay attached to their field.
		for (const popup of POPUPS) {
			assert.strictEqual(valueOf(popup, "padding"), "var(--size-2-3)", popup);
		}
	});

	it("lose their edge and turn 90% opaque on a phone or tablet, as Obsidian's menus do", () => {
		for (const popup of POPUPS) {
			const mobile = `.is-mobile ${popup}`;
			assert.strictEqual(valueOf(mobile, "border"), "none", mobile);
			assert.strictEqual(
				valueOf(mobile, "background-color"),
				"color-mix(in srgb, var(--cs-menu-face) var(--blur-opacity-m, 90%), transparent)",
				mobile,
			);
		}
	});

	it("no longer wear their control's face, its edge, or the old heavy shadow", () => {
		// Until 2026-10-23 they did. The decision to drop that look is recorded
		// in the stylesheet's comment and in internals-docs 16.
		for (const popup of POPUPS) {
			for (const rule of rules.filter((r) => r.selectors.includes(popup))) {
				const values = [...rule.decls.values()].join(" ");
				assert.doesNotMatch(values, /--cs-btn-face|--cs-field-border-hover|rgba\(/, popup);
			}
		}
	});
});

describe("rows are laid out like Obsidian's menu items", () => {
	it("pad, space and round every row as `.menu-item` does", () => {
		for (const row of ROWS) {
			assert.strictEqual(valueOf(row, "display"), "flex", row);
			assert.strictEqual(valueOf(row, "gap"), "var(--size-4-2)", row);
			assert.strictEqual(valueOf(row, "padding"), "var(--size-4-1) var(--size-4-2)", row);
			assert.strictEqual(valueOf(row, "border-radius"), "var(--radius-s)", row);
			assert.strictEqual(valueOf(row, "cursor"), "var(--cursor)", row);
		}
	});

	it("set the text size on the row: 13px on a computer, 15px on a phone or tablet", () => {
		for (const row of ROWS) {
			assert.strictEqual(valueOf(row, "font-size"), "var(--font-ui-small)", row);
			assert.strictEqual(valueOf(`.is-mobile ${row}`, "font-size"), "var(--font-ui-medium)", row);
		}
		// A callout's name takes that size from its row. The base rule keeps the
		// `[!` popover in a note at Obsidian's 15px suggestion size.
		assert.strictEqual(valueOf(".cs-combobox-menu .callout-studio-suggestion-name", "font-size"), "inherit");
	});

	it("highlight the row under the pointer or the arrow keys in Obsidian's hover grey", () => {
		for (const row of ROWS) {
			assert.strictEqual(valueOf(`${row}.is-active`, "background-color"), "var(--background-modifier-hover)", row);
		}
	});

	it("never fill the chosen row: it carries a ✓ instead", () => {
		const fills = rules.filter((rule) =>
			rule.selectors.some((s) => /\.is-selected\b/.test(s) && ROWS.some((row) => s.includes(row)))
			&& (rule.decls.has("background") || rule.decls.has("background-color")),
		);
		assert.deepStrictEqual(fills.map((rule) => rule.selectors), []);
		// The two tokens that painted the old fill are gone with it.
		assert.doesNotMatch(rawCss, /--cs-menu-row-selected/);
	});

	it("draws the ✓ where Obsidian's `setChecked(true)` draws it: last, muted, at the menu icon size", () => {
		assert.strictEqual(valueOf(".cs-combobox-check", "margin-inline-start"), "auto");
		assert.strictEqual(valueOf(".cs-combobox-check", "flex"), "0 0 auto");
		assert.strictEqual(valueOf(".cs-combobox-check", "color"), "var(--text-muted)");
		assert.strictEqual(valueOf(".cs-combobox-check", "--icon-size"), "var(--icon-s)");
		assert.strictEqual(valueOf(".cs-combobox-check", "--icon-stroke"), "var(--icon-s-stroke-width)");
	});
});

describe("groups, headings and the things that repaint the ground", () => {
	it("draws the line between groups as Obsidian's menu separator: one border line, 6px of air each side", () => {
		const between = ".cs-combobox-group + .cs-combobox-group";
		assert.strictEqual(valueOf(between, "border-top"), "var(--border-width, 1px) solid var(--background-modifier-border)");
		assert.strictEqual(valueOf(between, "margin-top"), "var(--size-2-3)");
		assert.strictEqual(valueOf(between, "padding-top"), "var(--size-2-3)");
		// The token that used to colour it, the field's hover edge, is gone.
		assert.doesNotMatch(rawCss, /--cs-menu-divider/);
	});

	it("lets a group reach across the list's side padding, so its line spans the whole list", () => {
		assert.strictEqual(valueOf(".cs-combobox-group", "margin-inline"), "calc(var(--size-2-3) * -1)");
		assert.strictEqual(valueOf(".cs-combobox-group", "padding-inline"), "var(--size-2-3)");
	});

	it("keeps the sticky group heading on the list's ground, edge to edge, in muted text", () => {
		assert.strictEqual(valueOf(".cs-combobox-group-label", "background"), FACE);
		assert.strictEqual(valueOf(".cs-combobox-group-label", "margin-inline"), "calc(var(--size-2-3) * -1)");
		assert.strictEqual(valueOf(".cs-combobox-group-label", "color"), "var(--text-muted)");
	});

	it("repaints the colour circles' cut-out ring with the ground", () => {
		assert.strictEqual(valueOf(".cs-combobox-menu .cs-color-circle", "box-shadow"), `0 0 0 1.5px ${FACE}`);
		assert.ok(
			rules.some((rule) => rule.selectors.includes(".cs-palette-menu .cs-color-circle") && rule.selectors.includes(".cs-combobox-menu .cs-color-circle")),
			"the Fold menu's circles share the rule",
		);
	});

	it("draws the transparent-swatch checkerboard from the ground it sits on", () => {
		// The base rule derives both tones from the window surface; a swatch in a
		// popup would otherwise be a checker of the wrong grey.
		const checker = valueOf(".cs-combobox-menu .cs-color-circle.is-transparent", "background-image");
		assert.match(checker, /var\(--cs-menu-face\) 0% 50%\)$/);
		assert.ok(!checker.includes("--cs-surface"), "the popup checkerboard must not name the window surface");
		assert.ok(
			rules.some((rule) => rule.selectors.includes(".cs-palette-menu .cs-color-circle.is-transparent")
				&& rule.selectors.includes(".cs-combobox-menu .cs-color-circle.is-transparent")),
			"the Fold menu shares the rule",
		);
	});

	it("dims an id's unmatched characters exactly as the `[!` popover does", () => {
		// A list used to brighten them, because it stood on the lighter control
		// face. On Obsidian's menu ground the popover's own faint text is right.
		assert.strictEqual(valueOf(".callout-studio-suggestion-id-dim", "color"), "var(--text-faint)");
		assert.ok(
			!rules.some((rule) => rule.selectors.includes(".cs-combobox-menu .callout-studio-suggestion-id-dim")),
			"no list-only override of the dimmed characters",
		);
	});
});
