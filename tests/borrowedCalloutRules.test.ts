/**
 * tests/borrowedCalloutRules.test.ts — the rules the rest of the page aims at a
 * callout's name, copied onto the callout editor's preview.
 *
 * The callout editor previews its draft under the reserved placeholder id, so
 * the notes keep the saved callout until Save. What a callout's look takes from
 * its name — a snippet's border on `[!plan]`, a theme's rule for every name
 * containing `col`, Obsidian's own colour for a built-in — would not reach the
 * placeholder, so the preview carries a copy of each such rule, re-aimed
 * (`manager/css/borrowedCalloutRules.ts`). What is pinned here:
 *
 * - **Only what reaches the name is copied**, and a list keeps only the
 *   selectors that did: an exact name, a family pattern, the `i` flag, a name
 *   inside `:is()`.
 * - **A name inside `:not()` is not a reach** and is left alone.
 * - **The context comes along**: `@media`, `@supports`, and CSS nesting,
 *   resolved the way the browser resolves it.
 * - **A sheet the browser will not open is skipped**, and so is `@keyframes`.
 *
 * The CSSOM is faked with plain objects carrying the fields the walk reads,
 * which is all a `CSSRuleList` is to it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { borrowedRulesCss, collectCalloutAimedRules } from "../src/manager/css/borrowedCalloutRules";

const PLACEHOLDER = "new-callout-preview";
const AIMED = `[data-callout="${PLACEHOLDER}"]`;

interface FakeRule {
	selectorText?: string;
	style?: { cssText: string };
	cssRules?: FakeRule[];
	media?: { mediaText: string };
	cssText?: string;
	appendRule?: () => void;
}

const rule = (selectorText: string, cssText = "border: 2px solid red;", nested?: FakeRule[]): FakeRule => ({
	selectorText,
	style: { cssText },
	...(nested ? { cssRules: nested } : {}),
});

function sheet(...rules: FakeRule[]): CSSStyleSheet {
	return { cssRules: rules, media: { mediaText: "" } } as unknown as CSSStyleSheet;
}

/** What the preview of a draft named `id` would borrow from `sheets`. */
function borrowed(id: string, ...sheets: CSSStyleSheet[]): string {
	return borrowedRulesCss(collectCalloutAimedRules(sheets), id, PLACEHOLDER);
}

describe("what the preview borrows", () => {
	it("copies a rule that names the callout, aimed at the placeholder", () => {
		const out = borrowed("plan", sheet(rule('.callout[data-callout="plan"]')));
		assert.equal(out, `.callout${AIMED} { border: 2px solid red; }`);
	});

	it("copies nothing for a rule that names another callout", () => {
		assert.equal(borrowed("plan", sheet(rule('.callout[data-callout="other"]'))), "");
	});

	it("keeps only the selectors of a list that reached the name", () => {
		const out = borrowed("plan", sheet(rule('.callout[data-callout="plan"], .callout[data-callout="other"], .x')));
		assert.equal(out, `.callout${AIMED} { border: 2px solid red; }`);
	});

	it("follows a family pattern that catches the name", () => {
		assert.match(borrowed("column", sheet(rule('.callout[data-callout*="col"]'))), /new-callout-preview/);
		assert.match(borrowed("column", sheet(rule('.callout[data-callout^="col"]'))), /new-callout-preview/);
		assert.equal(borrowed("plan", sheet(rule('.callout[data-callout*="col"]'))), "");
	});

	it("reads the `i` flag", () => {
		assert.match(borrowed("plan", sheet(rule('.callout[data-callout="PLAN" i]'))), /new-callout-preview/);
		assert.equal(borrowed("plan", sheet(rule('.callout[data-callout="PLAN"]'))), "", "Obsidian writes lower case");
	});

	it("reaches a name inside `:is()`, and leaves one inside `:not()` alone", () => {
		assert.equal(
			borrowed("plan", sheet(rule('.callout:is([data-callout="plan"], [data-callout="x"])'))),
			`.callout:is(${AIMED}, [data-callout="x"]) { border: 2px solid red; }`,
		);
		assert.equal(borrowed("plan", sheet(rule('.callout:not([data-callout="plan"])'))), "");
	});

	it("keeps the group rules around a copy", () => {
		const print: FakeRule = { media: { mediaText: "print" }, cssRules: [rule('.callout[data-callout="plan"]')] };
		const supports: FakeRule = {
			cssText: "@supports (display: grid) { }",
			cssRules: [rule('.callout[data-callout="plan"]')],
		};
		const out = borrowed("plan", sheet(print, supports));
		assert.match(out, /^@media print \{\n\.callout\[data-callout="new-callout-preview"\] \{/);
		assert.match(out, /@supports \(display: grid\) \{\n\.callout\[data-callout="new-callout-preview"\]/);
	});

	it("resolves CSS nesting the way the browser does", () => {
		const out = borrowed(
			"plan",
			sheet(
				rule('.callout[data-callout="plan"]', "border: 1px solid;", [
					rule("& > .callout-title", "color: red;"),
					rule(".callout-content", "padding: 0;"),
				]),
			),
		);
		assert.match(out, /:is\(\.callout\[data-callout="new-callout-preview"\]\) > \.callout-title \{ color: red; \}/);
		assert.match(out, /:is\(\.callout\[data-callout="new-callout-preview"\]\) \.callout-content \{ padding: 0; \}/);
	});

	it("skips a sheet the browser will not open, and `@keyframes`", () => {
		const closed = {
			get cssRules(): never {
				throw new Error("SecurityError");
			},
			media: { mediaText: "" },
		} as unknown as CSSStyleSheet;
		const keyframes: FakeRule = {
			cssText: "@keyframes x { }",
			cssRules: [rule('[data-callout="plan"]')],
			appendRule: () => {},
		};
		assert.equal(borrowed("plan", closed, sheet(keyframes)), "");
	});
});
