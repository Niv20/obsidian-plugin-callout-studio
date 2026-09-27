/**
 * manager/settingsGenesis.ts — the settings a device holds before anyone has
 * changed anything, and whether a payload still is just that.
 *
 * A device that has not yet received the synced `data.json` looks exactly like
 * a new installation. Writing its shipped defaults as a settings file is how a
 * new phone could reset every device's settings: nothing on it was a choice,
 * yet it arrived as the newest file. Two rules follow, and both need the same
 * snapshot of the defaults:
 *
 * - `SettingsSync` diffs a first file against it, so only real edits are
 *   stamped and untouched defaults can never outrank anyone's settings.
 * - `SettingsWriter` refuses to create a file that says nothing but the
 *   defaults. Onboarding flags, picker memory and derived artwork change on
 *   their own; they are not a reason to publish one.
 */
import { CalloutRegistry } from "./CalloutRegistry";
import { canonical, content } from "./syncTree";

/** Paths that change without anyone editing a setting. */
const INCIDENTAL: readonly (readonly string[])[] = [
	["settings", "welcomeSeen"],
	["settings", "competitorImportBannerHandled"],
	["settings", "iconSources", "lastCategory"],
	["settings", "iconSources", "lastEmojiSkinTone"],
	["settings", "quickInsertSource"],
	["iconSvgCache"],
];

let snapshot: unknown;

/** `toSaveData()` of a registry that has loaded nothing. Built once per build. */
export function settingsGenesis(): unknown {
	if (snapshot === undefined) {
		const registry = new CalloutRegistry();
		registry.load(null);
		snapshot = registry.toSaveData();
	}
	return structuredClone(snapshot);
}

/** `data` without the paths that change on their own; see {@link INCIDENTAL}. */
export function withoutIncidental(data: unknown): Record<string, unknown> {
	const copy = content(data);
	for (const path of INCIDENTAL) {
		let parent: unknown = copy;
		for (const name of path.slice(0, -1)) {
			parent = parent !== null && typeof parent === "object" ? (parent as Record<string, unknown>)[name] : undefined;
		}
		if (parent !== null && typeof parent === "object") delete (parent as Record<string, unknown>)[path[path.length - 1]!];
	}
	return copy;
}

/** Whether `data` carries no choice beyond the shipped defaults. */
export function isUntouchedSettings(data: unknown, genesis: unknown = settingsGenesis()): boolean {
	return canonical(withoutIncidental(data)) === canonical(withoutIncidental(genesis));
}
