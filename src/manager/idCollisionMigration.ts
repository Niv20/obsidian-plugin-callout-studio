/**
 * manager/idCollisionMigration.ts — folding rows that are one callout.
 *
 * Obsidian reduces a callout header to `type.trim().toLowerCase().replace(/\s+/g,
 * "-")` before it ever reaches a plugin, so `[!banner icon]`, `[!banner   icon]`,
 * `[!Banner Icon]` and `[!banner-icon]` all render as
 * `data-callout="banner-icon"` — one callout, four spellings. `CalloutRegistry`
 * keys its map by the id as spelled, so a vault can end up holding two rows for
 * one on-screen callout: they fight over a single CSS rule, split the usage
 * count, and appear twice in Settings, Quick Insert and the command builder.
 *
 * Creating that pair is blocked at the seam now — `CalloutRegistry.add` and the
 * rename branch of `update` both refuse a colliding spelling, via
 * `findAttrIdConflict`. This module is the other half: the pairs already sitting
 * in `data.json`, written by a build whose only guards were at the call sites
 * (and where the JSON backup importer, the one caller that had none, could add
 * the second row).
 *
 * Split out of `CalloutRegistry` rather than living beside the other load
 * migrations because it is the one that has to *merge* rather than delete, and
 * the merge rule below is a data-loss decision worth reading on its own.
 *
 * ## Which row survives
 *
 * In order, first match wins:
 *
 * 1. **a built-in.** Its id cannot realistically collide, but never risk
 *    dropping one.
 * 2. **a real row spelled without a dash.** That is the spelling the editor's ID
 *    field and its display-name derivation produce (`sanitizeCalloutIdInput`
 *    folds every dash run to a space), so it is the one the user most likely
 *    typed rather than inherited from a hand-written note.
 * 3. **any real row.** "Real" meaning not an uncustomized `source: "fallback"`
 *    row, which is disposable auto-junk that discovery would re-create anyway.
 * 4. **the first**, so the pass is total.
 *
 * ## What happens to the other one — survivor wins, loser fills gaps
 *
 * The survivor keeps **every field it authored**. A field it never set is filled
 * from the loser. So two rows that were customized differently come out as one
 * row carrying the union of the two, with the survivor winning every actual
 * disagreement — deterministic, order-independent within a group, and lossless
 * except where the two genuinely contradict each other.
 *
 * Four fields are never filled, and each would be a different kind of wrong:
 * `id` and `aliases` are the identity being merged (handled explicitly below),
 * and `builtIn`/`source` are provenance — a built-in survivor absorbing a
 * `source: "user"` loser must not come out claiming to be user-created.
 *
 * `customized` IS filled, on purpose: a survivor that has just inherited the
 * loser's authored styling has been customized, and leaving the flag unset would
 * let `CalloutDiscovery.pruneUnused` throw the merged row away the next time the
 * vault stopped mentioning it.
 *
 * ## What else has to move with the row
 *
 * Deleting a definition off the map is not the end of it — two other things
 * point at ids by string, and neither survives on its own:
 *
 * - **`settings.fallbackCalloutId`.** `CalloutRegistry.remove` re-points it for
 *   every other deletion path; this pass deletes straight off the map, so it has
 *   to do the same. A dangling value is not inert: `generateFallbackCSS` bails
 *   when the id resolves to nothing and every unrecognized callout in the vault
 *   silently loses its colour, icon and background.
 * - **`settings.customCommands[].calloutId`.** `CustomCommandManager.syncAll()`
 *   drops any command whose callout `registry.has()` cannot find, so a merge
 *   that left one pointing at the loser would delete the command *and* the
 *   hotkey the user bound to it. Re-pointed here the same way
 *   `CustomCommandManager.migrateCalloutId` does it at a rename.
 *
 * ## Why it is a fixed point
 *
 * The caller raises `needsSaveAfterLoad`, so the merged list is written back.
 * On the next load the loser's id survives only as an alias of the survivor, so
 * the group it forms names a single definition and nothing changes. Un-flushed,
 * `data.json` would keep both rows and the merge would simply be redone every
 * launch — the user seeing one row and the file holding two, which is the exact
 * failure `needsSaveAfterLoad` exists to prevent.
 */
import { calloutIdentity } from "../utils/calloutId";
import type { CalloutDefinition, PluginSettings } from "../types";

/**
 * Fields the merge never takes from the losing row. See the module doc — the
 * first two are the identity being merged, the last two are provenance.
 */
const NEVER_MERGED: ReadonlySet<string> = new Set([
	"id",
	"aliases",
	"builtIn",
	"source",
]);

/** What the caller needs to report and to decide whether to flush. */
export interface IdCollisionMergeReport {
	/** `"loser → survivor"` per folded row, for the debug log. */
	merged: string[];
}

/** An uncustomized auto-created row: disposable, and never the survivor. */
const isDisposable = (d: CalloutDefinition): boolean =>
	d.source === "fallback" && d.customized !== true;

/**
 * Copy every field the survivor never set from the loser onto it.
 *
 * Cast through `Record<string, unknown>` rather than `any`: the keys really are
 * arbitrary here — the point is to be total over `CalloutDefinition` so a field
 * added later is merged without anyone remembering to come back — but nothing
 * about the values needs to escape type checking elsewhere.
 */
function fillGaps(survivor: CalloutDefinition, loser: CalloutDefinition): void {
	const target = survivor as unknown as Record<string, unknown>;
	const source = loser as unknown as Record<string, unknown>;
	for (const key of Object.keys(source)) {
		if (NEVER_MERGED.has(key)) continue;
		if (source[key] === undefined) continue;
		if (target[key] !== undefined) continue;
		target[key] = source[key];
	}
}

/**
 * Merge every set of definitions that share one {@link calloutIdentity}.
 *
 * Mutates `callouts` and `settings` in place and returns what it did; an empty
 * `merged` means the map was already collision-free, which is the normal case.
 */
export function reconcileIdCollisions(
	callouts: Map<string, CalloutDefinition>,
	settings: PluginSettings,
	defaultFallbackId: string,
): IdCollisionMergeReport {
	// Group by identity, over ids AND aliases: a row whose *alias* is the other
	// row's id is the same collision wearing a different hat.
	const groups = new Map<string, Set<string>>();
	const addForm = (form: string, defId: string): void => {
		const identity = calloutIdentity(form);
		if (!identity) return;
		let set = groups.get(identity);
		if (!set) groups.set(identity, (set = new Set()));
		set.add(defId);
	};
	for (const def of callouts.values()) {
		addForm(def.id, def.id);
		for (const alias of def.aliases ?? []) addForm(alias, def.id);
	}

	const merged: string[] = [];
	for (const defIds of groups.values()) {
		if (defIds.size < 2) continue;
		const defs = Array.from(defIds)
			.map((id) => callouts.get(id))
			.filter((d): d is CalloutDefinition => d !== undefined);
		// An earlier group in this same pass may already have resolved (deleted)
		// one side of this collision.
		if (defs.length < 2) continue;

		const survivor =
			defs.find((d) => d.builtIn) ??
			defs.find((d) => !isDisposable(d) && !d.id.includes("-")) ??
			defs.find((d) => !isDisposable(d)) ??
			defs[0]!;

		for (const loser of defs) {
			if (loser.id === survivor.id || loser.builtIn) continue;
			callouts.delete(loser.id);
			merged.push(`${loser.id} → ${survivor.id}`);
			repoint(settings, loser.id, survivor.id, defaultFallbackId);
			// A disposable row carries nothing worth keeping and is not folded
			// in as an alias either: discovery owns that id again the moment a
			// note mentions it, and the survivor already answers to it through
			// `vaultIdFormsFor`.
			if (isDisposable(loser)) continue;
			fillGaps(survivor, loser);
			const aliases = new Set(survivor.aliases ?? []);
			aliases.add(loser.id);
			for (const a of loser.aliases ?? []) aliases.add(a);
			aliases.delete(survivor.id);
			survivor.aliases = Array.from(aliases);
		}
	}
	return { merged };
}

/**
 * Move everything in `settings` that names `oldId` by string onto `newId`.
 *
 * `defaultFallbackId` is only reached when the survivor is somehow unusable;
 * the fallback selection must never be left dangling. See the module doc.
 */
function repoint(
	settings: PluginSettings,
	oldId: string,
	newId: string,
	defaultFallbackId: string,
): void {
	if (settings.fallbackCalloutId === oldId) {
		settings.fallbackCalloutId = newId || defaultFallbackId;
	}
	for (const command of settings.customCommands) {
		if (command.calloutId === oldId) command.calloutId = newId;
	}
}
