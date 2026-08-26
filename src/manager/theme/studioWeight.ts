/**
 * manager/theme/studioWeight.ts — how hard Callout Studio has to push to win a
 * callout it owns.
 *
 * All that survives of the retired style-mode module. Ownership is no longer a
 * setting: the active theme either names a callout id or it does not, and
 * `CalloutRegistry.themeOwns` answers that. What is left is the arithmetic for
 * the callouts the plugin *does* paint, and it lives here beside
 * {@link StudioWeightCache}, which is its only production caller.
 *
 * ## Why the plugin writes `!important` at all
 *
 * The generated CSS goes into `document.adoptedStyleSheets`, which the cascade
 * orders after every `<link>`/`<style>` in the document — so at *equal*
 * specificity this plugin beats a theme and a snippet both. That is where the
 * old "Callout Studio always wins" belief came from, and it is only half true:
 * source order breaks ties, and the themes that make callouts their selling
 * point do not write ties. Measured across the 257 themes in the dev vault, the
 * heaviest callout selectors reach twelve class-units.
 *
 * The user does not experience that as "the theme won". They experience a
 * **split** — this plugin carrying the properties the theme happened not to
 * escalate, the theme carrying the rest — and a split reads as the plugin being
 * broken. So for a callout the plugin owns it takes every property outright,
 * using two levers that answer two different attacks:
 *
 * - `!important` beats a theme's normal declaration whatever its specificity.
 * - Among `!important` declarations the cascade compares specificity again, so
 *   the derived weight is what beats a theme that also shipped `!important`.
 *
 * The escape hatch survives: a user snippet can still overrule us with
 * `!important` plus one more class-unit than {@link studioWeightFor} emitted,
 * and the emitted weight is readable straight off the generated CSS. The
 * signposted route, though, is *Style with my own CSS* on the row itself, which
 * stops the plugin emitting anything for that callout at all.
 *
 * Deliberately *not* covered by any of this: the `.cs-*` DOM this plugin
 * invents for heading and inline callouts. No theme selector can match it, so
 * those rules stay plain, stay correctable, and — since they cannot collide with
 * a theme — are the one thing the plugin still draws for a callout its theme
 * owns.
 */

/**
 * How many times `.callout` is repeated in a selector when the active theme
 * gives it nothing to climb over — which is the overwhelmingly common case, and
 * why this is 1 rather than a defensive constant.
 *
 * The rung this replaced repeated `.callout` eight times unconditionally,
 * because it had no `!important` and specificity was the only lever it had.
 * With `!important` the two levers answer different attacks and only one of
 * them is usually needed:
 *
 * - A theme's **ordinary** declaration loses to an `!important` one at *any*
 *   specificity. Weight buys nothing against it.
 * - A theme's **`!important`** declaration is compared against ours by
 *   specificity, and only then by source order. That is the one case weight
 *   decides, and {@link studioWeightFor} sizes it from exactly that.
 *
 * Keeping the base at 1 is not just economy, though it is that too — eight
 * repeats add ~64 characters to every selector in the sheet, and the sheet is
 * written to localStorage on every change. It also keeps the user's own escape
 * hatch reachable: a snippet overrules us with `!important` plus one more
 * class-unit than we emitted, which at weight 1 is
 * `.callout.callout[data-callout="x"]` and at weight 14 is something nobody
 * writes by hand.
 */
export const STUDIO_WEIGHT_BASE = 1;

/**
 * The ceiling. Past this a theme is doing something pathological, and the
 * honest answer is that we do not beat it rather than an arms race that makes
 * every selector in the sheet longer for everyone.
 *
 * Safe at 14 because of a measured fact rather than a hopeful one: across the
 * 257 themes in the dev vault the heaviest callout selector is twelve
 * class-units (Elegance and Faded), and **no theme both exceeds this ceiling
 * and carries `!important`** — which is the only combination that could reach
 * past us.
 */
export const STUDIO_WEIGHT_MAX = 14;

/**
 * The weight to emit at, given the heaviest class-count the active theme and
 * snippets use on a callout selector **that carries `!important`**
 * (`ThemeCalloutStore.maxImportantClasses`).
 *
 * Important-only is the whole subtlety, and getting it wrong is expensive in
 * both directions: measuring every selector would put most vaults at weight 11
 * for nothing (AnuPpuccin reaches ten class-units, and does so *without*
 * `!important`, so ordinary importance already beats it), while measuring none
 * would lose to the themes that do reach for it.
 *
 * `maxClasses + 1` because the light rule lands at `(0, w+1, 0)`: one more than
 * the theme's own count clears it by two, and the `.theme-dark` twin by three.
 * Zero yields {@link STUDIO_WEIGHT_BASE}, and the result is clamped to
 * {@link STUDIO_WEIGHT_MAX}.
 *
 * A pure function of one number on purpose — the reason this is worth a name is
 * that it is the arithmetic a test can pin against real theme selectors, and
 * the version of it that shipped as a constant was wrong in a way nobody could
 * see.
 */
export function studioWeightFor(maxImportantClasses: number): number {
	return Math.min(
		STUDIO_WEIGHT_MAX,
		Math.max(STUDIO_WEIGHT_BASE, maxImportantClasses + 1),
	);
}
