/**
 * tests/secondaryButtons.test.ts — one face for every grey button.
 *
 * The plugin draws four kinds of non-CTA button: the settings tab's
 * `.cs-settings-neutral-btn` (Discover, Import, Export, Reset, Data
 * management), the bare `<button>`s in a window's `.cs-modal-footer`
 * (Cancel), and the two segmented rows — `.cs-border-side-btn`
 * (All/Top/Right/Bottom/Left) and `.cs-gradient-dir-btn`. They were styled
 * four different ways and behaved four different ways, and all four bugs came
 * from the same misreading of one token.
 *
 * **`--background-modifier-hover` is not a colour.** It is a translucent mono
 * overlay — `rgba(var(--mono-rgb-100), 0.067)`, black at 6.7% under
 * `.theme-light`, white at 6.7% under `.theme-dark`. Two consequences, both of
 * which shipped:
 *
 * - It composites against whatever is *behind* the button, not against the
 *   button's own fill. Discover rested on `--background-modifier-form-field`
 *   (`--color-base-25`, #2a2a2a) over a #1e1e1e pane and hovered to #2d2d2d —
 *   Δlum 0.3%, i.e. **no hover at all in dark mode**, while the identical rule
 *   in light mode moved #ffffff → #eeeeee and looked fine.
 * - It always moves *away* from the background, so its direction flips with the
 *   theme. The segmented rows rest on Obsidian's own `--interactive-normal`
 *   (#363636 in dark) but hovered to that overlay composited over the group box
 *   behind them (#1e1e1e) — landing at #2d2d2d, **darker than the button
 *   itself**. That is the "these get darker" report, and it is the same trap
 *   reached from the other side.
 *
 * So the contract is a pair of tokens declared once, `--cs-btn-face` and
 * `--cs-btn-face-hover`, the second mixed into the first with `--mono-rgb-100`
 * for direction. Verified in headless Chrome against real `app.css`, both
 * themes, transitions disabled (Chrome reports a mid-transition colour in
 * `oklab`, which is how a first pass at that harness measured the *resting*
 * colour twice and called the fix broken):
 *
 *     light   #ffffff → #ebebeb   Δlum −16.9%
 *     dark    #363636 → #464646   Δlum  +2.4%
 *
 * identically for all four, while a native Obsidian button beside them still
 * moves #ffffff → #fafafa / #363636 → #3f3f3f, untouched.
 *
 * The other half of the contract is **specificity**, and it is the half that is
 * easy to lose. Obsidian paints every button from
 * `button:not(.clickable-icon) { background-color: var(--interactive-normal) }`,
 * which is **(0,1,1)**. A single-class rule is (0,1,0) and simply does not get
 * the resting fill — which is why the `background: transparent` the border-side
 * buttons carried for their whole life never once took effect. Both segmented
 * rows double their class to clear it.
 *
 * This file is arithmetic over the stylesheet, not a rendering test; it cannot
 * see the cascade run. What it can do is stop the four from drifting apart
 * again, which is the thing that actually happened.
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
 * The four faces, by the selector that owns each one's resting fill. Kept as a
 * literal list rather than discovered by pattern: a fifth grey button appearing
 * without an entry here is exactly the drift this file exists to catch, and a
 * pattern would silently adopt it.
 */
const FACES = [
	{
		label: "settings tab (Discover, Import, Export, Reset, …)",
		base: ".callout-studio-settings .cs-settings-neutral-btn",
		hover: ".callout-studio-settings .cs-settings-neutral-btn:hover:not(:disabled)",
	},
	{
		label: "window footer (Cancel)",
		base: ".cs-modal > .cs-modal-footer button:not(.mod-cta, .mod-warning, .mod-destructive)",
		hover:
			".cs-modal > .cs-modal-footer button:not(.mod-cta, .mod-warning, .mod-destructive):not( :disabled, .cs-btn-disabled ):hover",
	},
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
				/var\(--interactive-accent-hover\)/,
				"a hovered selection steps within the accent, so it cannot be mistaken for an unselected segment",
			);
		});
	}
});

/**
 * The regression that started this: a translucent overlay standing in for a
 * button's fill. It is still the right answer for a list row, an icon button or
 * a chip — all of which sit on the surface behind them rather than owning a
 * face — so this is scoped to the four rules above rather than to the file.
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
