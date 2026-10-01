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
	...scanCalloutSurface(css).neutralBackground.map((bg) => bg.guard),
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

	it("reads Prism's opt-out guard and keeps the root state qualifier", () => {
		// The `:not(.cg-note-toolbar-callout)` sits on the callout compound this
		// plugin's own selector replaces, so it is not part of the guard. The
		// `body:not(…)` one is the ancestor guard; the root condition is kept
		// separately so Prism's opt-out and toolbar exclusions both work.
		assert.deepStrictEqual(
			guards(`body:not(.pt-disable-callout-styling) .callout:not(.cg-note-toolbar-callout) {
				background-color: unset;
			}`),
			["body:not(.pt-disable-callout-styling)"],
		);
	});

	it("keeps AnuPpuccin Vanilla's metadata conditions on both selector branches", () => {
		const css = `
			.anp-callout-vanilla-normal .callout:not([data-callout-metadata*=anp-sleek],
			[data-callout-metadata*=anp-block]):not([data-callout-metadata*=revert],
			[data-callout=blank-container], [data-callout=multi-column]),
			.callout[data-callout-metadata*=anp-vanilla-normal]:not([data-callout-metadata*=revert],
			[data-callout=blank-container], [data-callout=multi-column]) {
				background-color: transparent;
			}`;
		const backgrounds = scanCalloutSurface(css).neutralBackground;
		assert.strictEqual(backgrounds.length, 2);
		assert.strictEqual(backgrounds[0]?.guard, ".anp-callout-vanilla-normal");
		assert.ok(backgrounds[0]?.rootQualifier.includes("anp-sleek"));
		assert.ok(backgrounds[0]?.rootQualifier.includes("anp-block"));
		assert.ok(backgrounds[0]?.rootQualifier.includes("data-callout=multi-column"));
		assert.strictEqual(backgrounds[1]?.guard, "");
		assert.ok(backgrounds[1]?.rootQualifier.startsWith("[data-callout-metadata*=anp-vanilla-normal]"));
		assert.ok(backgrounds.every((bg) => bg.color === "transparent"));
	});

	it("restores a neutral root only when the matching title uses the accent", () => {
		const sleek = `.anp-callout-sleek .callout:not([data-callout-metadata*=anp-block]) {
			background-color: rgba(var(--ctp-mantle), 0.4);
		}
		.anp-callout-sleek .callout:not([data-callout-metadata*=anp-block]) > .callout-title {
			background-color: rgba(var(--callout-color), var(--callout-title-opacity, 0.1));
		}`;
		assert.deepStrictEqual(scanCalloutSurface(sleek).neutralBackground, [
			{
				guard: ".anp-callout-sleek",
				rootQualifier: ":not([data-callout-metadata*=anp-block])",
				color: "rgba(var(--ctp-mantle), 0.4)",
			},
		]);
		assert.deepStrictEqual(
			scanCalloutSurface(`.callout { background-color: rgba(0, 0, 0, 0.05); }`).neutralBackground,
			[],
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

	it("rejects a named id but retains a negative id condition", () => {
		// A per-id rule cannot reach a callout the user invented, so it is not
		// evidence about what happens to one. This is the asymmetry the whole
		// module rests on.
		assert.deepStrictEqual(
			guards(`.callout[data-callout="note"] { background-color: transparent; }`),
			[],
		);
		const excluded = scanCalloutSurface(
			`.callout:not([data-callout="note"]) { background-color: transparent; }`,
		);
		assert.deepStrictEqual(excluded.neutralBackground, [
			{ guard: "", rootQualifier: ':not([data-callout="note"])', color: "transparent" },
		]);
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
		assert.deepStrictEqual(surface.neutralBackground.map((bg) => bg.guard), ["body.flat"]);
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
		assert.deepStrictEqual(surface.neutralBackground.map((bg) => bg.guard), [""]);
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
		assert.deepStrictEqual(
			surface.neutralBackground.map((bg) => bg.guard),
			[".aaa", ".mmm", ".zzz"],
		);
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

	it("says nothing at all for a theme with no surface opinion", () => {
		const surface = resolveCalloutSurface([scanCalloutSurface("")]);
		assert.deepStrictEqual(surface.neutralBackground, []);
		assert.deepStrictEqual(surface.colorlessFrame, []);
	});
});

/** One fill as `box [guard] [root conditions] accent|fixed`, whitespace folded. */
const fills = (css: string): string[] =>
	scanCalloutSurface(css).fills.map(
		(f) =>
			`${f.box}${f.pseudo} [${f.guard}] [${f.rootQualifier.replace(/\s+/g, " ")}] ` +
			`${f.accent ? "accent" : "fixed"}${f.ownOpacity ? " own-opacity" : ""}`,
	);

describe("the surface scan — fills inside the callout", () => {
	it("reads a title stripe in all three shapes the corpus writes", () => {
		// AnuPpuccin Sleek (child combinator under a root step), Cyber Glow
		// (descendant), Composer's WindowPanel style (no root step at all).
		assert.deepStrictEqual(
			fills(`
				.anp-callout-sleek .callout:not([data-callout-metadata*=anp-block]) > .callout-title {
					background-color: rgba(var(--callout-color), var(--callout-title-opacity, 0.1));
				}
				.callout:not(.is-collapsible) .callout-title { background-color: rgba(var(--callout-color), 0.27); }
				.composer--WindowPanelCallout .callout-title {
					background-color: color-mix(in srgb, var(--callout-color) 10%, transparent);
				}`),
			[
				"title [.anp-callout-sleek] [:not([data-callout-metadata*=anp-block])] accent",
				"title [] [:not(.is-collapsible)] accent",
				"title [.composer--WindowPanelCallout] [] accent",
			],
		);
	});

	it("tells the theme's own colour from the accent, on either box", () => {
		// AnuPpuccin Vanilla fills the content with its neutral mantle; Cyber Glow
		// tints a bare `.callout-content` from the accent; flexcyon's plain style
		// fills the title with a fixed palette blue.
		assert.deepStrictEqual(
			fills(`
				.anp-callout-vanilla-normal .callout > .callout-content { background-color: rgb(var(--ctp-mantle)); }
				.callout-content { background-color: rgba(var(--callout-color), 0.25); }
				body.flexcyon-plain-callouts .callout .callout-title { color: var(--background-primary); background-color: var(--color-blue); }`),
			[
				"content [.anp-callout-vanilla-normal] [] fixed",
				"content [] [] accent",
				"title [body.flexcyon-plain-callouts] [] fixed",
			],
		);
	});

	it("refuses a fill the theme only paints in a state", () => {
		// Cyber Glow's hover and active tints. A background moved onto the title
		// because of them would be painted permanently.
		assert.deepStrictEqual(
			fills(`
				.callout.is-collapsible .callout-title:hover { background-color: rgba(var(--callout-color), 0.4); }
				.callout.is-collapsible .callout-title:active { background-color: rgba(var(--callout-color), 0.5); }`),
			[],
		);
	});

	it("records nothing for a rule that removes a fill, or one that names an id", () => {
		assert.deepStrictEqual(
			fills(`
				.callout-alternate-line .callout .callout-title { background: transparent; }
				.x .callout .callout-content { background-color: unset; background-image: none; }
				.callout[data-callout=formula] .callout-title { background: rgba(var(--callout-color), 0.2); }`),
			[],
		);
	});

	it("reads a pseudo-element only when it is a surface over its whole box", () => {
		// Ultra Lobster's line style lays the whole fill on an ::after; TerraFlow's
		// glass sheen pins it with logical insets; the brutal style's offset block
		// carries its own opacity. Light & Bright's 3px accent bar and Qlean's
		// dog-eared corner are decorations, and are not fills at all.
		assert.deepStrictEqual(
			fills(`
				.ulu-line-callouts .callout::after {
					background: rgba(var(--callout-color), 0.3) !important;
					content: ""; top: 0px; left: -3px; position: absolute; width: 100%; height: 100%; z-index: -1;
				}
				.callout::before {
					background: rgb(var(--callout-color)); content: ""; position: absolute;
					width: 3px; height: calc(100% - 30px); top: 15px; left: 15px;
				}
				body.callout-dogs-ear .markdown-rendered .callout:after {
					background: linear-gradient(to bottom right, rgba(200, 200, 200, 0.3) 50%, white 50%);
					content: ""; position: absolute; width: 32px; height: 32px; right: 0; bottom: 0;
				}
				.callout-style-glass .callout::after {
					content: ''; position: absolute; inset-block-start: 0; inset-inline: 0; inset-block-end: 0;
					background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, transparent 55%);
				}
				.ulu-brutal-callouts .callout:before {
					background: rgb(var(--callout-color)) !important; content: "";
					top: 8px; left: 8px; opacity: 0.2; position: absolute; width: 100%; height: 100%;
				}
				.draa-callouts .callout .callout-title::before {
					background: rgba(var(--callout-color), 0.4); position: absolute; width: 100%; height: 100%; top: 0; left: 0;
				}`),
			[
				"root::after [.ulu-line-callouts] [] accent",
				"root::after [.callout-style-glass] [] fixed",
				"root::before [.ulu-brutal-callouts] [] accent own-opacity",
				"title::before [.draa-callouts] [] accent",
			],
		);
	});
});

describe("the surface scan — whose ink a title fill carries", () => {
	const inked = (rule: string): boolean => {
		const fill = scanCalloutSurface(`.g .callout .callout-title { ${rule} }`).fills[0];
		if (fill === undefined) throw new Error(`no fill read from: ${rule}`);
		return fill.inked;
	};

	it("calls an opaque badge inked, whoever sets its text colour", () => {
		// Glass Robo's ladak style: the badge rule names no colour; the page-colour
		// ink comes from a rule elsewhere, and cannot survive the badge going.
		assert.strictEqual(inked("background: rgba(var(--callout-color), 1);"), true);
		assert.strictEqual(inked("background-color: var(--color-blue);"), true);
		assert.strictEqual(inked("background-color: #3b82f6;"), true);
		assert.strictEqual(inked("background-color: rgb(var(--callout-color) / 0.9);"), true);
	});

	it("leaves a translucent stripe under the theme's own ink alone", () => {
		assert.strictEqual(inked("background-color: rgba(var(--callout-color), var(--callout-title-opacity, 0.1));"), false);
		assert.strictEqual(inked("background-color: rgba(var(--callout-color), 0.27);"), false);
		assert.strictEqual(inked("background: color-mix(in srgb, var(--callout-color), transparent 80%);"), false);
		assert.strictEqual(inked("background-color: color-mix(in srgb, var(--callout-color) 10%, transparent);"), false);
		assert.strictEqual(inked("background: linear-gradient(to right, rgba(var(--callout-color), 0.1), transparent);"), false);
	});

	it("trusts a rule that picks the ink beside its fill, even a translucent one", () => {
		assert.strictEqual(inked("color: var(--background-primary); background-color: rgba(var(--callout-color), 0.2);"), true);
	});
});

describe("folding — where an authored background goes instead", () => {
	const where = (...sheets: string[]): string[] =>
		resolveCalloutSurface(sheets.map(scanCalloutSurface)).relocations.map(
			(f) => `${f.box}${f.pseudo} [${f.guard}] [${f.rootQualifier}]`,
		);

	it("moves it to a stripe the theme fills under the same conditions as its neutral root", () => {
		// AnuPpuccin Sleek: a neutral mantle on the root, the accent on the title.
		assert.deepStrictEqual(
			where(`
				.anp-callout-sleek .callout:not(.x) { background-color: rgba(var(--ctp-mantle), 0.4); }
				.anp-callout-sleek .callout:not(.x) > .callout-title { background-color: rgba(var(--callout-color), 0.1); }`),
			["title [.anp-callout-sleek] [:not(.x)]"],
		);
	});

	it("follows an unconditional neutral root to every fill — Cyber Glow's title and content", () => {
		assert.deepStrictEqual(
			where(`
				.callout { background-color: transparent; }
				.callout:not(.is-collapsible) .callout-title { background-color: rgba(var(--callout-color), 0.27); }
				.callout-content { background-color: rgba(var(--callout-color), 0.25); }`),
			["content [] []", "title [] [:not(.is-collapsible)]"],
		);
	});

	it("follows a root guard the fill's guard provably implies — Iridium", () => {
		// The title is tinted when none of three styles is on; the root is
		// transparent when neither of two is. Every page the first matches, the
		// second matches too.
		assert.deepStrictEqual(
			where(`
				body:not(.i-callout-filled, .i-callout-outlined-filled) .callout { background-color: transparent; }
				body:not(.i-callout-outlined, .i-callout-filled, .i-callout-outlined-filled) {
					.callout-title { background-color: color-mix(in srgb, var(--callout-color) 10%, transparent); }
				}`),
			["title [body:not(.i-callout-outlined, .i-callout-filled, .i-callout-outlined-filled)] []"],
		);
	});

	it("leaves it on the root where the theme only overlays the title", () => {
		// Shimmering Focus and Blue Topaz tint the title over a root they leave
		// painted. Moving the background there would show it twice in the title.
		assert.deepStrictEqual(
			where(`.callout-title { background-color: rgba(var(--callout-color), 0.15); }`),
			[],
		);
		// A root that is neutral only under a narrower condition proves nothing.
		assert.deepStrictEqual(
			where(`
				.flat .callout { background: none; }
				.callout .callout-title { background-color: rgba(var(--callout-color), 0.1); }`),
			[],
		);
	});

	it("moves it onto a whole-box surface, but never one with its own opacity", () => {
		assert.deepStrictEqual(
			where(`
				.ulu-line-callouts .callout { background: transparent; }
				.ulu-line-callouts .callout::after {
					background: rgba(var(--callout-color), 0.3) !important; position: absolute; width: 100%; height: 100%;
				}
				.ulu-brutal-callouts .callout { background: transparent; }
				.ulu-brutal-callouts .callout::before {
					background: rgb(var(--callout-color)); position: absolute; width: 100%; height: 100%; opacity: 0.2;
				}`),
			["root::after [.ulu-line-callouts] []"],
		);
	});

	it("lists the titles whose ink was chosen against their fill, and every surface layer to clear", () => {
		// flexcyon writes its plain title in the page colour on a palette blue.
		// AnuPpuccin's stripe leaves the ink to the theme, and so keeps it.
		const surface = resolveCalloutSurface([
			scanCalloutSurface(`
				body.flexcyon-plain-callouts .callout .callout-title { color: var(--background-primary); background-color: var(--color-blue); }
				.anp-callout-sleek .callout > .callout-title { background-color: rgba(var(--callout-color), 0.1); }
				.callout-style-liquid .callout::after { position: absolute; inset: 0; background: linear-gradient(115deg, transparent, white); }`),
		]);
		assert.deepStrictEqual(
			surface.inkedTitles.map((f) => f.guard),
			["body.flexcyon-plain-callouts"],
		);
		assert.deepStrictEqual(
			surface.surfaceLayers.map((f) => `${f.box}${f.pseudo} [${f.guard}]`),
			["root::after [.callout-style-liquid]"],
		);
		assert.deepStrictEqual(surface.relocations, []);
	});
});
