/**
 * tests/themeCalloutScan.test.ts — reading a theme's callout claims out of CSS.
 *
 * The scanner's whole value is that it is *right*: a badge saying "your theme
 * also styles this" is trusted the first time and ignored forever after one
 * false positive. So the suites below are mostly about what must **not** be
 * claimed — substring matchers, comments, unrelated attributes — with the
 * specificity arithmetic pinned separately, since that number is what decides
 * whether the report says the theme is winning.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	claimForId,
	classCountOf,
	mergeScans,
	scanCalloutClaims,
} from "../src/manager/theme/themeCalloutScan";

const claim = (css: string, id: string) =>
	claimForId(scanCalloutClaims(css), id);

describe("which attribute matchers count as a claim", () => {
	it("takes an exact match", () => {
		const c = claim('.callout[data-callout="tip"] { color: red; }', "tip");
		assert.ok(c);
		assert.deepStrictEqual([...c.props], ["color"]);
	});

	it("takes it unquoted and single-quoted too", () => {
		assert.ok(claim(".callout[data-callout=tip] { color: red; }", "tip"));
		assert.ok(claim(".callout[data-callout='tip'] { color: red; }", "tip"));
	});

	it("ignores a substring matcher", () => {
		// The reason this function exists in this shape. ITS Theme writes
		// `[data-callout*=column]` to catch `two-column`, `three-column` and so
		// on; reading it as an id invents a callout nobody has, and the badge
		// would appear on a vault with no conflict at all.
		const scan = scanCalloutClaims(
			".callout[data-callout*=column] { display: grid; }",
		);
		assert.strictEqual(scan.byId.size, 0);
		assert.strictEqual(scan.prefixes.size, 0);
	});

	it("ignores word and suffix matchers as well", () => {
		for (const op of ["~", "$", "|"]) {
			const scan = scanCalloutClaims(
				`.callout[data-callout${op}=cards] { color: red; }`,
			);
			assert.strictEqual(scan.byId.size, 0, op);
		}
	});

	it("treats ^= as a prefix, not an id", () => {
		// Callout Manager's parser pushes the `^=` value into its id list, which
		// surfaces a callout named e.g. "note-" that no one ever wrote. It is a
		// pattern, so it has to be matched with startsWith.
		const scan = scanCalloutClaims(
			'.callout[data-callout^="note-"] { color: red; }',
		);
		assert.strictEqual(scan.byId.size, 0);
		assert.deepStrictEqual([...scan.prefixes.keys()], ["note-"]);
		assert.ok(claimForId(scan, "note-blue"));
		assert.strictEqual(claimForId(scan, "tip"), undefined);
	});

	it("prefers an exact claim over a prefix that also matches", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout^="no"] { color: red; }\n' +
				'.callout.callout[data-callout="note"] { background: blue; }',
		);
		const c = claimForId(scan, "note");
		assert.ok(c);
		assert.deepStrictEqual([...c.props], ["background"]);
	});

	it("does not confuse data-callout-metadata for data-callout", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout-metadata="wide"] { width: 100%; }',
		);
		assert.strictEqual(scan.byId.size, 0);
	});
});

describe("what the scanner reads out of a rule", () => {
	it("collects declared property names, lower-cased", () => {
		const c = claim(
			'.callout[data-callout="x"] { --Callout-Color: red; BACKGROUND: blue; }',
			"x",
		);
		assert.deepStrictEqual([...(c?.props ?? [])].sort(), [
			"--callout-color",
			"background",
		]);
	});

	it("flags the properties a theme marked !important", () => {
		// The one case force genuinely cannot beat, so the report has to be able
		// to say so rather than let the user discover it by trying.
		const c = claim(
			'.callout[data-callout="x"] { color: red !important; background: blue; }',
			"x",
		);
		assert.deepStrictEqual([...(c?.important ?? [])], ["color"]);
		assert.ok(c?.props.has("background"));
	});

	it("ignores claims that only appear inside a comment", () => {
		const scan = scanCalloutClaims(
			'/* .callout[data-callout="ghost"] { color: red; } */\n' +
				'.callout[data-callout="real"] { color: blue; }',
		);
		assert.deepStrictEqual([...scan.byId.keys()], ["real"]);
	});

	it("still sees a claim wrapped in an at-rule", () => {
		const c = claim(
			'@media print { .callout[data-callout="x"] { color: red; } }',
			"x",
		);
		assert.ok(c, "a claim inside @media is still a claim");
	});

	it("scores each part of a selector list on its own", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout="a"],\n' +
				'body .callout.callout.callout[data-callout="b"] { color: red; }',
		);
		assert.strictEqual(scan.byId.get("a")?.maxClasses, 2);
		assert.strictEqual(scan.byId.get("b")?.maxClasses, 4);
	});

	it("keeps the highest weight seen for one id", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout="x"] { color: red; }\n' +
				'.callout.callout.callout[data-callout="x"] { color: blue; }\n' +
				'.callout[data-callout="x"] { color: green; }',
		);
		assert.strictEqual(scan.byId.get("x")?.maxClasses, 4);
	});
});

describe("classCountOf — the number that decides who wins", () => {
	it("counts classes, attributes and pseudo-classes alike", () => {
		assert.strictEqual(classCountOf(".callout[data-callout=x]"), 2);
		assert.strictEqual(classCountOf(".a.b.c"), 3);
		assert.strictEqual(classCountOf("li:first-child"), 1);
	});

	it("does not count elements or pseudo-elements", () => {
		// They are the `c` component, which is only compared after `b`.
		assert.strictEqual(classCountOf("body div .callout"), 1);
		assert.strictEqual(classCountOf(".callout::before"), 1);
	});

	it("gives :where() a weight of zero, contents included", () => {
		assert.strictEqual(classCountOf(".callout:where(.a.b.c)"), 1);
	});

	it("scores ITS Theme's heaviest real selector above a plain rule", () => {
		// Verbatim from the installed theme. This is the shape that made the
		// old "we always win" claim false.
		const its =
			"body:not(.default-callout-quote, .callout-no-quote) " +
			".callout.callout[data-callout=quote]";
		assert.ok(
			classCountOf(its) > classCountOf(".callout[data-callout=quote]"),
		);
	});
});

describe("mergeScans — theme plus enabled snippets", () => {
	it("keeps the strongest weight and the union of the properties", () => {
		const a = scanCalloutClaims('.callout[data-callout="x"] { color: red; }');
		const b = scanCalloutClaims(
			'.callout.callout.callout[data-callout="x"] { background: blue !important; }',
		);
		const merged = mergeScans([a, b]);
		const c = merged.byId.get("x");
		assert.strictEqual(c?.maxClasses, 4);
		assert.deepStrictEqual([...(c?.props ?? [])].sort(), [
			"background",
			"color",
		]);
		assert.deepStrictEqual([...(c?.important ?? [])], ["background"]);
	});

	it("is empty for an empty input, and for a sheet with no callouts", () => {
		assert.strictEqual(mergeScans([]).byId.size, 0);
		assert.strictEqual(scanCalloutClaims("body { margin: 0; }").byId.size, 0);
		assert.strictEqual(scanCalloutClaims("").byId.size, 0);
	});
});
