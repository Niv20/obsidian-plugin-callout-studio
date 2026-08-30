/**
 * manager/css/coreAccentShim.ts — the properties core stops painting when this
 * plugin hands the theme a spelling core itself cannot read.
 *
 * `accentDialect.ts` explains why `--callout-color` sometimes has to be written
 * as a bare RGB triplet on an Obsidian that wants a colour: the theme is the
 * one reading it, and a theme written before 1.13 never updated its
 * `rgba(var(--callout-color), …)`. The cost of doing that is precise and
 * enumerable — core's own `app.css` reads `--callout-color` in exactly eight
 * declarations, and a triplet makes all eight invalid at computed-value time:
 *
 *     .callout      { background-color, border-color,
 *                     --bases-table-header-background-hover,
 *                     --bases-embed-border-color, --bases-table-border-color,
 *                     --table-border-color }
 *     .callout-title      { color }
 *     .callout-icon .svg-icon { color }
 *
 * This module restates the first seven, re-spelled so they parse. The eighth is
 * deliberately absent: `.callout-icon .svg-icon`
 * is the only `color` reaching that element inside a callout, so when it unsets
 * it *inherits* — from `.callout-title`, which the rule below sets. Writing it
 * out would force a `(0,5,0)` selector heavier than most themes' own icon
 * rules, which is exactly the over-reach this file exists to avoid.
 *
 * ## Two rules about how hard this pushes, and both are the whole point
 *
 * **No `!important`, ever.** These are not the user's choices — they are core's
 * defaults, restated. A theme that has an opinion about the background must
 * still win.
 *
 * **`calloutSelDeferring`, never `CSSInjector.sel`.** The injector emits its own
 * rules at `studioWeights.resolve()`, which is 5 under AnuPpuccin — that theme
 * carries an `!important` callout rule, and one is enough to lift the weight. A
 * shim built from `this.sel()` would land at `(0,6,0)` and beat AnuPpuccin's own
 * `.anp-callout-vanilla-normal .callout:not(…):not(…)` at `(0,4,0)`, turning
 * every callout into an opaque tint *against the Style Settings option the user
 * deliberately chose* — worse than the bug this was written to fix.
 *
 * `(0,1,0)` rather than the `(0,2,0)` of an ordinary `calloutSel` for a reason
 * measured rather than tidy: a single-class guard like Minimal's
 * `.callouts-outlined .callout` or Aura's `.aura-origin-layout .callout` is
 * also `(0,2,0)`, and a tie goes to whoever comes last in the document — which
 * is always this sheet. Dropping one class-unit turns every one of those ties
 * into a loss, which is the right way round. The only tie left is with core
 * itself, and that one this sheet is *supposed* to win.
 *
 *     core        `.callout`                                    (0,1,0)  tie → source order
 *     this        `:where(.callout)[data-callout="x"]`          (0,1,0)
 *     a theme     `.callouts-outlined .callout`                 (0,2,0)  theme wins
 *     a theme     `.anp-callout-vanilla-normal .callout:not()…` (0,4,0)  theme wins
 *
 * ## Why there is no `.theme-dark` twin
 *
 * Every declaration reads a variable rather than a baked colour, and the
 * injector already redeclares both of them in its own dark rule. One rule
 * follows both modes for free.
 */
import type { AccentDialect, AccentSpelling } from "../theme/accentDialect";

/**
 * The colour to build these declarations out of — and there are two answers,
 * because there are two situations and only one of them is knowable.
 *
 * When **this plugin writes `--callout-color`** (any callout but an unmodified
 * built-in) its spelling is known: it is the active dialect, by construction.
 * Reading it back is then a *transliteration* of core's rule rather than a
 * second opinion about the colour, which is what keeps the box in step with a
 * theme's own per-id override — AnuPpuccin's `anp-callout-color-toggle`
 * repaints all 13 built-ins that way, and `--cs-accent` would follow core's
 * `--callout-default` into a slightly different blue.
 *
 * When **it does not** — an unmodified built-in, where withholding the variable
 * is the whole point (see `accentDeclarations`) — the value belongs to core or
 * to the theme and its spelling is a guess. Guessing wrong does not produce a
 * near-miss; it produces nothing at all, because an unparseable `var()`
 * substitution unsets the property. So that branch reads `--cs-accent`, which
 * is guaranteed a real colour on every version and every theme. A 10% tint in
 * core's blue rather than the theme's is a difference you have to look for; an
 * absent background is not.
 */
function accentRef(spelling: AccentSpelling, ownsVariable: boolean): string {
	if (!ownsVariable) return "var(--cs-accent)";
	return spelling === "triplet"
		? "rgb(var(--callout-color))"
		: "var(--callout-color)";
}

/** Core's own declarations, in core's own order, as functions of that read. */
function calloutProps(accent: string): ReadonlyArray<[string, string]> {
	const bg = `color-mix(in oklch, ${accent} 10%, transparent)`;
	const table = `color-mix(in oklch, ${accent} 25%, var(--background-primary) 50%)`;
	return [
		["background-color", bg],
		[
			"border-color",
			`color-mix(in oklch, ${accent} calc(var(--callout-border-opacity) * 100%), transparent)`,
		],
		["--bases-table-header-background-hover", bg],
		["--bases-embed-border-color", table],
		["--bases-table-border-color", table],
		["--table-border-color", table],
	];
}

export interface CoreAccentShimInput {
	/** `.callout[data-callout="x"]` for the id and every alias, comma-joined. */
	selectors: string;
	/** The same list, each part suffixed with `> .callout-title`. */
	titleSelectors: string;
	/** What the active styling expects. */
	dialect: AccentDialect;
	/** What the running Obsidian expects. */
	core: AccentSpelling;
	/**
	 * True when this plugin writes `--callout-color` for this def, i.e. anything
	 * but an unmodified built-in. See {@link accentRef}.
	 */
	ownsAccentVariable: boolean;
	/**
	 * True when the def paints its own background — authored colour, gradient,
	 * or `transparentBg`. Those go in the injector's `!important` block, and
	 * restating a weaker version underneath them would be dead text.
	 */
	ownsBackground: boolean;
	/**
	 * Does the active styling already declare this property on this callout,
	 * unconditionally? Two sources, both about a rule this shim would outrank by
	 * accident rather than on merit:
	 *
	 * - a bare `.callout` at `(0,1,0)` — Obsidian gruvbox's entire callout
	 *   section is one such rule, and it ties this one, so its deliberate 20%
	 *   tint would otherwise be replaced by core's 10% on source order alone.
	 *   This is the suppression that has to exist;
	 * - a family claim like `[data-callout*=note]`, which does not make the row
	 *   theme-owned (`themeDefinedIds` excludes `*=` on purpose) and so is
	 *   invisible to `standsDown`. At `(0,2,0)` it already outranks this rule,
	 *   so this is belt to that braces — kept because a one-class family
	 *   selector would not.
	 *
	 * Asked with the **declaration name as written**, never a normalised one:
	 * expanding shorthands is this module's job, not the scanners' — see
	 * {@link PAINTERS}.
	 */
	claims(prop: string): boolean;
}

/**
 * Every declaration name that paints one of the properties above, the property
 * itself included.
 *
 * A theme does not have to name the longhand to own the colour, and reading
 * only the longhand is how this shim came to overwrite one. **Sanctum**'s whole
 * callout section is a single bare rule —
 *
 *     .callout {
 *       border: var(--callout-border-width) solid
 *               rgba(var(--callout-color), var(--callout-border-opacity));
 *       background-color: rgba(var(--callout-color), 0.2);
 *     }
 *
 * — so `background-color` was suppressed and `border` was not, and the
 * `border-color` restated underneath it landed on top of the theme's at
 * `(0,1,0)` on source order. Worse than a colour swap: Sanctum sets
 * `--callout-border-opacity: 30%` (its Style Settings entry carries
 * `format: '%'`), and core's expression — `calc(var(--callout-border-opacity) *
 * 100%)`, which this shim transliterates — multiplies two percentages, which is
 * invalid in `calc()`. The declaration unsets and the border falls back to
 * `currentColor`, so raising Sanctum's **Callout border width** drew a black
 * frame where the theme asked for a 30% tint of the accent. Sanctum's own rule,
 * left alone, is correct — and it only *became* reachable because writing the
 * triplet dialect repaired the `rgba()` it is built on.
 *
 * Kept here rather than in `accentDialect.ts`/`themeCalloutScan.ts` because it
 * is knowledge about **what this file emits**: the scanners' job is to report
 * what the stylesheet says, and one table beside the declarations it guards
 * cannot drift from them. It also covers both claim sources at once — the bare
 * `.callout` set and the per-id one — which two recording-site fixes would not.
 *
 * Logical properties are included even though no installed theme writes one on
 * a callout: they are the same declaration in a different alphabet, and the
 * cost of listing them is a line each.
 */
const PAINTERS: Readonly<Record<string, readonly string[]>> = {
	"background-color": ["background-color", "background"],
	"border-color": [
		"border-color",
		"border",
		"border-top",
		"border-right",
		"border-bottom",
		"border-left",
		"border-top-color",
		"border-right-color",
		"border-bottom-color",
		"border-left-color",
		"border-block",
		"border-block-color",
		"border-block-start",
		"border-block-end",
		"border-block-start-color",
		"border-block-end-color",
		"border-inline",
		"border-inline-color",
		"border-inline-start",
		"border-inline-end",
		"border-inline-start-color",
		"border-inline-end-color",
	],
	color: ["color"],
};

/**
 * Does the active styling paint `prop` — by that name or through any shorthand
 * that reaches it? Custom properties have no shorthand and fall through to the
 * plain question.
 */
function painted(input: CoreAccentShimInput, prop: string): boolean {
	return (PAINTERS[prop] ?? [prop]).some((name) => input.claims(name));
}

/**
 * The shim for one callout, or `""` when there is nothing to repair.
 *
 * Empty whenever the active styling and core agree on the spelling. On 1.13
 * that is 221 of the 257 themes in the dev vault — the 196 with no opinion,
 * which fall back to core's own colour spelling, plus the 25 that read a colour
 * — as well as every vault with no theme at all. Only the 36 triplet readers
 * emit anything here, which is what keeps this change invisible everywhere
 * else.
 */
export function coreAccentShimCSS(input: CoreAccentShimInput): string {
	if (input.dialect.read === input.core) return "";

	const accent = accentRef(input.dialect.read, input.ownsAccentVariable);
	const props: string[] = [];
	for (const [name, value] of calloutProps(accent)) {
		if (name === "background-color" && input.ownsBackground) continue;
		if (painted(input, name)) continue;
		props.push(`  ${name}: ${value};`);
	}

	const parts: string[] = [];
	if (props.length > 0) {
		parts.push(`${input.selectors} {\n${props.join("\n")}\n}`);
	}
	if (!painted(input, "color")) {
		parts.push(`${input.titleSelectors} {\n  color: ${accent};\n}`);
	}
	return parts.join("\n\n");
}
