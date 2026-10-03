/**
 * settings/resetInventory.ts — What "Reset everything" would actually change.
 *
 * The confirmation used to describe the reset in general terms, the same words
 * whether it was about to delete forty callouts or nothing at all. This reads
 * the registry and answers for this vault: how many of each thing goes, and
 * which setting groups differ from their defaults. A row that would change
 * nothing is left out, and an empty inventory means there is nothing to reset.
 *
 * It mirrors `CalloutRegistry.resetAll()` — a group added there belongs here.
 *
 * Only the registry is read, so it cannot say how many notes use the custom
 * callouts that go; that takes a vault scan, and the caller adds the row itself
 * (`settings.resetItemReferences`) to `deleted`.
 */
import { DEFAULT_SETTINGS } from "../constants";
import type { CalloutRegistry } from "../manager/CalloutRegistry";

export interface ResetInventoryRow {
	/** i18n key of the row's sentence; `{{count}}` is filled in. */
	labelKey: string;
	/** How many go; absent for a setting group, which is one thing. */
	count?: number;
}

export interface ResetInventory {
	/** What the reset removes outright. */
	deleted: ResetInventoryRow[];
	/** What it puts back to the shipped defaults. */
	restored: ResetInventoryRow[];
}

export function resetInventory(registry: CalloutRegistry): ResetInventory {
	const { settings } = registry;
	const counted = (rows: [string, number][]): ResetInventoryRow[] =>
		rows.filter(([, count]) => count > 0).map(([labelKey, count]) => ({ labelKey, count }));
	const changed = (rows: [string, unknown, unknown][]): ResetInventoryRow[] =>
		rows.filter(([, current, original]) => !sameValue(current, original)).map(([labelKey]) => ({ labelKey }));

	return {
		deleted: counted([
			["settings.resetItemCallouts", registry.getUserDefined().length],
			["settings.resetItemImages", settings.userImages.length],
			["settings.resetItemCommands", settings.customCommands.length],
			["settings.resetItemPalettes", settings.customPalettes.length],
		]),
		restored: [
			...counted([
				["settings.resetItemBuiltIns", registry.getExportableDefinitions().filter((d) => d.builtIn).length],
			]),
			...changed([
				["settings.resetItemGlobalStyle", settings.globalStyle, DEFAULT_SETTINGS.globalStyle],
				["settings.resetItemContextMenu", settings.contextMenu, DEFAULT_SETTINGS.contextMenu],
				["settings.resetItemHeading", settings.headingCallouts, DEFAULT_SETTINGS.headingCallouts],
				["settings.resetItemInline", settings.inlineCallouts, DEFAULT_SETTINGS.inlineCallouts],
				["settings.resetItemFallback", settings.fallbackCalloutId, DEFAULT_SETTINGS.fallbackCalloutId],
				["settings.resetItemIconLibraries", settings.iconLibraries, DEFAULT_SETTINGS.iconLibraries],
			]),
		],
	};
}

export function isResetInventoryEmpty(inventory: ResetInventory): boolean {
	return inventory.deleted.length === 0 && inventory.restored.length === 0;
}

/**
 * Structural equality for plain settings values. Key order is ignored and a
 * key holding `undefined` counts as absent: a settings group that was loaded,
 * merged and saved again is the same group as the literal in `constants.ts`.
 */
function sameValue(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		return Array.isArray(a) && Array.isArray(b) && a.length === b.length
			&& a.every((item, index) => sameValue(item, b[index]));
	}
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
	for (const key of keys) {
		if (!sameValue(left[key], right[key])) return false;
	}
	return true;
}
