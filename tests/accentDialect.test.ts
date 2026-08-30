/**
 * tests/accentDialect.test.ts — which spelling of `--callout-*` a stylesheet
 * expects, read out of its own text.
 *
 * Every fixture below is a few synthetic lines, never a copy of a real theme:
 * the themes named in the comments are the *measurement* that justifies a rule,
 * and pasting 9000 lines of AnuPpuccin in here would freeze its bugs alongside
 * its shape. The numbers come from scanning all 257 themes installed in the dev
 * vault.
 *
 * The one thing to hold on to while editing this file: **`read` and `declared`
 * are two questions**, and every attempt to collapse them into one has a
 * counterexample below.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	resolveAccentDialect,
	type AccentSpelling,
} from "../src/manager/theme/accentDialect";
import { scanAccentDialect } from "../src/manager/theme/accentDialectScan";
import { resolveDeclaredSpelling } from "../src/manager/theme/accentValueFormat";
import { StudioWeightCache } from "../src/manager/theme/StudioWeightCache";
import type { App } from "obsidian";

/** Scan one sheet and resolve it, with core's spelling as the fallback. */
function dialectOf(css: string, core: AccentSpelling = "color") {
	return resolveAccentDialect([scanAccentDialect(css)], core);
}

/**
 * What one variable is declared as in one mode — `undefined` when the sheet
 * does not declare it there at all, which is the answer that sends
 * `accentVarSpelling` to core. Most fixtures below declare unscoped, so the two
 * modes agree and `light` stands for both; the per-mode cases say so.
 */
function declaredIn(
	d: ReturnType<typeof dialectOf>,
	name: string,
	mode: "light" | "dark" = "light",
) {
	return d.declared.get(name)?.[mode];
}

describe("accentDialect — what the read sites expect", () => {
	it("reads a legacy rgba() wrapper as a triplet", () => {
		// AnuPpuccin's whole callout system, in one line: it never wraps
		// --callout-color in color-mix(), so a hex makes every one of these
		// invalid at computed-value time and the colour silently vanishes.
		const d = dialectOf(
			`.callout > .callout-title { background-color: rgba(var(--callout-color), 0.1); }`,
		);
		assert.equal(d.read, "triplet");
	});

	it("reads a color-mix() as a colour", () => {
		const d = dialectOf(
			`.callout { background-color: color-mix(in srgb, var(--callout-color) 10%, transparent); }`,
		);
		assert.equal(d.read, "color");
	});

	it("reads an unwrapped var() as a colour", () => {
		// Aura does exactly this alongside 17 rgba() reads — the minority loses
		// the vote, and that regression is documented rather than fixed.
		const d = dialectOf(`.callout { border-left: 3px solid var(--callout-color); }`);
		assert.equal(d.read, "color");
	});

	it("takes the INNERMOST wrapper, not the outermost", () => {
		const d = dialectOf(
			`.callout { background: color-mix(in srgb, rgb(var(--callout-color)) 25%, transparent); }`,
		);
		assert.equal(d.read, "triplet");
	});

	it("does not mistake relative colour syntax for a triplet", () => {
		// `hsl(from …)` is real (Baseline, Cupertino) and `oklch(from …)` too
		// (Iridium). The wrapper looks legacy and the value is a colour. No
		// verdict in the dev vault flips on this today; relative colour is where
		// themes are heading, so it is pinned before it can.
		for (const value of [
			"hsl(from var(--callout-color) h s l / 0.1)",
			"oklch(from var(--callout-color) l c h)",
			"rgb(from var(--callout-color) r g b)",
		]) {
			assert.equal(dialectOf(`.callout { background: ${value}; }`).read, "color", value);
		}
	});

	it("ignores pass-through aliases, which carry no format at all", () => {
		// Load-bearing, and measured: without this rule SALEM (1 triplet read
		// against 17 aliases), Sandstorm (9 against 14) and Serenity (4 against
		// 5) all flip from triplet to colour — three themes broken by one
		// missing line. An alias just forwards whatever it was handed.
		const d = dialectOf(`
			.callout[data-callout="tip"] { --callout-color: var(--callout-important); }
			.callout[data-callout="note"] { --callout-color: var(--callout-default); }
			.callout > .callout-title { border-left: 3px solid rgb(var(--callout-color)); }
		`);
		assert.equal(d.read, "triplet");
	});

	it("still counts an aliased read that is wrapped", () => {
		// `--x: color-mix(… var(--callout-color) …)` is a real read: the theme
		// committed to a spelling even though the target is a custom property.
		const d = dialectOf(
			`.callout { --my-bg: color-mix(in srgb, var(--callout-color) 10%, transparent); }`,
		);
		assert.equal(d.read, "color");
	});

	it("ignores a theme's private palette", () => {
		// ITS Theme carries --callout-blue, --callout-green and nine more of its
		// own. How a theme spells its private variables is its business; letting
		// them vote would drown out the handful of reads on the contract surface
		// this plugin actually shares with it.
		const d = dialectOf(`.x { color: rgb(var(--callout-blue)); }`);
		assert.equal(d.read, "color", "no evidence — falls back to core");
	});

	it("lets the majority win, and falls back to core without one", () => {
		const mixed = `
			.a { color: rgb(var(--callout-color)); }
			.b { color: rgb(var(--callout-color)); }
			.c { background: color-mix(in srgb, var(--callout-color) 5%, transparent); }
		`;
		assert.equal(dialectOf(mixed).read, "triplet");
		assert.equal(dialectOf("", "color").read, "color");
		assert.equal(dialectOf("", "triplet").read, "triplet");
	});

	it("breaks a tie towards core", () => {
		// Cold code: there is not one tie across the 257 installed themes. Pinned
		// so nobody tunes it into something clever on a hunch.
		const tie = `
			.a { color: rgb(var(--callout-color)); }
			.b { background: color-mix(in srgb, var(--callout-color) 5%, transparent); }
		`;
		assert.equal(dialectOf(tie, "color").read, "color");
		assert.equal(dialectOf(tie, "triplet").read, "triplet");
	});

	it("counts a snippet's reads alongside the theme's", () => {
		// Same reason `maxImportantClasses` takes both: the spelling that has to
		// work is whatever is on the page, whoever wrote it.
		const d = resolveAccentDialect(
			[
				scanAccentDialect(""),
				scanAccentDialect(`.callout { color: rgb(var(--callout-color)); }`),
			],
			"color",
		);
		assert.equal(d.read, "triplet");
	});
});

describe("accentDialect — what the theme's own variables hold", () => {
	it("is per variable, not per sheet", () => {
		// Composer, verbatim in shape: 32 bare-triplet declarations and 14
		// color-mix() reads. One answer for the whole sheet is wrong for half of
		// it, which is the entire reason this is two fields.
		const d = dialectOf(`
			body { --callout-error: 158, 48, 57; --callout-info: #446688; }
			.callout { background: color-mix(in srgb, var(--callout-color) 10%, transparent); }
		`);
		assert.equal(d.read, "color");
		assert.equal(declaredIn(d, "--callout-error"), "triplet");
		assert.equal(declaredIn(d, "--callout-info"), "color");
		assert.equal(declaredIn(d, "--callout-tip"), undefined, "unnamed stays unknown");
	});

	it("sees a triplet a theme declares but never reads", () => {
		// Reshi, Nebula, Novadust, Nightfox and RetroNotes all do this. A
		// read-only detector reports "no evidence" and leaves --cs-accent-theme
		// holding a triplet it is registered <color> to reject — which greys
		// every heading bar and inline pill on an unmodified built-in.
		const d = dialectOf(`body { --callout-info: 12, 34, 56; }`);
		assert.equal(d.read, "color", "no reads at all");
		assert.equal(declaredIn(d, "--callout-info"), "triplet");
	});

	it("follows a var() hop to find the triplet", () => {
		// Obsidian gruvbox declares --callout-info: var(--neutral-blue_x) and
		// --neutral-blue_x: 69,133,136 five hundred lines apart. 19 other
		// installed themes hide a triplet behind indirection the same way.
		const d = dialectOf(`
			body { --neutral-blue_x: 69,133,136; --callout-info: var(--neutral-blue_x); }
		`);
		assert.equal(declaredIn(d, "--callout-info"), "triplet");
	});

	it("follows a var() FALLBACK when the primary is undeclared", () => {
		// The Catppuccin chain, which every AnuPpuccin derivative inherits.
		const d = dialectOf(
			`body { --callout-info: var(--ctp-custom-blue, var(--ctp-ext-blue, 42, 110, 245)); }`,
		);
		assert.equal(declaredIn(d, "--callout-info"), "triplet");
	});

	it("terminates on a chain that references itself", () => {
		const props = new Map([
			["--a", "var(--b)"],
			["--b", "var(--a)"],
			["--callout-info", "var(--a)"],
		]);
		assert.equal(resolveDeclaredSpelling("--callout-info", props), undefined);
	});

	it("gives up rather than guessing past the hop budget", () => {
		const props = new Map<string, string>([["--callout-info", "var(--h0)"]]);
		for (let i = 0; i < 9; i++) props.set(`--h${i}`, `var(--h${i + 1})`);
		props.set("--h9", "1,2,3");
		assert.equal(resolveDeclaredSpelling("--callout-info", props), undefined);
	});

	it("falls back to the sheet's OWN read spelling when the chain leaves it", () => {
		// Four installed themes end a `--callout-<type>` on a variable Obsidian
		// declares and they do not — Arcane on `--color-blue` (core: `#086ddd`),
		// Aura and Nier on `--color-*-rgb` (core: `0, 191, 188`), Vicious on its
		// own `--C005-RGB`. The resolver can only answer "don't know", and before
		// this that meant core's spelling: on 1.13 a colour, so all three triplet
		// themes handed a bare triplet to the `<color>`-registered
		// `--cs-accent-theme` and greyed every heading bar and inline pill on an
		// unmodified built-in.
		//
		// Arcane is why this is the read dialect and not the `-rgb` suffix the
		// other three share: it needs *colour* and has no suffix to read.
		const triplet = dialectOf(`
			body { --callout-info: var(--color-cyan-rgb); }
			.callout { background: rgba(var(--callout-color), 0.1); }
		`);
		assert.equal(triplet.read, "triplet");
		assert.equal(declaredIn(triplet, "--callout-info"), "triplet");

		const colour = dialectOf(`
			body { --callout-info: var(--color-blue); }
			.callout { background: color-mix(in srgb, var(--callout-color) 10%, transparent); }
		`);
		assert.equal(colour.read, "color");
		assert.equal(declaredIn(colour, "--callout-info"), "color");
	});

	it("leaves a theme with no opinion exactly where it was", () => {
		// 195 of the 257 installed themes read nothing, so `read` IS core and the
		// fallback cannot move anything. This is what keeps the change invisible
		// in those vaults.
		for (const core of ["triplet", "color"] as const) {
			const d = dialectOf(`body { --callout-info: var(--nowhere); }`, core);
			assert.equal(declaredIn(d, "--callout-info"), core);
		}
	});

	it("still reads a value it CAN resolve, whatever the sheet reads", () => {
		// The fallback is a last resort, never a shortcut: an explicit value wins
		// over the sheet's habits. Composer is the reason — it declares triplets
		// and reads colours.
		const d = dialectOf(`
			body { --callout-error: 158, 48, 57; --callout-info: #446688; }
			.callout { background: color-mix(in srgb, var(--callout-color) 10%, transparent); }
		`);
		assert.equal(d.read, "color");
		assert.equal(declaredIn(d, "--callout-error"), "triplet");
		assert.equal(declaredIn(d, "--callout-info"), "color");
	});

	it("answers per MODE, because a theme can declare in only one", () => {
		// Nier, in shape: all thirteen accent variables under `.theme-dark`
		// alone, as triplets, with light mode left on core's — which on 1.13 are
		// colours. Ten of the 257 installed themes do something like this
		// (Abyssal, Composer, Nier, Nightfox, Novadust, Poimandres, Polka,
		// Slytherin, Tokyo Night Storm, Velocity).
		//
		// One answer for both modes wraps the wrong one in `rgb()`, and
		// `--cs-accent-theme` is registered `<color>`, so the mismatched mode
		// falls back to grey: every heading bar, inline pill, ref token and icon
		// tint on those built-ins, in whichever mode lost.
		const d = dialectOf(`
			.theme-dark { --callout-warning: 233, 151, 63; }
			.callout { background: rgba(var(--callout-color), 0.1); }
		`);
		assert.equal(declaredIn(d, "--callout-warning", "dark"), "triplet");
		assert.equal(
			declaredIn(d, "--callout-warning", "light"),
			undefined,
			"undeclared in light — core supplies it there",
		);
	});

	it("lets an unscoped declaration stand for both modes", () => {
		const d = dialectOf(`body { --callout-info: 1, 2, 3; }`);
		assert.equal(declaredIn(d, "--callout-info", "light"), "triplet");
		assert.equal(declaredIn(d, "--callout-info", "dark"), "triplet");
	});

	it("lets a mode-scoped declaration override an unscoped one", () => {
		// The cascade, reproduced: `.theme-dark` at (0,1,0) beats `body` at
		// (0,0,1), so the dark view resolves against the theme's dark value.
		const d = dialectOf(`
			body { --callout-info: #446688; }
			.theme-dark { --callout-info: 1, 2, 3; }
		`);
		assert.equal(declaredIn(d, "--callout-info", "light"), "color");
		assert.equal(declaredIn(d, "--callout-info", "dark"), "triplet");
	});

	it("resolves a var() hop inside the mode that declared it", () => {
		// The hop has to be followed in the same view, or a dark-only palette
		// resolves against a light-only alias and comes out `undefined`.
		const d = dialectOf(`
			.theme-dark { --nier-blue: 69, 133, 136; --callout-info: var(--nier-blue); }
		`);
		assert.equal(declaredIn(d, "--callout-info", "dark"), "triplet");
	});

	it("ignores an accent variable declared only behind a theme option", () => {
		// Aura declares nine of them under `.aura-origin-layout`, which is one of
		// three layouts in a class-select and NOT the default; TerraFlow does the
		// same under `.academia-theme`, one palette of eleven. In the state
		// almost everyone is in, the class is absent and the variable still holds
		// *core's* value — a colour on 1.13. Trusting the guarded declaration
		// wraps that colour in `rgb()`, which fails `--cs-accent-theme`'s
		// `<color>` registration, and every heading bar, inline pill and icon
		// tint on those eight built-ins goes grey. Measured: 16 grey-outs across
		// Aura's two modes, down to zero.
		const d = dialectOf(`
			.aura-origin-layout { --callout-info: var(--color-cyan-rgb); }
			.callout { background: rgba(var(--callout-color), 0.1); }
		`);
		assert.equal(d.read, "triplet");
		assert.equal(
			declaredIn(d, "--callout-info"),
			undefined,
			"unknowable guard — core supplies the live value",
		);
	});

	it("trusts a `:not()` guard, which is the theme's normal state", () => {
		// Velocity writes `body:not(.disable-callout-styling)` for its ordinary
		// callout styling — the class only appears when the reader ticks "Restore
		// default Callout styling". Reading that as unknowable would throw away a
		// declaration that is live for almost every reader.
		const d = dialectOf(
			`body:not(.disable-callout-styling) { --callout-quote: 150, 150, 160; }`,
		);
		assert.equal(declaredIn(d, "--callout-quote"), "triplet");
	});

	it("trusts a declaration on `.callout` itself", () => {
		// RetroNotes puts all fourteen there. It is a guard, but it is the
		// element being styled, so it is always satisfied.
		const d = dialectOf(`.callout { --callout-info: 12, 34, 56; }`);
		assert.equal(declaredIn(d, "--callout-info"), "triplet");
	});

	it("still records a palette variable a guarded rule declares", () => {
		// Only accent variables are held to the guard rule. How a theme spells a
		// colour in its own palette is a fact about the theme, not about which
		// option is on — and a `var()` chain that hops through it has to resolve.
		const d = dialectOf(`
			.some-option { --brand-rgb: 1, 2, 3; }
			body { --callout-info: var(--brand-rgb); }
		`);
		assert.equal(declaredIn(d, "--callout-info"), "triplet");
	});

	it("lets a snippet's declaration win over the theme's", () => {
		// Cascade order: snippets load after the theme.
		const d = resolveAccentDialect(
			[
				scanAccentDialect(`body { --callout-info: #446688; }`),
				scanAccentDialect(`body { --callout-info: 1, 2, 3; }`),
			],
			"color",
		);
		assert.equal(declaredIn(d, "--callout-info"), "triplet");
	});
});

describe("accentDialect — what the theme paints unconditionally", () => {
	it("records a property declared on a bare .callout", () => {
		// Obsidian gruvbox's entire callout section is this one rule, at (0,1,0)
		// — the only theme selector in the vault light enough for the derived
		// surface to outrank by accident.
		const d = dialectOf(`.callout { background-color: rgba(var(--callout-color), 0.2); }`);
		assert.ok(d.unguarded.has("background-color"));
	});

	it("records the name the theme wrote, and does not expand it", () => {
		// This set is raw evidence: `border` stays `border`. Expanding a
		// shorthand into the longhands it paints belongs to the one reader —
		// `PAINTERS` in manager/css/coreAccentShim.ts — because only the reader
		// knows which properties it is about to emit, and one table there cannot
		// drift from the declarations beside it the way two recording sites did.
		const d = dialectOf(`.callout { background: #123456; border: 1px solid red; }`);
		assert.ok(d.unguarded.has("background"));
		assert.ok(d.unguarded.has("border"));
		assert.equal(d.unguarded.has("background-color"), false);
		assert.equal(d.unguarded.has("border-color"), false);
	});

	it("still counts it when the selector is repeated for weight", () => {
		const d = dialectOf(`.callout.callout { background-color: #123456; }`);
		assert.ok(d.unguarded.has("background-color"));
	});

	it("does NOT record a rule gated by a body class", () => {
		// AnuPpuccin's Vanilla Normal. We cannot know whether the class is on,
		// and when it is its (0,4,0) beats the derived surface on its own — so
		// suppressing here would strand every callout the guard does not reach.
		const d = dialectOf(
			`.anp-callout-vanilla-normal .callout { background-color: transparent; }`,
		);
		assert.equal(d.unguarded.size, 0);
	});

	it("does NOT record a rule gated by callout metadata", () => {
		// Opt-in per callout, via `> [!note|anp-vanilla-normal]`. Conditional on
		// what the user typed, so it says nothing about callouts in general.
		const d = dialectOf(
			`.callout[data-callout-metadata*=anp-vanilla-normal] { background-color: transparent; }`,
		);
		assert.equal(d.unguarded.size, 0);
	});

	it("does NOT record a rule scoped to one callout id", () => {
		const d = dialectOf(`.callout[data-callout="note"] { background-color: #123456; }`);
		assert.equal(d.unguarded.size, 0);
	});

	it("does not record custom properties", () => {
		// The derived surface never emits one, so a theme declaring one here
		// cannot collide with it.
		const d = dialectOf(`.callout { --callout-blend-mode: normal; }`);
		assert.equal(d.unguarded.size, 0);
	});
});

describe("accentDialect — kept current without polling", () => {
	/** An Obsidian whose active theme can be swapped under us. */
	function swappableApp(): { app: App; setTheme: (name: string, css: string) => void } {
		const customCss = {
			theme: "A",
			themes: { A: { version: "1" } } as Record<string, { version: string }>,
			styleEl: { textContent: "" },
			snippets: [] as string[],
			enabledSnippets: new Set<string>(),
			extraStyleEls: [] as Array<{ textContent: string }>,
		};
		return {
			app: { customCss } as unknown as App,
			setTheme: (name, css) => {
				customCss.theme = name;
				customCss.themes[name] = { version: "1" };
				customCss.styleEl.textContent = css;
			},
		};
	}

	const LEGACY = `.callout { background: rgba(var(--callout-color), 0.1); }`;
	const MODERN = `.callout { background: color-mix(in srgb, var(--callout-color) 10%, transparent); }`;

	it("re-derives at a pass boundary when the theme changes", () => {
		// The whole live-update story, and it needs no machinery of its own:
		// `css-change` already invalidates and re-injects, and an inject opens
		// with `beginPass()`. No polling, no MutationObserver, one round.
		const { app, setTheme } = swappableApp();
		setTheme("Legacy", LEGACY);
		const cache = new StudioWeightCache(app);
		assert.equal(cache.dialect().read, "triplet");

		setTheme("Modern", MODERN);
		cache.beginPass();
		assert.equal(cache.dialect().read, "color");
	});

	it("holds the answer steady WITHIN a pass", () => {
		// Forty callouts in one inject must not re-scan an 850 KB sheet forty
		// times, and must not disagree with each other halfway through.
		const { app, setTheme } = swappableApp();
		setTheme("Legacy", LEGACY);
		const cache = new StudioWeightCache(app);
		assert.equal(cache.dialect().read, "triplet");
		setTheme("Modern", MODERN);
		assert.equal(cache.dialect().read, "triplet", "still the pass's answer");
	});

	it("does not move for a Style Settings toggle, and should not", () => {
		// Style Settings changes body classes and variable VALUES; it never
		// rewrites a read site. It does fire css-change, so this path runs — and
		// the right outcome is that the generated CSS comes out byte-identical
		// and nothing is re-injected. The theme's own guarded rules take effect
		// on their own, live, which is the entire fix for "Style Settings
		// options are not inherited".
		const { app, setTheme } = swappableApp();
		setTheme("Legacy", LEGACY);
		const cache = new StudioWeightCache(app);
		const before = cache.dialect().read;
		cache.beginPass();
		assert.equal(cache.dialect().read, before);
	});
});
