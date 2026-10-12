/**
 * tests/themeMetadataScan.test.ts — which metadata words a stylesheet reacts
 * to, and where each may stand.
 *
 * Every fixture is a selector shape lifted from a theme installed in the
 * maintainer's test vault (2026-10-12): ITS Theme, flexcyon, Blue Topaz,
 * MagicUser, Sanctum, Willemstad, Faded and AnuPpuccin together use every
 * attribute operator there is, and the operator is what decides whether
 * `[!note|pink wide]` and `[!note|pink|wide]` both work for that theme's
 * `wide` — the question the `|` suggestions have to answer before offering it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	scanMetadataWords,
	wordAppliesTo,
	type ThemeMetadataWord,
} from "../src/manager/theme/themeMetadataScan";

const byWord = (css: string): Map<string, ThemeMetadataWord> =>
	new Map(scanMetadataWords(css).map((w) => [w.word, w]));

describe("scanMetadataWords — the operator decides the placement", () => {
	it("~= (ITS Theme) needs spaces", () => {
		const words = byWord(
			".callout.callout.callout:is([data-callout-metadata~=bg-c-red], [data-callout-metadata~=c-red]) { color: red }",
		);
		assert.strictEqual(words.get("c-red")?.placement, "spaced");
		assert.strictEqual(words.get("bg-c-red")?.placement, "spaced");
		assert.strictEqual(words.get("c-red")?.guards, null);
	});

	it("*= (flexcyon, Blue Topaz) works anywhere", () => {
		const words = byWord('.callout[data-callout-metadata*="all-red"] { --x: 1 }');
		assert.strictEqual(words.get("all-red")?.placement, "anywhere");
	});

	it("^= must come first, $= must come last (Blue Topaz, Faded)", () => {
		const words = byWord(
			".callout.callout:is([data-callout-metadata^='noicon']) { a: b }\n" +
				'div[data-callout-metadata$="large"] { a: b }',
		);
		assert.strictEqual(words.get("noicon")?.placement, "first");
		assert.strictEqual(words.get("large")?.placement, "last");
	});

	it("= and |= mean the word must stand alone (Ebullientworks, Faded)", () => {
		const words = byWord(
			".callout[data-callout-metadata=flex] { a: b }\n" +
				'.markdown-reading-view div[data-callout-metadata|="left"] { a: b }',
		);
		assert.strictEqual(words.get("flex")?.placement, "alone");
		assert.strictEqual(words.get("left")?.placement, "alone");
	});

	it("a word matched several ways takes the most forgiving", () => {
		const words = byWord(
			".callout[data-callout-metadata=left] { a: b }\n" +
				'.callout[data-callout-metadata*="left"] { a: b }',
		);
		assert.strictEqual(words.get("left")?.placement, "anywhere");
	});
});

describe("scanMetadataWords — words tied to one callout", () => {
	it("keeps a callout condition from the same compound (ITS kith, MagicUser)", () => {
		const words = byWord(
			".callout[data-callout=kith][data-callout-metadata=friend] { a: b }\n" +
				'.callout[data-callout^="h1-"][data-callout-metadata="left"] { a: b }',
		);
		const friend = words.get("friend");
		assert.deepStrictEqual(friend?.guards, [{ op: "", value: "kith" }]);
		assert.ok(friend && wordAppliesTo(friend, "kith"));
		assert.ok(friend && !wordAppliesTo(friend, "note"));
		const left = words.get("left");
		assert.ok(left && wordAppliesTo(left, "h1-title"));
		assert.ok(left && !wordAppliesTo(left, "note"));
	});

	it("ignores a condition on an ancestor (Willemstad's columns)", () => {
		const words = byWord(
			'.callout[data-callout="columns"] > .callout-content > .callout[data-callout-metadata="w1"] { a: b }',
		);
		assert.strictEqual(words.get("w1")?.guards, null);
	});

	it("a word any rule reaches unguarded is unguarded", () => {
		const words = byWord(
			".callout[data-callout=grid][data-callout-metadata~=left] { a: b }\n" +
				".callout[data-callout-metadata~=left] { a: b }",
		);
		assert.strictEqual(words.get("left")?.guards, null);
	});

	it("an alternative inside :is() is no guard (Blue Topaz's indent)", () => {
		const words = byWord(
			'.callout.callout:is([data-callout-metadata*="indent"], [data-callout*=indent]) .callout-content p { a: b }',
		);
		assert.strictEqual(words.get("indent")?.guards, null);
	});

	it("a callout named only inside :not() is no guard", () => {
		const words = byWord(
			'.callout:not([data-callout="note"])[data-callout-metadata~="wide"] { a: b }',
		);
		assert.strictEqual(words.get("wide")?.guards, null);
	});
});

describe("scanMetadataWords — what is not a word", () => {
	it("drops family fragments, empties and comments", () => {
		const words = byWord(
			'/* .callout[data-callout-metadata~="ghost"] {} */\n' +
				'.callout:is([data-callout-metadata*="bg-"], [data-callout-metadata=""]) { a: b }\n' +
				'.callout[data-callout-metadata*="-large"] { a: b }',
		);
		assert.deepStrictEqual([...words.keys()], []);
	});

	it("keeps opt-outs named inside :not() (AnuPpuccin)", () => {
		const words = byWord(
			'.callout:not([data-callout-metadata*="anp-sleek"]) { a: b }',
		);
		assert.strictEqual(words.get("anp-sleek")?.placement, "anywhere");
	});

	it("keeps the spelling exactly — theme matching is case-sensitive", () => {
		const words = byWord('.callout[data-callout-metadata~="Wide"] { a: b }');
		assert.ok(words.has("Wide"));
		assert.ok(!words.has("wide"));
	});

	it("lists words in the order the sheet first names them", () => {
		const order = scanMetadataWords(
			".callout[data-callout-metadata~=b] { a: b }\n" +
				".callout[data-callout-metadata~=a] { a: b }\n" +
				".callout[data-callout-metadata~=b] { c: d }",
		).map((w) => w.word);
		assert.deepStrictEqual(order, ["b", "a"]);
	});

	it("reads nested CSS as its flat equivalent", () => {
		const words = byWord(
			'.callout { &[data-callout-metadata~="wide"] { width: 100% } }',
		);
		assert.strictEqual(words.get("wide")?.placement, "spaced");
	});
});
