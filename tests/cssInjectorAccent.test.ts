/**
 * tests/cssInjectorAccent.test.ts — the accent half of the generated stylesheet.
 *
 * Covers `accentProps` / `ownAccentProps` / `themeAccentVar` (the three-variable
 * split and the one case that emits only two of them), `needsDarkBlock` (when a
 * `.theme-dark` override is worth emitting at all), and `generateTokenColorCSS`
 * (the same accent, restated on the DOM this plugin builds itself).
 *
 * The invariant everything here exists to protect is one sentence long and is
 * invisible until someone installs a theme:
 *
 *   **An unmodified built-in gets no `--callout-color` at all.**
 *
 * That is what makes an untouched `[!info]` render identically with the plugin
 * on or off, and what lets a theme that redefines `--color-blue` still reach it.
 * The moment the user edits the callout it is theirs and the hex wins. The
 * fallback block is the deliberate exception — it paints callouts that are NOT
 * the one it took its style from, so withholding the variable there would leave
 * an unknown callout on core's own default instead of on the fallback's colour,
 * i.e. quietly break the setting. It gets the variable spelled out instead.
 *
 * `hideIcon` is the one edit that must NOT end the deference (it is a display
 * flag, not a claim on colour) — pinned in tests/hideIcon.test.ts, and restated
 * from this side here because the two answers come out of one comparison.
 *
 * Note on drift, which is now TWO kinds. The `obsidian` stub's
 * `requireApiVersion` returns true, so *core's* spelling here is always the
 * 1.13+ one — a full colour and a bare `var(--callout-…)` reference. But the
 * spelling actually emitted is the **active theme's**, not core's: a theme that
 * never updated its `rgba(var(--callout-color), …)` gets a triplet on the same
 * Obsidian. `harness()` reports no theme at all, which is the 196-of-257 case
 * and why most of this file reads as before; `themedHarness()` is how the
 * suites below drive the other answer. See `manager/theme/accentDialect.ts`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	definition,
	firstRule,
	harness,
	must,
	parseRules,
	ruleFor,
	themedHarness,
	valueOf,
} from "./support/cssInjectorHarness";
import { OBSIDIAN_CALLOUT_VAR } from "../src/constants";

describe("themeAccentVar — who owns the accent", () => {
	it("hands an unmodified built-in to Obsidian's own variable", () => {
		const { registry, css } = harness();
		for (const id of Object.keys(OBSIDIAN_CALLOUT_VAR)) {
			const def = registry.get(id);
			assert.ok(def, `built-in ${id} should be seeded by load(null)`);
			assert.strictEqual(
				css.themeAccentVar(def),
				OBSIDIAN_CALLOUT_VAR[id],
				`${id} should defer to ${OBSIDIAN_CALLOUT_VAR[id]}`,
			);
		}
	});

	it("takes the accent back the moment the user edits a built-in", () => {
		const { registry, css } = harness();
		const note = registry.get("note");
		assert.ok(note);
		assert.strictEqual(
			css.themeAccentVar({ ...note, colorLight: "#ff0000" }),
			undefined,
		);
	});

	it("never defers for a user-created callout, even one named like a built-in", () => {
		const { css } = harness();
		// `builtIn: false` is the whole test: the id happens to be in the map,
		// but the row is the user's, so there is nothing to defer to.
		assert.strictEqual(
			css.themeAccentVar(definition({ id: "note", builtIn: false })),
			undefined,
		);
	});
});

describe("accentProps — the three colour variables", () => {
	it("omits --callout-color entirely for an unmodified built-in", () => {
		const { registry, css } = harness();
		const note = registry.get("note");
		assert.ok(note);

		const props = css.accentProps(note, "light");
		assert.ok(
			!props.some((p) => p.includes("--callout-color")),
			`core's variable must be left alone, got:\n${props.join("\n")}`,
		);
		// …but ours still resolves, by following the same variable core is
		// using, so color-mix() surfaces move with the theme in lockstep. It
		// goes through the `<color>`-typed hand-off rather than naming that
		// variable directly, so a theme still writing ≤1.12 bare triplets
		// degrades to grey instead of poisoning every color-mix() downstream.
		assert.ok(
			props.some((p) =>
				p.includes("--cs-accent-theme: var(--callout-default)"),
			),
		);
		assert.ok(
			props.some((p) => p.includes("--cs-accent: var(--cs-accent-theme)")),
		);
	});

	it("emits a hex --callout-color for a modified built-in", () => {
		const { registry, css } = harness();
		const note = registry.get("note");
		assert.ok(note);

		const props = css.accentProps(
			{ ...note, colorLight: "#ff0000" },
			"light",
		);
		assert.ok(props.some((p) => p.includes("--callout-color: #ff0000")));
		assert.ok(props.some((p) => p.includes("--cs-accent: #ff0000")));
	});

	it("emits all three for a user callout, per mode", () => {
		const { css } = harness();
		const def = definition();

		assert.deepStrictEqual(css.accentProps(def, "light"), [
			"  --callout-color: #336699;",
			"  --cs-accent: #336699;",
			"  --cs-color-rgb: 51, 102, 153;",
		]);
		assert.deepStrictEqual(css.accentProps(def, "dark"), [
			"  --callout-color: #88bbee;",
			"  --cs-accent: #88bbee;",
			"  --cs-color-rgb: 136, 187, 238;",
		]);
	});

	it("spells the variable out when imposed, so the fallback still imposes a hue", () => {
		const { registry, css } = harness();
		const note = registry.get("note");
		assert.ok(note);

		// The fallback block's call: `important` AND `imposed`. Dropping
		// --callout-color here would leave an unrecognized callout on core's own
		// default rather than on the fallback's colour. On 1.13+ (which the
		// stub reports) it is spelled as the typed hand-off, so this block
		// cannot forward core a value core is unable to parse.
		const props = css.accentProps(note, "light", true, true);
		assert.ok(
			props.some(
				(p) => p === "  --callout-color: var(--cs-accent-theme) !important;",
			),
			`imposed accent missing, got:\n${props.join("\n")}`,
		);
		assert.ok(
			props.some(
				(p) =>
					p === "  --cs-accent-theme: var(--callout-default) !important;",
			),
			`the hand-off must be declared in the same rule, got:\n${props.join("\n")}`,
		);
		assert.ok(props.every((p) => p.endsWith(" !important;")));
	});

	it("wraps the theme's variable when the theme declared it as a triplet", () => {
		// Obsidian gruvbox declares --callout-info: var(--neutral-blue_x) and
		// --neutral-blue_x: 69,133,136. --cs-accent-theme is registered <color>,
		// so handing it that triplet fails the type check and falls back to the
		// grey initial value — greying every heading bar, pill and icon tint on
		// every unmodified built-in. Nothing errors; it just goes grey.
		const { registry, css } = themedHarness(
			`body { --neutral-blue_x: 69,133,136; --callout-default: var(--neutral-blue_x); }`,
		);
		const note = must(registry.get("note"), "built-in note");
		assert.ok(
			css
				.accentProps(note, "light", true)
				.includes("  --cs-accent-theme: rgb(var(--callout-default)) !important;"),
		);
	});

	it("leaves it bare when the theme declared it as a colour", () => {
		const { registry, css } = themedHarness(
			`body { --callout-default: #446688; }`,
		);
		const note = must(registry.get("note"), "built-in note");
		assert.ok(
			css
				.accentProps(note, "light", true)
				.includes("  --cs-accent-theme: var(--callout-default) !important;"),
		);
	});

	it("stops following the theme when imposing a hue it cannot spell", () => {
		// The third branch of the imposed rule. The read sites want a triplet,
		// but the theme's own variable holds a colour, so there is no spelling
		// that both follows the theme and parses. The fallback block paints every
		// unknown id at an `!important` nothing outranks, so forwarding an
		// unparseable value would take all of them down at once — it spells out
		// its own triplet instead and gives up the theme-following.
		const { registry, css } = themedHarness(`
			body { --callout-default: #446688; }
			.callout { background: rgba(var(--callout-color), 0.1); }
		`);
		const note = must(registry.get("note"), "built-in note");
		const props = css.accentProps(note, "light", true, true);
		assert.ok(
			props.some((p) => /^ {2}--callout-color: \d+, \d+, \d+ !important;$/.test(p)),
			`expected a spelled-out triplet, got:\n${props.join("\n")}`,
		);
	});

	it("forwards the theme's variable when it CAN spell it", () => {
		const { registry, css } = themedHarness(`
			body { --callout-default: 8, 109, 221; }
			.callout { background: rgba(var(--callout-color), 0.1); }
		`);
		const note = must(registry.get("note"), "built-in note");
		assert.ok(
			css
				.accentProps(note, "light", true, true)
				.includes("  --callout-color: var(--callout-default) !important;"),
		);
	});

	it("imposed changes nothing for a def that already carries its own colour", () => {
		const { css } = harness();
		const def = definition();
		assert.deepStrictEqual(
			css.accentProps(def, "light", true, true),
			css.accentProps(def, "light", true, false),
		);
	});

	it("keeps --cs-color-rgb a literal triplet even while deferring", () => {
		const { registry, css } = harness();
		const note = registry.get("note");
		assert.ok(note);
		// A triplet cannot be derived from a var(), so the legacy variable
		// carries the shipped default as a best effort rather than following the
		// theme. Nothing in the plugin reads it any more; it is kept for one
		// release for anything outside that still does.
		const props = css.ownAccentProps(note, "light");
		assert.ok(props.some((p) => /--cs-color-rgb: \d+, \d+, \d+;/.test(p)));
	});
});

describe("ownAccentProps — the two variables this plugin owns", () => {
	it("is accentProps minus core's variable", () => {
		const { css } = harness();
		const def = definition();
		const own = css.ownAccentProps(def, "light");
		assert.deepStrictEqual(own, [
			"  --cs-accent: #336699;",
			"  --cs-color-rgb: 51, 102, 153;",
		]);
		assert.deepStrictEqual(css.accentProps(def, "light").slice(1), own);
	});

	it("carries !important through both", () => {
		const { css } = harness();
		assert.deepStrictEqual(
			css.ownAccentProps(definition(), "dark", true),
			[
				"  --cs-accent: #88bbee !important;",
				"  --cs-color-rgb: 136, 187, 238 !important;",
			],
		);
	});
});

describe("needsDarkBlock — when a .theme-dark override is worth emitting", () => {
	it("is false when every mode-dependent colour matches", () => {
		const { css } = harness();
		assert.strictEqual(
			css.needsDarkBlock(
				definition({ colorLight: "#336699", colorDark: "#336699" }),
			),
			false,
		);
	});

	it("is true when the accent differs", () => {
		const { css } = harness();
		assert.strictEqual(css.needsDarkBlock(definition()), true);
	});

	it("is true when only the background differs", () => {
		const { css } = harness();
		assert.strictEqual(
			css.needsDarkBlock(
				definition({
					colorLight: "#336699",
					colorDark: "#336699",
					bgColorLight: "#eef4fa",
					bgColorDark: "#16202b",
				}),
			),
			true,
		);
	});

	it("is true when only the gradient's end colour differs", () => {
		const { css } = harness();
		assert.strictEqual(
			css.needsDarkBlock(
				definition({
					colorLight: "#336699",
					colorDark: "#336699",
					bgColorLight: "#eef4fa",
					bgColorDark: "#eef4fa",
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#fdf0e6",
						toColorDark: "#2b1f16",
					},
				}),
			),
			true,
		);
	});

	it("is false for a gradient whose ends match in both modes", () => {
		const { css } = harness();
		assert.strictEqual(
			css.needsDarkBlock(
				definition({
					colorLight: "#336699",
					colorDark: "#336699",
					bgColorLight: "#eef4fa",
					bgColorDark: "#eef4fa",
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#fdf0e6",
						toColorDark: "#fdf0e6",
					},
				}),
			),
			false,
		);
	});

	it("decides whether generateCalloutCSS emits the dark block at all", () => {
		const { css } = harness();
		const same = definition({ colorLight: "#336699", colorDark: "#336699" });
		const out = css.generateCalloutCSS(same);
		assert.ok(!out.includes(".theme-dark .callout[data-callout=\"quiet\"] {"));

		const differ = css.generateCalloutCSS(definition());
		assert.ok(
			differ.includes('.theme-dark .callout[data-callout="quiet"] {'),
		);
	});

	it("gates the alias dark copies on the same answer", () => {
		const { css } = harness();
		const same = css.generateCalloutCSS(
			definition({
				colorLight: "#336699",
				colorDark: "#336699",
				aliases: ["hush"],
			}),
		);
		assert.ok(same.includes('.callout[data-callout="hush"] {'));
		assert.ok(
			!same.includes('.theme-dark .callout[data-callout="hush"] {'),
			"an alias must not get a dark block its owner did not get",
		);
	});
});

describe("generateTokenColorCSS — the accent on this plugin's own DOM", () => {
	it("covers all three token roles in one selector list", () => {
		const { css } = harness();
		const out = css.generateTokenColorCSS(definition());
		const first = firstRule(out);
		assert.deepStrictEqual(first.selector.split(", ").sort(), [
			'.cs-heading-callout[data-callout="quiet"]',
			'.cs-inline-callout[data-callout="quiet"]',
			'.cs-ref-token[data-callout="quiet"]',
		]);
	});

	it("stamps the space-form id, NOT Obsidian's dasherized attr", () => {
		const { css } = harness();
		// This DOM is ours (renderShared.buildCalloutTokenDom stamps it), so it
		// carries the normalized space-preserving id. Only `.callout[…]` — which
		// Obsidian writes — takes the dashed form. The two conventions are
		// deliberate; unifying them silently breaks one surface or the other.
		const out = css.generateTokenColorCSS(
			definition({ id: "multi word callout" }),
		);
		assert.ok(out.includes('.cs-inline-callout[data-callout="multi word callout"]'));
		assert.ok(!out.includes("multi-word-callout"));

		const block = css.generateCalloutCSS(
			definition({ id: "multi word callout" }),
		);
		assert.ok(block.includes('.callout[data-callout="multi-word-callout"]'));
	});

	it("emits core's --callout-color on none of them", () => {
		const { css } = harness();
		// These elements are ours and core's variable would go unread there —
		// hence ownAccentProps rather than accentProps.
		const out = css.generateTokenColorCSS(definition());
		assert.ok(!out.includes("--callout-color"));
	});

	it("skips the dark rule when the two accents match", () => {
		const { css } = harness();
		const out = css.generateTokenColorCSS(
			definition({ colorLight: "#336699", colorDark: "#336699" }),
		);
		assert.ok(!out.includes(".theme-dark"));
	});

	it("leaves ref tokens out of the background selector", () => {
		const { css } = harness();
		// A ref token is a bare icon: no surface to paint. It still takes the
		// accent (above), just not the background.
		const out = css.generateTokenColorCSS(
			definition({ bgColorLight: "#eef4fa", bgColorDark: "#16202b" }),
		);
		const bgRules = parseRules(out).filter((r) =>
			r.props.includes("background-color"),
		);
		assert.ok(bgRules.length > 0);
		for (const rule of bgRules) {
			assert.ok(
				!rule.selector.includes("cs-ref-token"),
				`ref tokens have no surface to paint: ${rule.selector}`,
			);
		}
	});

	it("gives every alias the same accent, in one rule", () => {
		const { css } = harness();
		const out = css.generateTokenColorCSS(
			definition({ aliases: ["hush", "still"] }),
		);
		const first = firstRule(out);
		for (const id of ["quiet", "hush", "still"]) {
			assert.ok(
				first.selector.includes(`.cs-inline-callout[data-callout="${id}"]`),
				`alias ${id} missing from ${first.selector}`,
			);
		}
	});

	it("follows the theme on an unmodified built-in here too", () => {
		const { registry, css } = harness();
		const info = registry.get("info");
		assert.ok(info);
		const rule = firstRule(css.generateTokenColorCSS(info));
		assert.strictEqual(
			valueOf(rule, "--cs-accent-theme"),
			"var(--callout-info)",
		);
		assert.strictEqual(valueOf(rule, "--cs-accent"), "var(--cs-accent-theme)");
	});
});

describe("generateFallbackCSS — the accent for ids nobody defined", () => {
	it("imposes the fallback's colour with !important", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		const out = css.generateFallbackCSS(registry.getAll());
		const rule = parseRules(out).find(
			(r) => r.selector.startsWith("body .callout:not(") && !r.at.length,
		);
		assert.ok(rule);
		assert.strictEqual(
			valueOf(rule, "--callout-color"),
			"var(--cs-accent-theme) !important",
		);
		assert.strictEqual(
			valueOf(rule, "--cs-accent-theme"),
			"var(--callout-default) !important",
		);
	});

	it("excludes every known id AND alias, in Obsidian's attr form", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		registry.add(definition({ id: "multi word callout" }));
		const out = css.generateFallbackCSS(registry.getAll());
		// A space-form :not() would never exclude the element Obsidian tagged
		// `multi-word-callout`, and these rules carry !important at a
		// specificity no per-callout rule can reach — so the miss would forcibly
		// repaint a callout the user did define.
		assert.ok(out.includes(':not([data-callout="multi-word-callout"])'));
		assert.ok(!out.includes(':not([data-callout="multi word callout"])'));
		// Aliases too: `abstract` ships with `summary`/`tldr`.
		assert.ok(out.includes(':not([data-callout="tldr"])'));
	});

	it("emits nothing at all when no fallback is configured", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "";
		assert.strictEqual(css.generateFallbackCSS(registry.getAll()), "");
	});

	it("emits nothing when the configured fallback is not in the list", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "no-such-row";
		assert.strictEqual(css.generateFallbackCSS(registry.getAll()), "");
	});

	it("still excludes a row handed to the theme", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		registry.add(definition({ id: "themed", externalStyle: true }));
		// Load-bearing rather than an oversight: everything in this block carries
		// !important at a specificity no theme can reach, so dropping the row
		// from the :not() chain would paint it *harder* than a normal callout —
		// the exact opposite of handing it over. "Emit nothing for it" is
		// achieved by generateCalloutCSS returning early instead.
		assert.ok(css.generateFallbackCSS(registry.getAll()).includes(
			':not([data-callout="themed"])',
		));
		assert.strictEqual(
			css.generateCalloutCSS(definition({ id: "themed", externalStyle: true })),
			"",
		);
	});

	it("tags unknown tokens by class, with no :not() chain", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		const out = css.generateFallbackCSS(registry.getAll());
		// The token renderer stamps .cs-unknown on unresolved ids, so a plain
		// class rule suffices on this DOM.
		const rule = ruleFor(
			out,
			".cs-inline-callout.cs-unknown, .cs-heading-callout.cs-unknown, .cs-ref-token.cs-unknown",
		);
		assert.deepStrictEqual(rule.props, [
			"--cs-accent-theme",
			"--cs-accent",
			"--cs-color-rgb",
		]);
	});
});

describe("externalExclusion — lifting themed callouts out of the global rules", () => {
	it("is empty when the user has handed none over", () => {
		const { css } = harness();
		assert.strictEqual(css.externalExclusion(), "");
	});

	it("wraps the list in :where() so the global rules keep their weight", () => {
		const { registry, css } = harness();
		registry.add(
			definition({ id: "themed", externalStyle: true, aliases: ["themed alt"] }),
		);
		const excl = css.externalExclusion();
		// A plain :not([a]):not([b]) chain takes the specificity of each
		// argument, so every row the user hands over would make these rules
		// *harder* for the very theme they are handing them to. :where()
		// contributes zero. (generateFallbackCSS deliberately does the opposite —
		// there the inflation is what lets the catch-all outrank per-callout
		// rules.)
		assert.match(excl, /^:not\(:where\(.+\)\)$/);
		assert.ok(excl.includes('[data-callout="themed"]'));
		assert.ok(excl.includes('[data-callout="themed-alt"]'));
	});

	it("reaches every global rule that is keyed on nothing but .callout", () => {
		const { registry, css } = harness();
		registry.add(definition({ id: "themed", externalStyle: true }));
		registry.settings.globalStyle.titleScale = 1.2;
		registry.settings.globalStyle.alignContentWithTitle = true;
		const out = css.generateGlobalStyleCSS();
		for (const rule of parseRules(out)) {
			assert.ok(
				rule.selector.includes(":not(:where(") ||
					!rule.selector.startsWith(".callout"),
				`global rule escapes the exclusion: ${rule.selector}`,
			);
		}
	});
});
