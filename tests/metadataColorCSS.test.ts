/**
 * tests/metadataColorCSS.test.ts — the stylesheet half of `[!type|colour]`.
 *
 * Four things must hold, and each fails silently in Obsidian rather than
 * loudly anywhere:
 *
 * 1. **The selector finds the word in either separator** — a space (ITS Theme)
 *    or a pipe (the Callout Metadata plugin) or a mix — and never inside a
 *    longer word. Pinned by evaluating the six attribute forms against real
 *    metadata strings with CSS's own semantics.
 * 2. **It outweighs the callout's own colour** in every mode, or the override
 *    paints in light mode and loses in dark.
 * 3. **Every colour weighs the same**, so source order — weakest colour first
 *    — is the whole precedence story, in both modes.
 * 4. **Off is nothing.** The hidden switch emits not one byte.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	flattenNesting,
	harness,
	parseRules,
	rulesMatching,
	valueOf,
	type Harness,
} from "./support/cssInjectorHarness";
import { metadataWordSelector } from "../src/manager/css/metadataColorCSS";
import { metadataNamesWord } from "../src/utils/calloutMetadata";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";
import { splitSelectorList } from "../src/utils/selectorText";
import type { CustomPalette } from "../src/types";
import type { App } from "obsidian";

interface MetaInternals {
	generateMetadataColorCSS(standalone?: boolean): string;
	generateCalloutCSS(def: ReturnType<typeof definition>): string;
}
const internals = (h: Harness): MetaInternals => h.injector as unknown as MetaInternals;

const palette = (name: string, over: Partial<CustomPalette> = {}): CustomPalette => ({
	id: `cp-${name}`,
	name,
	colorLight: "#aa0000",
	colorDark: "#ff5555",
	bgColorLight: "#ffeeee",
	bgColorDark: "#331111",
	textColorLight: "#111111",
	textColorDark: "#eeeeee",
	...over,
});

/**
 * Evaluate one `[data-callout-metadata<op>="v" i]` against a value, the way a
 * browser does. ASCII case folding only — that is what the `i` flag means.
 */
function attrMatches(form: string, value: string): boolean {
	const m = /^\[data-callout-metadata(~|\^|\$|\*)?="((?:[^"\\]|\\.)*)" i\]$/.exec(form.trim());
	assert.ok(m, `unexpected form ${form}`);
	const fold = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
	const v = fold((m[2] ?? "").replace(/\\(.)/g, "$1"));
	const attr = fold(value);
	switch (m[1]) {
		case "~": return attr.split(/[ \t\n\r\f]+/).includes(v);
		case "^": return attr.startsWith(v);
		case "$": return attr.endsWith(v);
		case "*": return attr.includes(v);
		default: return attr === v;
	}
}

/** Does the whole `:is(…)` match this metadata string? */
function selectorMatches(isSelector: string, value: string): boolean {
	const inner = isSelector.slice(":is(".length, -1);
	return splitSelectorList(inner).some((form) => attrMatches(form, value));
}

describe("metadataWordSelector — the word in either separator", () => {
	const sel = metadataWordSelector(["pink"]);

	const yes = [
		"pink", "pink right", "right pink", "a pink b", " pink ",
		"pink|right", "right|pink", "a|pink|b", "|pink", "pink|",
		"a|pink b", "a pink|b", "a| pink |b",
		"PINK", "Pink|x",
	];
	for (const value of yes) {
		it(`matches "${value}"`, () => assert.ok(selectorMatches(sel, value)));
	}

	const no = ["", "pinky", "hotpink", "pink-2", "pink,", "a|pinky|b", "bubblegum", "p ink"];
	for (const value of no) {
		it(`does not match "${value}"`, () => assert.ok(!selectorMatches(sel, value)));
	}

	it("folds an alias into the same :is()", () => {
		const both = metadataWordSelector(["gray", "grey"]);
		assert.ok(selectorMatches(both, "x|grey"));
		assert.ok(selectorMatches(both, "gray wide"));
	});

	it("is one class of specificity whichever form matches", () => {
		assert.deepStrictEqual(specificityOf(`.callout${sel}`), [0, 2, 0]);
	});
});

describe("generateMetadataColorCSS — the rules", () => {
	it("off is nothing at all", () => {
		const h = harness();
		h.registry.settings.metadataColors.enabled = false;
		assert.strictEqual(internals(h).generateMetadataColorCSS(), "");
		assert.strictEqual(internals(h).generateMetadataColorCSS(true), "");
	});

	it("emits one commented group per colour, weakest first, palettes last", () => {
		const h = harness();
		h.registry.settings.customPalettes = [palette("Comic Red")];
		const css = internals(h).generateMetadataColorCSS();
		const order = [...css.matchAll(/\/\* metadata colour: (\S+) \*\//g)].map((m) => m[1]);
		assert.ok(order.indexOf("pink") < order.indexOf("blue"));
		assert.strictEqual(order[order.length - 1], "comic-red");
	});

	it("carries the palette's own accent and background", () => {
		const h = harness();
		const css = flattenNesting(internals(h).generateMetadataColorCSS());
		const purple = parseRules(css).find(
			(r) =>
				r.at.length === 0 &&
				r.selector.startsWith(":root .callout") &&
				r.selector.includes('"purple"') &&
				r.props.includes("--cs-accent"),
		);
		assert.ok(purple, "purple's light block rule");
		assert.strictEqual(valueOf(purple, "--cs-accent"), "#7852ee !important");
		assert.ok(purple.props.includes("--callout-color"));
		assert.ok(purple.props.includes("background-color"));
	});

	it("outweighs the callout's own light and dark rules", () => {
		const h = harness();
		const own = internals(h).generateCalloutCSS(definition());
		const meta = flattenNesting(internals(h).generateMetadataColorCSS());
		const heaviest = parseRules(own)
			.filter((r) => r.at.length === 0 && r.props.includes("--cs-accent"))
			.flatMap((r) => splitSelectorList(r.selector))
			.map(specificityOf)
			.reduce((a, b) => (compareSpecificity(a, b) >= 0 ? a : b));
		for (const rule of parseRules(meta).filter(
			(r) => r.at.length === 0 && r.selector.includes(".callout[") && r.props.includes("--cs-accent"),
		)) {
			for (const sel of splitSelectorList(rule.selector)) {
				assert.ok(
					compareSpecificity(specificityOf(sel), heaviest) > 0,
					`${sel} must outweigh ${heaviest.join(",")}`,
				);
			}
		}
	});

	it("gives every colour's light and dark block rule the same weight", () => {
		const h = harness();
		h.registry.settings.customPalettes = [palette("Comic Red")];
		const weights = new Set(
			parseRules(flattenNesting(internals(h).generateMetadataColorCSS()))
				.filter((r) => r.at.length === 0 && r.props.includes("--callout-color"))
				.flatMap((r) => splitSelectorList(r.selector))
				.map((s) => specificityOf(s).join(",")),
		);
		assert.strictEqual(weights.size, 1, [...weights].join(" | "));
	});

	it("restates the heading bar and the inline pill, heavier than their own rules", () => {
		const h = harness();
		const meta = flattenNesting(internals(h).generateMetadataColorCSS());
		for (const [surface, ownNeedle] of [
			[":root .cs-inline-callout[data-callout]:is(", ".cs-inline-callout["],
			[":root .cs-heading-callout[data-callout]:is(", ".cs-heading-callout["],
		] as const) {
			const rule = rulesMatching(meta, surface).find((r) => r.props.includes("--cs-accent"));
			assert.ok(rule, surface);
			const own = rulesMatching(internals(h).generateCalloutCSS(definition()), ownNeedle)
				.flatMap((r) => splitSelectorList(r.selector))
				.map(specificityOf);
			assert.ok(own.length > 0, ownNeedle);
			for (const sel of splitSelectorList(rule.selector)) {
				for (const o of own) assert.ok(compareSpecificity(specificityOf(sel), o) > 0, `${sel} vs ${o.join(",")}`);
			}
		}
	});

	it("stays off callouts the theme owns", () => {
		const h = harness();
		h.registry.add(definition({ id: "themed" }));
		h.registry.setThemeOwnedIds(new Set(["themed"]));
		const css = internals(h).generateMetadataColorCSS();
		assert.ok(css.includes(':not([data-callout="themed"])'));
	});

	it("a transparent palette clears the background and the two child boxes", () => {
		const h = harness();
		h.registry.settings.customPalettes = [palette("Glass", { transparentBg: true })];
		const css = internals(h).generateMetadataColorCSS();
		const glass = css.slice(css.indexOf("/* metadata colour: glass */"));
		assert.ok(/background-color: transparent !important/.test(glass));
		assert.ok(glass.includes("> .callout-title"));
	});

	it("the exported snippet keeps only the block callout rules", () => {
		const h = harness();
		h.registry.add(definition({ id: "themed" }));
		h.registry.setThemeOwnedIds(new Set(["themed"]));
		const css = internals(h).generateMetadataColorCSS(true);
		assert.ok(css.length > 0);
		assert.ok(!css.includes(".cs-inline-callout"));
		assert.ok(!css.includes(".cs-heading-callout"));
		assert.ok(!css.includes(":not("), "the theme of THIS vault means nothing elsewhere");
	});
});

describe("metadataNamesWord — the stylesheet's own answer, in code", () => {
	// The PDF painters bake colours from this; the screen paints from the
	// selector. A string one of them reads differently is a callout that
	// prints in a colour the screen never showed.
	const sel = metadataWordSelector(["pink"]);
	for (const value of [
		"pink", "a pink", "a|pink", "pink|b", "a|pink b", "a pink|b", " PINK ", "x|Pink|y",
		"a\u00a0pink", "pink\u00a0b", "a\tpink", "a|pink\tb", "pinkish", "a|pinky", "",
	]) {
		it(JSON.stringify(value), () => {
			assert.strictEqual(metadataNamesWord(value, "pink"), selectorMatches(sel, value));
		});
	}
});

describe("generateMetadataColorCSS — replacing, not layering", () => {
	const swept = definition({
		id: "grad",
		bgColorLight: "#ddeeff",
		bgColorDark: "#112233",
		bgGradient: {
			angleDeg: 135,
			toColorLight: "#ffddee",
			toColorDark: "#331122",
			textGradient: true,
			textToColorLight: "#aa0066",
			textToColorDark: "#ff66aa",
		},
	});
	const rulesOf = (h: Harness, key: string) =>
		parseRules(flattenNesting(internals(h).generateMetadataColorCSS())).filter((r) =>
			r.selector.includes(`"${key}"`),
		);

	it("with no gradient or sweep in any definition, a colour carries no resets", () => {
		const rules = rulesOf(harness(), "pink");
		assert.ok(!rules.some((r) => r.decls.some((d) => d.startsWith("background-image: none"))));
		assert.ok(!rules.some((r) => r.selector.includes(".callout-title-inner")));
		assert.ok(!rules.some((r) => r.at.length > 0));
	});

	it("over a definition with a gradient and a title sweep, a solid colour clears both", () => {
		const h = harness();
		h.registry.add(swept);
		const rules = rulesOf(h, "pink");
		const block = rules.find(
			(r) => r.at.length === 0 && r.selector.startsWith(":root .callout") && r.props.includes("--cs-accent"),
		);
		assert.ok(block?.decls.includes("background-image: none !important"), "the gradient");
		assert.ok(
			rules.some((r) => r.selector.endsWith("> .callout-title > .callout-title-inner") &&
				r.decls.includes("-webkit-text-fill-color: currentColor !important")),
			"the title sweep",
		);
		assert.ok(
			rules.some((r) => r.selector.endsWith("> .callout-fold") && r.decls.includes("color: inherit !important")),
			"the chevron",
		);
		assert.ok(
			rules.some((r) => r.at.includes("@media print") && r.selector.endsWith("::before") &&
				r.decls.includes("background-image: none !important")),
			"the print repaint",
		);
		assert.ok(rules.some((r) => r.selector.endsWith(" .cs-heading-title") && r.decls.includes("background-clip: border-box")), "the heading bar's title");
		assert.ok(rules.some((r) => r.selector.endsWith(".cs-inline-callout") && r.decls.includes("background-clip: border-box")), "the pill's own sweep");
		assert.ok(rules.some((r) => r.selector.endsWith("> .cs-callout-name") && r.decls.includes("background-clip: border-box")), "the heading token's name");
	});

	it("each reset outweighs the definition rule it undoes, surface by surface", () => {
		const h = harness();
		h.registry.add(swept);
		const own = parseRules(internals(h).generateCalloutCSS(swept))
			.filter((r) => r.at.length === 0)
			.flatMap((r) => splitSelectorList(r.selector).map((selector) => ({ selector, props: r.props })));
		const resets = rulesOf(h, "pink")
			.filter((r) => r.at.length === 0)
			.flatMap((r) => splitSelectorList(r.selector).map((selector) => ({ selector, decls: r.decls })));
		// [what the reset clears, the definition's selectors for it, the reset's]
		const pairs: Array<[string, (sel: string) => boolean, (sel: string) => boolean]> = [
			[
				"the block's gradient",
				(sel) => /^(\.theme-dark )?\.callout\[data-callout="[^"]*"\]$/.test(sel),
				(sel) => sel.startsWith(":root .callout") && !sel.includes(" > "),
			],
			["the block title's sweep", (sel) => sel.endsWith(".callout-title-inner"), (sel) => sel.endsWith(".callout-title-inner")],
			["the pill's sweep", (sel) => sel.includes(".cs-inline-callout.cs-inline-callout"), (sel) => sel.endsWith(".cs-inline-callout")],
			["the bar title's sweep", (sel) => sel.endsWith(".cs-heading-title"), (sel) => sel.endsWith(".cs-heading-title")],
			["the token name's sweep", (sel) => sel.endsWith(".cs-callout-name"), (sel) => sel.endsWith(".cs-callout-name")],
		];
		for (const [what, ownSel, resetSel] of pairs) {
			const theirs = own.filter((r) => ownSel(r.selector.trim()) && r.props.includes("background-image"));
			const ours = resets.filter((r) => resetSel(r.selector.trim()) && r.decls.some((d) => d.startsWith("background-") || d.startsWith("-webkit-background-clip")));
			assert.ok(theirs.length > 0 && ours.length > 0, what);
			for (const reset of ours) {
				for (const rule of theirs) {
					assert.ok(
						compareSpecificity(specificityOf(reset.selector), specificityOf(rule.selector)) > 0,
						`${what}: ${reset.selector} vs ${rule.selector}`,
					);
				}
			}
		}
	});

	it("content text follows the theme unless the palette chose a colour", () => {
		const h = harness();
		h.registry.settings.customPalettes = [
			palette("Comic Red"),
			palette("Plain", { textColorLight: undefined, textColorDark: undefined }),
		];
		const content = (key: string) =>
			rulesOf(h, key).filter((r) => r.selector.endsWith("> .callout-content")).map((r) => valueOf(r, "color"));
		assert.deepStrictEqual(content("pink"), ["inherit !important"], "a preset never picks a text colour");
		assert.deepStrictEqual(content("plain"), ["inherit !important"]);
		assert.deepStrictEqual(content("comic-red"), ["#111111 !important", "#eeeeee !important"]);
	});

	it("states each colour's word once per surface, nested", () => {
		const css = internals(harness()).generateMetadataColorCSS();
		const start = css.indexOf("/* metadata colour: pink */");
		const pink = css.slice(start, css.indexOf("/* metadata colour:", start + 1));
		// The callout, the pill and the heading bar; a heading token block only
		// exists when some definition sweeps its title.
		assert.strictEqual(pink.split('[data-callout-metadata~="pink" i]').length - 1, 3);
		assert.ok(pink.includes(":root & {"));
	});
});

describe("generateMetadataColorCSS — a word the user's own snippet styles is theirs", () => {
	const snippetApp = (names: string[], css: string[]): App =>
		({
			customCss: {
				theme: "",
				themes: {},
				styleEl: { textContent: "" },
				snippets: names,
				enabledSnippets: new Set(names),
				extraStyleEls: css.map((textContent) => ({ textContent })),
			},
		}) as unknown as App;
	const groups = (h: Harness) =>
		[...internals(h).generateMetadataColorCSS().matchAll(/\/\* metadata colour: (\S+) \*\//g)].map((m) => m[1]);

	it("stands down on it, and on nothing else", () => {
		const h = harness(snippetApp(["my-colours"], ['.callout[data-callout-metadata~="Red"] { --callout-color: 255, 0, 0; }']));
		assert.ok(!groups(h).includes("red"), "the snippet keeps red");
		assert.ok(groups(h).includes("pink"));
		assert.ok(!h.injector.metadataColorEntries().some((e) => e.key === "red"), "nor is red offered after the pipe");
	});

	it("but reads nothing into Callout Studio's own exported snippet", () => {
		const exported = '.callout[data-callout-metadata~="red" i] { --callout-color: #e93147; }';
		assert.ok(groups(harness(snippetApp(["callout-studio-custom"], [exported]))).includes("red"));
	});
});
