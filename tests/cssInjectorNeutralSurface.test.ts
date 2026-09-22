/** Theme layouts with an accent-tinted title and a neutral callout body. */
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
import { splitSelectorList } from "../src/utils/selectorText";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

/** The relevant root/title rules from AnuPpuccin's Vanilla and Sleek styles. */
const ANUPPUCCIN = `
	.anp-callout-vanilla-normal .callout:not([data-callout-metadata*=anp-sleek],
	[data-callout-metadata*=anp-vanilla-plus], [data-callout-metadata*=anp-block]):not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]),
	.callout[data-callout-metadata*=anp-vanilla-normal]:not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]) { background-color: transparent; }
	.anp-callout-vanilla-normal .callout:not([data-callout-metadata*=anp-sleek],
	[data-callout-metadata*=anp-vanilla-plus], [data-callout-metadata*=anp-block]):not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]) > .callout-title,
	.callout[data-callout-metadata*=anp-vanilla-normal]:not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]) > .callout-title {
		background-color: rgba(var(--callout-color), var(--callout-title-opacity, 0.1));
	}
	.anp-callout-vanilla-normal .callout:not([data-callout-metadata*=anp-sleek],
	[data-callout-metadata*=anp-vanilla-plus], [data-callout-metadata*=anp-block]) > .callout-content {
		background-color: rgb(var(--ctp-mantle));
	}
	.anp-callout-vanilla-plus .callout:not([data-callout-metadata*=anp-sleek],
	[data-callout-metadata*=anp-vanilla-normal], [data-callout-metadata*=anp-block]),
	.callout[data-callout-metadata*=anp-vanilla-plus]:not([data-callout-metadata*=revert]) {
		background-color: transparent;
	}
	.anp-callout-sleek .callout:not([data-callout-metadata*=anp-block],
	[data-callout-metadata*=anp-vanilla-normal], [data-callout-metadata*=anp-vanilla-plus]),
	.callout[data-callout-metadata*=anp-sleek]:not([data-callout-metadata*=revert]) {
		background-color: rgba(var(--ctp-mantle), 0.4);
	}
	.anp-callout-sleek .callout:not([data-callout-metadata*=anp-block],
	[data-callout-metadata*=anp-vanilla-normal], [data-callout-metadata*=anp-vanilla-plus]) > .callout-title,
	.callout[data-callout-metadata*=anp-sleek]:not([data-callout-metadata*=revert]) > .callout-title {
		background-color: rgba(var(--callout-color), var(--callout-title-opacity, 0.1));
	}
	.callout { --callout-blend-mode: normal; }
`;

/** Soft Paper uses a neutral root in light mode and a transparent one in dark. */
const SOFT_PAPER = `
	.theme-light .callout:not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]) {
		background-color: rgba(var(--ctp-mantle), 0.4);
	}
	.theme-dark .callout:not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]) {
		background-color: transparent;
	}
	.theme-light .callout:not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]) > .callout-title {
		background-color: rgba(var(--callout-color), var(--callout-title-opacity, 0.1));
	}
	.theme-dark .callout:not([data-callout-metadata*=revert],
	[data-callout=blank-container], [data-callout=multi-column]) > .callout-title {
		background-color: rgba(var(--callout-color), 0.15);
	}
`;

const palette = (over: Record<string, unknown> = {}) =>
	definition({
		id: "apple",
		colorLight: "#3d7ce6",
		colorDark: "#448aff",
		bgColorLight: "#dae8ff",
		bgColorDark: "#243249",
		bgGradient: {
			angleDeg: 135,
			toColorLight: "#deffcc",
			toColorDark: "#284916",
		},
		...over,
	});

const ruleFor = (css: string, guard: string): CssRule =>
	must(
		parseRules(css).find(
			(r) => r.selector.startsWith(guard) && r.props.includes("background-color"),
		),
		`background rule under ${guard}`,
	);

describe("AnuPpuccin neutral content", () => {
	it("restores the native root in Vanilla Normal, Plus, and Sleek", () => {
		const out = themedHarness(ANUPPUCCIN).css.generateCalloutCSS(palette());
		for (const guard of [".anp-callout-vanilla-normal", ".anp-callout-vanilla-plus"]) {
			const rule = ruleFor(out, guard);
			assert.strictEqual(valueOf(rule, "background-color"), "transparent !important");
			assert.strictEqual(valueOf(rule, "background-image"), "none !important");
			assert.ok(rule.selector.includes("data-callout-metadata"));
		}
		const sleek = ruleFor(out, ".anp-callout-sleek");
		assert.strictEqual(
			valueOf(sleek, "background-color"),
			"rgba(var(--ctp-mantle), 0.4) !important",
		);
		assert.ok(out.includes("--callout-color:"), "the title still receives the custom accent");
		assert.ok(!sleek.decls.some((decl) => decl.includes("--background-primary")));
	});

	it("keeps metadata overrides, aliases, and print gradients scoped", () => {
		const out = themedHarness(ANUPPUCCIN).css.generateCalloutCSS(
			palette({ aliases: ["pomme"] }),
		);
		const normal = ruleFor(out, ".anp-callout-vanilla-normal");
		assert.ok(normal.selector.includes("anp-sleek"));
		assert.ok(normal.selector.includes("anp-block"));
		assert.ok(normal.selector.includes("data-callout=multi-column"));
		assert.strictEqual(splitSelectorList(normal.selector).length, 2);
		assert.ok(normal.selector.includes('[data-callout="apple"]'));
		assert.ok(normal.selector.includes('[data-callout="pomme"]'));
		const optIn = parseRules(out).find((r) =>
			r.selector.startsWith(".callout") &&
			r.selector.includes("[data-callout-metadata*=anp-vanilla-normal]") &&
			r.props.includes("background-color"),
		);
		assert.ok(optIn, "metadata can select Vanilla Normal without its body class");
		const print = must(
			parseRules(out).find((r) =>
				r.selector.startsWith(".anp-callout-vanilla-normal") &&
				r.selector.includes("::before") &&
				r.at.includes("@media print"),
			),
			"print cancellation",
		);
		assert.strictEqual(splitSelectorList(print.selector).length, 2);
		assert.strictEqual(valueOf(print, "background-image"), "none !important");
	});
});

describe("Soft Paper light and dark surfaces", () => {
	it("uses each mode's own neutral root without changing metadata exclusions", () => {
		const out = themedHarness(SOFT_PAPER).css.generateCalloutCSS(palette());
		const light = ruleFor(out, ".theme-light");
		const dark = must(
			parseRules(out).find((r) =>
				r.selector.startsWith(".theme-dark") &&
				r.selector.includes("data-callout-metadata*=revert") &&
				r.props.includes("background-color"),
			),
			"dark theme surface cancellation",
		);
		assert.strictEqual(
			valueOf(light, "background-color"),
			"rgba(var(--ctp-mantle), 0.4) !important",
		);
		assert.strictEqual(valueOf(dark, "background-color"), "transparent !important");
		const authoredDark = ruleFor(out, ".theme-dark");
		assert.ok(
			compareSpecificity(specificityOf(dark.selector), specificityOf(authoredDark.selector)) > 0,
			"theme surface cancellation must beat the palette's dark tint",
		);
		assert.ok(light.selector.includes("data-callout=multi-column"));
		assert.ok(dark.selector.includes("data-callout-metadata*=revert"));
	});
});
