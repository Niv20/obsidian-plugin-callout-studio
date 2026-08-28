/**
 * manager/discoveryIndexBoot.ts — putting the discovered rows back at startup.
 *
 * `data.json` no longer describes a discovered row nobody has claimed (see
 * `discoveredRowPersistence.ts`), so something has to put those rows back when
 * Obsidian opens, and it must not be a whole-vault scan: re-reading every note
 * on every launch is exactly the cost the incremental discovery design exists
 * to avoid. `DeviceLocalStore` keeps the ids; this is the pass that spends them.
 *
 * It also owns the one-way migration. A vault upgrading into this version still
 * has those rows written in its settings file; `CalloutRegistry.load` reads them
 * back as ordinary rows, so they are already in the registry by the time this
 * runs. Adopting their ids into the index and asking for a single flush is what
 * makes the file converge — and nothing disappears from the settings list on
 * the way, which is the difference between a migration and a data loss.
 *
 * The last step re-writes the index from what the registry actually holds
 * afterwards, which keeps it honest in both directions: an id whose row was
 * refused because an explicit configuration now owns it drops out, and a device
 * that has never had an index gets one — so the recovery scan below is offered
 * once, not on every launch of a vault that genuinely uses no custom callouts.
 */
import type { CalloutDefinition, PluginData, PluginSettings } from "../types";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { isEphemeralDiscoveredRow } from "./discoveredRowPersistence";
import { restoreDiscoveredRows } from "./discoveredRow";

/** The registry surface this pass drives. */
interface BootTarget {
	settings: PluginSettings;
	get(id: string): CalloutDefinition | undefined;
	getAll(): CalloutDefinition[];
	add(def: CalloutDefinition): boolean;
	batch<T>(body: () => T): T;
}

export interface DiscoveryIndexBoot {
	/** How many rows the index put back. */
	restored: number;
	/**
	 * The saved file still listed unclaimed discovered rows. One write-back
	 * drops them; the ids live in the index now.
	 */
	converged: boolean;
}

/**
 * Rebuild this session's discovered rows, fold in anything the saved file still
 * carried, and leave the index describing the result.
 *
 * Call immediately after `registry.load()`, before the first CSS inject — the
 * restored rows have to be in the sheet from the start, exactly as theme rows
 * are.
 */
export function bootDiscoveryIndex(
	registry: BootTarget,
	store: DeviceLocalStore,
	saved: Partial<PluginData> | null,
): DiscoveryIndexBoot {
	const commands = registry.settings.customCommands;
	// Read before the rewrite below replaces it.
	const remembered = [...store.discovered];

	// The flag used to sync. Carry a pre-move file's value over once, from the
	// RAW saved settings rather than the merged ones — the merge no longer
	// knows the field, which is exactly what retires it from `data.json`.
	const legacySettings = saved?.settings as
		| { firstRunCompleted?: boolean; retiredThemeIds?: unknown }
		| undefined;
	store.adoptLegacyFirstRun(legacySettings?.firstRunCompleted);
	store.adoptLegacyRetiredThemeIds(legacySettings?.retiredThemeIds);

	// Rows the saved file still described. Asked of the registry rather than of
	// `saved.callouts` so the answer is about the rows as `load()` reconciled
	// them — a saved row that turned out to be a built-in, or was demoted, is
	// not a discovered row whatever the file called it.
	const legacy = registry
		.getAll()
		.filter((def) => isEphemeralDiscoveredRow(def, commands))
		.map((def) => def.id);

	const restored = restoreDiscoveredRows(
		registry,
		remembered,
		store.retiredThemeIds,
	);

	// What the index should say now: every unclaimed discovered row the
	// registry holds, from either source. Written even when empty, which is
	// what marks this device as indexed.
	syncIndexFromRegistry(registry, store);

	return { restored, converged: legacy.length > 0 };
}

/**
 * Re-derive the index from the rows the registry actually holds.
 *
 * The authoritative direction, used wherever the whole picture just changed —
 * startup, and a user-requested vault scan. Incremental discovery adds and the
 * prune forgets one id at a time; this is the pass that also drops an id whose
 * row is gone for a reason neither of those saw, such as an explicit
 * configuration arriving from another device and taking the name.
 */
export function syncIndexFromRegistry(
	registry: Pick<BootTarget, "getAll" | "settings">,
	store: DeviceLocalStore,
): void {
	const commands = registry.settings.customCommands;
	store.replace(
		registry
			.getAll()
			.filter((def) => isEphemeralDiscoveredRow(def, commands))
			.map((def) => def.id),
	);
}
