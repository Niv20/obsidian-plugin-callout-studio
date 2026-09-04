/**
 * manager/settingsFile.ts — reading `data.json`, and telling apart the two ways
 * that can come back empty-handed.
 *
 * `Plugin.loadData()` answers with a nullish value for two situations that could
 * not be more different:
 *
 * - **There is no file.** A brand-new install. Starting from the shipped
 *   defaults is exactly right.
 * - **There is a file and we could not read it.** A half-synced copy, a
 *   truncated write, a lock held by another process, a byte of corruption.
 *   Starting from the shipped defaults here means the registry now describes
 *   none of the user's callouts — and the very next save serializes that over
 *   the file, destroying settings that were merely *unavailable* a moment ago.
 *
 * The second case is not hypothetical: it is the second half of issue #41. On a
 * Syncthing vault the reporter's plugin folder filled with alternating conflict
 * copies, one device's every copy exactly **0 bytes**. `JSON.parse("")` throws,
 * Obsidian returns nullish, `CalloutRegistry.load` treats that as "no saved
 * data" and clears the map, and the reload path then writes the emptied registry
 * back out — which is how a sync conflict escalated into data loss.
 *
 * Obsidian does distinguish the two internally (`Vault.readJson` returns `null`
 * only for `ENOENT` and `undefined` for every other read or parse failure), but
 * that is private behaviour of a minified bundle, not an API promise. So this
 * module asks the question that *is* stable — does the file exist? — of the
 * adapter, and takes the disagreement between the two answers as the signal.
 */
import { normalizePath } from "obsidian";
import type { App, PluginManifest } from "obsidian";
import type { PluginData } from "../types";

/** What `data.json` turned out to be. */
export type SettingsRead =
	/** No file. A genuine fresh install. */
	| { kind: "absent" }
	/**
	 * A file we understood.
	 *
	 * `json` is the re-serialized form of exactly what was read, ready to seed
	 * the write guard's baseline — see `utils/saveGuard.ts` for why it is the
	 * parsed object round-tripped rather than the raw file text, and for the
	 * canonicalization it applies on top.
	 */
	| { kind: "loaded"; data: Partial<PluginData>; json: string }
	/** A file that is there but is not usable settings. Change nothing. */
	| { kind: "unreadable" };

/** What the read needs from the plugin. */
export interface SettingsFileHost {
	app: App;
	manifest: PluginManifest;
	/** Obsidian's `Plugin.loadData`. */
	loadData(): Promise<unknown>;
}

/**
 * Where `data.json` lives. `manifest.dir` is typed optional, hence the
 * reconstruction fallback — the same one `PackDataStore` and `LocaleStore` use.
 */
function dataPath(host: SettingsFileHost): string {
	const base =
		host.manifest.dir ??
		`${host.app.vault.configDir}/plugins/${host.manifest.id}`;
	return normalizePath(`${base}/data.json`);
}

/**
 * Read and classify `data.json`.
 *
 * The order matters. Content is asked for **first**, because that is the answer
 * we actually want and a successful read settles the question by itself.
 * Existence is asked only when the content came back unusable, and it is what
 * separates "nothing to read" from "something we could not read".
 */
export async function readSettingsFile(
	host: SettingsFileHost,
): Promise<SettingsRead> {
	const raw = await host.loadData();
	// Arrays and primitives parse fine and are not settings. They also prove the
	// file exists, so they fall through to the same verdict the check below
	// reaches — but they must not be handed on as `Partial<PluginData>`.
	if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
		return {
			kind: "loaded",
			data: raw,
			json: JSON.stringify(raw),
		};
	}

	try {
		const present = await host.app.vault.adapter.exists(dataPath(host));
		return { kind: present ? "unreadable" : "absent" };
	} catch {
		// The adapter itself is not answering. Assume the worse of the two: a
		// wrong "absent" overwrites the user's settings, a wrong "unreadable"
		// costs one session of not writing them.
		return { kind: "unreadable" };
	}
}
