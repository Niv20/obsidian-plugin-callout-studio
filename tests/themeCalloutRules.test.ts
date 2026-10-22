/**
 * tests/themeCalloutRules.test.ts — which of a theme's rules the switch that
 * turns the theme's callout styling off takes away.
 *
 * Every selector here is one an installed theme writes (the theme is named),
 * read as the browser serializes it. Two promises are pinned: a rule that
 * styles callouts loses exactly the selectors that reach one, and nothing
 * outside a callout changes — not even the weight of a rule that keeps
 * matching there.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	isCalloutVariable,
	reachesCallout,
	withoutCalloutBranches,
} from "../src/manager/theme/themeCalloutRules";
import { specificityOf } from "../src/utils/cssSpecificity";
import { splitSelectorList } from "../src/utils/selectorText";

describe("whether a selector reaches a callout", () => {
	it("reads every box of Obsidian's callout DOM, and Live Preview's widget", () => {
		for (const selector of [
			".callout",
			".markdown-rendered .callout-title",
			".callout-title-inner img",
			".is-phone .callout-icon .svg-icon",
			".callout-content p",
			".callout-fold.is-collapsed",
			".cm-callout .edit-block-button",
			'[data-callout="note"]',
			'[data-callout-metadata~="wide"]',
			"[data-callout-fold]",
		]) {
			assert.ok(reachesCallout(selector), selector);
		}
	});

	it("reads the `> [!type]` line while it is edited as text", () => {
		// Shimmering Focus, which core never styles.
		assert.ok(reachesCallout(".HyperMD-callout.HyperMD-callout.HyperMD-callout.HyperMD-callout"));
		assert.ok(reachesCallout(".cm-hmd-callout.cm-hmd-callout.cm-hmd-callout"));
	});

	it("reads the callout classes matched by their text", () => {
		assert.ok(reachesCallout('div[class*="callout"] p'));
	});

	it("never reads a negation, which leaves callouts alone", () => {
		// Blue Topaz's indent guides, Cosmical's heading counters.
		assert.ok(!reachesCallout('.markdown-preview-view:not(.kanban) *:not([data-callout="kanban"]) > div > ul'));
		assert.ok(!reachesCallout("blockquote:not(.callout)"));
		assert.ok(
			!reachesCallout(
				".header-counters :not(.callout,.HyperMD-codeblock,pre,code,.frontmatter,.cm-hmd-frontmatter) :is(h2,.HyperMD-header-2)",
			),
		);
	});

	it("never reads a theme option, or another plugin's callout-named class", () => {
		// ITS, Velocity (List Callouts, Todoist), Cosmical, Border.
		for (const selector of [
			"body:not(.default-callout-quote, .callout-no-quote)",
			"body:not(.disable-callout-styling)",
			".lc-list-callout>.list-bullet",
			".todoist-callout .callout-header",
			".wider-callouts",
			".callout-style-1.theme-light",
		]) {
			assert.ok(!reachesCallout(selector), selector);
		}
	});
});

describe("what is left of a rule's selectors", () => {
	it("takes a rule whose every selector reaches a callout", () => {
		for (const selector of [
			"body:not(.default-callout-quote, .callout-no-quote) .callout.callout[data-callout=quote]", // ITS
			"body.callout-on .callout", // GitHub Theme
			".callouts-outlined .callout .callout-title", // Minimal
			'.anp-callout-sleek .callout:not([data-callout-metadata*="sleek"]) > .callout-title', // AnuPpuccin
			"div:has(> .callout)",
		]) {
			assert.strictEqual(withoutCalloutBranches(selector), null, selector);
		}
	});

	it("keeps the selectors of a list that do not reach one", () => {
		// Bolt, Brainhack, Border.
		assert.strictEqual(
			withoutCalloutBranches(".callout .callout, .callout blockquote, blockquote blockquote, blockquote .callout"),
			"blockquote blockquote",
		);
		assert.strictEqual(withoutCalloutBranches(".callout-content, .blockquote"), ".blockquote");
		assert.strictEqual(
			withoutCalloutBranches(
				'.theme-light .callout:is([data-callout-metadata*="style-1"], [data-callout*=style-1]), .callout-style-1.theme-light',
			),
			".callout-style-1.theme-light",
		);
	});

	it("leaves a rule that reaches no callout exactly as written", () => {
		const selector = '.markdown-preview-view:not(.kanban) *:not([data-callout="kanban"]) > div > ul';
		assert.strictEqual(withoutCalloutBranches(selector), selector);
		assert.strictEqual(withoutCalloutBranches(".markdown-rendered p"), ".markdown-rendered p");
	});

	it("switches a callout alternative off inside :is() and :has(), keeping the rest", () => {
		// Dune, Iridium, Blue Topaz (Thino), and a :has() list.
		assert.strictEqual(
			withoutCalloutBranches(".fontmod-1 .markdown-preview-view :is(p, li, .callout-title-inner)"),
			".fontmod-1 .markdown-preview-view :is(p, li, :not(*, .callout-title-inner))",
		);
		assert.strictEqual(
			withoutCalloutBranches(".markdown-rendered :is(blockquote, hr, .callout, .internal-query) + :is(h1, h2)"),
			".markdown-rendered :is(blockquote, hr, :not(*, .callout), .internal-query) + :is(h1, h2)",
		);
		assert.strictEqual(
			withoutCalloutBranches(".wrap > .content:has(:is(.callout, img))"),
			".wrap > .content:has(:is(:not(*, .callout), img))",
		);
		assert.strictEqual(withoutCalloutBranches("div:has(> .callout, > table)"), "div:has(:not(*, .callout), > table)");
	});

	it("never changes the weight of what keeps matching outside a callout", () => {
		// Dropping `.callout-title-inner` outright would make Dune's paragraph
		// rule lighter, and a lighter rule can lose a tie it used to win.
		for (const selector of [
			".fontmod-1 .markdown-preview-view :is(p, li, .callout-title-inner)",
			":is(.tag-mcllist-card, .tag-mcllist-card .callout-content) > ul",
			"div:has(> .callout, > table)",
			"body.active-line-block .view-content>.markdown-source-view .cm-line.cm-active:is(.HyperMD-callout,.HyperMD-codeblock-bg,.HyperMD-quote)",
		]) {
			const narrowed = withoutCalloutBranches(selector);
			assert.ok(narrowed !== null && narrowed !== selector, selector);
			assert.deepStrictEqual(specificityOf(narrowed), specificityOf(selector), selector);
		}
	});

	it("takes a branch whose :is() has nothing left to offer", () => {
		assert.strictEqual(withoutCalloutBranches(":is(.callout, .callout-title) p, h1"), "h1");
	});

	it("reads a nested rule's own text", () => {
		assert.strictEqual(withoutCalloutBranches("& > .callout-title"), null);
		assert.strictEqual(withoutCalloutBranches("&:hover"), "&:hover");
	});

	it("is stable: what it leaves, read again, stays", () => {
		for (const selector of [
			".fontmod-1 .markdown-preview-view :is(p, li, .callout-title-inner)",
			"div:has(> .callout, > table)",
			".callout-content, .blockquote",
		]) {
			const once = withoutCalloutBranches(selector);
			assert.ok(once !== null);
			assert.strictEqual(withoutCalloutBranches(once), once);
			for (const branch of splitSelectorList(once)) assert.ok(!reachesCallout(branch), branch);
		}
	});

	it("does not let an escape hide a callout class", () => {
		assert.strictEqual(withoutCalloutBranches(".c\\61llout"), null);
	});
});

describe("which custom properties go", () => {
	it("is the callout family, whoever declares it", () => {
		for (const name of ["--callout-radius", "--callout-default", "--callout-color", "--callout-title-weight"]) {
			assert.ok(isCalloutVariable(name), name);
		}
		for (const name of ["--callouts-gap", "--anp-callout-radius", "--color-blue-rgb"]) {
			assert.ok(!isCalloutVariable(name), name);
		}
	});
});
