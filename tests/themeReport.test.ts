/**
 * tests/themeReport.test.ts — the generated theme-compatibility worksheet.
 *
 * The document's whole claim is that it says what a tester will actually see,
 * for 257 themes nobody is going to check by hand. Two failure modes matter,
 * and neither is loud:
 *
 * - **A wrong fact.** One row that lists a callout type the settings tab does
 *   not show, and a tester stops trusting the other 256. So the id column is
 *   asserted against the plugin's own scanner rules — `:not()` exclusions,
 *   comments, `~=` versus `*=` — rather than against a convenient
 *   approximation.
 * - **A wrong order.** 257 rows are navigated by scrolling to a name, and ten
 *   of the dev vault's themes begin with a lowercase letter while three carry
 *   diacritics or a typographic apostrophe. A plain `sort()` puts all of those
 *   in a tail after Z, where nobody looks.
 *
 * Every CSS fragment below marked "verbatim" was copied out of a theme
 * installed in the development vault.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	analyzeTheme,
	BUILT_IN_ATTR_IDS,
	sortThemeReports,
	type ThemeInput,
} from "../src/manager/theme/themeReport";
import { renderThemeReport } from "../src/manager/theme/themeReportMarkdown";

const theme = (css: string, name = "Test Theme"): ThemeInput => ({
	name,
	version: "1.0.0",
	css,
});

const report = (css: string) => analyzeTheme(theme(css));

describe("alphabetical ordering", () => {
	it("ignores case, so a lowercase name is not exiled to the end", () => {
		const rows = sortThemeReports([
			{ name: "Zenburn" },
			{ name: "iA Writer" },
			{ name: "Atom" },
			{ name: "sQdthOne" },
			{ name: "flexcyon" },
		]);
		assert.deepStrictEqual(
			rows.map((r) => r.name),
			["Atom", "flexcyon", "iA Writer", "sQdthOne", "Zenburn"],
		);
	});

	it("ignores diacritics, so Rosé Pine files among the Rose names", () => {
		// `é` compares equal to `e`, so these interleave on the *next*
		// character — "Rosé Pine" before "Rose Red" — rather than the accented
		// pair being shunted past every unaccented name.
		const rows = sortThemeReports([
			{ name: "Rose Red" },
			{ name: "Royal Velvet" },
			{ name: "Rosé Pine" },
			{ name: "Rosé Pine Moon" },
		]);
		assert.deepStrictEqual(
			rows.map((r) => r.name),
			["Rosé Pine", "Rosé Pine Moon", "Rose Red", "Royal Velvet"],
		);
	});

	it("sorts a typographic apostrophe as part of the word", () => {
		const rows = sortThemeReports([
			{ name: "Origami" },
			{ name: "Olivier’s Theme" },
			{ name: "Oxygen" },
		]);
		assert.deepStrictEqual(
			rows.map((r) => r.name),
			["Olivier’s Theme", "Origami", "Oxygen"],
		);
	});

	it("is total, so two runs cannot disagree", () => {
		// A comparator that returns 0 for two distinct names leaves their order
		// up to the engine's sort stability, and the document is regenerated
		// often enough that a wandering row would show up as a spurious diff.
		const rows = [{ name: "Aura" }, { name: "aura" }, { name: "AURA" }];
		const once = sortThemeReports(rows).map((r) => r.name);
		const twice = sortThemeReports(sortThemeReports(rows)).map((r) => r.name);
		assert.deepStrictEqual(once, twice);
		assert.deepStrictEqual(once, ["AURA", "Aura", "aura"]);
	});

	it("orders the rendered table, not just the array", () => {
		const md = renderThemeReport(
			[report(""), report("")].map((r, i) => ({
				...r,
				name: i === 0 ? "Zen" : "Abyssal",
			})),
			{ activeTheme: null, themesPath: "/themes" },
		);
		assert.ok(md.indexOf("| Abyssal ") < md.indexOf("| Zen "));
	});
});

describe("what the theme adds", () => {
	it("lists ids the theme names and Obsidian does not ship", () => {
		const r = report(
			'.callout[data-callout="recite"] { color: red; }\n' +
				'.callout[data-callout="note"] { color: blue; }',
		);
		assert.deepStrictEqual(r.addedIds, ["recite"]);
		assert.strictEqual(r.builtInsRestyled, 1);
		assert.strictEqual(r.involvement, "per-id");
	});

	it("counts an alias of a built-in as a built-in, not as a new type", () => {
		// `tldr` and `summary` are Obsidian's own spellings of `abstract`. A
		// theme repainting them has added nothing.
		assert.ok(BUILT_IN_ATTR_IDS.has("tldr"));
		const r = report('.callout[data-callout="tldr"] { color: red; }');
		assert.deepStrictEqual(r.addedIds, []);
		assert.strictEqual(r.builtInsRestyled, 1);
	});

	it("lists a ~= type, because the plugin will list it too", () => {
		// Verbatim from ITS Theme, which declares five of its most-used types
		// this way and no other way.
		const r = report(".callout.callout[data-callout~=infobox] { color: red; }");
		assert.deepStrictEqual(r.addedIds, ["infobox"]);
		assert.deepStrictEqual(r.fuzzy, []);
	});

	it("does not list a *= family, and says why in the checks", () => {
		// Verbatim from ITS Theme. Listing `column` would invent a callout type
		// nobody has; saying nothing at all would leave a tester wondering why
		// their `two-column` callout is being restyled.
		const r = report(".callout[data-callout*=column] { display: grid; }");
		assert.deepStrictEqual(r.addedIds, []);
		assert.deepStrictEqual(r.fuzzy, ["*=column"]);
		assert.ok(r.checks.some((c) => c.includes("[data-callout*=column]")));
	});

	it("drops a :not() exclusion list, which is an anti-claim", () => {
		// Verbatim shape from ITS Theme's `.callout-bordered` rule, which names
		// nine of its own ids purely to exempt them. Counting those would put
		// nine phantom types on the row.
		const r = report(
			".callout-bordered .callout:not([data-callout=aside], [data-callout=blank]) { border: 1px; }",
		);
		assert.deepStrictEqual(r.addedIds, []);
	});

	it("ignores everything inside a CSS comment", () => {
		// 117 of the 257 themes in the dev vault embed a Style Settings
		// `@settings` YAML block in a comment, and its prose parses as CSS.
		const r = report(
			'/* .callout[data-callout="ghost"] { color: red !important; } */\n' +
				".callout { padding: 8px; }",
		);
		assert.deepStrictEqual(r.addedIds, []);
		assert.strictEqual(r.importantCount, 0);
		assert.strictEqual(r.involvement, "generic");
	});
});

describe("how far a theme reaches", () => {
	it("separates no callout CSS from generic callout CSS", () => {
		assert.strictEqual(report("body { color: red; }").involvement, "none");
		assert.strictEqual(report(".callout { padding: 4px; }").involvement, "generic");
	});

	it("reports the icon mechanism, strongest first", () => {
		assert.strictEqual(
			report('.callout[data-callout=x] { --callout-icon: lucide-star; }').icons,
			"var",
		);
		assert.strictEqual(
			report(".callout-icon { -webkit-mask-image: url(a.svg); }").icons,
			"mask",
		);
		// Hidden beats both: whatever the theme set underneath, nothing shows.
		assert.strictEqual(
			report(
				".callout-icon { -webkit-mask-image: url(a.svg); display: none; }",
			).icons,
			"hidden",
		);
	});

	it("calls a grid layout but not an icon's display:none", () => {
		assert.deepStrictEqual(
			report('.callout[data-callout="2"] { display: grid; }').layout,
			["display"],
		);
		assert.deepStrictEqual(report(".callout-icon { display: none; }").layout, []);
	});

	it("counts !important and the heaviest selector", () => {
		const r = report(
			".a.b.c .callout[data-callout=x] { color: red !important; background: blue !important; }",
		);
		assert.strictEqual(r.importantCount, 2);
		// `.a .b .c .callout` plus the attribute selector: CSS counts an
		// attribute in the same column as a class, which is exactly why the
		// plugin's own escalation is measured in "class units".
		assert.strictEqual(r.maxClasses, 5);
	});

	it("counts a :not() chain, which carries real weight", () => {
		// Verbatim shape from Elegance and Faded, the two heaviest selectors in
		// the vault. Blanking the negations before measuring — which the
		// *claim* reader legitimately does to the same string — scored these
		// four units too low, and the whole point of the column is to say how
		// hard the plugin has to push.
		const r = report(
			"body:not(.table-100):not(.table-max):not(.table-wide) .callout { color: red; }",
		);
		// One per negation plus `.callout`; `body` is an element, so column c.
		assert.strictEqual(r.maxClasses, 4);
	});

	it("takes only the most specific argument of :is() and :has()", () => {
		// The spec's rule, and the reason `utils/cssSpecificity.ts` exists: a
		// regex counting every class token inside these over-states 38 of this
		// vault's themes, and an over-stated number is the one that makes the
		// plugin claim it is losing a contest it already wins.
		assert.strictEqual(report(".callout:is(.a.b.c, .d) { color: red; }").maxClasses, 4);
		assert.strictEqual(report(".callout:where(.a.b.c) { color: red; }").maxClasses, 1);
		assert.strictEqual(report(".callout:has(.a.b) { color: red; }").maxClasses, 3);
	});

	it("flags a theme whose callouts change with their content", () => {
		// 19 themes use `:has()` on callouts. These rules fire on what is
		// *inside* the callout, so a tester writing an empty example callout
		// will not reproduce what their real note does — the one finding no
		// id-keyed column can carry.
		const r = report(".callout:has(.dataview) .callout-content { padding: 0; }");
		assert.strictEqual(r.contentSensitive, true);
		assert.ok(r.checks.some((c) => c.includes(":has()")));
	});

	it("does not flag a theme without :has()", () => {
		assert.strictEqual(report(".callout { padding: 4px; }").contentSensitive, false);
	});

	it("names the Style Settings switch a tester has to check first", () => {
		// Verbatim from Prism, one of six themes shipping an off switch for
		// their own callout styling — the most useful single fact on its row.
		const r = report(
			"/* @settings\nname: Prism\n*/\n" +
				"body:not(.pt-disable-callout-styling) .callout { border: 0; }",
		);
		assert.deepStrictEqual(r.styleSettings, ["pt-disable-callout-styling"]);
		assert.ok(r.checks.some((c) => c.includes("pt-disable-callout-styling")));
	});

	it("says nothing about Style Settings when the theme has none", () => {
		const r = report("body.callout-on .callout { border: 0; }");
		assert.deepStrictEqual(r.styleSettings, []);
	});
});

describe("the checks are entailed by the columns", () => {
	it("tells a tester to expect nothing from a theme with no callout CSS", () => {
		const r = report("body { color: red; }");
		assert.strictEqual(r.checks.length, 1);
		assert.ok(r.checks[0]?.includes("no callout CSS"));
	});

	it("warns that layout survives being taken over", () => {
		const r = report('.callout[data-callout="cards"] { display: grid; }');
		assert.ok(r.checks.some((c) => c.includes("does not undo layout")));
	});

	it("warns that a mask outlives an icon Callout Studio sets", () => {
		const r = report(
			'.callout[data-callout="x"] .callout-icon { -webkit-mask-image: url(a.svg); }',
		);
		assert.ok(r.checks.some((c) => c.includes("CSS mask")));
	});
});

describe("the rendered worksheet", () => {
	const rows = [
		analyzeTheme(theme('.callout[data-callout="recite"] { color: red; }', "ITS")),
		analyzeTheme(theme("body { color: red; }", "Adwaita")),
	];

	it("keeps the tester's two columns empty", () => {
		const md = renderThemeReport(rows, {
			activeTheme: "ITS",
			themesPath: "/themes",
		});
		const line = md.split("\n").find((l) => l.startsWith("| ITS "));
		assert.ok(line);
		assert.ok(line.endsWith("|  |  |"), "Result and Notes ship blank");
	});

	it("escapes a pipe so one theme cannot break the table", () => {
		const md = renderThemeReport(
			[analyzeTheme(theme(".callout { color: red; }", "A | B"))],
			{ activeTheme: null, themesPath: "/themes" },
		);
		const line = md.split("\n").find((l) => l.includes("A \\| B"));
		assert.ok(line, "the name's pipe is escaped");
		assert.strictEqual(line.split(/(?<!\\)\|/).length - 1, 13);
	});

	it("says which theme was active, and copes with none", () => {
		assert.ok(
			renderThemeReport(rows, {
				activeTheme: "ITS",
				themesPath: "/t",
			}).includes("**ITS**"),
		);
		assert.ok(
			renderThemeReport(rows, {
				activeTheme: null,
				themesPath: "/t",
			}).includes("Obsidian default"),
		);
	});

	it("gives a detail block only to themes that add types", () => {
		const md = renderThemeReport(rows, {
			activeTheme: null,
			themesPath: "/t",
		});
		assert.ok(md.includes("### ITS"));
		assert.ok(!md.includes("### Adwaita"));
	});
});
