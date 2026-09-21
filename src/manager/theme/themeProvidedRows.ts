/**
 * manager/theme/themeProvidedRows.ts — giving the callout types a theme invents
 * a row of their own.
 *
 * A theme like AnuPpuccin or ITS does not only repaint `note` and `warning`; it
 * declares callout ids Obsidian has never heard of. Before this, those were
 * invisible to the plugin: they had no row, so they did not appear in the
 * settings list, in autocomplete, or in quick insert, and the only way to use
 * one was to type it from memory and let discovery mint an *unrelated*
 * fallback-styled row for it the next time the file was scanned.
 *
 * This sweep mints a row for each of them instead — in `theme` mode, so nothing
 * is emitted and the theme keeps drawing them exactly as it always did — and
 * removes them again when the theme stops supplying them.
 *
 * ## Three rules that keep the sweep from destroying anything
 *
 * 1. **It never touches a row it did not mint.** The mint step skips any id
 *    that already has a row or is somebody's alias, so a callout the user
 *    created keeps `source: "user"`, its colours, and its own style mode even
 *    when the theme happens to define the same id. The settings tab groups such
 *    a row under the theme anyway — grouping is by *origin*, and it is asked of
 *    {@link ThemeCalloutStore.themeDefinedIds}, not of `source`.
 * 2. **A row the user has adopted is re-homed, never deleted.** Switching theme
 *    turns a customized `source: "theme"` row into `source: "user"`, so it
 *    simply moves down into *My callout types* carrying every field it had.
 * 3. **It is idempotent.** Run twice on the same stylesheet it writes nothing,
 *    which is what keeps the `css-change` → inject → `css-change` chain from
 *    cycling. When that sweep runs, and why the chain terminates, is
 *    `themeRowSync.ts` — this file is only the sweep itself.
 */
import type { CalloutDefinition } from "../../types";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { buildDiscoveredRow, fallbackSourceFor } from "../discoveredRow";
import {
	pruneRetiredThemeIds,
	recordRetiredThemeIds,
} from "./retiredThemeIds";
import type { RetiredThemeIdHolder } from "../DeviceLocalStore";
import type { ThemeCalloutStore } from "./ThemeCalloutStore";

/** The slice of `CalloutRegistry` this sweep needs. */
export interface ThemeRowRegistry {
	settings: { fallbackCalloutId: string };
	getAll(): CalloutDefinition[];
	get(id: string): CalloutDefinition | undefined;
	add(def: CalloutDefinition): boolean;
	update(id: string, partial: Partial<CalloutDefinition>): boolean;
	remove(id: string): boolean;
	batch<T>(body: () => T): T;
	/**
	 * Publish which ids the theme claims. Called by the sweep itself so the
	 * two cannot be done out of order: every row it mints this round is already
	 * known to be the theme's before anything renders it.
	 */
	setThemeOwnedIds(ids: ReadonlySet<string>): boolean;
}

/**
 * Bring the `source: "theme"` rows in line with what the active theme defines.
 * Returns the number of rows added, removed or re-homed.
 */
export function syncThemeProvidedRows(
	registry: ThemeRowRegistry,
	store: ThemeCalloutStore,
	holder: RetiredThemeIdHolder,
): number {
	const themeIds = store.themeDefinedIds();
	const existing = registry.getAll();

	// Every attribute form already spoken for, so a minted row can never
	// collide with a callout the user (or Obsidian) already owns. Aliases count
	// — two rows claiming one attribute id is the collision `findAttrIdConflict`
	// exists to prevent. It is also what makes provenance structural: the
	// overlay only ever holds ids nothing else defines, so a row that survives
	// the retire pass below is, by construction, one that existed first.
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
	// throughout, with no delete-and-remint in the middle.
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
		const retired: string[] = [];
		for (const def of stale) {
			if (def.customized === true) {
				// Kept as insurance rather than because anything still reaches
				// it: the preview window stopped writing to theme rows, and a
				// theme row is no longer persisted, so nothing can arrive here
				// customized. Deleting a user's edits to tidy away a dead branch
				// is the wrong direction to be wrong in.
				if (registry.update(def.id, { source: "user" })) changed++;
			} else if (registry.remove(def.id)) {
				changed++;
				// The theme took the callout type with it, but the notes did not
				// change — so without this, discovery re-creates the row from
				// `[!recite]` still sitting in a file, one file-open later.
				retired.push(def.id);
			}
		}
		if (fresh.length > 0) {
			const fallback = fallbackSourceFor(
				registry,
				registry.settings.fallbackCalloutId,
			);
			for (const id of fresh) {
				// Modelled on the fallback callout so the row has *something*
				// to show in the pickers, where a colourless entry reads as
				// broken. None of it is emitted, and none of it is saved — see
				// `CalloutRegistry.toSaveData`, which skips `source: "theme"`.
				const row: CalloutDefinition = {
					...buildDiscoveredRow(id, fallback),
					source: "theme",
				};
				if (registry.add(row)) changed++;
			}
		}

		// Recorded and pruned together so the list only ever holds ids that are
		// still retired: one that has a definition again, or that this theme has
		// started declaring again, drops straight back out.
		const before = holder.retiredThemeIds;
		const next = pruneRetiredThemeIds(
			recordRetiredThemeIds(before, retired),
			(id) => registry.get(id) !== undefined,
			(id) => themeIds.has(obsidianCalloutAttrId(id)),
		);
		if (next.length !== before.length || next.some((id, i) => id !== before[i])) {
			holder.retiredThemeIds = next;
			changed++;
		}
		return changed;
	});
}
