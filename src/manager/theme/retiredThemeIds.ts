/**
 * manager/theme/retiredThemeIds.ts — remembering what a theme took with it.
 *
 * A callout type the theme invented is an ephemeral overlay row: it exists
 * while the theme declares the id and is gone the moment it stops. That is the
 * behaviour, and on its own it does not survive contact with the vault.
 *
 * The notes still say `> [!recite]`. `CalloutDiscovery` reads exactly that and
 * auto-creates rows for ids nothing defines — so the row the theme switch just
 * removed comes straight back one file-open later, as an uncustomized fallback
 * row wearing the default style. The user sees a callout they never made,
 * styled by nobody, in the section for callouts they made.
 *
 * So the sweep records what it retired and discovery consults the list. Three
 * properties are load-bearing:
 *
 * - **It gates discovery only.** `canUseCalloutId` never reads it, so creating
 *   the id explicitly still works and is still the way to take it over.
 * - **A user-requested vault scan clears it.** That is the same doctrine
 *   `suppressRediscovery` already follows: the automatic passes may be held
 *   back, but a scan the user asked for may bring anything back.
 * - **The sweep prunes it.** An id that has a definition again, or that the
 *   active theme declares again, is not retired any more — so the list
 *   self-cleans instead of growing with every theme the user tries.
 *
 * Ids are held in `calloutIdentity` form, the plugin's one canonicalization —
 * which matters here more than most places: a theme declares its callouts in
 * CSS, where the id is always the dasherized `data-callout` spelling, while the
 * notes that still say `> [!recite]` may spell it with spaces. Keyed by the
 * space-preserving form, a retirement recorded as `banner-icon` did not hold
 * back a note writing `[!banner icon]`.
 */
import { calloutIdentity } from "../../utils/calloutId";

/**
 * How many retired ids are worth remembering.
 *
 * The biggest theme in the corpus declares 45, and the list is pruned on every
 * sweep, so reaching this needs a great many switches between themes whose ids
 * are all still in use. It exists so a pathological history cannot grow
 * `data.json` without bound; oldest goes first, because the id a user last
 * stopped using is the one they are least likely to want held back.
 */
export const RETIRED_THEME_ID_CAP = 200;

/** Read a stored list back, dropping anything that is not a usable id. */
export function sanitizeRetiredThemeIds(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const entry of raw) {
		if (typeof entry !== "string") continue;
		const id = calloutIdentity(entry);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out.slice(-RETIRED_THEME_ID_CAP);
}

/** Add ids to the list, newest last, deduped and capped. Pure. */
export function recordRetiredThemeIds(
	list: readonly string[],
	ids: readonly string[],
): string[] {
	const added = ids
		.map((id) => calloutIdentity(id))
		.filter((id) => id.length > 0);
	if (added.length === 0) return [...list];
	const fresh = new Set(added);
	// Re-retiring an id moves it to the back rather than duplicating it, so the
	// cap evicts by how recently the id mattered.
	const kept = list.filter((id) => !fresh.has(id));
	return [...kept, ...new Set(added)].slice(-RETIRED_THEME_ID_CAP);
}

/**
 * Drop ids that are no longer retired: something defines them again, or the
 * active theme has started declaring them again.
 */
export function pruneRetiredThemeIds(
	list: readonly string[],
	isDefined: (id: string) => boolean,
	isThemeClaimed: (id: string) => boolean,
): string[] {
	return list.filter((id) => !isDefined(id) && !isThemeClaimed(id));
}

/** Whether automatic discovery should hold this id back. */
export function isRetiredThemeId(
	list: readonly string[],
	id: string,
): boolean {
	const normalized = calloutIdentity(id);
	return normalized.length > 0 && list.includes(normalized);
}
