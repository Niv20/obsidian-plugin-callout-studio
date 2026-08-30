/**
 * tests/calloutSurfaceScan.test.ts — what the active styling says about the
 * surface of a callout it has never heard of.
 *
 * Every fixture below is a real excerpt from a theme installed in the
 * development vault, trimmed to the rule that carries the fact, and every count
 * in the comments is a measurement across all 257 of them. That matters more
 * here than in most scanners: the guard this reads is re-stated verbatim in
 * front of a selector the plugin writes, so a rule that is too loose does not
 * degrade — it applies the theme's condition to something the theme never said.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { scanCalloutSurface } from "../src/manager/theme/calloutSurfaceScan";
import {
	resolveCalloutSurface,
	guardPrefix,
} from "../src/manager/theme/calloutSurface";

const guards = (css: string): string[] => [
	...scanCalloutSurface(css).neutralBackground,
];
const frames = (css: string): string[] => [
	...scanCalloutSurface(css).colorlessFrame,
];
const painted = (css: string): string[] => [
	...scanCalloutSurface(css).framePainted,
];

describe("the surface scan — blanked backgrounds", () => {
	it("reads GitHub Theme's Style Settings class toggle", () => {
		// `GitHub callout style` is a `class-toggle` with `id: callout-on`, so
		// Style Settings puts the class on <body>. Carrying the guard is the whole
		// mechanism: Style Settings' setSetting fires no `css-change`, so a
		// decision taken in JS would never be revisited.
		assert.deepStrictEqual(
			guards(`body.callout-on .callout {
				border-left: 0.25em solid var(--color-base-30);
				background-color: transparent;
				color: var(--text-muted);
			}`),
			["body.callout-on"],
		);
	});

	it("reads Prism's opt-out guard, and drops the state qualifier on .callout", () => {
		// The `:not(.cg-note-toolbar-callout)` sits on the callout compound this
		// plugin's own selector replaces, so it is not part of the guard. The
		// `body:not(…)` one is, and it is what lets Prism's own "disable callout
		// styling" option put the plugin's background back.
		assert.deepStrictEqual(
			guards(`body:not(.pt-disable-callout-styling) .callout:not(.cg-note-toolbar-callout) {
				background-color: unset;
			}`),
			["body:not(.pt-disable-callout-styling)"],
		);
	});

	it("reads Cybertron, which is the same rule without the extra :not()", () => {
		assert.deepStrictEqual(
			guards(`body:not(.pt-disable-callout-styling) .callout { background-color: unset; }`),
			["body:not(.pt-disable-callout-styling)"],
		);
	});

	it("reads an unguarded rule as the empty guard — Cyber Glow, Notation 2, Polka", () => {
		assert.deepStrictEqual(
			guards(`.callout { background-color: transparent; }`),
			[""],
		);
		assert.strictEqual(guardPrefix(""), "");
	});

	it("accepts every spelling of `no background` the corpus uses", () => {
		// `unset` (Prism, Cybertron), `transparent` (GitHub, Minimal, Oxygen…),
		// Oxygen's spelled-out `rgba(0,0,0,0)`, and the `background` shorthand
		// (Glass Robo, Polka, Ultra Lobster).
		for (const value of ["unset", "transparent", "rgba(0,0,0,0)", "initial", "revert"]) {
			assert.deepStrictEqual(
				guards(`.callouts-outlined .callout { background-color: ${value}; }`),
				[".callouts-outlined"],
				value,
			);
		}
		assert.deepStrictEqual(
			guards(`.ulu-line-callouts .callout { background: transparent !important; }`),
			[".ulu-line-callouts"],
		);
		// `background: none` blanks it; `background-color: none` is invalid and the
		// parser drops it, so believing it would be believing a dead declaration.
		assert.deepStrictEqual(guards(`.callout { background: none; }`), [""]);
		assert.deepStrictEqual(guards(`.callout { background-color: none; }`), []);
	});

	it("keeps a multi-class and a comma-carrying guard whole", () => {
		// Shiba Inu compounds two classes; Iridium's `:not()` holds a list, which a
		// naive comma split would have torn in half.
		assert.deepStrictEqual(
			guards(`.shib-callout-toggle.shib-callout-block .callout { background-color: unset; }`),
			[".shib-callout-toggle.shib-callout-block"],
		);
		assert.deepStrictEqual(
			guards(`body:not(.i-callout-filled, .i-callout-outlined-filled) .callout { background: transparent; }`),
			["body:not(.i-callout-filled, .i-callout-outlined-filled)"],
		);
	});

	it("says nothing about a background the theme actually paints", () => {
		assert.deepStrictEqual(
			guards(`.callout { background-color: color-mix(in oklch, var(--callout-color) 10%, transparent); }`),
			[],
		);
		assert.deepStrictEqual(
			guards(`.callout { background-color: rgba(var(--callout-color), 0.2); }`),
			[],
		);
	});

	it("says nothing about a rule that names an id", () => {
		// A per-id rule cannot reach a callout the user invented, so it is not
		// evidence about what happens to one. This is the asymmetry the whole
		// module rests on.
		assert.deepStrictEqual(
			guards(`.callout[data-callout="note"] { background-color: transparent; }`),
			[],
		);
		assert.deepStrictEqual(
			guards(`.callout:not([data-callout="note"]) { background-color: transparent; }`),
			[],
		);
	});

	it("refuses a guard it could not restate", () => {
		// A child combinator means something different in front of our selector; an
		// id or an attribute is not a state this plugin can reason about. Each
		// drops the fact rather than guessing — see calloutSurfaceTarget.ts.
		for (const sel of [
			"body > .callout",
			"#app .callout",
			"body[data-mode] .callout",
			"* .callout",
			"body::after .callout",
		]) {
			assert.deepStrictEqual(
				guards(`${sel} { background-color: transparent; }`),
				[],
				sel,
			);
		}
	});
});

describe("the surface scan — colourless frames", () => {
	it("reads Prism's and Cybertron's two-part frame", () => {
		// The visible box is the title's 2px border over the content's 1px ones,
		// and neither states a colour — so both draw in `currentColor`, which this
		// plugin was overwriting through `.callout-content { color }`.
		const css = `
			body:not(.pt-disable-callout-styling) .callout .callout-title { border: 2px solid; }
			body:not(.pt-disable-callout-styling) .callout .callout-content {
				border-right: 1px solid;
				border-bottom: 1px solid;
				border-left: 1px solid;
			}`;
		assert.deepStrictEqual(frames(css), ["body:not(.pt-disable-callout-styling)"]);
		assert.deepStrictEqual(painted(css), []);
	});

	it("reads a frame with no .callout ancestor at all — Cyber Glow", () => {
		assert.deepStrictEqual(frames(`.callout-content { border-top: 2px solid; }`), [""]);
	});

	it("records a coloured frame as painted, not as colourless", () => {
		// Shiba Inu writes both in the same rule, and the colour it reaches for is
		// `--callout-color` — which this plugin already sets to the custom accent,
		// so that theme works today and must be left alone.
		const css = `.shib-callout-toggle.shib-callout-style-1 .callout .callout-title {
			border: 2px solid;
			border-color: color-mix(in srgb, var(--callout-color) 40%, transparent);
		}`;
		assert.deepStrictEqual(frames(css), [".shib-callout-toggle.shib-callout-style-1"]);
		assert.deepStrictEqual(painted(css), [".shib-callout-toggle.shib-callout-style-1"]);
		// …and the veto is what the fold makes of that pair.
		assert.deepStrictEqual(
			resolveCalloutSurface([scanCalloutSurface(css)]).colorlessFrame,
			[],
		);
	});

	it("ignores a border that states its colour inline, and one that does not draw", () => {
		assert.deepStrictEqual(
			frames(`.callout-title { border-left: 0.25em solid var(--color-base-30); }`),
			[],
		);
		assert.deepStrictEqual(frames(`.callout-title { border-bottom: 1px none; }`), []);
		// A longhand pair is a frame the theme has coloured, somewhere.
		assert.deepStrictEqual(frames(`.callout-title { border-style: solid; }`), []);
	});
});

describe("folding several sheets", () => {
	it("lets a snippet blank the surface exactly as a theme can", () => {
		const surface = resolveCalloutSurface([
			scanCalloutSurface(`.callout { background-color: color-mix(in oklch, var(--callout-color) 10%, transparent); }`),
			scanCalloutSurface(`body.flat .callout { background-color: transparent; }`),
		]);
		assert.deepStrictEqual(surface.neutralBackground, ["body.flat"]);
	});

	it("lets an unguarded rule swallow every guarded one", () => {
		// It already applies in every state they name, so keeping them would emit
		// three copies of one rule.
		const surface = resolveCalloutSurface([
			scanCalloutSurface(`
				.a .callout { background-color: transparent; }
				.callout { background-color: unset; }
				.b .callout { background: none; }`),
		]);
		assert.deepStrictEqual(surface.neutralBackground, [""]);
	});

	it("sorts the guards, because the stylesheet is compared byte-for-byte", () => {
		// CSSInjector.injectNow skips the stylesheet swap, the localStorage write
		// and the `css-change` when the text is unchanged. An unordered set would
		// make that comparison depend on scan order.
		const surface = resolveCalloutSurface([
			scanCalloutSurface(`
				.zzz .callout { background: none; }
				.aaa .callout { background: none; }
				.mmm .callout { background: none; }`),
		]);
		assert.deepStrictEqual(surface.neutralBackground, [".aaa", ".mmm", ".zzz"]);
	});

	it("one coloured frame anywhere vetoes every colourless one", () => {
		// Deliberately global rather than per guard: a theme that states the colour
		// in a separate rule under a different guard would slip a per-guard veto,
		// and the cost of being wrong is painting over a colour the theme chose.
		const surface = resolveCalloutSurface([
			scanCalloutSurface(`.a .callout .callout-title { border: 2px solid; }`),
			scanCalloutSurface(`.b .callout .callout-content { border-top: 1px solid red; }`),
		]);
		assert.deepStrictEqual(surface.colorlessFrame, []);
		assert.deepStrictEqual(surface.neutralBackground, []);
	});

	it("says nothing at all for a theme with no opinion — 240 of 257", () => {
		const surface = resolveCalloutSurface([scanCalloutSurface("")]);
		assert.deepStrictEqual(surface.neutralBackground, []);
		assert.deepStrictEqual(surface.colorlessFrame, []);
	});
});
