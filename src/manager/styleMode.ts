/**
 * manager/styleMode.ts — who gets to style a callout, and how hard we push.
 *
 * One resolved answer per callout, read by everything that emits CSS or DOM for
 * it, so the four surfaces that have to agree (`CSSInjector`, `renderShared`,
 * `cssSnippetExport`, `CalloutDiscovery`) cannot drift apart by each testing the
 * raw fields themselves.
 *
 * ## Why there is a ladder at all
 *
 * The generated CSS goes into `document.adoptedStyleSheets`, which the cascade
 * orders after every `<link>`/`<style>` in the document — so at *equal*
 * specificity this plugin beats a theme and a snippet both. That is where the
 * old "Callout Studio always wins" belief came from, and it is only half true:
 * source order breaks ties, and the themes that make callouts their selling
 * point do not write ties. Measured against ITS Theme, 450 of its 718 callout
 * selectors (63%) sit above this plugin's `(0,2,0)`. The user does not see
 * "the theme won" — they see a *split*, this plugin carrying the properties the
 * theme happened not to escalate and the theme carrying the rest.
 *
 * So one boolean was never enough. `theme` hands the callout over whole;
 * `force` takes it back whole; `standard` is the polite middle that was the
 * only behaviour before, and stays the default.
 */
import type { CalloutDefinition } from "../types";

/** The resolved answer. See the module comment for what each one means. */
export type CalloutStyleMode = "theme" | "standard" | "force";

/**
 * The mode a definition is in.
 *
 * `externalStyle` is deliberately still the persisted spelling of `"theme"`
 * rather than a `styleMode` value: `data.json` syncs between devices that may
 * run different builds of the plugin, and a build too old to know the field
 * ignores it. Ignoring `styleMode: "force"` costs nothing (the callout renders
 * the way it always did); ignoring `styleMode: "theme"` would mean an old build
 * *restyling a callout its owner handed to their theme*, which is the loudest
 * regression available. Two keys, and every existing row keeps working
 * untouched — hence no migration.
 */
export function styleModeOf(def: CalloutDefinition): CalloutStyleMode {
	if (def.externalStyle === true) return "theme";
	return def.styleMode ?? "standard";
}

/** True when this plugin emits nothing at all for the callout. */
export function standsDown(def: CalloutDefinition): boolean {
	return styleModeOf(def) === "theme";
}

/**
 * The definition `def` becomes in `mode`, or `null` when it is already there.
 *
 * Lives here rather than in `CalloutRegistry.setStyleMode` because it is the
 * other half of {@link styleModeOf} — three states across two fields only stays
 * unambiguous if exactly one place writes them, and that place should be the
 * one that reads them.
 *
 * Two rules, both load-bearing. It writes at most one field and **deletes the
 * other**, so no row can ever claim two states at once. And it deletes rather
 * than writing `false` / `"standard"`, because `isCalloutModified` compares
 * `JSON.stringify(value ?? null)` — an explicit falsy value would leave a
 * built-in nobody edited looking customized forever.
 */
export function applyStyleMode(
	def: CalloutDefinition,
	mode: CalloutStyleMode,
): CalloutDefinition | null {
	if (styleModeOf(def) === mode) return null;
	const next: CalloutDefinition = { ...def };
	delete next.externalStyle;
	delete next.styleMode;
	if (mode === "theme") next.externalStyle = true;
	else if (mode === "force") next.styleMode = "force";
	return next;
}

/**
* How many times `.callout` is repeated in a forced selector.
 *
 * At weight *w* the per-callout rule is `(0,w+1,0)` and its `.theme-dark` twin
 * is `(0,w+2,0)`. Class count is compared before element count, so this number
 * alone decides whether a theme's rule or ours applies.
 *
 * Eight is measured, not guessed. `themeCalloutScan` reports the heaviest
 * class-count any selector uses per callout id, and across the themes on hand
 * that is 7 (ITS Theme, on `[!quote]` and `[!recite]`), 6 (Baseline) and 6
 * (Cupertino). Weight 8 puts the light rule at 9 and the dark one at 10 — two
 * units clear of the worst observed. An earlier draft used 6, which merely
 * *tied* ITS and would have relied on source order to break it.
 *
 * Repeating the one class every callout is guaranteed to carry is deliberate,
 * and the alternatives were worse: `:not()` changes *what matches* (that is
 * `generateFallbackCSS`'s job, and the reason its chain is already `(0,26,1)`),
 * and `:is()` takes the max of its arguments, which is harder to read off the
 * selector and harder to test. Repetition is semantically inert, matches
 * right-to-left off the attribute so the extra class tests cost nothing, and
 * its weight is obvious to anyone reading the emitted CSS.
 */
export const FORCE_WEIGHT_DEFAULT = 8;

/**
 * The ceiling, for when the weight is later derived from the active theme
 * rather than fixed. Past this a theme is doing something pathological and
 * more weight is not the answer — see `!important` below.
 */
export const FORCE_WEIGHT_MAX = 14;

/**
 * The `.callout` repeat count a mode emits at.
 *
 * Note what force does *not* do. It wins the properties this plugin declares;
 * it does not undo layout the theme adds (a theme that turns a callout into a
 * card grid keeps its card grid), and it cannot beat a theme that shipped
 * `!important`.
 *
 * Escalating to `!important` here was considered and rejected, and not out of
 * squeamishness. This plugin's CSS already cascades after every snippet, so at
 * equal importance it beats the user's own CSS too. Adding `!important` would
 * mean a user who wants to correct one property in their own snippet can only
 * answer with `!important` — and still lose on source order. That makes the
 * plugin unoverridable by its own user, which is strictly worse than losing a
 * property to their theme. A high-specificity rule always leaves one more class
 * as an escape hatch; `!important` leaves none, which is why it stays confined
 * to `generateFallbackCSS`.
 */
export function emitWeightFor(mode: CalloutStyleMode): number {
	return mode === "force" ? FORCE_WEIGHT_DEFAULT : 1;
}
