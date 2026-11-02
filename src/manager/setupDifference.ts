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
	return differencesFrom(a)(b);
}

/**
 * {@link differingEntries} of many setups against the same `a`, which is read
 * once: comparing every version with what is shown now otherwise reads "now"
 * again for each one, and that was most of the work.
 */
export function differencesFrom(a: Partial<PluginData>): (b: Partial<PluginData>) => Set<string> {
	const mine = rows(a),
		x = groups(a);
	return (b) => {
		const found = new Set<string>();
		const theirs = rows(b);
		for (const id of new Set([...mine.keys(), ...theirs.keys()]))
			if (mine.get(id) !== theirs.get(id)) found.add(`row:${id}`);
		const y = groups(b);
		for (const key of new Set([...x.keys(), ...y.keys()]))
			if (x.get(key) !== y.get(key)) found.add(`settings:${key}`);
		return found;
	};
}

/** Each callout type as text, by id. */
function rows(d: Partial<PluginData>): Map<string, string> {
	return new Map((d.callouts ?? []).map((row) => [row.id, canonical(row)]));
}

/** Each group of settings as text, by name; a group that is absent and one that is `undefined` read the same. */
function groups(d: Partial<PluginData>): Map<string, string> {
	const settings = (withoutIncidental({ settings: d.settings ?? {} }).settings ?? {}) as Record<string, unknown>;
	return new Map(Object.entries(settings).map(([key, value]) => [key, canonical(value)]));
}

/**
 * Changes made on this device and not yet saved (`before` differs from what
 * was last `saved`) that an adoption replaced (`merged` differs from `before`).
 */
export function unsavedChangesReplaced(
	saved: Partial<PluginData>,
	before: Partial<PluginData>,
	merged: Partial<PluginData>,
): number {
	const replaced = differingEntries(before, merged);
	return [...differingEntries(saved, before)].filter((entry) => replaced.has(entry)).length;
}
