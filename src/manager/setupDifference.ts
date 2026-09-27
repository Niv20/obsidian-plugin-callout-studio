/**
 * manager/setupDifference.ts — which parts of two setups differ, at the level a
 * person thinks in: callout types by id, and groups of settings.
 *
 * Picker memory and onboarding flags are not counted (see `withoutIncidental`):
 * nobody would call a changed icon-picker category a difference in their setup.
 */
import type { PluginData } from "../types";
import { withoutIncidental } from "./settingsGenesis";
import { canonical } from "./syncTree";

/** `row:<id>` for each differing callout type, `settings:<group>` for each differing group. */
export function differingEntries(a: Partial<PluginData>, b: Partial<PluginData>): Set<string> {
	const found = new Set<string>();
	const rows = (d: Partial<PluginData>) => new Map((d.callouts ?? []).map(row => [row.id, canonical(row)]));
	const mine = rows(a), theirs = rows(b);
	for (const id of new Set([...mine.keys(), ...theirs.keys()])) if (mine.get(id) !== theirs.get(id)) found.add(`row:${id}`);
	const groups = (d: Partial<PluginData>) => (withoutIncidental({ settings: d.settings ?? {} }).settings ?? {}) as Record<string, unknown>;
	const x = groups(a), y = groups(b);
	for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) if (canonical(x[key]) !== canonical(y[key])) found.add(`settings:${key}`);
	return found;
}

/**
 * Changes made on this device and not yet saved (`before` differs from what
 * was last `saved`) that an adoption replaced (`merged` differs from `before`).
 */
export function unsavedChangesReplaced(saved: Partial<PluginData>, before: Partial<PluginData>, merged: Partial<PluginData>): number {
	const replaced = differingEntries(before, merged);
	return [...differingEntries(saved, before)].filter(entry => replaced.has(entry)).length;
}
