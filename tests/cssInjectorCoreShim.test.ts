/**
 * tests/cssInjectorCoreShim.test.ts — the declarations core stops painting when
 * this plugin hands the theme a spelling core itself cannot read.
 *
 * Fixtures are a few synthetic lines each, in the shape of a real theme rather
 * than a copy of one. The shapes and the numbers beside them were measured
 * across the 257 themes installed in the dev vault.
 *
 * The assertion this file exists for is the third one: **the shim must lose to
 * the theme.** Every other property here is a consequence of that.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	parseRules,
	rulesMatching,
	themedHarness,
	valueOf,
	must,
} from "./support/cssInjectorHarness";
import {
	classCountOf,
	compareSpecificity,
	specificityOf,
} from "../src/utils/cssSpecificity";

/** A theme that reads the accent the way everything before Obsidian 1.13 did. */
const LEGACY_THEME = `
	.callout > .callout-title { background-color: rgba(var(--callout-color), 0.1); }
	.callout > .callout-title { border-left: 3px solid rgb(var(--callout-color)); }
`;

/** The same, plus the `!important` rule that lifts the studio weight. */
const LEGACY_THEME_IMPORTANT = `
	${LEGACY_THEME}
	.callout[data-callout=formula] .callout-title { background-color: rgba(0, 0, 0, 0.05) !important; }
`;

/** A theme written for 1.13+, which needs nothing repaired. */
const MODERN_THEME = `
	.callout { background-color: color-mix(in srgb, var(--callout-color) 10%, transparent); }
`;

const preset = () => definition({ id: "apple", colorLight: "#ff8800", colorDark: "#ff8800" });

/** The shim rule: the one on the bare callout selector with no `!important`. */
function shimRule(css: string) {
	return must(
		parseRules(css).find(
			(r) => r.selector === ':where(.callout)[data-callout="apple"]' && !r.decls.some((d) => d.includes("!important")),
		),
		"shim rule",
	);
}

describe("core accent shim — when it exists at all", () => {
	it("is absent when the theme and core agree, and changes nothing else", () => {
		// 196 of the 257 installed themes never touch the accent variables, and
		// every one of those vaults must emit exactly what it emitted before any
		// of this existed.
		const { css } = themedHarness(MODERN_THEME);
		const out = css.generateCalloutCSS(preset());
		assert.ok(!parseRules(out).some((r) => r.props.includes("--table-border-color")));
		assert.ok(out.includes("--callout-color: #ff8800 !important;"));
	});

	it("appears, with the accent re-spelled, when the theme reads a triplet", () => {
		const { css } = themedHarness(LEGACY_THEME);
		const out = css.generateCalloutCSS(preset());
		assert.ok(out.includes("--callout-color: 255, 136, 0 !important;"));
		const shim = shimRule(out);
		assert.equal(
			valueOf(shim, "background-color"),
			"color-mix(in oklch, rgb(var(--callout-color)) 10%, transparent)",
		);
	});

	it("reads back the variable it wrote, when it wrote one", () => {
		// A transliteration of core's rule rather than a second opinion about the
		// colour: it stays in step with a theme's per-id override — AnuPpuccin's
		// `anp-callout-color-toggle` repaints all 13 built-ins that way — instead
		// of following core's --callout-default into a slightly different blue.
		const { css } = themedHarness(LEGACY_THEME);
		const bg = must(valueOf(shimRule(css.generateCalloutCSS(preset())), "background-color"));
		assert.ok(bg.includes("rgb(var(--callout-color))"), bg);
	});

	it("falls back to --cs-accent where it deliberately wrote nothing", () => {
		// An unmodified built-in gets no --callout-color from this plugin at all
		// — that is what lets core's rule, and any theme overriding it, keep
		// deciding the accent. So its spelling is somebody else's, and guessing
		// wrong does not produce a near-miss: an unparseable var() substitution
		// unsets the property and the background disappears entirely. --cs-accent
		// is guaranteed a real colour on every version and every theme.
		const { registry, css } = themedHarness(LEGACY_THEME);
		const note = must(registry.get("note"), "built-in note");
		const shim = must(
			parseRules(css.generateCalloutCSS(note)).find(
				(r) => r.props.includes("--table-border-color"),
			),
			"shim rule",
		);
		const bg = must(valueOf(shim, "background-color"));
		assert.ok(bg.includes("var(--cs-accent)"), bg);
		assert.ok(!bg.includes("--callout-color"), bg);
	});

	it("restates every core declaration the spelling broke, and no others", () => {
		// Core reads --callout-color in eight places. Seven are here; the eighth,
		// `.callout-icon .svg-icon { color }`, is deliberately absent because it
		// inherits from the title rule below.
		const { css } = themedHarness(LEGACY_THEME);
		const out = css.generateCalloutCSS(preset());
		const shim = shimRule(out);
		assert.deepStrictEqual(
			shim.props,
			[
				"background-color",
				"border-color",
				"--bases-table-header-background-hover",
				"--bases-embed-border-color",
				"--bases-table-border-color",
				"--table-border-color",
			],
		);
		const title = must(
			parseRules(out).find(
				(r) => r.selector === ':where(.callout)[data-callout="apple"] > .callout-title',
			),
			"title rule",
		);
		assert.equal(valueOf(title, "color"), "rgb(var(--callout-color))");
		assert.equal(rulesMatching(out, ".svg-icon").length, 0);
	});

	it("emits nothing for a callout the theme owns", () => {
		const { registry, css } = themedHarness(LEGACY_THEME);
		registry.setThemeOwnedIds(new Set(["apple"]));
		assert.equal(css.generateCalloutCSS(preset()), "");
	});
});

describe("core accent shim — how hard it pushes", () => {
	it("carries no !important, ever", () => {
		const { css } = themedHarness(LEGACY_THEME);
		assert.ok(!shimRule(css.generateCalloutCSS(preset())).decls.some((d) => d.includes("!important")));
	});

	it("stays at weight 1 even where the plugin's own rules are lifted to 5", () => {
		// The trap this test exists for. `generateCalloutCSS` raises the studio
		// weight to clear a theme's own `!important` rules, and a shim built from
		// that selector would land at (0,5,0) — above AnuPpuccin's (0,4,0) — and
		// paint an opaque box over the Style Settings option the user chose. That
		// is worse than the bug the shim fixes.
		const { css } = themedHarness(LEGACY_THEME_IMPORTANT);
		const out = css.generateCalloutCSS(preset());
		const own = must(
			parseRules(out).find((r) => r.props.includes("--callout-color")),
			"the plugin's own rule",
		);
		assert.ok(classCountOf(own.selector) > 1, own.selector);
		assert.equal(classCountOf(shimRule(out).selector), 1);
	});

	it("beats core, and loses to a theme rule with a guard on it", () => {
		const shim = specificityOf(':where(.callout)[data-callout="apple"]');
		// Core is a tie, deliberately: this sheet is written into
		// adoptedStyleSheets, which the cascade orders after every <link> in the
		// document, and app.css is a <link>. Beating core on weight as well would
		// mean beating a pile of theme rules that deserve to win.
		assert.equal(compareSpecificity(shim, specificityOf(".callout")), 0);
		for (const themeSelector of [
			// AnuPpuccin, Vanilla Normal — the reported case.
			".anp-callout-vanilla-normal .callout:not([data-callout-metadata*=anp-sleek]):not([data-callout=multi-column])",
			// AnuPpuccin again, opted into per callout by metadata.
			'.callout[data-callout-metadata*="anp-vanilla-normal"]:not([data-callout=blank-container]):not([data-callout=multi-column])',
			// Minimal, "Outlined".
			".callouts-outlined .callout",
			// Blue Topaz, "Shade".
			"body.shade-callout-style .callout",
		]) {
			assert.ok(
				compareSpecificity(shim, specificityOf(themeSelector)) < 0,
				`shim must lose to ${themeSelector}`,
			);
		}
	});
});

describe("core accent shim — what it refuses to paint over", () => {
	it("yields the background to an explicit Studio choice", () => {
		// A chosen accent is not a chosen background. An authored one goes in the
		// `!important` block above; restating a weaker copy underneath would be
		// dead text. The rest of the shim stays — those are still broken.
		const { css } = themedHarness(LEGACY_THEME);
		for (const over of [
			{ bgColorLight: "#402000", bgColorDark: "#402000" },
			{ transparentBg: true as const },
			{
				bgColorLight: "#402000",
				bgColorDark: "#402000",
				bgGradient: { angleDeg: 90, toColorLight: "#804000", toColorDark: "#804000" },
			},
		]) {
			const out = css.generateCalloutCSS(definition({ id: "apple", ...over }));
			const shim = shimRule(out);
			assert.equal(valueOf(shim, "background-color"), undefined, JSON.stringify(over));
			assert.ok(valueOf(shim, "border-color") !== undefined);
		}
	});

	it("yields a property the theme paints on a bare .callout", () => {
		// Obsidian gruvbox's whole callout section is one such rule, at (0,1,0),
		// with a deliberate 20% tint. The shim would outrank it by accident and
		// replace it with core's 10%.
		const { css } = themedHarness(
			`${LEGACY_THEME}\n.callout { background-color: rgba(var(--callout-color), 0.2); }`,
		);
		const shim = shimRule(css.generateCalloutCSS(preset()));
		assert.equal(valueOf(shim, "background-color"), undefined);
		assert.ok(valueOf(shim, "border-color") !== undefined, "the rest still applies");
	});

	it("yields the border to a theme that paints it with the SHORTHAND", () => {
		// Sanctum, verbatim in shape. Reading only the longhand suppressed
		// `background-color` and missed `border`, so the restated `border-color`
		// landed on top of the theme's at (0,1,0) on source order — and did not
		// merely change the colour. Sanctum sets `--callout-border-opacity: 30%`
		// (its Style Settings entry carries `format: '%'`), so core's expression
		// `calc(var(--callout-border-opacity) * 100%)` multiplies two
		// percentages, which `calc()` rejects: the declaration unsets and the
		// border falls back to `currentColor`. Raising Sanctum's "Callout border
		// width" drew a black frame where the theme asked for a 30% tint.
		const { css } = themedHarness(
			`${LEGACY_THEME}\n.callout { border: var(--callout-border-width) solid rgba(var(--callout-color), var(--callout-border-opacity)); background-color: rgba(var(--callout-color), 0.2); }`,
		);
		const out = css.generateCalloutCSS(preset());
		assert.equal(
			parseRules(out).some(
				(r) => r.selector === ':where(.callout)[data-callout="apple"]' && r.props.includes("border-color"),
			),
			false,
			"the shim must not restate a border the theme paints itself",
		);
		// The custom properties are still restated — nothing claims those.
		const shim = shimRule(out);
		assert.equal(valueOf(shim, "background-color"), undefined);
		assert.ok(valueOf(shim, "--table-border-color") !== undefined);
	});

	it("yields the border to every shorthand that reaches its colour", () => {
		// One table, `PAINTERS` in coreAccentShim.ts, rather than a longhand
		// check at each of the two recording sites — the scanners report what the
		// stylesheet says, and only the emitter knows which properties are at
		// stake. The side shorthands count because the shim sets all four sides
		// at once, so it overwrites a theme that coloured only one.
		for (const decl of [
			"border: 1px solid red",
			"border-color: red",
			"border-left: 3px solid red",
			"border-top-color: red",
			"border-inline-start: 3px solid red",
			"border-block-color: red",
		]) {
			const { css } = themedHarness(`${LEGACY_THEME}\n.callout { ${decl}; }`);
			const out = css.generateCalloutCSS(preset());
			assert.equal(
				parseRules(out).some(
					(r) =>
						r.selector === ':where(.callout)[data-callout="apple"]' &&
						r.props.includes("border-color"),
				),
				false,
				decl,
			);
		}
	});

	it("still restates the border when the theme says nothing about it", () => {
		const { css } = themedHarness(`${LEGACY_THEME}\n.callout { padding: 1em; }`);
		assert.ok(valueOf(shimRule(css.generateCalloutCSS(preset())), "border-color") !== undefined);
	});

	it("yields the title colour to a bare .callout-title rule", () => {
		// `color` has no shorthand, so this is the plain question — pinned
		// because `PAINTERS` now answers it and a table entry is easy to drop.
		const { css } = themedHarness(`${LEGACY_THEME}\n.callout { color: red; }`);
		assert.equal(rulesMatching(css.generateCalloutCSS(preset()), ".callout-title").length, 0);
	});

	it("yields a property claimed by a family matcher", () => {
		// `[data-callout*=…]` names no callout, so it mints no row and never
		// makes one theme-owned — but it does paint one, and it ties the shim at
		// (0,2,0) and loses on source order.
		const { css } = themedHarness(
			`${LEGACY_THEME}\n.callout[data-callout*="app"] { background-color: #123456; }`,
		);
		const shim = shimRule(css.generateCalloutCSS(preset()));
		assert.equal(valueOf(shim, "background-color"), undefined);
	});

	it("keeps painting when the theme's rule is guarded", () => {
		// A body class we cannot see the state of. When it is on, its own weight
		// wins; when it is off, something has to paint the box.
		const { css } = themedHarness(
			`${LEGACY_THEME}\n.anp-callout-vanilla-normal .callout { background-color: transparent; }`,
		);
		const shim = shimRule(css.generateCalloutCSS(preset()));
		assert.ok(valueOf(shim, "background-color") !== undefined);
	});
});

describe("the ownership line a theme actually feels", () => {
	/**
	 * The `background-*` declarations on the BLOCK callout, split by band.
	 *
	 * Block only: the heading-bar / inline-pill rules paint the same background
	 * on DOM of this plugin's own, where no theme is competing and no
	 * `!important` is needed (see `generateTokenColorCSS`). Split by band
	 * because the two answer different questions — see the table in
	 * `internals-docs/06-css-generation.md`.
	 */
	function blockBackgrounds(css: string) {
		const decls = parseRules(css)
			.filter((r) => r.selector.includes(".callout[") || r.selector.includes(')[data-callout'))
			.flatMap((r) => r.decls)
			.filter((d) => /^background(-color|-image)?:/.test(d));
		return {
			chosen: decls.filter((d) => d.includes("!important")),
			derived: decls.filter((d) => !d.includes("!important")),
		};
	}

	it("a chosen ACCENT never paints a background of its own", () => {
		// The invariant every theme in the survey depends on, stated once at the
		// level a theme feels it. A preset colour is a colour and nothing else,
		// so the box's tint stays whatever the theme derives from
		// `--callout-color`: Catppuccin's 10%, Obsidian gruvbox's 20%,
		// Willemstad's 12.5%, Prism's and GitHub Theme's deliberate
		// transparency, Minimal's "Outlined" empty box. One `!important`
		// background here would flatten all six.
		for (const theme of [MODERN_THEME, LEGACY_THEME, LEGACY_THEME_IMPORTANT]) {
			const { css } = themedHarness(theme);
			assert.deepStrictEqual(blockBackgrounds(css.generateCalloutCSS(preset())).chosen, []);
		}
	});

	it("…and only restates core's own where the spelling broke it", () => {
		// The derived band is allowed a background, and only there: under a
		// legacy theme the triplet we wrote makes core's 10% tint invalid, so the
		// shim restates it — at (0,1,0), with no `!important`, and never when the
		// theme paints one itself. Under a modern theme nothing is broken and
		// nothing is restated.
		assert.deepStrictEqual(
			blockBackgrounds(themedHarness(MODERN_THEME).css.generateCalloutCSS(preset())).derived,
			[],
		);
		assert.deepStrictEqual(
			blockBackgrounds(themedHarness(LEGACY_THEME).css.generateCalloutCSS(preset())).derived,
			["background-color: color-mix(in oklch, rgb(var(--callout-color)) 10%, transparent)"],
		);
	});

	it("an AUTHORED background does paint, and wins", () => {
		// The other side of the same line: a Saved Palette colour, a gradient or
		// "transparent" is a background the user chose, so it goes in the
		// `!important` band and beats the theme — for that property only.
		for (const over of [
			{ bgColorLight: "#402000", bgColorDark: "#402000" },
			{
				bgColorLight: "#402000",
				bgColorDark: "#402000",
				bgGradient: { angleDeg: 90, toColorLight: "#804000", toColorDark: "#804000" },
			},
			{ transparentBg: true as const },
		]) {
			for (const theme of [MODERN_THEME, LEGACY_THEME]) {
				const bands = blockBackgrounds(
					themedHarness(theme).css.generateCalloutCSS(definition({ id: "apple", ...over })),
				);
				assert.ok(bands.chosen.length > 0, JSON.stringify(over));
				assert.deepStrictEqual(
					bands.derived,
					[],
					`the shim must not restate a background under one the user authored: ${JSON.stringify(over)}`,
				);
			}
		}
	});

	it("a chosen ICON always wins, whatever the theme does", () => {
		// The other half of what the user explicitly picked. A theme that names
		// `--callout-icon` for a family, or styles `.callout-icon` from a body
		// class, must not be able to take the artwork back — so the override sits
		// at the studio weight with `!important`, not at the deferring weight.
		const out = themedHarness(LEGACY_THEME_IMPORTANT).css.generateCalloutCSS(
			definition({ id: "apple", icon: { type: "emoji", value: "🍎" } }),
		);
		const after = must(
			parseRules(out).find((r) => r.selector.endsWith(".callout-icon::after")),
			"icon ::after rule",
		);
		assert.ok(after.decls.every((d) => d.includes("!important")), after.decls.join(" | "));
		assert.ok(classCountOf(must(after.selector.split(" ")[0])) > 1, after.selector);
	});
});

describe("core accent shim — coverage", () => {
	it("covers every alias in the same two rules", () => {
		const { css } = themedHarness(LEGACY_THEME);
		const out = css.generateCalloutCSS(definition({ id: "apple", aliases: ["pomme"] }));
		const shim = must(
			parseRules(out).find((r) => r.props.includes("--table-border-color")),
			"shim rule with alias",
		);
		assert.ok(shim.selector.includes('[data-callout="pomme"]'), shim.selector);
		for (const part of shim.selector.split(",")) {
			assert.equal(classCountOf(part.trim()), 1, part);
		}
	});

	it("needs no .theme-dark twin, because it reads a variable that has one", () => {
		// The injector redeclares --callout-color in its own dark rule, so one
		// shim rule follows both modes. A twin would be dead weight — and at a
		// higher specificity than the light rule, which is how it would start
		// quietly winning arguments.
		const { css } = themedHarness(LEGACY_THEME);
		const out = css.generateCalloutCSS(
			definition({ id: "apple", colorLight: "#ff8800", colorDark: "#0088ff" }),
		);
		assert.ok(out.includes(".theme-dark"), "the plugin's own dark rule is still there");
		assert.equal(
			parseRules(out).filter(
				(r) => r.selector.includes(".theme-dark") && r.props.includes("--table-border-color"),
			).length,
			0,
		);
	});
});
