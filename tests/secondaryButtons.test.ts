/**
 * tests/secondaryButtons.test.ts — who paints the plugin's grey buttons.
 *
 * Since decision 14 of the native-look plan, **Obsidian does**. A window's
 * Cancel (a `<button class="mod-cancel">` in Obsidian's `.modal-button-container`), the settings tab's
 * secondary buttons (Discover, Import, Export, Reset, …), Pick an icon's
 * **Manage libraries** and the import window's Upload/Paste get no face, edge,
 * hover or focus ring from the plugin: Obsidian's `button` rules draw them, so
 * they look exactly like Obsidian's own buttons (on macOS that is a flat grey
 * button with no hover step, as in Obsidian's own dialogs).
 *
 * Two kinds of button still wear the plugin's shared grey face, until they are
 * rebuilt as Obsidian controls later in the plan: the two segmented rows,
 * `.cs-border-side-btn` (the style windows' border sides) and
 * `.cs-gradient-dir-btn` (the palette's gradient direction). Their face is a
 * pair of tokens declared once, `--cs-btn-face` and `--cs-btn-face-hover`, the
 * second mixed into the first with `--mono-rgb-100` for direction.
 *
 * **Why not `--background-modifier-hover` for that hover?** It is not a colour:
 * it is a translucent mono overlay (black or white at 6.7%), so it composites
 * against whatever is *behind* the button and flips direction with the theme.
 * That shipped twice — a hover that did nothing in dark mode, and segments that
 * got darker under the pointer.
 *
 * And **specificity**: Obsidian paints every button from
 * `button:not(.clickable-icon) { background-color: var(--interactive-normal) }`,
 * which is (0,1,1). A single-class rule is (0,1,0) and never gets its fill, so
 * both segmented rows double their class to clear it.
 *
 * This file is arithmetic over the stylesheet, not a rendering test.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

type Rule = { selector: string; declarations: string; at: number };

/** Flattens `@media`/`@supports` rather than skipping them — the hover rules live inside one. */
function parseRules(css: string, base = 0): Rule[] {
	const out: Rule[] = [];
	let depth = 0;
	let buffer = "";
	let selector = "";
	let blockStart = 0;

	for (let i = 0; i < css.length; i++) {
		const char = css[i];
		if (char === "{") {
			if (depth === 0) {
				selector = buffer.trim();
				blockStart = i + 1;
			}
			depth++;
		} else if (char === "}") {
			depth--;
			if (depth === 0) {
				const body = css.slice(blockStart, i);
				if (selector.startsWith("@")) out.push(...parseRules(body, base + blockStart));
				else out.push({ selector, declarations: body, at: base + blockStart });
				buffer = "";
				continue;
			}
		}
		if (depth === 0) buffer += char;
	}
	return out;
}

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);
const rules = parseRules(css);

/** A background declaration's value, shorthand or longhand. */
function backgroundOf(rule: Rule): string | null {
	const m = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(rule.declarations);
	return m?.[1]?.trim() ?? null;
}

const find = (selector: string): Rule | undefined =>
	rules.find((r) => r.selector.replace(/\s+/g, " ") === selector);

/**
 * The buttons that still wear the shared face, by the selector that owns each
 * one's resting fill. A literal list on purpose: a new grey button that paints
 * itself should have to be added here by hand, with a reason.
 */
const FACES = [
	{
		label: "segmented: border sides",
		base: ".cs-border-side-btn.cs-border-side-btn",
		hover: ".cs-border-side-btn:hover",
	},
	{
		label: "segmented: gradient direction",
		base: ".cs-gradient-dir-btn.cs-gradient-dir-btn",
		hover: ".cs-gradient-dir-btn:hover",
	},
];

/**
 * Selectors of grey buttons that Obsidian paints. None of them may appear in a
 * rule that sets a face, an edge or a shadow.
 */
const NATIVE_BUTTONS = [
	".modal-button-container",
	".icon-picker-manage-libraries",
	".cs-import-action",
];

describe("Obsidian paints the plain grey buttons", () => {
	it("no rule of the plugin's gives them a face, an edge or a shadow", () => {
		const painted = rules.filter(
			(r) => NATIVE_BUTTONS.some((b) => r.selector.replace(/\s+/g, " ").includes(b))
				&& /(?:^|;)\s*(background(?:-color)?|border(?:-color)?|box-shadow)\s*:/.test(r.declarations),
		);
		assert.deepStrictEqual(painted.map((r) => r.selector.replace(/\s+/g, " ")), []);
	});

	it("the settings tab's secondary buttons carry no class of the plugin's to paint", () => {
		// They used to wear `.cs-settings-neutral-btn`; it is gone from both
		// sides, so a future rule cannot quietly bring the old face back.
		assert.ok(!css.includes("cs-settings-neutral-btn"));
	});
});

describe("every grey button wears the shared face", () => {
	for (const face of FACES) {
		it(`${face.label} rests on --cs-btn-face`, () => {
			const rule = find(face.base);
			assert.ok(rule, `no rule for ${face.base} — was it renamed?`);
			assert.match(
				backgroundOf(rule) ?? "",
				/var\(--cs-btn-face,/,
				`${face.label} must rest on var(--cs-btn-face, …), not a token of its own`,
			);
		});

		it(`${face.label} hovers to --cs-btn-face-hover`, () => {
			const rule = find(face.hover);
			assert.ok(rule, `no hover rule for ${face.hover} — was it renamed?`);
			assert.match(
				backgroundOf(rule) ?? "",
				/var\(--cs-btn-face-hover,/,
				`${face.label} must hover to var(--cs-btn-face-hover, …)`,
			);
		});
	}
});

/**
 * Obsidian's own resting fill for a button. Every rule that claims a button's
 * face has to outrank it or it does not have a face at all.
 */
const OBSIDIAN_BUTTON_FACE = specificityOf("button:not(.clickable-icon)");

describe("a grey button's face outranks Obsidian's own", () => {
	it("the bar is (0,1,1)", () => {
		assert.deepStrictEqual(OBSIDIAN_BUTTON_FACE, [0, 1, 1]);
	});

	for (const face of FACES) {
		it(`${face.label} clears it`, () => {
			assert.ok(
				compareSpecificity(specificityOf(face.base), OBSIDIAN_BUTTON_FACE) > 0,
				`${face.base} is ${JSON.stringify(specificityOf(face.base))}, which does not ` +
					`outrank button:not(.clickable-icon) ${JSON.stringify(OBSIDIAN_BUTTON_FACE)} — ` +
					"its resting fill would come from Obsidian instead. Double the class.",
			);
		});
	}
});

/**
 * The selected segment and the hovered one are the same specificity, so the one
 * written later wins. `.is-active` used to sit after `:hover`, which meant a
 * selected segment swallowed its own hover and answered the pointer with
 * nothing — the single dead control in the row.
 */
describe("a selected segment still answers the pointer", () => {
	const SEGMENTS = [
		{ label: "border sides", active: ".cs-border-side-btn.is-active", hover: ".cs-border-side-btn:hover" },
		{ label: "gradient direction", active: ".cs-gradient-dir-btn.is-active", hover: ".cs-gradient-dir-btn:hover" },
	];

	for (const seg of SEGMENTS) {
		it(`${seg.label}: .is-active is declared before :hover`, () => {
			const active = find(seg.active);
			const hover = find(seg.hover);
			assert.ok(active && hover, `missing a rule for ${seg.label}`);
			assert.deepStrictEqual(
				specificityOf(seg.active),
				specificityOf(seg.hover),
				"if these stop tying, this ordering rule is no longer what decides it",
			);
			assert.ok(
				active.at < hover.at,
				`${seg.active} must be declared before ${seg.hover} — at equal specificity the ` +
					"later rule wins, and a selected segment would swallow its own hover.",
			);
		});

		it(`${seg.label}: selected + hovered is distinct from both`, () => {
			const rule = find(`${seg.active}:hover`);
			assert.ok(rule, `${seg.active}:hover is missing — a hovered selection has no feedback`);
			assert.match(
				backgroundOf(rule) ?? "",
				/^var\(--interactive-accent-hover\)$/,
				"a hovered selection takes Obsidian's accent hover, so it cannot be mistaken for an unselected segment",
			);
		});
	}
});

/**
 * The regression that started this: a translucent overlay standing in for a
 * button's fill. It is still the right answer for a list row, an icon button or
 * a chip — all of which sit on the surface behind them rather than owning a
 * face — so this is scoped to the faces listed above rather than to the file.
 */
describe("no grey button paints the hover overlay", () => {
	const OVERLAY = /var\(\s*--background-modifier-hover\s*\)/;
	const FORM_FIELD = /var\(\s*--background-modifier-form-field\s*\)/;

	for (const face of FACES) {
		it(`${face.label} uses neither the overlay nor the form-field token`, () => {
			for (const selector of [face.base, face.hover]) {
				const rule = find(selector);
				if (!rule) continue;
				const bg = backgroundOf(rule) ?? "";
				assert.ok(
					!OVERLAY.test(bg),
					`${selector} paints --background-modifier-hover, which is a translucent ` +
						"overlay: it composites against what is behind the button and flips " +
						"direction with the theme.",
				);
				assert.ok(
					!FORM_FIELD.test(bg),
					`${selector} paints --background-modifier-form-field, which is an input ` +
						"token (--color-base-25 in dark) and is what made Discover's hover invisible.",
				);
			}
		});
	}
});

/** The tokens have to exist, or every call site silently takes its fallback. */
describe("the shared tokens are declared", () => {
	const declaration = rules.find((r) => /--cs-btn-face\s*:/.test(r.declarations));

	it("--cs-btn-face and --cs-btn-face-hover are written once, together", () => {
		assert.ok(declaration, "no rule declares --cs-btn-face");
		assert.match(declaration.declarations, /--cs-btn-face-hover\s*:/);
	});

	it("the hover is mixed from the resting face, with --mono-rgb-100 for direction", () => {
		assert.match(declaration?.declarations ?? "", /color-mix\(/);
		assert.match(
			declaration?.declarations ?? "",
			/var\(--mono-rgb-100\)/,
			"the mix needs the theme's own contrast direction, or it darkens in both themes",
		);
	});

	it("reaches the settings tab and every window", () => {
		const scope = declaration?.selector.replace(/\s+/g, " ") ?? "";
		assert.match(scope, /\.callout-studio-settings/);
		assert.match(scope, /\.cs-modal/);
	});
});
