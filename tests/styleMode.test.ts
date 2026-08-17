/**
 * tests/styleMode.test.ts — the three states a callout can be styled in.
 *
 * `theme < standard < force`, spelled across two fields (`externalStyle` and
 * `styleMode`) rather than one, so a `data.json` synced to an older build
 * degrades in the safe direction. That split is the thing most likely to rot,
 * so the first suite pins it from both ends: `styleModeOf` reading, and
 * `applyStyleMode` writing.
 *
 * The load-bearing assertion is further down, in "standard output did not
 * move": force works by repeating `.callout` in the selector, which means the
 * selector builder every other emitter already used had to change. If weight-1
 * output is byte-identical to what shipped, that change is invisible to every
 * user not in force mode — and if it is not, this fails loudly rather than
 * quietly restyling every vault.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	applyStyleMode,
	emitWeightFor,
	FORCE_WEIGHT_DEFAULT,
	standsDown,
	styleModeOf,
} from "../src/manager/styleMode";
import { calloutSel, calloutSelAt } from "../src/utils/calloutSelector";
import {
	definition,
	harness,
	parseRules,
	rulesMatching,
	valueOf,
} from "./support/cssInjectorHarness";
import type { CalloutDefinition } from "../src/types";

describe("styleModeOf — reading three states out of two fields", () => {
	it("reads an untouched definition as standard", () => {
		assert.strictEqual(styleModeOf(definition()), "standard");
	});

	it("reads the pre-ladder externalStyle flag as theme", () => {
		assert.strictEqual(
			styleModeOf(definition({ externalStyle: true })),
			"theme",
		);
	});

	it("reads styleMode: force as force", () => {
		assert.strictEqual(
			styleModeOf(definition({ styleMode: "force" })),
			"force",
		);
	});

	it("lets externalStyle win if hand-edited data claims both", () => {
		// Nothing this plugin writes can produce this row — `applyStyleMode`
		// deletes one field before setting the other. But `data.json` is a file
		// on disk that syncs, so the resolver still has to be total. Deferring
		// to the theme is the safe half of the fork: it under-paints rather
		// than painting over a callout its owner handed away.
		const both = definition({ externalStyle: true, styleMode: "force" });
		assert.strictEqual(styleModeOf(both), "theme");
	});

	it("standsDown is true only for theme", () => {
		assert.strictEqual(standsDown(definition({ externalStyle: true })), true);
		assert.strictEqual(standsDown(definition({ styleMode: "force" })), false);
		assert.strictEqual(standsDown(definition()), false);
	});
});

describe("applyStyleMode — writing one field and clearing the other", () => {
	it("returns null when the definition is already in that mode", () => {
		assert.strictEqual(applyStyleMode(definition(), "standard"), null);
		assert.strictEqual(
			applyStyleMode(definition({ styleMode: "force" }), "force"),
			null,
		);
	});

	it("deletes the keys rather than writing false or 'standard'", () => {
		// `isCalloutModified` compares `JSON.stringify(value ?? null)`, so an
		// explicit falsy value would leave a built-in nobody edited reading as
		// customized forever — and, for a built-in, would end its deference to
		// the theme's `--callout-*`.
		const next = applyStyleMode(definition({ externalStyle: true }), "standard");
		assert.ok(next);
		assert.ok(!("externalStyle" in next), "externalStyle should be gone");
		assert.ok(!("styleMode" in next), "styleMode should be gone");
	});

	it("never leaves both fields set", () => {
		const modes = ["theme", "standard", "force"] as const;
		for (const from of modes) {
			for (const to of modes) {
				if (from === to) continue;
				const start = applyStyleMode(definition(), from) ?? definition();
				const next = applyStyleMode(start, to);
				assert.ok(next, `${from} → ${to}`);
				assert.ok(
					!(next.externalStyle === true && next.styleMode !== undefined),
					`${from} → ${to} left both fields set`,
				);
				assert.strictEqual(styleModeOf(next), to, `${from} → ${to}`);
			}
		}
	});
});

describe("setStyleMode — the registry's one refusal", () => {
	it("refuses to hand the active fallback callout to the theme", () => {
		// `generateFallbackCSS` paints every *unknown* callout from this
		// definition, so a fallback target that styles nothing would keep
		// imposing its colours on the vault while claiming to be hands-off.
		const { registry } = harness();
		registry.settings.fallbackCalloutId = "note";
		assert.strictEqual(registry.setStyleMode("note", "theme"), false);
		assert.strictEqual(styleModeOf(registry.get("note") as CalloutDefinition), "standard");
	});

	it("allows forcing that same callout", () => {
		// Force carries no such conflict: the fallback block already outranks
		// everything, so this only changes the callout's own rules.
		const { registry } = harness();
		registry.settings.fallbackCalloutId = "note";
		assert.strictEqual(registry.setStyleMode("note", "force"), true);
	});

	it("setExternalStyle still means theme-or-normal, never force", () => {
		const { registry } = harness();
		registry.setStyleMode("note", "force");
		assert.strictEqual(registry.setExternalStyle("note", false), true);
		assert.strictEqual(styleModeOf(registry.get("note") as CalloutDefinition), "standard");
	});
});

describe("calloutSelAt — the weighted selector", () => {
	it("is the plain selector at weight 1", () => {
		assert.strictEqual(calloutSelAt("note", 1), calloutSel("note"));
	});

	it("repeats .callout, keeping the attribute and the theme prefix", () => {
		assert.strictEqual(
			calloutSelAt("note", 3, ".theme-dark "),
			'.theme-dark .callout.callout.callout[data-callout="note"]',
		);
	});

	it("still escapes a hostile id", () => {
		// Same threat as `cssInjectorInject.test.ts`'s SECURITY suite: an
		// unescaped quote or trailing backslash leaves the CSS string token open
		// and the parser eats every rule generated after it. Repetition must not
		// have bypassed the one escaping funnel — so the escaped body has to be
		// character-for-character what weight 1 already produced.
		for (const hostile of ['ev"il', "back\\slash", 'both"\\']) {
			const one = calloutSel(hostile);
			const many = calloutSelAt(hostile, 4);
			assert.strictEqual(
				many,
				one.replace(".callout[", ".callout.callout.callout.callout["),
				hostile,
			);
			// The attribute value must be one closed CSS string: every quote
			// inside it is backslash-escaped, so exactly two survive unescaped —
			// the delimiters.
			const bare = many.replace(/\\./g, "");
			assert.strictEqual((bare.match(/"/g) ?? []).length, 2, hostile);
			assert.ok(bare.endsWith('"]'), hostile);
		}
	});

	it("never drops below weight 1", () => {
		assert.strictEqual(calloutSelAt("note", 0), calloutSel("note"));
	});

	it("emitWeightFor gives force the documented weight and nothing else", () => {
		assert.strictEqual(emitWeightFor("force"), FORCE_WEIGHT_DEFAULT);
		assert.strictEqual(emitWeightFor("standard"), 1);
		assert.strictEqual(emitWeightFor("theme"), 1);
	});

	it("clears the heaviest class-count measured in a real theme", () => {
		// The whole point of the number, and the reason it is 8 rather than the
		// 6 first drafted. `themeCalloutScan` over the themes on hand reports a
		// worst case of 7 class-units (ITS Theme, `[!quote]` and `[!recite]`);
		// Baseline and Cupertino peak at 6. The forced light rule is weight + 1,
		// so it must clear 7 outright rather than tie it — a tie only wins on
		// source order, which is not something to design a feature around.
		const WORST_OBSERVED = 7;
		assert.ok(
			FORCE_WEIGHT_DEFAULT + 1 > WORST_OBSERVED,
			`weight ${FORCE_WEIGHT_DEFAULT} does not outrank a (0,${WORST_OBSERVED},x) theme rule`,
		);
	});
});

describe("standard output did not move", () => {
	// If any of these drift, every existing vault silently restyles.
	const cases: Array<[string, Partial<CalloutDefinition>]> = [
		["a plain user callout", {}],
		["one with a background", { bgColorLight: "#112233", bgColorDark: "#445566" }],
		["one with aliases", { aliases: ["quiet-alias"] }],
		["one with no icon", { hideIcon: true }],
		["one with content colours", { textColorLight: "#123456" }],
	];

	for (const [what, over] of cases) {
		it(`emits weight-1 selectors for ${what}`, () => {
			const { css } = harness();
			const out = css.generateCalloutCSS(definition(over));
			for (const rule of parseRules(out)) {
				assert.ok(
					!rule.selector.includes(".callout.callout"),
					`${what}: escalated selector leaked into standard mode — ${rule.selector}`,
				);
			}
		});
	}

	it("is byte-identical whether or not styleMode is absent or standard-ish", () => {
		const { css } = harness();
		const plain = css.generateCalloutCSS(definition());
		const cleared = css.generateCalloutCSS(
			applyStyleMode(definition({ styleMode: "force" }), "standard") ??
				definition(),
		);
		assert.strictEqual(cleared, plain);
	});
});

describe("theme mode still emits nothing", () => {
	it("emits no rules at all", () => {
		const { css } = harness();
		assert.deepStrictEqual(
			parseRules(css.generateCalloutCSS(definition({ externalStyle: true }))),
			[],
		);
	});

	it("keeps the one hideIcon exception, at weight 1", () => {
		// A theme cannot express "no icon" on the owner's behalf, so that single
		// rule survives — but it must not arrive escalated.
		const { css } = harness();
		const out = css.generateCalloutCSS(
			definition({ externalStyle: true, hideIcon: true }),
		);
		const rules = parseRules(out);
		assert.ok(rules.length > 0, "expected the hideIcon rule to survive");
		for (const rule of rules) {
			assert.ok(!rule.selector.includes(".callout.callout"), rule.selector);
		}
	});
});

describe("force mode", () => {
	const forced = (over: Partial<CalloutDefinition> = {}): string =>
		harness().css.generateCalloutCSS(
			definition({ styleMode: "force", ...over }),
		);

	it("escalates every rule that targets Obsidian's callout DOM", () => {
		const repeated = ".callout".repeat(FORCE_WEIGHT_DEFAULT);
		const rules = parseRules(forced({ bgColorLight: "#112233" }));
		const obsidianRules = rules.filter((r) =>
			/(^|[\s,])(\.theme-dark )?\.callout\[data-callout|\.callout\./.test(
				r.selector,
			),
		);
		assert.ok(obsidianRules.length > 0, "expected some callout rules");
		for (const rule of obsidianRules) {
			assert.ok(
				rule.selector.includes(repeated),
				`not escalated: ${rule.selector}`,
			);
		}
	});

	it("leaves the plugin's own token DOM alone", () => {
		// `.cs-heading-callout` / `.cs-inline-callout` / `.cs-ref-token` are this
		// plugin's elements. No theme competes for them, so escalating there
		// would be pure noise in the sheet.
		for (const rule of parseRules(forced())) {
			if (!/\.cs-/.test(rule.selector)) continue;
			assert.ok(
				!rule.selector.includes(".callout.callout"),
				`token DOM escalated: ${rule.selector}`,
			);
		}
	});

	it("does not reach for !important", () => {
		// That register belongs to `generateFallbackCSS` alone — see
		// `emitWeightFor`'s comment for why escalating here would make the
		// plugin unoverridable by the user's own snippet.
		assert.ok(!forced({ bgColorLight: "#112233" }).includes("!important"));
	});

	it("does not leak its weight into the next callout emitted", () => {
		const { css } = harness();
		css.generateCalloutCSS(definition({ styleMode: "force" }));
		const after = css.generateCalloutCSS(definition({ id: "plain" }));
		for (const rule of parseRules(after)) {
			assert.ok(!rule.selector.includes(".callout.callout"), rule.selector);
		}
	});

	it("keeps an untouched built-in deferring to core's own variable", () => {
		// The reason `styleMode` is in COLOUR_NEUTRAL_FIELDS. Forcing `[!info]`
		// asks for Obsidian's blue at a weight the theme cannot reach — not for
		// some hex this plugin invented. If the mode counted as a modification,
		// `isUnmodifiedBuiltIn` would flip and a literal colour would be baked
		// in at high specificity, which is close to the opposite of the request.
		const { registry, css } = harness();
		assert.strictEqual(registry.setStyleMode("info", "force"), true);
		const info = registry.get("info");
		assert.ok(info);
		assert.strictEqual(registry.isUnmodifiedBuiltIn(info), true);

		const out = css.generateCalloutCSS(info);
		const base = rulesMatching(out, '[data-callout="info"]')[0];
		assert.ok(base, "expected a rule for [!info]");
		assert.strictEqual(valueOf(base, "--callout-color"), undefined);
		// The deference is one hop: a theme's value launders through the
		// `<color>`-typed `--cs-accent-theme` on its way to `--cs-accent`, so the
		// chain — not the collapsed value — is what says core still decides.
		assert.match(valueOf(base, "--cs-accent-theme") ?? "", /--callout-info/);
		assert.strictEqual(valueOf(base, "--cs-accent"), "var(--cs-accent-theme)");
	});

	it("is persisted for a built-in, so it survives a reload", () => {
		// Colour-neutral means `isUnmodifiedBuiltIn` skips it, NOT that
		// `toSaveData` does — same split as `hideIcon`. Getting this wrong
		// looks like the setting simply not sticking.
		const { registry } = harness();
		registry.setStyleMode("info", "force");
		assert.deepStrictEqual(
			registry.toSaveData().callouts.map((d) => d.id),
			["info"],
		);
	});
});
