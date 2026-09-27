/**
 * manager/settingsDiagnosis.ts — why the settings file cannot be used, in words
 * a user can act on.
 *
 * "Unreadable" covers causes with different fixes. A file still downloading
 * needs patience. A 0-byte file from an interrupted sync, Git conflict markers,
 * a file a sync service combined from two versions, or a hand edit that listed
 * a type twice needs replacing. The generic message could only say "finish
 * synchronization or restore a valid copy", which sent people into a hidden
 * folder. This reads the raw bytes, never through `loadData` (which hides the
 * difference), and names the cause. It changes nothing.
 */
import { PRIMARY_IO_TIMEOUT_MS, settingsDataPath, type SettingsFileHost } from "./settingsFile";
import { withTimeout } from "../utils/withTimeout";
import { hasSafeSettingsFileShape } from "./settingsFileShape";
import { isNewerSettingsFormat } from "./foreignFields";
import { content, SYNC_KEY } from "./syncTree";

export type SettingsDiagnosis =
	/** The read failed: not downloaded, offline, or no access. */
	| "unavailable"
	/** Nothing but whitespace: usually an interrupted sync. */
	| "empty"
	/** Unresolved `<<<<<<<` / `>>>>>>>` lines, as Git leaves them. */
	| "merge-markers"
	/** Not JSON, or JSON that is not a settings object. */
	| "damaged"
	/** Valid settings inside sync metadata that no longer matches them. */
	| "combined"
	/** Readable JSON with rows this build cannot use, e.g. one id twice. */
	| "invalid-entries"
	/** Written by a later build of the plugin. */
	| "newer"
	/** Nothing wrong any more. */
	| "readable";

export interface SettingsFileInspection {
	diagnosis: SettingsDiagnosis;
	/** The bytes read, for an exact copy and an "unchanged?" check; null when the read failed. */
	raw: string | null;
	/** The settings inside, when the only fault is the sync metadata around them. */
	salvage: Record<string, unknown> | null;
}

export async function inspectSettingsFile(host: Pick<SettingsFileHost, "app" | "manifest">): Promise<SettingsFileInspection> {
	let raw: string;
	try {
		raw = await withTimeout(host.app.vault.adapter.read(settingsDataPath(host)), PRIMARY_IO_TIMEOUT_MS,
			() => new Error("Settings read timed out"));
	} catch { return { diagnosis: "unavailable", raw: null, salvage: null }; }
	const found = (diagnosis: SettingsDiagnosis, salvage: Record<string, unknown> | null = null): SettingsFileInspection =>
		({ diagnosis, raw, salvage });
	if (!raw.trim()) return found("empty");
	if (/^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(raw)) return found("merge-markers");
	let data: unknown;
	try { data = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { return found("damaged"); }
	if (!data || typeof data !== "object" || Array.isArray(data)) return found("damaged");
	const file = data as Record<string, unknown>;
	if (isNewerSettingsFormat(file)) return found("newer");
	if (hasSafeSettingsFileShape(file)) return found("readable");
	const body = content(file);
	if (SYNC_KEY in file && hasSafeSettingsFileShape(body)) return found("combined", body);
	return found("invalid-entries");
}
