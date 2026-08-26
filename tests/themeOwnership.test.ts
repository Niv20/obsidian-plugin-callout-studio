/**
 * tests/themeOwnership.test.ts — who paints a callout, and what follows.
 *
 * There is no setting for this any more. The active theme either names a
 * callout id or it does not, `CalloutRegistry.themeOwns` derives the answer,
 * and the row's section in the settings tab reports it. The one thing the user
 * still decides is the separate, narrower "I style this one in my own CSS"
 * (`externalStyle`), which is why the two predicates are pinned apart here.
 *
 * The load-bearing behaviours further down are the ones a regression would be
 * quiet about. **Callout Studio takes everything it owns**: `!important` on
 * every declaration aimed at core's DOM, at a selector weight derived from the
 * active theme — because winning seven properties out of eight is the failure
 * this model exists to eliminate, and it looks like a plugin bug rather than a
 * cascade one. **It takes nothing it does not own**: not a rule, not a
 * variable, and no longer even the `hideIcon` exception the two-mode version
 * carved out. The single thing it still draws is its own `.cs-*` token DOM,
 * which no theme selector can match.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { STUDIO_WEIGHT_BASE } from "../src/manager/theme/studioWeight";
import { calloutSel, calloutSelAt } from "../src/utils/calloutSelector";
import {
	definition,
	harness,
	parseRules,
	rulesMatching,
	valueOf,
} from "./support/cssInjectorHarness";
import type { CalloutDefinition } from "../src/types";

describe("themeOwns — derived from the theme, never stored", () => {
	it("owns nothing at all until something publishes the theme's ids", () => {
		// The fail-safe, and the reason the default is an empty set rather than
		// a lazy read. This registry takes no `App` and cannot see the theme
		// when `load()` runs; standing DOWN on that blank would strip every
		// callout the user has styled, while standing up cannot hurt anyone.
		const { registry } = harness();
		assert.strictEqual(registry.themeOwns(registry.get("note")!), false);
	});

	it("owns a built-in the theme names", () => {
		// 48 of the 257 themes in the dev vault restyle a built-in by name, and
		// 27 of those restyle every single one.
		const { registry } = harness();
		registry.setThemeOwnedIds(new Set(["note"]));
		assert.strictEqual(registry.themeOwns(registry.get("note")!), true);
		assert.strictEqual(registry.themeOwns(registry.get("tip")!), false);
	});

	it("owns the whole callout when the theme names only an alias", () => {
		// Letting `[!tldr]` be the theme's while `[!abstract]` stays ours is
		// exactly the split render this model exists to abolish.
		const { registry } = harness();
		registry.add(definition({ id: "abstract", aliases: ["tldr"] }));
		registry.setThemeOwnedIds(new Set(["tldr"]));
		assert.strictEqual(registry.themeOwns(registry.get("abstract")!), true);
	});

	it("matches on the attribute form, not the id as written", () => {
		// Obsidian dasherizes `data-callout`, so a theme writing
		// `[data-callout="my-note"]` claims the callout the user calls `my note`.
		const { registry } = harness();
		registry.add(definition({ id: "my note" }));
		registry.setThemeOwnedIds(new Set(["my-note"]));
		assert.strictEqual(registry.themeOwns(registry.get("my note")!), true);
	});

	it("gives the callout back the moment the theme stops naming it", () => {
		// The whole benefit of deriving: switching theme restores the user's
		// saved appearance with nothing to migrate, because nothing was written.
		const { registry } = harness();
		registry.add(definition({ id: "recite", colorLight: "#123456" }));
		registry.setThemeOwnedIds(new Set(["recite"]));
		assert.strictEqual(registry.themeOwns(registry.get("recite")!), true);

		registry.setThemeOwnedIds(new Set());
		const back = registry.get("recite")!;
		assert.strictEqual(registry.themeOwns(back), false);
		assert.strictEqual(back.colorLight, "#123456", "never touched");
	});

	it("reports whether the set actually moved", () => {
		// The caller skips a re-inject on false, and an inject is a whole CSS
		// regeneration plus a localStorage write.
		const { registry } = harness();
		assert.strictEqual(registry.setThemeOwnedIds(new Set(["a"])), true);
		assert.strictEqual(registry.setThemeOwnedIds(new Set(["a"])), false);
		assert.strictEqual(registry.setThemeOwnedIds(new Set(["a", "b"])), true);
		assert.strictEqual(registry.setThemeOwnedIds(new Set(["b"])), true);
	});
});

describe("standsDown — the two reasons to emit nothing", () => {
	it("is true for a theme-owned callout", () => {
		const { registry } = harness();
		registry.setThemeOwnedIds(new Set(["note"]));
		assert.strictEqual(registry.standsDown(registry.get("note")!), true);
	});

	it("is true for a callout the user styles in their own CSS", () => {
		const { registry } = harness();
		registry.add(definition({ id: "mine", externalStyle: true }));
		assert.strictEqual(registry.standsDown(registry.get("mine")!), true);
	});

	it("keeps the two apart, because only one is read-only", () => {
		// An External CSS row is still the user's: it stays in their own
		// section, keeps its pencil, and can be taken back. Collapsing the two
		// would file it under a theme that has never heard of it.
		const { registry } = harness();
		registry.add(definition({ id: "mine", externalStyle: true }));
		assert.strictEqual(registry.themeOwns(registry.get("mine")!), false);
	});
});

describe("setExternalStyle — the one styling choice still the user's", () => {
	it("sets and clears, and deletes rather than writing false", () => {
		// An explicit `false` would leave a built-in nobody edited reading as
		// customized forever: `isCalloutModified` compares `value ?? null`.
		const { registry } = harness();
		assert.strictEqual(registry.setExternalStyle("note", true), true);
		assert.strictEqual(registry.get("note")?.externalStyle, true);

		assert.strictEqual(registry.setExternalStyle("note", false), true);
		assert.ok(!("externalStyle" in (registry.get("note") as object)));
	});

	it("returns false when the row is already there", () => {
		const { registry } = harness();
		assert.strictEqual(registry.setExternalStyle("note", false), false);
		registry.setExternalStyle("note", true);
		assert.strictEqual(registry.setExternalStyle("note", true), false);
	});

	it("refuses an id it does not have", () => {
		const { registry } = harness();
		assert.strictEqual(registry.setExternalStyle("nope", true), false);
	});
});

describe("the unknown-id fallback follows its template", () => {
	it("goes quiet when the fallback callout is the theme's", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		registry.setThemeOwnedIds(new Set(["note"]));
		assert.strictEqual(css.generateFallbackCSS(registry.getAll()), "");
	});

	it("paints while the fallback callout is Callout Studio's", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		const out = css.generateFallbackCSS(registry.getAll());
		assert.match(out, /body \.callout:not\(/);
		assert.match(out, /!important/);
	});
});

describe("calloutSelAt — the weighted selector", () => {
	it("is the plain selector at weight 1", () => {
		assert.strictEqual(calloutSelAt("quiet", 1), calloutSel("quiet"));
	});

	it("repeats .callout, keeping the attribute and the theme prefix", () => {
		const sel = calloutSelAt("quiet", 3, ".theme-dark ");
		assert.strictEqual(
			sel,
			'.theme-dark .callout.callout.callout[data-callout="quiet"]',
		);
	});

	it("escapes a hostile id at every weight", () => {
		const sel = calloutSelAt('ev"il', 4);
		assert.ok(sel.includes('[data-callout="ev\\"il"]'));
	});

	it("never falls below weight 1", () => {
		assert.strictEqual(calloutSelAt("quiet", 0), calloutSel("quiet"));
		assert.strictEqual(calloutSelAt("quiet", -3), calloutSel("quiet"));
	});
});

describe("studio mode — taking the callout completely", () => {
	const studioCss = (over: Partial<CalloutDefinition> = {}): string => {
		const { css } = harness();
		return css.generateCalloutCSS(definition(over));
	};

	it("stays at the base weight when the theme has no !important rules", () => {
		// The common case, and the reason the weight is derived rather than
		// constant: `!important` alone already beats every ordinary theme rule,
		// so climbing would lengthen every selector in the sheet for nothing.
		const out = studioCss();
		const first = parseRules(out)[0];
		assert.ok(first);
		const repeats = first.selector.split(".callout").length - 1;
		assert.strictEqual(repeats, STUDIO_WEIGHT_BASE);
	});

	it("marks every declaration it puts on core's own DOM", () => {
		const out = studioCss({
			transparentBg: true,
			textColorLight: "#111111",
			textColorDark: "#eeeeee",
		});
		// Core's own blockquote DOM only — `.cs-*` is ours and is asserted the
		// other way round in the next test.
		const coreRules = parseRules(out).filter(
			(r) =>
				r.selector.includes("[data-callout=") &&
				!r.selector.includes(".cs-"),
		);
		assert.ok(coreRules.length > 0);
		for (const rule of coreRules) {
			for (const decl of rule.decls) {
				assert.match(
					decl,
					/!important/,
					`unmarked declaration on core DOM: ${rule.selector} { ${decl} }`,
				);
			}
		}
	});

	it("leaves its own token DOM ordinary, so a snippet can still correct it", () => {
		// No theme selector can match `.cs-heading-callout` or
		// `.cs-inline-callout`, so there is nothing to beat — and the user's
		// escape hatch has to live somewhere.
		const out = studioCss();
		const tokenRules = parseRules(out).filter(
			(r) =>
				r.selector.includes(".cs-inline-callout") ||
				r.selector.includes(".cs-heading-callout"),
		);
		assert.ok(tokenRules.length > 0, "expected token rules");
		for (const rule of tokenRules) {
			for (const decl of rule.decls) {
				assert.doesNotMatch(decl, /!important/, rule.selector);
			}
		}
	});

	it("cancels the title sweep in print at the same importance", () => {
		// The screen sweep and its @media print reset tie on specificity and
		// are resolved on source order, so an ordinary reset under an
		// !important sweep would leave the unclipped block over the title.
		const out = studioCss({
			bgGradient: {
				angleDeg: 120,
				toColorLight: "#996633",
				toColorDark: "#eebb88",
				textGradient: true,
				textToColorLight: "#996633",
				textToColorDark: "#eebb88",
			},
		});
		const printReset = parseRules(out).find(
			(r) =>
				r.at.some((a) => a.includes("print")) &&
				r.props.includes("-webkit-text-fill-color"),
		);
		assert.ok(printReset, "expected a print reset for the sweep");
		assert.match(
			valueOf(printReset, "-webkit-text-fill-color") ?? "",
			/currentColor !important/,
		);
	});

	it("does not leak its weight into the next callout", () => {
		const { css } = harness();
		css.generateCalloutCSS(definition());
		const after = css.generateCalloutCSS(
			definition({ id: "second", externalStyle: true, hideIcon: true }),
		);
		assert.ok(!after.includes(".callout.callout"), after);
	});
});

describe("a theme-owned callout — emitting nothing at all", () => {
	it("produces not one rule on core's DOM", () => {
		const { registry, css } = harness();
		registry.add(definition({ id: "recite" }));
		registry.setThemeOwnedIds(new Set(["recite"]));
		const out = css.generateCalloutCSS(registry.get("recite")!);
		assert.strictEqual(rulesMatching(out, ".callout[").length, 0);
		assert.doesNotMatch(out, /--callout-color/);
		assert.doesNotMatch(out, /background/);
	});

	it("emits nothing at all for a callout the user styles themselves", () => {
		const { css } = harness();
		assert.strictEqual(
			css.generateCalloutCSS(definition({ externalStyle: true })),
			"",
		);
	});

	it("no longer makes the hideIcon exception", () => {
		// The two-mode model still emitted `display: none` here, arguing that a
		// theme cannot express "no icon" on the owner's behalf. Under an
		// absolute rule that does not survive: hiding the icon on a callout the
		// theme draws is an override like any other, and the one a user is most
		// likely to read as the plugin breaking their theme. The flag stays on
		// the row and applies again the moment the theme lets go.
		const { registry, css } = harness();
		registry.add(definition({ id: "recite", hideIcon: true }));
		registry.setThemeOwnedIds(new Set(["recite"]));
		const out = css.generateCalloutCSS(registry.get("recite")!);
		assert.doesNotMatch(out, /display: none/);
		assert.strictEqual(registry.get("recite")?.hideIcon, true, "preserved");
	});

	it("emits not one rule, measured theme or not", () => {
		// "Nothing" used to have an exception: the `.cs-*` token rules, on the
		// argument that no theme selector can match them. Those two formats are
		// gone for a theme callout, so there is no DOM left to paint and the
		// sentence is now literal — which is the point of stating it twice here,
		// once with a measurement available and once without.
		const { registry, css } = harness();
		registry.add(definition({ id: "recite" }));
		registry.setThemeOwnedIds(new Set(["recite"]));
		assert.strictEqual(css.generateCalloutCSS(registry.get("recite")!), "");

		registry.setThemeAppearances(
			new Map([
				[
					"recite",
					{
						accent: "rgb(10, 20, 30)",
						background: "rgb(1, 2, 3)",
						icon: { kind: "unknown" as const },
					},
				],
			]),
		);
		const out = css.generateCalloutCSS(registry.get("recite")!);
		assert.strictEqual(out, "");
		assert.strictEqual(rulesMatching(out, ".callout[").length, 0);
	});

	it("paints it again in full the moment the theme lets go", () => {
		// The pre-existing-callout half of the lifecycle: standing down costs
		// the row nothing, so there is nothing to restore.
		const { registry, css } = harness();
		registry.add(definition({ id: "mine", colorLight: "#ff0000" }));
		registry.setThemeOwnedIds(new Set(["mine"]));
		assert.strictEqual(css.generateCalloutCSS(registry.get("mine")!), "");

		registry.setThemeOwnedIds(new Set());
		const back = css.generateCalloutCSS(registry.get("mine")!);
		assert.ok(rulesMatching(back, ".callout[").length > 0);
		assert.match(back, /#ff0000|255, 0, 0/);
	});

	it("renders no token DOM for a callout the user styles themselves", () => {
		// Unlike the theme case: they asked to style it, and there is nothing
		// here for them to style, so the `[!id]` stays as literal text.
		const { css } = harness();
		const out = css.generateCalloutCSS(definition({ externalStyle: true }));
		assert.strictEqual(rulesMatching(out, ".cs-heading-callout").length, 0);
		assert.strictEqual(rulesMatching(out, ".cs-inline-callout").length, 0);
	});

	it("is lifted out of the global frame rules", () => {
		const { registry, css } = harness();
		registry.add(definition({ id: "handed", externalStyle: true }));
		registry.settings.globalStyle.borderRadius = 12;
		const excl = css.externalExclusion();
		assert.match(excl, /:not\(:where\(/);
		assert.ok(excl.includes('[data-callout="handed"]'));
		// `:where()` contributes zero specificity, so the list can grow to
		// every callout in the vault without making the global rules harder for
		// the very theme they are stepping aside for.
		const global = css.generateGlobalStyleCSS();
		assert.ok(global.includes(excl));
	});
});

/**
 * Publishing a measurement is a registry change, and the settings tab depends
 * on hearing it.
 *
 * The probe is asynchronous and lands one turn *after* the sweep that published
 * the theme's ownership — and that sweep already made the tab repaint. So by
 * the time the colours are known the rows have been drawn, and
 * `registry.onChange` plus `css-change` are the only two events the tab listens
 * to. The probe's own re-inject deliberately withholds the second, so without
 * this announcement a row that came up unmeasured kept its empty swatch and
 * placeholder icon until something unrelated repainted the list.
 *
 * The other half is that it must stay quiet otherwise: `onChange` regenerates
 * the whole sheet, writes settings and repaints the tab, and the
 * `css-change → inject → sweep` chain only terminates because a pass that
 * measures the same colours announces nothing.
 */
describe("announcing what the theme was measured to look like", () => {
	const reading = (accent: string) =>
		new Map([
			[
				"recite",
				{
					accent,
					background: null,
					icon: { kind: "unknown" as const },
				},
			],
		]);

	it("announces the first measurements", () => {
		const { registry } = harness();
		let changes = 0;
		registry.onChange(() => changes++);
		assert.strictEqual(registry.setThemeAppearances(reading("red")), true);
		assert.strictEqual(changes, 1);
	});

	it("says nothing when the same colours are measured again", () => {
		// The `css-change` path invalidates and re-measures. Landing on the
		// same answers must not cost a repaint, a save and a CSS pass — and if
		// it did, each one would provoke the next.
		const { registry } = harness();
		registry.setThemeAppearances(reading("red"));
		let changes = 0;
		registry.onChange(() => changes++);
		assert.strictEqual(registry.setThemeAppearances(reading("red")), false);
		assert.strictEqual(changes, 0);
	});

	it("announces a colour that moved", () => {
		const { registry } = harness();
		registry.setThemeAppearances(reading("red"));
		let changes = 0;
		registry.onChange(() => changes++);
		assert.strictEqual(registry.setThemeAppearances(reading("blue")), true);
		assert.strictEqual(changes, 1);
	});

	it("announces artwork that moved under an unchanged colour", () => {
		// Two themes can agree on the accent and draw different icons. A
		// comparison that stopped at the colours would leave the outgoing
		// theme's drawing on the row.
		const { registry } = harness();
		registry.setThemeAppearances(reading("red"));
		let changes = 0;
		registry.onChange(() => changes++);
		const moved = registry.setThemeAppearances(
			new Map([
				[
					"recite",
					{
						accent: "red",
						background: null,
						icon: { kind: "svg" as const, markup: "<svg/>" },
					},
				],
			]),
		);
		assert.strictEqual(moved, true);
		assert.strictEqual(changes, 1);
	});

	it("announces a measurement disappearing", () => {
		// Switching to a theme that owns nothing: the map empties, and every
		// row has to stop showing the colours it was wearing.
		const { registry } = harness();
		registry.setThemeAppearances(reading("red"));
		let changes = 0;
		registry.onChange(() => changes++);
		assert.strictEqual(registry.setThemeAppearances(new Map()), true);
		assert.strictEqual(changes, 1);
	});
});
