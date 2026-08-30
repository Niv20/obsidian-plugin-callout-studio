/**
 * tests/cssInjectorThemeSurface.test.ts — standing down from the callout
 * surface when the active styling owns it.
 *
 * The three themes named below were reported as broken and are reproduced here
 * from their own stylesheets: GitHub Theme with **GitHub callout style** on,
 * Prism, and Cybertron. What each one asserts is not "the CSS says X" but the
 * cascade outcome that was measured in a browser against Obsidian 1.13.7's
 * `app.css` — the studio callout's surface matches the theme's own callouts, its
 * frame carries the callout's accent rather than the plugin's default text
 * grey, and nothing moves in the state where the theme said nothing.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	harness,
	parseRules,
	themedHarness,
	valueOf,
	must,
	type CssRule,
} from "./support/cssInjectorHarness";
import {
	DEFAULT_TEXT_COLOR_DARK,
	DEFAULT_TEXT_COLOR_LIGHT,
} from "../src/utils/colorUtils";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";

/** `body.callout-on`, the class Style Settings adds for `GitHub callout style`. */
const GITHUB = `
	.callout { background-color: color-mix(in oklch, var(--callout-color) 10%, transparent); }
	body.callout-on .callout {
		border-left: 0.25em solid var(--color-base-30);
		background-color: transparent;
		color: var(--text-muted);
	}
`;

/** Prism, and Cybertron, whose callout section is a copy of it. */
const PRISM = `
	body:not(.pt-disable-callout-styling) .callout:not(.cg-note-toolbar-callout) { background-color: unset; }
	body:not(.pt-disable-callout-styling) .callout:not(.cg-note-toolbar-callout) .callout-title { border: 2px solid; }
	body:not(.pt-disable-callout-styling) .callout:not(.cg-note-toolbar-callout) .callout-content {
		border-right: 1px solid;
		border-bottom: 1px solid;
		border-left: 1px solid;
	}
	body:not(.pt-disable-callout-styling) .callout:not(.cg-note-toolbar-callout)[data-callout=note] > .callout-title {
		background-color: var(--color-grey-base);
		border-color: var(--color-grey-tint);
	}
`;

/** A theme with a real callout background — the 240-of-257 case. */
const OPINIONLESS = `.callout { background-color: rgba(0, 0, 0, 0.05); }`;

const PRISM_GUARD = "body:not(.pt-disable-callout-styling)";

/**
 * A callout shaped like the one in the bug report: a saved palette's accent,
 * background and gradient, plus the text colours the editor *invents* to have
 * something to put in a swatch.
 */
const palette = (over: Record<string, unknown> = {}) =>
	definition({
		id: "apple",
		colorLight: "#3d7ce6",
		colorDark: "#448aff",
		bgColorLight: "#dae8ff",
		bgColorDark: "#243249",
		textColorLight: DEFAULT_TEXT_COLOR_LIGHT,
		textColorDark: DEFAULT_TEXT_COLOR_DARK,
		bgGradient: {
			angleDeg: 135,
			toColorLight: "#deffcc",
			toColorDark: "#284916",
		},
		...over,
	});

/** Every rule whose selector begins with `guard`. */
const under = (css: string, guard: string): CssRule[] =>
	parseRules(css).filter((r) => r.selector.startsWith(guard));

/** The one rule under `guard` that declares `prop`. */
const ruleDeclaring = (css: string, guard: string, prop: string): CssRule =>
	must(
		under(css, guard).find((r) => r.props.includes(prop)),
		`rule under "${guard}" declaring ${prop}`,
	);

describe("GitHub Theme — `GitHub callout style`", () => {
	it("cancels the background under the theme's own class, and only there", () => {
		// Measured: with `callout-on` on, every built-in drops to a transparent
		// surface while the studio callout kept a 22% tint and a gradient. The
		// cancel is emitted as a rule under `body.callout-on` rather than by
		// withholding the background, because Style Settings toggles that class
		// without firing `css-change` — one stylesheet has to carry both states.
		const { css } = themedHarness(GITHUB);
		const out = css.generateCalloutCSS(palette());
		const rule = ruleDeclaring(out, "body.callout-on", "background-color");
		assert.strictEqual(valueOf(rule, "background-color"), "transparent !important");
		assert.strictEqual(valueOf(rule, "background-image"), "none !important");
	});

	it("leaves the unguarded rules exactly as they were", () => {
		// This IS the disabled state: with the class off, nothing under
		// `body.callout-on` matches, so what renders is the text below — which
		// must be byte-identical to a vault whose theme says nothing at all.
		const themed = themedHarness(GITHUB).css.generateCalloutCSS(palette());
		const plain = harness().css.generateCalloutCSS(palette());
		const unguarded = (css: string): string =>
			parseRules(css)
				.filter((r) => !r.selector.includes("body.callout-on"))
				.map((r) => `${r.at.join("|")} ${r.selector} { ${r.decls.join("; ")} }`)
				.join("\n");
		assert.strictEqual(unguarded(themed), unguarded(plain));
	});

	it("is the whole runtime transition: no re-inject, no second stylesheet", () => {
		// The guarded cancel and the rule it cancels sit in one generated sheet, so
		// flipping the body class flips the render in the browser. Both halves
		// present is the property that makes that true.
		const out = themedHarness(GITHUB).css.generateCalloutCSS(palette());
		assert.ok(
			parseRules(out).some(
				(r) =>
					!r.selector.includes("body.callout-on") &&
					r.props.includes("background-color") &&
					(valueOf(r, "background-color") ?? "").includes("color-mix"),
			),
			"the ordinary background rule must still be emitted",
		);
		assert.ok(under(out, "body.callout-on").length > 0);
	});

	it("keeps the accent on the icon and title, and does not touch the theme's own border", () => {
		// GitHub draws the callout's left bar in `--color-base-30` — a grey every
		// built-in gets too — so it is not this plugin's to repaint. The accent
		// still reaches the icon and title through `--callout-color`, which the
		// unguarded rule sets.
		const out = themedHarness(GITHUB).css.generateCalloutCSS(palette());
		assert.strictEqual(
			under(out, "body.callout-on").filter((r) => r.props.includes("border-color"))
				.length,
			0,
		);
		assert.ok(out.includes("--callout-color:"));
	});
});

describe("Prism — the frame is the callout's accent, and nothing spills", () => {
	it("paints no background at all under the guard", () => {
		// Prism leaves `.callout` blank and builds the visible box out of the title
		// and content borders, so `.callout` is a LARGER box with a different
		// radius: measured, the plugin's tint stuck 4px past the frame all round
		// and the 135° gradient put its far stop in the bottom-right corner, which
		// is the strip in the report.
		const out = themedHarness(PRISM).css.generateCalloutCSS(palette());
		const rule = ruleDeclaring(out, PRISM_GUARD, "background-color");
		assert.strictEqual(valueOf(rule, "background-color"), "transparent !important");
		assert.strictEqual(valueOf(rule, "background-image"), "none !important");
		for (const r of under(out, PRISM_GUARD)) {
			for (const d of r.decls) {
				assert.ok(
					!/#[0-9a-f]{3,8}|color-mix|linear-gradient/i.test(d),
					`no colour may survive under the guard: ${r.selector} { ${d} }`,
				);
			}
		}
	});

	it("also cancels the PDF-export ::before, which is a second copy of the surface", () => {
		// `printGradientCSS` repaints the gradient onto a `::before` at `inset: 0`
		// for macOS Preview's sake. Left alone it spills in print exactly as the
		// first copy did on screen.
		const out = themedHarness(PRISM).css.generateCalloutCSS(palette());
		const rule = must(
			parseRules(out).find(
				(r) =>
					r.selector.startsWith(PRISM_GUARD) &&
					r.selector.includes("::before") &&
					r.at.includes("@media print"),
			),
			"print ::before cancel",
		);
		assert.strictEqual(valueOf(rule, "background-image"), "none !important");
		// Never `content`: killing the pseudo-element would take a theme's own with it.
		assert.ok(!rule.props.includes("content"));
	});

	it("hands the frame the accent, on both boxes, never on the callout root", () => {
		// Measured before: `rgb(224,224,224)`, i.e. #e0e0e0 — the plugin's own
		// default text colour reaching `currentColor` through the theme's
		// colourless `border: 2px solid`. After: the callout's accent.
		const out = themedHarness(PRISM).css.generateCalloutCSS(palette());
		const rule = ruleDeclaring(out, PRISM_GUARD, "border-color");
		assert.strictEqual(valueOf(rule, "border-color"), "var(--cs-accent) !important");
		assert.ok(rule.selector.includes("> .callout-title"));
		assert.ok(rule.selector.includes("> .callout-content"));
		// The callout root is where the plugin's own global border paints; leaving
		// it alone is what keeps the two features from colliding.
		for (const part of rule.selector.split(",")) {
			assert.ok(/> \.callout-(title|content)$/.test(part.trim()), part);
		}
	});

	it("withdraws the invented text colour, so the theme's own ink returns", () => {
		const out = themedHarness(PRISM).css.generateCalloutCSS(palette());
		const rule = ruleDeclaring(out, PRISM_GUARD, "color");
		assert.strictEqual(valueOf(rule, "color"), "inherit !important");
		assert.ok(rule.selector.endsWith("> .callout-content"));
	});

	it("keeps a text colour the user actually chose", () => {
		// The line `hasAuthoredTextColors` draws for the save path, held here too:
		// #e0e0e0 is a value the editor invents to fill a swatch, #ff0000 is not.
		const out = themedHarness(PRISM).css.generateCalloutCSS(
			palette({ textColorLight: "#ff0000", textColorDark: "#ff0000" }),
		);
		assert.strictEqual(
			under(out, PRISM_GUARD).filter((r) => r.props.includes("color")).length,
			0,
		);
	});

	it("works for any accent, because it never names one", () => {
		for (const hex of ["#3d7ce6", "#ff8800", "#00ffaa"]) {
			const out = themedHarness(PRISM).css.generateCalloutCSS(
				palette({ colorLight: hex, colorDark: hex }),
			);
			assert.strictEqual(
				valueOf(ruleDeclaring(out, PRISM_GUARD, "border-color"), "border-color"),
				"var(--cs-accent) !important",
			);
		}
	});

	it("covers every alias the same way", () => {
		const out = themedHarness(PRISM).css.generateCalloutCSS(
			palette({ aliases: ["pomme"] }),
		);
		const rule = ruleDeclaring(out, PRISM_GUARD, "background-color");
		assert.ok(rule.selector.includes('[data-callout="apple"]'));
		assert.ok(rule.selector.includes('[data-callout="pomme"]'));
	});

	it("stands down for a callout the user asked to be transparent", () => {
		// `transparentBorderProps` already emits `border-color: transparent` for
		// that definition, and the user's own ask outranks the theme's frame.
		const out = themedHarness(PRISM).css.generateCalloutCSS(
			palette({ transparentBg: true }),
		);
		assert.strictEqual(
			under(out, PRISM_GUARD).filter((r) => r.props.includes("border-color")).length,
			0,
		);
	});

	it("emits nothing at all for a definition with no background to cancel", () => {
		const out = themedHarness(PRISM).css.generateCalloutCSS(
			definition({ id: "apple" }),
		);
		assert.strictEqual(
			under(out, PRISM_GUARD).filter((r) => r.props.includes("background-color"))
				.length,
			0,
		);
	});
});

describe("Cybertron — background-free, and the theme's own cyan back on the text", () => {
	// Cybertron is Prism's callout section with the per-id rules removed; its
	// built-ins frame themselves in `--text-normal`, which is the theme's cyan.
	const CYBERTRON = `
		body:not(.pt-disable-callout-styling) .callout { background-color: unset; }
		body:not(.pt-disable-callout-styling) .callout .callout-title { border: 2px solid; }
		body:not(.pt-disable-callout-styling) .callout .callout-content { border-right: 1px solid; }
	`;

	it("cancels the surface, the ink and the frame in one block", () => {
		const out = themedHarness(CYBERTRON).css.generateCalloutCSS(palette());
		assert.strictEqual(
			valueOf(ruleDeclaring(out, PRISM_GUARD, "background-color"), "background-color"),
			"transparent !important",
		);
		assert.strictEqual(
			valueOf(ruleDeclaring(out, PRISM_GUARD, "color"), "color"),
			"inherit !important",
		);
		assert.strictEqual(
			valueOf(ruleDeclaring(out, PRISM_GUARD, "border-color"), "border-color"),
			"var(--cs-accent) !important",
		);
	});

	it("names no colour of the theme's own anywhere", () => {
		// `--cs-accent` is declared on the callout root for every definition in
		// every mode, so the frame follows an arbitrary custom colour and a nested
		// callout gets its own — with nothing about Cybertron written down.
		const out = themedHarness(CYBERTRON).css.generateCalloutCSS(palette());
		assert.ok(!out.includes("5dbcd2"));
		assert.ok(!out.toLowerCase().includes("cyan"));
	});
});

describe("the cancel has to outrank what it cancels", () => {
	it("clears the dark-mode block, whose `.theme-dark` is a class of its own", () => {
		// An unguarded cancel at weight + 1 would only TIE the dark rule and win on
		// source order. weight + 2 wins outright, in every guard including the
		// empty one, with no dependence on where in the file this lands.
		const out = themedHarness(
			`.callout { background-color: transparent; }`,
		).css.generateCalloutCSS(palette());
		const dark = must(
			parseRules(out).find((r) => r.selector.startsWith(".theme-dark ")),
			"dark rule",
		);
		const cancel = must(
			parseRules(out).find(
				(r) => valueOf(r, "background-color") === "transparent !important",
			),
			"cancel rule",
		);
		assert.ok(
			compareSpecificity(
				specificityOf(cancel.selector),
				specificityOf(dark.selector),
			) > 0,
			`${cancel.selector} must outweigh ${dark.selector}`,
		);
	});
});

describe("a standalone CSS-snippet export carries none of this", () => {
	it("drops the guarded block, because the guard outlives the theme", () => {
		// Prism's guard is an opt-out: `body:not(.pt-disable-callout-styling)` is
		// satisfied in every vault that has never heard of Prism. A snippet
		// carrying it would blank callout backgrounds under every theme, for good.
		const themed = themedHarness(PRISM);
		const def = palette();
		assert.strictEqual(
			themed.injector.generateCalloutCSS(def, true).includes(PRISM_GUARD),
			false,
		);
		// …while the live pass, on the same injector, still emits it.
		assert.ok(themed.injector.generateCalloutCSS(def).includes(PRISM_GUARD));
	});
});

describe("a theme with no opinion is untouched", () => {
	it("emits byte-identical text to a vault with no theme at all", () => {
		// 240 of the 257 installed themes. This is the assertion that keeps the
		// mechanism invisible everywhere it was not asked for.
		const def = palette();
		assert.strictEqual(
			themedHarness(OPINIONLESS).css.generateCalloutCSS(def),
			harness().css.generateCalloutCSS(def),
		);
	});

	it("and so does the fallback block for unknown ids", () => {
		const def = palette();
		const themed = themedHarness(OPINIONLESS);
		themed.registry.add(def);
		themed.registry.settings.fallbackCalloutId = def.id;
		const plain = harness();
		plain.registry.add(def);
		plain.registry.settings.fallbackCalloutId = def.id;
		assert.strictEqual(
			themed.css.generateFallbackCSS(themed.registry.getAll()),
			plain.css.generateFallbackCSS(plain.registry.getAll()),
		);
	});

	it("but the fallback DOES stand down when the styling claims the surface", () => {
		// An unknown id is painted by that block, so it inherits the block's
		// quarrel with a theme that blanks the callout background.
		const themed = themedHarness(PRISM);
		const def = palette();
		themed.registry.add(def);
		themed.registry.settings.fallbackCalloutId = def.id;
		const out = themed.css.generateFallbackCSS(themed.registry.getAll());
		assert.strictEqual(
			valueOf(ruleDeclaring(out, PRISM_GUARD, "background-color"), "background-color"),
			"transparent !important",
		);
		// The guard replaces this block's own `body`. Prefixing it instead asks for
		// a body inside a body, which matches nothing — and matched nothing
		// silently, which is how it survived the first draft.
		assert.ok(!out.includes("body:not(.pt-disable-callout-styling) body"));
		assert.ok(
			ruleDeclaring(out, PRISM_GUARD, "background-color").selector.includes(
				":not(",
			),
			"the fallback keeps its exclusion chain",
		);
	});

	it("keeps the plain `body` prefix when the guard is empty", () => {
		const themed = themedHarness(`.callout { background: none; }`);
		const def = palette();
		themed.registry.add(def);
		themed.registry.settings.fallbackCalloutId = def.id;
		const out = themed.css.generateFallbackCSS(themed.registry.getAll());
		assert.ok(
			parseRules(out).some(
				(r) =>
					r.selector.startsWith("body .callout.callout.callout") &&
					valueOf(r, "background-color") === "transparent !important",
			),
			out,
		);
	});
});
