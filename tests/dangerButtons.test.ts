/**
 * tests/dangerButtons.test.ts — the red buttons answer the pointer.
 *
 * Sibling to `secondaryButtons.test.ts`, and the same class of bug reached from
 * a third side. The greys had rules that resolved against the wrong surface;
 * the reds have a rule that resolves against *nothing*.
 *
 * Obsidian ships a hover for its red-button variants:
 *
 *     button.mod-warning       { background-color: var(--background-modifier-error) }
 *     button.mod-warning:hover { background-color: var(--background-modifier-error-hover) }
 *
 * and then, under `body`, defines both of those tokens as `var(--color-red)`.
 * The rule matches, fires, and paints the colour already there — Δlum 0.0% in
 * both themes. Delete, Replace and "Start fresh" were never missing a hover
 * rule; they were running a no-op, which is why the gap survived so long in a
 * stylesheet that otherwise looks like it handles them.
 *
 * So the contract mirrors the grey one: a token declared beside the grey pair,
 * mixed from the resting fill with `--mono-rgb-100` for direction, and a
 * hover-only rule heavy enough to land. Judge the step in **CIEDE2000**, not
 * Δlum and not CIE76 — light lands at ΔE00 4.19 against the grey face's 4.10,
 * and dark is deliberately smaller (2.84 vs 5.26) because closing that gap
 * costs white-text contrast on a fill Obsidian already ships below AA.
 *
 * What this file guards is the part that silently rots: the token existing, the
 * direction being the theme's rather than a hardcoded `black`, the rule
 * outranking Obsidian's own hover, both historical red classes being covered,
 * and the resting fill staying unclaimed so a theme keeps its own red.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);

/** Collapsed whitespace, so a selector can be matched across its wrapped lines. */
const flat = css.replace(/\s+/g, " ");

describe("the danger hover token", () => {
	it("is declared beside the grey pair, not in a block of its own", () => {
		const block = /\{([^{}]*--cs-btn-face\s*:[^{}]*)\}/.exec(css)?.[1] ?? "";
		assert.ok(block, "no rule declares --cs-btn-face");
		assert.match(
			block,
			/--cs-btn-danger-face-hover\s*:/,
			"--cs-btn-danger-face-hover must sit with --cs-btn-face so the two " +
				"families cannot drift onto different scopes",
		);
	});

	it("is mixed from the resting error fill", () => {
		assert.match(
			flat,
			/--cs-btn-danger-face-hover: color-mix\( in srgb, var\(--background-modifier-error\) 92%/,
			"the hover has to be mixed from --background-modifier-error, so a theme " +
				"that retunes its red gets a hover derived from that red",
		);
	});
	it("takes its direction from the theme, never a hardcoded black", () => {
		const decl =
			/--cs-btn-danger-face-hover: color-mix\(([^;]*)\);/.exec(flat)?.[1] ?? "";
		assert.match(
			decl,
			/rgb\(var\(--mono-rgb-100\)\)/,
			"without --mono-rgb-100 the red darkens in dark mode too, which is the " +
				"one rule the shared button face exists to make true everywhere",
		);
		assert.doesNotMatch(
			decl,
			/\bblack\b|#000/,
			"a literal black cannot flip with the theme",
		);
	});
});

/**
 * Obsidian's own red hover, which ours has to outrank. It lives inside
 * `@media (hover: hover)`, so the media query buys no specificity — the
 * selector alone decides it.
 */
const OBSIDIAN_WARNING_HOVER = specificityOf("button.mod-warning:hover");

describe("the red hover lands", () => {
	const SELECTORS = [
		"body:not(.is-mobile) .callout-studio-settings button:is(.mod-warning, .mod-destructive):not( :disabled, .cs-btn-disabled ):hover",
		"body:not(.is-mobile) .cs-modal button:is(.mod-warning, .mod-destructive):not( :disabled, .cs-btn-disabled ):hover",
		"body:not(.is-mobile) .callout-studio-editor button:is(.mod-warning, .mod-destructive):not( :disabled, .cs-btn-disabled ):hover",
	];

	it("Obsidian's bar is (0,2,1)", () => {
		assert.deepStrictEqual(OBSIDIAN_WARNING_HOVER, [0, 2, 1]);
	});

	for (const selector of SELECTORS) {
		const root = /\.(callout-studio-settings|cs-modal|callout-studio-editor)/.exec(selector)?.[1];

		it(`${root} carries the rule`, () => {
			assert.ok(
				flat.includes(selector),
				`${selector} is missing — red buttons under .${root} would fall back ` +
					"to Obsidian's no-op hover",
			);
		});

		it(`${root} outranks button.mod-warning:hover`, () => {
			assert.ok(
				compareSpecificity(specificityOf(selector), OBSIDIAN_WARNING_HOVER) > 0,
				`${selector} is ${JSON.stringify(specificityOf(selector))}, which does not ` +
					`outrank ${JSON.stringify(OBSIDIAN_WARNING_HOVER)}`,
			);
		});
	}

	it("is desktop-only, and skips the mobile red-text treatment", () => {
		const at = flat.indexOf(SELECTORS[1]!);
		assert.ok(at > 0);
		const before = flat.slice(0, at);
		assert.match(
			before.slice(-160),
			/@media \(hover: hover\) \{[^{]*$/,
			"the rule must sit inside @media (hover: hover), or a touch device keeps " +
				"the hovered red stuck after a tap",
		);
		for (const selector of SELECTORS) {
			assert.ok(
				selector.startsWith("body:not(.is-mobile)"),
				".is-mobile button.mod-warning drops the red fill for grey-with-red-text; " +
					"a tablet with a pointer satisfies hover: hover and would hover it red",
			);
		}
	});

	it("paints only the hover — the resting fill stays the theme's", () => {
		for (const className of ["mod-warning", "mod-destructive"]) {
			assert.doesNotMatch(
				flat,
				new RegExp(
					`(?:\\.cs-modal|\\.callout-studio-settings|\\.callout-studio-editor) button\\.${className}(?!:not|:hover|\\s*,)[^{]*\\{[^}]*background`,
				),
				`claiming .${className}'s resting fill at our weight would beat a ` +
					"theme that paints it directly; only the hover is ours to set",
			);
		}
	});

	it("covers Obsidian 1.13's destructive-plus-CTA warning buttons", () => {
		for (const selector of SELECTORS) {
			assert.match(selector, /:is\(\.mod-warning, \.mod-destructive\)/);
		}
	});
});
