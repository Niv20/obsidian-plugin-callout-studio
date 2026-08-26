/**
 * manager/discoveredRow.ts — what "mirror the fallback callout" means.
 *
 * Two paths make a `source: "fallback"` row wear the configured fallback
 * callout's look, and they are written from opposite ends: `CalloutDiscovery`
 * mints a brand-new row for an id it just met, while
 * `CalloutRegistry.restyleUncustomizedFallbackRows` re-styles rows that already
 * exist when the user picks a different fallback. Nothing forces the two to
 * agree on *which* of the fallback's properties are "the look" — and when they
 * disagreed, the discovery side was the one carrying the fallback's own
 * bookkeeping (authorship flags, shared object references) onto every row it
 * created.
 *
 * So the answer lives here, in one function small enough to read in full, and
 * `CalloutDiscovery` does the deciding (which ids, which guards) rather than
 * the assembling. Depends on nothing but the type, the shipped defaults and the
 * title helper.
 */
import type { CalloutDefinition } from "../types";
import { DEFAULT_CALLOUTS } from "../constants";
import { obsidianDefaultTitle } from "../utils/calloutId";

/** The narrow slice of `CalloutRegistry` this module needs to look a row up. */
interface DefinitionLookup {
	get(id: string): CalloutDefinition | undefined;
}

/**
 * The definition a discovered row should be modelled on: the callout the user
 * chose under **Fallback callout**, or `note` when they chose nothing.
 *
 * The last step deliberately reaches past the registry to `constants.ts`: a
 * stale `fallbackCalloutId` naming a callout that has since been deleted must
 * still produce a styled row rather than a crash, and the SHIPPED `note` is the
 * right model there — not the user's possibly-edited one, which they never
 * pointed at.
 */
export function fallbackSourceFor(
	registry: DefinitionLookup,
	fallbackCalloutId: string,
): CalloutDefinition {
	const noteDefault =
		DEFAULT_CALLOUTS.find((c) => c.id === "note") ?? DEFAULT_CALLOUTS[0]!;
	return registry.get(fallbackCalloutId || "note") ?? noteDefault;
}

/**
 * Build the row discovery adds for a previously unseen `id`, styled after
 * `fallback`.
 *
 * The spread is the whole point — a fallback row is meant to look exactly like
 * the fallback callout, including fields nobody has thought to enumerate yet —
 * so what matters is the short list of keys overridden after it. Everything
 * below the spread is either this row's own identity, or a property of
 * `fallback` that is *not* part of its look.
 */
export function buildDiscoveredRow(
	id: string,
	fallback: CalloutDefinition,
): CalloutDefinition {
	return {
		...fallback,
		// Restated only to CLONE it. `{ ...fallback }` copies the reference, so
		// writing `icon: fallback.icon` after it changed nothing: every row a
		// scan created, and the live fallback definition the registry hands the
		// renderer, all shared one `CalloutIcon` object. Nothing mutates an icon
		// in place today, which is exactly why it stayed invisible — but a
		// single in-place write (a resolver stamping a resolved value, an
		// importer normalizing a pack id) would then travel to every row at
		// once, with no `update()` and no save. `restyleUncustomizedFallbackRows`
		// clones for the same reason rather than rely on that.
		icon: { ...fallback.icon },
		// The only other objects the spread hands over by reference, cloned on
		// the same grounds and with the same depth the sibling path uses.
		bgGradient: fallback.bgGradient ? { ...fallback.bgGradient } : undefined,
		iconAdjust: fallback.iconAdjust
			? structuredClone(fallback.iconAdjust)
			: undefined,
		id,
		// Dash-to-space before capitalizing, matching Obsidian's own
		// default-title algorithm — see obsidianDefaultTitle.
		displayName: obsidianDefaultTitle(id),
		// An alias is an identity the fallback callout owns; two rows claiming
		// it would collide.
		aliases: [],
		builtIn: false,
		source: "fallback",
		// Authorship, not look — and the spread would otherwise copy it.
		// `CalloutEditorSave` stamps `customized: true` on every callout the
		// user creates, so the moment **Fallback callout** points at one of
		// their own, every row discovery mints from then on is born claiming to
		// have been hand-edited. Both consequences are silent and permanent:
		// `pruneUnused` skips such a row forever, so auto-created rows pile up
		// and never clean themselves out, and `filterUsableCallouts` reads it
		// as adopted and keeps offering it in autocomplete long after its last
		// usage went away. `restyleUncustomizedFallbackRows` never copies this
		// flag either — that is the agreement this file exists to keep.
		customized: undefined,
		// Ownership, not look, and sharper than the flag above: it means "this
		// callout's styling belongs to the theme", so a row born wearing it is
		// skipped by `restyleUncustomizedFallbackRows` as well as by the prune.
		// It could never follow the fallback again, and `CSSInjector` — which
		// treats the flag as an opt-out from the whole generated block, the
		// id-blind global rules and the icon repaint alike — would emit nothing
		// for it, leaving a row the user can see in settings and style there
		// while the note stays unpainted.
		externalStyle: undefined,
	};
}

/**
 * `def` re-styled to mirror `fallback`, or `null` when it already does.
 *
 * The other half of {@link buildDiscoveredRow}'s agreement, and the reason both
 * live here: one builds a brand-new row wearing the fallback's look, the other
 * re-dresses rows that already exist when the user picks a different fallback,
 * and nothing outside this file forces the two to agree on which properties
 * "the look" is. When they disagreed, mirrored rows kept their own stale
 * transparency flag while taking the fallback's hexes — the contradiction
 * `dropStaleTransparencyFlags` exists to repair.
 *
 * Every mirrored key is spelled out, `undefined` included, because the result
 * is merged onto the row: a key that isn't there leaves the old value standing.
 *
 * Returning `null` for an unchanged row is not an optimization. The pass runs
 * on every fallback edit, every fallback-target delete and every discovery
 * sweep, so most of its work lands on rows already wearing exactly this style;
 * writing those back fired a full stylesheet regeneration, an icon repaint and
 * a `data.json` write for a no-op.
 */
export function mirroredFallbackRow(
	def: CalloutDefinition,
	fallback: CalloutDefinition,
): CalloutDefinition | null {
	const next: CalloutDefinition = {
		...def,
		icon: { ...fallback.icon },
		hideIcon: fallback.hideIcon,
		colorLight: fallback.colorLight,
		colorDark: fallback.colorDark,
		bgColorLight: fallback.bgColorLight,
		bgColorDark: fallback.bgColorDark,
		bgGradient: fallback.bgGradient ? { ...fallback.bgGradient } : undefined,
		// Transparency travels with the backgrounds it replaces. Omitting it
		// meant a transparent fallback was never mirrored as transparent at all.
		transparentBg: fallback.transparentBg,
		textColorLight: fallback.textColorLight,
		textColorDark: fallback.textColorDark,
		// Both adjustment layers travel together: the per-role map alone would
		// be read against *this* row's stale legacy trio wherever a role leaves
		// a field unset (see resolveIconAdjust).
		iconAdjust: fallback.iconAdjust
			? structuredClone(fallback.iconAdjust)
			: undefined,
		iconOffsetX: fallback.iconOffsetX,
		iconOffsetY: fallback.iconOffsetY,
		iconSize: fallback.iconSize,
	};
	// A structural compare, and sound precisely because `next` is a spread of
	// `def`: the keys they share keep their order, and a mirrored key the row
	// lacks is either `undefined` — which stringify drops on both sides, so the
	// absent-vs-explicitly-absent pair reads as equal — or a value the row
	// genuinely did not have.
	return JSON.stringify(next) === JSON.stringify(def) ? null : next;
}
