/**
 * tests/themeCalloutScan.test.ts — reading a theme's callout claims out of CSS.
 *
 * The scanner's whole value is that it is *right*: a badge saying "your theme
 * also styles this" is trusted the first time and ignored forever after one
 * false positive. So the suites below are mostly about what must **not** be
 * claimed — negations, comments, unrelated attributes — and about the one
 * distinction the whole module is shaped around: enumeration may only read the
 * operators that name **one** callout — `=` and `~=` — while *lookup* may
 * consult every operator, because by then the id is one the registry already
 * holds and there is nothing left to invent.
 *
 * The awkward inputs here are all real. Every id and selector marked "verbatim"
 * was copied out of a theme installed in the development vault.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	mergeScans,
	scanCalloutClaims,
} from "../src/manager/theme/themeCalloutScan";
import {
	claimForId,
	patternMatches,
} from "../src/manager/theme/themeClaimLookup";

const claim = (css: string, id: string) =>
	claimForId(scanCalloutClaims(css), id);

describe("enumeration — which matchers may name a callout", () => {
	it("takes an exact match", () => {
		const c = claim('.callout[data-callout="tip"] { color: red; }', "tip");
		assert.ok(c);
		assert.deepStrictEqual([...c.props], ["color"]);
		assert.strictEqual(c.certain, true);
	});

	it("takes it unquoted and single-quoted too", () => {
		assert.ok(claim(".callout[data-callout=tip] { color: red; }", "tip"));
		assert.ok(claim(".callout[data-callout='tip'] { color: red; }", "tip"));
	});

	it("takes a ~= match, which names exactly one callout too", () => {
		// Obsidian writes only the callout TYPE into data-callout — metadata
		// goes to data-callout-metadata — so the whitespace-separated list this
		// operator matches always has one word in it. Verbatim from ITS Theme,
		// which declares `infobox`, `cards`, `timeline`, `aside` and `kanban`
		// this way and no other way; excluding it hid its five most-used types.
		const scan = scanCalloutClaims(
			".callout.callout[data-callout~=infobox] { color: red; }",
		);
		assert.deepStrictEqual([...scan.byId.keys()], ["infobox"]);
		assert.strictEqual(scan.byId.get("infobox")?.certain, true);
		assert.strictEqual(scan.patterns.length, 0);
	});

	it("normalizes the id to the attribute form Obsidian writes", () => {
		// Verbatim from ITS Theme, case-insensitive flag and all. Keyed as
		// written, this key matches nothing any caller can ask for, and
		// `themeProvidedRows` would mint a row, fail to recognise it next
		// sweep, delete it and mint it again forever.
		const scan = scanCalloutClaims(
			"body:not(.callout-no-metadata) .callout[data-callout~=Metadata i] { color: red; }",
		);
		assert.deepStrictEqual([...scan.byId.keys()], ["metadata"]);
	});

	it("normalizes a pattern's value too, so it can still match", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout^="Col"] { color: red; }',
		);
		assert.ok(claimForId(scan, "col-md"));
	});

	it("never enumerates a family matcher as an id", () => {
		// The reason this module is split in two. ITS Theme writes
		// `[data-callout*=column]` to catch `two-column`, `three-column` and so
		// on; listing it as an id invents a callout nobody has.
		//
		// `~` is deliberately absent from this list. It is the one operator
		// that describes no family: Obsidian puts a single word in
		// `data-callout`, so `~=column` matches `column` and nothing else.
		for (const op of ["*", "$", "|", "^"]) {
			const scan = scanCalloutClaims(
				`.callout[data-callout${op}=column] { display: grid; }`,
			);
			assert.strictEqual(scan.byId.size, 0, op);
		}
	});

	it("does not confuse data-callout-metadata for data-callout", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout-metadata="wide"] { width: 100%; }',
		);
		assert.strictEqual(scan.byId.size, 0);
	});

	it("parses the awkward ids the installed themes really declare", () => {
		// Verbatim: Velocity ships `!`, `$`, `@` and `~`; Primary ships `tl;dr`;
		// Kakano ships `-0.5`; Blue Topaz single-quotes `'icon'`.
		const css = [
			".callout[data-callout=!] { color: red; }",
			".callout[data-callout=$] { color: red; }",
			".callout[data-callout=@] { color: red; }",
			".callout[data-callout=~] { color: red; }",
			".callout[data-callout=tl;dr] { color: red; }",
			".callout[data-callout=-0.5] { color: red; }",
			".callout[data-callout='icon'] { color: red; }",
		].join("\n");
		const ids = [...scanCalloutClaims(css).byId.keys()].sort();
		assert.deepStrictEqual(ids, [
			"!",
			"$",
			"-0.5",
			"@",
			"icon",
			"tl;dr",
			"~",
		]);
	});
});

describe("lookup — which matchers may claim an id you already have", () => {
	it("matches a substring pattern against a real id, hedged", () => {
		// Notation 2 styles all 26 built-ins through `*=` exclusively. Dropping
		// these is a measured false negative: the theme reads as having no
		// opinion about callouts at all.
		const c = claim(
			".callout[data-callout*=note] { color: red; }",
			"note",
		);
		assert.ok(c, "a substring matcher does claim the id it matches");
		assert.strictEqual(c.certain, false);
	});

	it("still does not invent the id the pattern was written for", () => {
		const scan = scanCalloutClaims(
			".callout[data-callout*=column] { display: grid; }",
		);
		assert.strictEqual(scan.byId.size, 0);
		// ...and asking about a callout the user does have still works.
		assert.ok(claimForId(scan, "two-column"));
		assert.strictEqual(claimForId(scan, "note"), undefined);
	});

	it("treats ^= as a prefix, not an id", () => {
		// Verbatim: Kakano's `col-md`, the only `^=` in the whole vault.
		const scan = scanCalloutClaims(
			'.callout[data-callout^="col-md"] { color: red; }',
		);
		assert.strictEqual(scan.byId.size, 0);
		assert.ok(claimForId(scan, "col-md-6"));
		assert.strictEqual(claimForId(scan, "tip"), undefined);
	});

	it("prefers an exact claim over a pattern that also matches", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout*="ote"] { color: red; }\n' +
				'.callout.callout[data-callout="note"] { background: blue; }',
		);
		const c = claimForId(scan, "note");
		assert.ok(c);
		assert.deepStrictEqual([...c.props], ["background"]);
		assert.strictEqual(c.certain, true);
	});

	it("keeps the heaviest of several matching patterns", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout*="not"] { color: red; }\n' +
				'.a.b.c.d .callout[data-callout$="ote"] { background: blue; }',
		);
		assert.strictEqual(claimForId(scan, "note")?.weight[1], 6);
	});

	it("implements each operator the way CSS does", () => {
		// `~` is listed for completeness — the scanner enumerates it now, so
		// nothing reaches this branch through a real scan — but the operator
		// still has to mean what CSS says it means.
		assert.ok(patternMatches("^", "col", "col-md"));
		assert.ok(!patternMatches("^", "md", "col-md"));
		assert.ok(patternMatches("$", "md", "col-md"));
		assert.ok(patternMatches("*", "ol-m", "col-md"));
		assert.ok(patternMatches("~", "col-md", "col-md"));
		assert.ok(!patternMatches("~", "col", "col-md"));
		assert.ok(patternMatches("|", "col", "col-md"));
		assert.ok(patternMatches("|", "col", "col"));
		assert.ok(!patternMatches("|", "col", "column"));
	});
});

describe("a negated claim is not a claim", () => {
	it("ignores [data-callout=x] inside :not()", () => {
		// Verbatim from Blue Topaz's indent guides. The rule deliberately
		// leaves [!kanban] alone, so reporting a conflict on it is backwards.
		const scan = scanCalloutClaims(
			"body.bt-connected-indent-hover .markdown-preview-view:not(.kanban) " +
				'*:not([data-callout="kanban"]) > div { border: 1px; }',
		);
		assert.strictEqual(scan.byId.size, 0);
		assert.strictEqual(scan.patterns.length, 0);
	});

	it("still reads a claim inside :is() or :where()", () => {
		// Those select the callout; they do not exclude it.
		assert.ok(claim('.callout:is([data-callout="x"]) { color: red; }', "x"));
		assert.ok(
			claim('.callout:where([data-callout="x"]) { color: red; }', "x"),
		);
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
		assert.deepStrictEqual(scan.byId.get("a")?.weight, [0, 2, 0]);
		assert.deepStrictEqual(scan.byId.get("b")?.weight, [0, 4, 1]);
	});

	it("does not split a selector list inside :not()", () => {
		// Verbatim from ITS Theme. A plain `.split(",")` tears this in two and
		// weighs a fragment nobody wrote — which happened to land on the right
		// answer here and would not on the next theme.
		const scan = scanCalloutClaims(
			"body:not(.default-callout-quote, .callout-no-quote) " +
				".callout.callout[data-callout=quote] { color: red; }",
		);
		assert.deepStrictEqual(scan.byId.get("quote")?.weight, [0, 4, 1]);
	});

	it("keeps the highest weight seen for one id", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout="x"] { color: red; }\n' +
				'.callout.callout.callout[data-callout="x"] { color: blue; }\n' +
				'.callout[data-callout="x"] { color: green; }',
		);
		assert.deepStrictEqual(scan.byId.get("x")?.weight, [0, 4, 0]);
	});
});

describe("native CSS nesting is read as its flat equivalent", () => {
	/**
	 * The shape that made this necessary, near enough verbatim: Minimal Dracula
	 * puts every callout rule inside `body.theme-light` / `body.theme-dark`,
	 * declares on the callout itself, and nests the parts. The flat-only walker
	 * treated any body holding a `{` as a wrapper, so it descended past BOTH
	 * levels and announced only `.callout-content`, `.callout-title` and `a` —
	 * which name no callout. The theme read as having no callout rules at all.
	 */
	it("reads a rule that declares AND nests, inside a wrapping rule", () => {
		const scan = scanCalloutClaims(`body.theme-light {
			--drx-color-red-2: #f00;
			.callout[data-callout="todo"] {
				background: var(--drx-color-red-2) !important;
				color: white !important;
				.callout-content {
					padding: 0rem 1rem;
					background: var(--drx-color-red-2) !important;
				}
				a { color: white !important; }
			}
		}`);
		const c = scan.byId.get("todo");
		assert.ok(c, "the parent rule's own claim is what used to be lost");
		assert.deepStrictEqual([...c.props].sort(), [
			"background",
			"color",
			"padding",
		]);
		assert.deepStrictEqual([...c.important].sort(), ["background", "color"]);
		// `body.theme-light .callout[data-callout="todo"] .callout-content`:
		// three classes plus the attribute, and `body` for the element column.
		// The nested rule's weight is the whole point — `studioWeightFor` sizes
		// the plugin's own escalation off exactly this number.
		assert.deepStrictEqual(c.weight, [0, 4, 1]);
	});

	it("resolves & against the parent, including in a compound", () => {
		const scan = scanCalloutClaims(
			'.callout[data-callout="recite"] { & .callout-title { color: red; } }',
		);
		assert.deepStrictEqual(scan.byId.get("recite")?.weight, [0, 3, 0]);
		const compound = scanCalloutClaims(
			'.callout[data-callout="recite"] { &.is-collapsed { color: red; } }',
		);
		assert.deepStrictEqual(compound.byId.get("recite")?.weight, [0, 3, 0]);
	});

	it("treats a nested selector with no & as a descendant", () => {
		// Verbatim from Underwater's `[!box]`, which nests `& > .callout-title`;
		// the bare form is what Minimal Dracula writes.
		const scan = scanCalloutClaims(
			'.callout[data-callout="box"] { & > .callout-title { display: none; } }',
		);
		assert.deepStrictEqual(scan.byId.get("box")?.weight, [0, 3, 0]);
		const bare = scanCalloutClaims(
			'.callout[data-callout="box"] { a { color: red; } }',
		);
		assert.deepStrictEqual(bare.byId.get("box")?.weight, [0, 2, 1]);
	});

	it("wraps a parent selector LIST in :is(), as the spec does", () => {
		// Substituting `.a, .b` into `& .t` raw would produce `.a, .b .t` —
		// two selectors where the theme wrote one, one of them nobody's.
		const scan = scanCalloutClaims(
			'[data-callout="a"], [data-callout="b"] { & .t { color: red; } }',
		);
		assert.deepStrictEqual([...scan.byId.keys()].sort(), ["a", "b"]);
		// :is() takes its most specific argument, so this is one attribute
		// plus `.t` — not two attributes plus `.t`.
		assert.deepStrictEqual(scan.byId.get("a")?.weight, [0, 2, 0]);
	});

	it("keeps declarations that follow a nested rule", () => {
		// CSS allows declarations on either side of a nested rule, so the split
		// cannot simply stop at the first `{`.
		const c = claim(
			'[data-callout="x"] { a { color: red; } margin: 0; }',
			"x",
		);
		assert.ok(c?.props.has("margin"));
	});

	it("goes several levels deep", () => {
		const scan = scanCalloutClaims(
			'.a { .b { [data-callout="deep"] { color: red; .c { background: blue; } } } }',
		);
		const c = scan.byId.get("deep");
		assert.deepStrictEqual([...(c?.props ?? [])].sort(), [
			"background",
			"color",
		]);
		assert.deepStrictEqual(c?.weight, [0, 4, 0]);
	});

	it("hands a nested at-rule's declarations to the rule around it", () => {
		// `[!x] { @media print { … } }` means `@media print { [!x] { … } }`.
		const c = claim(
			'[data-callout="x"] { @media print { color: red !important; } }',
			"x",
		);
		assert.deepStrictEqual([...(c?.important ?? [])], ["color"]);
		assert.deepStrictEqual(c?.weight, [0, 1, 0]);
	});

	it("still claims an id whose rule holds nothing but a nested rule", () => {
		// An empty body already named the id; a body holding only children is
		// the same statement.
		assert.ok(claim('[data-callout="x"] { .child { color: red; } }', "x"));
	});

	it("invents nothing from a wrapper that names no callout", () => {
		const scan = scanCalloutClaims(
			".wrapper { .other { color: red; } }\n" +
				"@keyframes spin { from { transform: rotate(0deg); } }\n" +
				"@font-face { font-family: x; src: url(a.woff); }",
		);
		assert.strictEqual(scan.byId.size, 0);
		assert.strictEqual(scan.patterns.length, 0);
	});

	it("keeps :not() an anti-claim through the nesting", () => {
		const scan = scanCalloutClaims(
			'.callout:not([data-callout="note"]) { & .t { color: red; } }',
		);
		assert.strictEqual(scan.byId.size, 0);
	});

	it("does not mistake a semicolon inside a value or an id for a boundary", () => {
		// `tl;dr` is verbatim from Primary. The `;` is inside brackets, so it
		// must not be read as the end of a declaration run.
		assert.ok(claim('[data-callout=tl;dr] { color: red; a { color: blue; } }', "tl;dr"));
		const c = claim('[data-callout="x"] { content: ";"; a { color: red; } }', "x");
		assert.ok(c?.props.has("content"));
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
		assert.deepStrictEqual(c?.weight, [0, 4, 0]);
		assert.deepStrictEqual([...(c?.props ?? [])].sort(), [
			"background",
			"color",
		]);
		assert.deepStrictEqual([...(c?.important ?? [])], ["background"]);
	});

	it("merges pattern claims by operator and value", () => {
		const merged = mergeScans([
			scanCalloutClaims('.callout[data-callout*="ote"] { color: red; }'),
			scanCalloutClaims(
				'.a.b .callout[data-callout*="ote"] { background: blue; }',
			),
		]);
		assert.strictEqual(merged.patterns.length, 1);
		assert.deepStrictEqual(merged.patterns[0]?.claim.weight, [0, 4, 0]);
	});

	it("is empty for an empty input, and for a sheet with no callouts", () => {
		assert.strictEqual(mergeScans([]).byId.size, 0);
		assert.strictEqual(scanCalloutClaims("body { margin: 0; }").byId.size, 0);
		assert.strictEqual(scanCalloutClaims("").byId.size, 0);
	});
});
