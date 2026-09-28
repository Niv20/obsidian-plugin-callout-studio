/**
 * manager/settingsRecoveryService.ts — getting settings back without touching a
 * file by hand.
 *
 * Every recovery used to end in a hidden folder: copy a backup over
 * `data.json`, delete a conflict copy, restore from a provider's version
 * history. On a phone that folder is out of reach, and a file-level rollback
 * does not even stick: every running device merges its newer history straight
 * back over the old file. These actions go through the writer instead. A
 * restore is a new edit, stamped above everything it replaces, so every device
 * agrees on it: rows added since the old setup are deleted, rows deleted since
 * come back.
 */
import { Notice } from "obsidian";
import { t } from "../i18n";
import type { PluginData } from "../types";
import { CalloutRegistry } from "./CalloutRegistry";
import { isNewerSettingsFormat } from "./foreignFields";
import { registryIsOwned } from "./registryOwnership";
import { tryAdoptExternalSettings, type ExternalReloadHost } from "./settingsAdopt";
import {
	backupDeviceOf, listSettingsBackups, writeRawSettingsCopy, writeSettingsBackup,
} from "./settingsBackup";
import { inspectSettingsFile, type SettingsDiagnosis } from "./settingsDiagnosis";
import { settingsDataPath } from "./settingsFile";
import { hasSafeSettingsFileShape } from "./settingsFileShape";
import { differingEntries } from "./setupDifference";
import { retrySettingsRecovery } from "./settingsRecoveryActions";
import { canonical, content } from "./syncTree";

export type RecoverySourceKind = "history" | "backup" | "copy";

/** One earlier setup the recovery window can offer. */
export interface RecoverySource {
	kind: RecoverySourceKind;
	/** When it was saved; null for a copy that carries no time. */
	time: number | null;
	/** The file, for backups and copies. */
	path: string | null;
	/** Who saved it, as far as can be told. */
	origin: "this-device" | "other-device" | "older-version" | null;
	/** The settings it holds, normalized; null when it cannot be read as settings. */
	data: Partial<PluginData> | null;
}

export interface SetupDifference {
	/** Callout types the source holds. */
	callouts: number;
	/** Callout types and setting groups that differ from now. */
	changed: number;
}

export type RestoreOutcome = "restored" | "paused" | "invalid" | "stale" | "backup" | "failed";

/** A settings object as this build would save it, or null when it is not one. */
function normalized(data: unknown): Partial<PluginData> | null {
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	const body = content(data);
	if (isNewerSettingsFormat(body) || !hasSafeSettingsFileShape(body)) return null;
	try {
		const scratch = new CalloutRegistry();
		scratch.load(body);
		return scratch.toSaveData();
	} catch { return null; }
}

export class SettingsRecoveryService {
	constructor(private readonly host: ExternalReloadHost) {}

	/** Why the settings file cannot be used, for the paused-saving banner. */
	async diagnose(): Promise<SettingsDiagnosis> {
		return (await inspectSettingsFile(this.host)).diagnosis;
	}

	/** Device history, then backups, then stray copies of the settings file, each newest first. */
	async listSources(): Promise<RecoverySource[]> {
		const sources: RecoverySource[] = [];
		try {
			for (const entry of await this.host.settingsWriter.historyEntries()) {
				sources.push({ kind: "history", time: entry.savedAt, path: null, origin: "this-device", data: normalized(entry.data) });
			}
		} catch (error) { console.warn("[callout-studio] settings history could not be read", error); }
		const { adapter } = this.host.app.vault;
		const read = async (path: string) => {
			try { return normalized(JSON.parse(await adapter.read(path))); } catch { return null; }
		};
		try {
			const device = backupDeviceOf(this.host);
			for (const entry of await listSettingsBackups(this.host)) {
				const origin = entry.device === null ? "older-version" : entry.device === device ? "this-device" : "other-device";
				sources.push({ kind: "backup", time: entry.time, path: entry.path, origin, data: await read(entry.path) });
			}
		} catch (error) { console.warn("[callout-studio] settings backups could not be listed", error); }
		try {
			const primary = settingsDataPath(this.host);
			const dir = primary.slice(0, primary.lastIndexOf("/"));
			for (const path of (await adapter.list(dir)).files.sort()) {
				// Any sync service's copy: `data 2.json`, `data (conflicted copy …).json`, …
				if (path === primary || !/^data\b.*\.json$/i.test(path.slice(dir.length + 1))) continue;
				sources.push({ kind: "copy", time: null, path, origin: null, data: await read(path) });
			}
		} catch (error) { console.warn("[callout-studio] settings copies could not be listed", error); }
		return sources;
	}

	/** How `data` differs from what is displayed now. */
	difference(data: Partial<PluginData>): SetupDifference {
		return { callouts: data.callouts?.length ?? 0, changed: differingEntries(this.host.registry.toSaveData(), data).size };
	}

	/** A Callout Studio backup of `data`, as Export writes one. */
	exportJson(data: Partial<PluginData>): string {
		const scratch = new CalloutRegistry();
		scratch.load(structuredClone(data));
		return scratch.exportToJSONv2();
	}

	/**
	 * Make `data` the current setup, after saving a verified backup of this one.
	 * Only while saving works: a paused session has its own recovery actions.
	 */
	async restore(data: Partial<PluginData>): Promise<RestoreOutcome> {
		const { host } = this, writer = host.settingsWriter;
		if (writer.isFrozen || writer.isDestroyed) return "paused";
		const candidate = normalized(data);
		if (!candidate) return "invalid";
		// Decide against the newest file this device can see, not a stale view of it.
		if (await tryAdoptExternalSettings(host, { force: true }) !== "applied") return "stale";
		if (writer.isFrozen) return "paused";
		const before = host.registry.toSaveData();
		const snapshot = canonical(before);
		const isCurrent = () => !host.settingsEditOpen && !host.registry.hasPreviewDefinition() &&
			canonical(host.registry.toSaveData()) === snapshot;
		if (!await writeSettingsBackup(host, before)) return "backup";
		if (!isCurrent()) return "stale";
		let published = false;
		try {
			const saved = await writer.commit(candidate, isCurrent, () => {
				host.registry.load(structuredClone(candidate));
				published = true;
			});
			if (!saved || !published) return "failed";
		} catch (error) {
			console.error("[callout-studio] could not restore an earlier setup", error);
			return published ? "restored" : "failed";
		}
		this.refresh();
		return "restored";
	}

	/**
	 * Called only after the user confirms. Replace a settings file that cannot
	 * be read with what is displayed. When a sync service only broke the
	 * metadata around valid settings, those settings are merged in first, so
	 * the replacement loses nothing the file held.
	 */
	async replaceUnreadable(): Promise<boolean> {
		const { host } = this, writer = host.settingsWriter;
		if (writer.status.frozenReason !== "unreadable" || registryIsOwned(host)) return false;
		const first = await inspectSettingsFile(host), second = await inspectSettingsFile(host);
		if (first.diagnosis === "readable" && second.diagnosis === "readable") return retrySettingsRecovery(host);
		const raw = first.raw;
		// Only bytes that hold still, and never a later build's file.
		if (raw === null || raw !== second.raw || first.diagnosis === "newer") {
			new Notice(t("notice.replaceUnreadableUnavailable"), 10000);
			return false;
		}
		if (first.salvage) {
			const merged = writer.mergeExternal(first.salvage, host.registry.toSaveData()) as Partial<PluginData>;
			host.registry.load(merged);
			this.refresh();
		}
		const snapshot = canonical(host.registry.toSaveData());
		const isCurrent = () => !writer.isDestroyed && !host.settingsEditOpen && !host.registry.hasPreviewDefinition() &&
			canonical(host.registry.toSaveData()) === snapshot;
		const unchanged = async () => {
			try { return await host.app.vault.adapter.read(settingsDataPath(host)) === raw; } catch { return false; }
		};
		try {
			const replaced = await writer.replaceUnreadable(isCurrent, async () => {
				if (await writeRawSettingsCopy(host, "unreadable", raw)) return isCurrent();
				writer.status.fail("backup");
				return false;
			}, unchanged);
			if (!replaced || writer.isDestroyed) return false;
			await host.saveSettings();
			return !writer.isDestroyed && !writer.isFrozen &&
				writer.matchesLastWrite(JSON.stringify(host.registry.toSaveData()), true);
		} catch (error) {
			console.error("[callout-studio] could not replace the unreadable settings file", error);
			return false;
		}
	}

	/**
	 * Called only after the user confirms. This device's recovery copy cannot
	 * be read, which pauses saving here until it can. Keep an exact copy of it
	 * in the backups folder, replace it with what is displayed, then recover as
	 * usual. The settings file itself is not touched.
	 */
	async discardRecoveryCopy(): Promise<boolean> {
		const { host } = this, writer = host.settingsWriter;
		if (writer.status.frozenReason !== "recovery-read" || registryIsOwned(host)) return false;
		let stored: unknown;
		try { stored = await writer.recoveryCopyRaw(); } catch (error) {
			console.error("[callout-studio] the device recovery copy could not be read", error);
			new Notice(t("notice.recoveryStorageUnavailable"), 10000);
			return false;
		}
		if (stored === undefined) return false;
		if (isNewerSettingsFormat(stored)) { writer.freeze("newer-version"); return false; }
		// Readable again: nothing to discard.
		if (stored === null || (typeof stored === "object" && !Array.isArray(stored) &&
			hasSafeSettingsFileShape(stored as Record<string, unknown>))) return retrySettingsRecovery(host);
		if (!await writeRawSettingsCopy(host, "recovery-copy", JSON.stringify(stored, undefined, 2) ?? "null")) {
			writer.status.fail("backup");
			return false;
		}
		try { await writer.remember(writer.stamped(host.registry.toSaveData())); } catch { return false; }
		// The checkpoint is readable now, but the primary may still need its
		// own repair. Keep saving paused while the retry classifies that file.
		if (writer.status.frozenReason === "recovery-read") writer.freeze("unreadable");
		return retrySettingsRecovery(host);
	}

	/**
	 * A summary for a bug report: states and counts, never setup content. Plain
	 * English on purpose; it is read by whoever answers the report.
	 */
	async diagnostics(platform: string): Promise<string> {
		const { host } = this, writer = host.settingsWriter, status = writer.status;
		const file = await inspectSettingsFile(host);
		let envelope = "none", stamps = 0;
		try {
			const meta = (JSON.parse(file.raw ?? "null") as Record<string, unknown> | null)?.calloutStudioSync as
				{ version?: unknown; stamps?: object } | undefined;
			if (meta) { envelope = String(meta.version); stamps = Object.keys(meta.stamps ?? {}).length; }
		} catch { /* Diagnosed above. */ }
		let recovery: string;
		try {
			const copy = await writer.recoveryCopyRaw();
			recovery = copy === undefined ? "not kept on this host" : copy === null ? "none" :
				isNewerSettingsFormat(copy) ? "from a newer version" :
				typeof copy === "object" && !Array.isArray(copy) && hasSafeSettingsFileShape(copy as Record<string, unknown>) ? "readable" : "invalid";
		} catch { recovery = "storage not responding"; }
		const sources = await this.listSources();
		const count = (predicate: (source: RecoverySource) => boolean) => sources.filter(predicate).length;
		return [
			"Callout Studio sync diagnostics",
			`Version: ${host.manifest.version} (${platform})`,
			`Saving: ${writer.isFrozen ? `paused (${status.frozenReason ?? "unknown"})` : status.failure ? `failing (${status.failure})` : "working"}`,
			`Settings file: ${file.diagnosis}, ${file.raw?.length ?? 0} characters, envelope ${envelope}, ${stamps} stamps`,
			`Recovery copy: ${recovery}`,
			`Device: ${host.localState.deviceId}`,
			`History on this device: ${count(source => source.kind === "history")} states`,
			`Backups: ${count(source => source.origin === "this-device" && source.kind === "backup")} from this device, ` +
				`${count(source => source.origin === "other-device")} from other devices, ${count(source => source.origin === "older-version")} from older versions`,
			`Other copies of the settings file: ${count(source => source.kind === "copy")}`,
		].join("\n");
	}

	private refresh(): void {
		const { host } = this;
		host.refreshThemeAppearance();
		host.customCommands.syncAll();
		host.refreshCallouts();
		if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
	}
}
