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
	harness,
	parseRules,
	rulesMatching,
	valueOf,
	type Harness,
} from "./support/cssInjectorHarness";
import { metadataWordSelector } from "../src/manager/css/metadataColorCSS";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";
import { splitSelectorList } from "../src/utils/selectorText";
import type { CustomPalette } from "../src/types";

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
		const both = metadataWordSelector(["bubblegum", "pink"]);
		assert.ok(selectorMatches(both, "x|pink"));
		assert.ok(selectorMatches(both, "bubblegum wide"));
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
		assert.ok(order.indexOf("bubblegum") < order.indexOf("blue"));
		assert.strictEqual(order[order.length - 1], "comic-red");
	});

	it("carries the palette's own accent and background", () => {
		const h = harness();
		const css = internals(h).generateMetadataColorCSS();
		const violet = parseRules(css).find(
			(r) =>
				r.at.length === 0 &&
				r.selector.startsWith(":root .callout") &&
				r.selector.includes('"violet"') &&
				r.props.includes("--cs-accent"),
		);
		assert.ok(violet, "violet's light block rule");
		assert.strictEqual(valueOf(violet, "--cs-accent"), "#7852ee !important");
		assert.ok(violet.props.includes("--callout-color"));
		assert.ok(violet.props.includes("background-color"));
	});

	it("outweighs the callout's own light and dark rules", () => {
		const h = harness();
		const own = internals(h).generateCalloutCSS(definition());
		const meta = internals(h).generateMetadataColorCSS();
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
			parseRules(internals(h).generateMetadataColorCSS())
				.filter((r) => r.at.length === 0 && r.props.includes("--callout-color"))
				.flatMap((r) => splitSelectorList(r.selector))
				.map((s) => specificityOf(s).join(",")),
		);
		assert.strictEqual(weights.size, 1, [...weights].join(" | "));
	});

	it("restates the heading bar and the inline pill, heavier than their own rules", () => {
		const h = harness();
		const meta = internals(h).generateMetadataColorCSS();
		const pill = rulesMatching(meta, ':root .cs-inline-callout[data-callout]:is(')
			.find((r) => r.props.includes("--cs-accent"));
		assert.ok(pill);
		assert.ok(pill.selector.includes(".cs-heading-callout[data-callout]"));
		const own = rulesMatching(internals(h).generateCalloutCSS(definition()), ".cs-inline-callout[")
			.flatMap((r) => splitSelectorList(r.selector))
			.map(specificityOf);
		for (const sel of splitSelectorList(pill.selector)) {
			for (const o of own) assert.ok(compareSpecificity(specificityOf(sel), o) > 0);
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
