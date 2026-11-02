/**
 * tests/styleGuards.test.ts — three habits of Obsidian's own stylesheet that
 * `styles.css` keeps (finding GAP-04 of the native-look plan).
 *
 * Each one was fixed by hand across the whole file first, and is held here so
 * a new rule cannot quietly undo it:
 *
 * 1. **A hover only where there is a pointer.** Every `:hover` rule sits in
 *    `@media (hover: hover)`, as Obsidian's do. On a touch screen a tap leaves
 *    its hover behind (WebKit even replays it onto whatever is under the finger
 *    after a redraw), so an ungated hover is a control that stays lit.
 * 2. **Focus rings are grey.** A ring says "the keyboard is here"; Obsidian
 *    draws it in `--background-modifier-border-focus`, never in the accent
 *    colour, which means "chosen" or "on".
 * 3. **Disabled looks the way Obsidian's does.** Obsidian dims a disabled
 *    button to 70%, an icon button to 40%, and a field, a switch or a slider
 *    to 50% (app.css 1.14.4). A rule of the plugin's that dims something
 *    disabled says which of the three it is copying.
 *
 * The exceptions are frozen lists, each with the reason, so a new one has to
 * be a decision. This file reads the stylesheet as text: the fake DOM the
 * other tests use has no cascade.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parseRules, valueOf, type CssRule } from "./support/cssInjectorHarness";
import { readRepoFile } from "./support/sourceScan";

const rules = parseRules(readRepoFile("styles.css"));

/** A selector without its `:not(…)` arguments: what it actually selects. */
const selecting = (selector: string): string => selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "");

describe("the stylesheet reader", () => {
	// Guards every assertion below: a parser that found nothing would make the
	// whole file vacuously green.
	it("found the rules, inside media queries too", () => {
		assert.ok(rules.length > 500, `only ${rules.length} rules parsed`);
		assert.ok(rules.some((rule) => rule.at.some((at) => at.includes("hover: hover"))));
	});
});

describe("a hover only where there is a pointer", () => {
	/** Is `rule` inside `@media (hover: hover)` (alone or with more conditions)? */
	const gated = (rule: CssRule): boolean => rule.at.some((at) => /\(\s*hover\s*:\s*hover\s*\)/.test(at));

	it("puts every :hover rule in @media (hover: hover)", () => {
		const loose = rules
			.filter((rule) => selecting(rule.selector).includes(":hover") && !gated(rule))
			.map((rule) => rule.selector);
		assert.deepStrictEqual(loose, []);
	});
});

describe("focus rings are grey", () => {
	/**
	 * The one ring in the accent colour, and why: it copies Obsidian exactly.
	 * Review conversion's After field is edited like a file being renamed, and
	 * Obsidian's rename field turns its ring accent while you type
	 * (`.tree-item-self.is-being-renamed:focus-within`).
	 */
	const ACCENT_RINGS = new Set([".cs-portable-input-grow:focus-within"]);
	const ACCENT = /var\(\s*--(?:interactive-accent|color-accent|text-accent)/;

	it("draws no focus ring in the accent colour", () => {
		const accented = rules
			.filter((rule) => /:focus/.test(selecting(rule.selector)))
			.filter((rule) => rule.decls.some((decl) => /^(outline|box-shadow|border)/.test(decl) && ACCENT.test(decl)))
			.map((rule) => rule.selector)
			.filter((selector) => !ACCENT_RINGS.has(selector));
		assert.deepStrictEqual(accented, []);
	});

	it("keeps its one exception live", () => {
		for (const selector of ACCENT_RINGS) {
			assert.ok(
				rules.some((rule) => rule.selector === selector),
				`${selector} has no rule left — remove it`,
			);
		}
	});
});

describe("disabled looks the way Obsidian's does", () => {
	/** Obsidian's three dims, from app.css 1.14.4. */
	const OBSIDIAN_DIM = {
		button: "0.7", // button[disabled], button[aria-disabled="true"]
		icon: "0.4", // .clickable-icon[aria-disabled='true']
		field: "0.5", // input:disabled, textarea:disabled, .checkbox-container.is-disabled, input[type=range]:disabled
	} as const;

	/** Every rule of the plugin's that dims a disabled thing, and what it is. */
	const DIMS: Record<string, keyof typeof OBSIDIAN_DIM> = {
		// The footer's tiles are drawn as buttons, the globe among them.
		".cs-footer-tile.cs-footer-tile.cs-footer-tile:disabled": "button",
		// The + inside the IDs field shares the field's face.
		".cs-tag-add-btn:disabled": "field",
		// A radio, a choice control like Obsidian's switch.
		".cs-option-radio:disabled": "field",
		// The picker's search field and filters, locked while a library downloads.
		".icon-picker-toolbar.is-disabled": "field",
	};
	const DISABLED = /:disabled|\.is-disabled|\[aria-disabled="?true"?\]|\.cs-btn-disabled/;

	const dimming = rules.filter((rule) => DISABLED.test(selecting(rule.selector)) && rule.props.includes("opacity"));

	it("dims only what it has named, at Obsidian's value for its kind", () => {
		const wrong = dimming
			.filter((rule) => {
				const kind = DIMS[rule.selector];
				return kind === undefined || valueOf(rule, "opacity") !== OBSIDIAN_DIM[kind];
			})
			.map((rule) => `${rule.selector} { opacity: ${valueOf(rule, "opacity")} }`);
		assert.deepStrictEqual(wrong, [], "add it to DIMS with its kind, at Obsidian's value");
	});

	it("names no rule that is gone", () => {
		const gone = Object.keys(DIMS).filter((selector) => !dimming.some((rule) => rule.selector === selector));
		assert.deepStrictEqual(gone, []);
	});
});
