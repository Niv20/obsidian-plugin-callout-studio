/**
 * manager/styleModeMigration.ts — retiring the manual style-mode model.
 *
 * A callout used to carry a hand-set answer to "who paints this: my theme, or
 * Callout Studio". That question is no longer the user's to answer — the active
 * theme either names the callout id or it does not, and `CalloutRegistry.themeOwns`
 * derives the rest — so the fields that stored the answer have to come off disk.
 *
 * ## What it removes, and why each is safe
 *
 * - **`styleMode`** on a row. Every value it ever held — `"studio"`, and the
 *   retired rungs `"blend"`, `"force"`, `"standard"` — meant "this plugin
 *   paints it", which is exactly what the field's *absence* means now. So this
 *   is a delete with no replacement rather than a translation.
 * - **`settings.defaultStyleMode`**. It existed so that upgrading a vault that
 *   predated the two-mode model changed nothing on screen: it covered all 13
 *   built-ins at once. With ownership derived, a built-in is painted by this
 *   plugin unless the theme names it, so there is nothing left for a vault-wide
 *   default to decide.
 *
 * ## What it deliberately leaves alone
 *
 * **`externalStyle`.** It survives the model that briefly absorbed it, because
 * it never really belonged to it: it means "I style this one myself, in a
 * snippet", which is still a real, user-owned choice. Deleting it would make
 * this plugin start overriding the CSS of everyone who had used the shipped
 * *Use theme style* action, with `!important`, on upgrade.
 *
 * **Anything else on a row.** It stamps nothing: `styleMode` was compared by
 * the full-strength `isCalloutModified`, so a stamped built-in would be written
 * to `data.json`, enter exports, and grow a spurious *Reset to default*. The
 * same trap applies to any replacement field, which is the argument for not
 * having one.
 *
 ## What it does to a saved `source: "theme"` row, and why there are two answers
 *
 * Such a row must not reach the live map, because a theme row is no longer a
 * stored thing at all: it is an **ephemeral overlay**, minted from the active
 * theme's stylesheet on every launch and written to `data.json` by nothing (see
 * `CalloutRegistry.toSaveData` and `manager/theme/themeProvidedRows.ts`). But
 * "what is this row" has two different answers depending on who wrote it, and
 * getting that wrong either deletes a user's callout or resurrects a ghost.
 *
 * - **Written before the data version reached 4** — the value was inert in every
 *   released build, with no readers, arriving only from a long-removed
 *   registration API or an import. Its provenance is genuinely ambiguous, so it
 *   is **preserved**, re-homed to `source: "user"`. The cost is a row the user
 *   may not remember creating; the alternative is deleting one they do.
 * - **Written at version 4 or later** — demonstrably the sweep's own work, since
 *   that is the only thing that has ever minted one. Uncustomized, it is
 *   **dropped**: the startup sweep re-mints it a moment later if the theme still
 *   declares the id, and if the theme does not, the row was a leftover of a
 *   theme that is gone. Customized, it is re-homed rather than dropped, because
 *   the whole point of the customized branch elsewhere is that user edits are
 *   never thrown away to keep a rule tidy.
 *
 * The version gate is the one marker that survives a save. Every other
 * migration in this file's neighbourhood keys on content instead, deliberately,
 * because an imported or hand-edited file can carry any version it likes — but
 * a re-homed row and a row that was always the user's are the same row, so
 * without a durable marker the re-home could not tell itself from its result.
 * The drop needs no gate of its own: nothing writes such a row any more, so it
 * is a no-op on every later load.
 *
 * The whole thing runs once, from `CalloutRegistry.load()`, and the caller
 * turns a `true` return into a `pendingLoadMigrationSave` so the file stops
 * carrying the old shape.
 */
import type { CalloutDefinition, PluginData, PluginSettings } from "../types";

/** The `PluginData.version` this migration is complete as of. */
const DATA_VERSION_NO_MODES = 4;

/**
 * Strip the retired style-mode fields in place. Returns true when anything
 * changed.
 *
 * Only rows named in `data.callouts` are touched — never the seeded built-ins
 * the live map also holds, which have no saved row and so nothing to clean.
 */
export function migrateStyleModes(
	live: Map<string, CalloutDefinition>,
	_settings: PluginSettings,
	data: Partial<PluginData>,
): boolean {
	let changed = false;
	const existingInstall =
		(Array.isArray(data.callouts) && data.callouts.length > 0) ||
		data.settings !== undefined;
	const firstTime = existingInstall && (data.version ?? 0) < DATA_VERSION_NO_MODES;

	// The retired setting is already gone from the live object —
	// `mergeSavedSettings` rebuilds settings from the keys this build knows —
	// so noticing it on the raw file is all that is left to do. That forces a
	// save, which is what stops it riding along in `data.json` forever.
	const rawSettings = data.settings as Record<string, unknown> | undefined;
	if (rawSettings?.defaultStyleMode !== undefined) changed = true;

	for (const saved of data.callouts ?? []) {
		const def = live.get(saved.id) as
			| (CalloutDefinition & { styleMode?: unknown })
			| undefined;
		if (!def) continue;
		if (def.styleMode !== undefined) {
			delete def.styleMode;
			changed = true;
		}
		if (def.source !== "theme") continue;
		if (firstTime || def.customized === true) {
			def.source = "user";
		} else {
			live.delete(saved.id);
		}
		changed = true;
	}

	return changed;
}
