/**
 * manager/theme/themeOverlayRows.ts — giving the callout types a theme invents
 * a row of their own, for as long as that theme is active.
 *
 * A theme like AnuPpuccin or ITS does not only repaint `note` and `warning`; it
 * declares callout ids Obsidian has never heard of. Without a row they are
 * invisible to the plugin — absent from the settings list, from autocomplete
 * and from quick insert — and, worse, absent from the `:not()` chain that
 * `generateFallbackCSS` builds out of `getAll()`. Everything in that chain
 * carries `!important` at a specificity no theme can reach, so a theme callout
 * with no row is not merely unlisted: it is actively overpainted with the
 * fallback template. Minting the row is what hands it back.
 *
 * ## Why this can never reach `data.json`
 *
 * The rows are minted in `source: "theme"`, and that source is the one thing
 * `selectPersistedRows` drops unconditionally (`discoveredRowPersistence.ts`).
 * They are equally excluded from `getUserDefined`, and so from JSON exports and
 * the *Reset everything* sweep. This matters because theme ownership is a fact
 * about *this machine*: a vault synced to a laptop with a different theme must
 * produce a byte-identical `data.json`, or two devices start rewriting one
 * file at each other — issue #41. The overlay is therefore add-or-remove only.
 * Nothing here re-homes a row into a persisted source. A manual scan or an
 * explicit import can save a definition for that id.
 *
 * ## Three rules that keep the sweep from destroying anything
 *
 * 1. **It never touches a row it did not mint.** The mint step skips any id
 *    that already has a row or is somebody's alias, so a callout the user
 *    created keeps `source: "user"`, its colours and its style mode even when
 *    the theme happens to declare the same id. The settings tab groups such a
 *    row under the theme anyway — grouping is by `themeOwns`, not by `source`.
 * 2. **Only rows it minted are removed.** `stale` filters on
 *    `source === "theme"`, so a row that was ever anything else is out of
 *    reach. A `"fallback"` row left behind by a scan simply drops into *My
 *    callout types* when the theme lets go of its id.
 * 3. **It is idempotent.** Run twice against the same stylesheet it changes
 *    nothing, which is what stops the `css-change` → inject → `css-change`
 *    chain from cycling.
 */
import type { CalloutDefinition } from "../../types";
import { RESERVED_DEMO_IDS } from "../../constants";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { usableThemeIds } from "../../utils/usableCallouts";
import { buildDiscoveredRow, fallbackSourceFor } from "../discoveredRow";

/** The slice of `CalloutRegistry` this sweep needs. */
export interface ThemeOverlayRegistry {
	settings: { fallbackCalloutId: string };
	getAll(): CalloutDefinition[];
	get(id: string): CalloutDefinition | undefined;
	add(def: CalloutDefinition): boolean;
	remove(id: string): boolean;
	batch<T>(body: () => T): T;
	/**
	 * Publish which ids the theme claims. Called by the sweep itself so the two
	 * cannot be done out of order: every row it mints this round is already
	 * known to be the theme's before anything renders it.
	 */
	setThemeOwnedIds(ids: ReadonlySet<string>): boolean;
}

/**
 * Bring the `source: "theme"` overlay in line with what the active theme
 * declares. Returns the number of rows added or removed.
 *
 * `declared` is the raw set from {@link ThemeCalloutStore.themeDefinedIds};
 * filtering it is this function's job so the scan and the overlay cannot
 * disagree about which ids are real.
 */
export function syncThemeOverlayRows(
	registry: ThemeOverlayRegistry,
	declared: ReadonlySet<string>,
): number {
	// A stylesheet may name anything; only a value that can be written as an
	// actual callout token can become a row. Reserved demo ids are excluded
	// outright — a theme that happens to name one must not be able to mint a
	// row over the settings preview's placeholder.
	const themeIds = new Set(
		[...usableThemeIds(declared)].filter((id) => !RESERVED_DEMO_IDS.has(id)),
	);
	const existing = registry.getAll();

	// Every attribute form already spoken for, so a minted row can never
	// collide with a callout the user (or Obsidian) already owns. Aliases count
	// — two rows claiming one attribute id is the collision `findAttrIdConflict`
	// exists to prevent. It is also what makes provenance structural: the
	// overlay only ever holds ids nothing else defines, so it can never shadow
	// anything, because it exists only where there is nothing to shadow.
	const claimed = new Set<string>();
	for (const def of existing) {
		claimed.add(obsidianCalloutAttrId(def.id));
		for (const alias of def.aliases ?? []) {
			claimed.add(obsidianCalloutAttrId(alias));
		}
	}

	// An id both the outgoing and the incoming theme declare appears in neither
	// list — not stale, because the set still has it; not fresh, because a row
	// already claims it. A direct theme switch therefore leaves it owned
	// throughout, with no delete-and-remint flicker in the middle.
	const stale = existing.filter(
		(def) =>
			def.source === "theme" && !themeIds.has(obsidianCalloutAttrId(def.id)),
	);
	const fresh = [...themeIds].filter((id) => !claimed.has(id));

	// Ownership moves even when no row does — a theme that starts naming a
	// built-in mints and retires nothing yet changes who paints it — so it is
	// published unconditionally, and inside the batch so that listeners see the
	// rows and the ownership as one change rather than two halves of a sweep.
	return registry.batch(() => {
		registry.setThemeOwnedIds(themeIds);
		let changed = 0;
		for (const def of stale) {
			if (registry.remove(def.id)) changed++;
		}
		if (fresh.length > 0) {
			const fallback = fallbackSourceFor(
				registry,
				registry.settings.fallbackCalloutId,
			);
			for (const id of fresh) {
				// Modelled on the fallback callout so the row has *something* to
				// show in the pickers, where a colourless entry reads as broken.
				// Artwork loaders and cache cleanup skip theme rows, so even a
				// placeholder left over after a fallback change cannot modify
				// the synced icon cache. None of this is emitted (the
				// injector stands down for a theme-owned row) and none of it is
				// saved.
				const row: CalloutDefinition = {
					...buildDiscoveredRow(id, fallback),
					source: "theme",
				};
				if (registry.add(row)) changed++;
			}
		}
		return changed;
	});
}
