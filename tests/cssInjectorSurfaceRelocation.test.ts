/**
 * tests/cssInjectorSurfaceRelocation.test.ts — where an authored background goes
 * when the theme takes it off the root, and what "transparent" has to clear.
 *
 * The bug this pins: under AnuPpuccin's Sleek style a Saved Palette's gradient
 * rendered as one flat colour, and a transparent callout kept a tinted title.
 * The theme puts the callout's colour on a title stripe and gives the root a
 * neutral mantle; the plugin restored the mantle and left the stripe to the
 * theme, so the user's background had nowhere to go. Every fixture is trimmed
 * from a theme installed in the development vault.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	must,
	parseRules,
	themedHarness,
	valueOf,
	type CssRule,
} from "./support/cssInjectorHarness";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";
import { splitSelectorList } from "../src/utils/selectorText";

/** AnuPpuccin's Sleek style, both branches: the body class and the metadata opt-in. */
const SLEEK = `
	.anp-callout-sleek .callout:not([data-callout-metadata*=anp-block]):not([data-callout-metadata*=revert]),
	.callout[data-callout-metadata*=anp-sleek]:not([data-callout-metadata*=revert]) {
		background-color: rgba(var(--ctp-mantle), 0.4);
	}
	.anp-callout-sleek .callout:not([data-callout-metadata*=anp-block]):not([data-callout-metadata*=revert]) > .callout-title,
	.callout[data-callout-metadata*=anp-sleek]:not([data-callout-metadata*=revert]) > .callout-title {
		background-color: rgba(var(--callout-color), var(--callout-title-opacity, 0.1));
	}
`;

const gradient = (over: Record<string, unknown> = {}) =>
	definition({
		id: "apple",
		colorLight: "#3d7ce6",
		colorDark: "#448aff",
		bgColorLight: "#dae8ff",
		bgColorDark: "#243249",
		bgGradient: { angleDeg: 123, toColorLight: "#deffcc", toColorDark: "#284916" },
		...over,
	});

/** Every rule landing on `suffix` of the callout under `guard`, screen only. */
const onBox = (css: string, guard: string, suffix: string): CssRule[] =>
	parseRules(css).filter(
		(r) =>
			r.at.length === 0 &&
			splitSelectorList(r.selector).some(
				(part) => part.trim().startsWith(guard) && part.trim().endsWith(suffix),
			),
	);

describe("AnuPpuccin Sleek — the gradient moves to the title stripe", () => {
	const css = themedHarness(SLEEK).css.generateCalloutCSS(gradient());
	const stripe = onBox(css, ".anp-callout-sleek", " > .callout-title");

	it("paints the authored gradient on the title, under the theme's own conditions", () => {
		const light = must(stripe.find((r) => !r.selector.includes(".theme-dark")), "light stripe");
		assert.match(valueOf(light, "background-image") ?? "", /^linear-gradient\(123deg, .*!important$/);
		assert.match(valueOf(light, "background-color") ?? "", /!important$/);
		assert.ok(light.selector.includes("[data-callout-metadata*=anp-block]"), light.selector);
		assert.ok(light.selector.includes('[data-callout="apple"]'));
		// The metadata branch moves it too, with no body class at all.
		assert.ok(
			onBox(css, ".callout", " > .callout-title").some((r) =>
				r.selector.includes("[data-callout-metadata*=anp-sleek]") &&
				valueOf(r, "background-image")?.includes("linear-gradient"),
			),
		);
	});

	it("keeps the root on the theme's neutral mantle", () => {
		const root = must(
			onBox(css, ".anp-callout-sleek", ":not([data-callout-metadata*=revert])")[0],
			"root restore",
		);
		assert.strictEqual(valueOf(root, "background-color"), "rgba(var(--ctp-mantle), 0.4) !important");
		assert.strictEqual(valueOf(root, "background-image"), "none !important");
	});

	it("writes dark mode as a condition on the callout, so it matches with the guard on <body>", () => {
		// `.theme-dark .anp-callout-sleek` can never match: both classes sit on
		// <body>. The dark stripe carries the mode on the callout compound instead.
		const dark = must(stripe.find((r) => r.selector.includes(":is(.theme-dark *)")), "dark stripe");
		assert.ok(!/\.theme-dark\s+\.anp-callout-sleek/.test(dark.selector), dark.selector);
		const light = must(stripe.find((r) => !r.selector.includes(".theme-dark")), "light stripe");
		assert.notStrictEqual(valueOf(dark, "background-image"), valueOf(light, "background-image"));
		const darkSel = must(splitSelectorList(dark.selector)[0]);
		const lightSel = must(splitSelectorList(light.selector)[0]);
		assert.ok(compareSpecificity(specificityOf(darkSel), specificityOf(lightSel)) > 0);
	});

	it("outranks the theme's own stripe, important or not", () => {
		const theirs = ".anp-callout-sleek .callout:not([data-callout-metadata*=anp-block]):not([data-callout-metadata*=revert]) > .callout-title";
		const light = must(stripe[0], "stripe");
		const ours = must(splitSelectorList(light.selector)[0]);
		assert.ok(compareSpecificity(specificityOf(ours), specificityOf(theirs)) > 0);
	});

	it("repaints the stripe's gradient for PDF export on a rasterised ::before", () => {
		const print = parseRules(css).filter(
			(r) => r.at.includes("@media print") && r.selector.includes("> .callout-title::before"),
		);
		const before = must(print.find((r) => !r.selector.includes(".theme-dark")), "print ::before");
		assert.match(valueOf(before, "background-image") ?? "", /linear-gradient\(123deg/);
		assert.strictEqual(valueOf(before, "filter"), "opacity(0.999) !important");
	});

	it("moves a solid colour as well, replacing whatever image the stripe had", () => {
		const solid = themedHarness(SLEEK).css.generateCalloutCSS(gradient({ bgGradient: undefined }));
		const light = must(onBox(solid, ".anp-callout-sleek", " > .callout-title")[0], "solid stripe");
		assert.strictEqual(valueOf(light, "background-image"), "none !important");
		assert.match(valueOf(light, "background-color") ?? "", /!important$/);
	});

	it("leaves the theme's own stripe to a callout that only chose an accent", () => {
		const accentOnly = themedHarness(SLEEK).css.generateCalloutCSS(definition({ id: "apple" }));
		assert.deepStrictEqual(onBox(accentOnly, ".anp-callout-sleek", " > .callout-title"), []);
	});
});

describe("Transparent is transparent all the way down", () => {
	it("clears the title and content in every theme, aliases included", () => {
		const css = themedHarness("").css.generateCalloutCSS(
			definition({ transparentBg: true, aliases: ["hush"] }),
		);
		const clear = must(
			parseRules(css).find((r) => r.selector.includes("> .callout-content")),
			"child clear",
		);
		const parts = splitSelectorList(clear.selector).map((p) => p.trim());
		for (const id of ["quiet", "hush"]) {
			assert.ok(parts.includes(`.callout[data-callout="${id}"] > .callout-title`), clear.selector);
			assert.ok(parts.includes(`.callout[data-callout="${id}"] > .callout-content`), clear.selector);
		}
		assert.strictEqual(valueOf(clear, "background-color"), "transparent !important");
		assert.strictEqual(valueOf(clear, "background-image"), "none !important");
	});

	it("never moves a background for it, and leaves the stripe's ink to the theme", () => {
		// Sleek's stripe is a 10% tint under the theme's ordinary title ink,
		// which reads just as well on the page once the tint is gone.
		const css = themedHarness(SLEEK).css.generateCalloutCSS(gradient({
			transparentBg: true,
			bgColorLight: undefined,
			bgColorDark: undefined,
			bgGradient: undefined,
		}));
		assert.deepStrictEqual(onBox(css, ".anp-callout-sleek", " > .callout-title"), []);
		assert.ok(!parseRules(css).some((r) => valueOf(r, "color") === "var(--cs-accent) !important"), css);
	});

	it("restores the ink where the theme wrote the title in the page colour", () => {
		// flexcyon's plain style: a palette-blue title in --background-primary.
		// With the fill cleared that text is invisible on the page.
		const css = themedHarness(`
			body.flexcyon-plain-callouts .callout .callout-title { color: var(--background-primary); background-color: var(--color-blue); }
		`).css.generateCalloutCSS(definition({ transparentBg: true }));
		const ink = must(
			parseRules(css).find((r) => r.selector.startsWith("body.flexcyon-plain-callouts") && r.props.includes("color")),
			"title ink",
		);
		const parts = splitSelectorList(ink.selector).map((p) => p.trim());
		assert.ok(parts.some((p) => p.endsWith("> .callout-title .callout-title-inner")), ink.selector);
		assert.ok(parts.some((p) => p.endsWith("> .callout-title .callout-icon")), ink.selector);
	});

	it("clears a surface laid over the callout, but not a decoration on it", () => {
		const css = themedHarness(`
			.ulu-line-callouts .callout::after {
				background: rgba(var(--callout-color), 0.3) !important; content: "";
				position: absolute; width: 100%; height: 100%; top: 0; left: -3px;
			}
			.callout::before { background: rgb(var(--callout-color)); position: absolute; width: 3px; height: 80%; }
		`).css.generateCalloutCSS(definition({ transparentBg: true }));
		const layer = must(
			parseRules(css).find((r) => r.selector.startsWith(".ulu-line-callouts") && r.selector.endsWith("::after")),
			"layer clear",
		);
		assert.strictEqual(valueOf(layer, "background-color"), "transparent !important");
		assert.strictEqual(valueOf(layer, "background-image"), "none !important");
		assert.ok(
			!parseRules(css).some((r) => r.at.length === 0 && r.selector.endsWith("::before")),
			"the 3px accent bar is the theme's frame, and stays",
		);
	});

	it("outweighs a generic !important background — GitHubDHC", () => {
		const theirs = "body.callout-on .callout";
		const css = themedHarness(`${theirs} { background-color: var(--background-primary) !important; }`)
			.css.generateCalloutCSS(definition({ transparentBg: true }));
		const root = must(
			parseRules(css).find((r) => r.at.length === 0 && valueOf(r, "background-color") === "transparent !important" && !r.selector.includes(">")),
			"root clear",
		);
		const ours = must(splitSelectorList(root.selector)[0]);
		assert.ok(
			compareSpecificity(specificityOf(ours), specificityOf(theirs)) > 0,
			`${ours} does not outrank ${theirs}`,
		);
	});
});

describe("themes that move the colour somewhere else", () => {
	it("Cyber Glow tints both boxes, so both receive the gradient", () => {
		const css = themedHarness(`
			.callout { background-color: transparent; }
			.callout:not(.is-collapsible) .callout-title { background-color: rgba(var(--callout-color), 0.27); }
			.callout.is-collapsible .callout-title { background-color: rgba(var(--callout-color), 0.27); }
			.callout-content { background-color: rgba(var(--callout-color), 0.25); }
		`).css.generateCalloutCSS(gradient());
		const painted = parseRules(css).filter(
			(r) => r.at.length === 0 && valueOf(r, "background-image")?.includes("linear-gradient(123deg"),
		);
		const boxes = painted.flatMap((r) => splitSelectorList(r.selector).map((p) => p.trim()));
		assert.ok(boxes.some((p) => p.endsWith(":not(.is-collapsible) > .callout-title")), boxes.join("\n"));
		assert.ok(boxes.some((p) => p.endsWith(".is-collapsible > .callout-title")), boxes.join("\n"));
		assert.ok(boxes.some((p) => p.endsWith('[data-callout="apple"] > .callout-content')), boxes.join("\n"));
	});

	it("a theme that only overlays the title keeps the gradient on the root alone", () => {
		const css = themedHarness(`.callout-title { background-color: rgba(var(--callout-color), 0.15); }`)
			.css.generateCalloutCSS(gradient());
		assert.ok(
			!parseRules(css).some((r) => r.selector.includes("> .callout-title") && valueOf(r, "background-image") !== undefined),
			css,
		);
	});
});
