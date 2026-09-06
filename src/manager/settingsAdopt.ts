import { readSettingsConflictFiles } from "./settingsConflictFiles";
import { canonical, content } from "./syncTree";
import type { PluginData } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { readSettingsFile } from "./settingsFile";
import { readSettledSettingsFile } from "./settingsSettledRead";
import { isFromNewerBuild } from "./foreignFields";
import { warnSettingsFromNewerVersion } from "./settingsNotices";
import { registryIsOwned } from "./registryOwnership";
import { backUpBeforeAdoption } from "./settingsConflictBackup";
import { stableKeyOrder } from "../utils/stableJson";
import type { SettingsFileHost, SettingsRead } from "./settingsFile";

export interface SettingsBootHost extends SettingsFileHost {
	registry: CalloutRegistry;
	localState: DeviceLocalStore;
	settingsWriter: SettingsWriter;
	saveSettings(): Promise<void>;
}

export async function applySettingsRead(
	host: SettingsBootHost,
	read: Extract<SettingsRead, { kind: "absent" | "loaded" }>,
	diskJson?: string,
): Promise<void> {
	if (host.settingsWriter.isDestroyed) return;
	const savedData: Partial<PluginData> | null =
		read.kind === "loaded" ? read.data : null;

	if (isFromNewerBuild(savedData)) {
		host.settingsWriter.freeze();
		console.error(
			"[callout-studio] data.json was written by a newer version; " +
				"settings will not be written this session",
		);
		warnSettingsFromNewerVersion();
	}

	await host.settingsWriter.hold(async () => {
		if (savedData && !host.settingsWriter.isFrozen && host.settingsWriter.hasCheckpoint) await host.settingsWriter.remember(savedData);
		if (host.settingsWriter.isDestroyed) return;
		try {
			host.registry.load(savedData);
		} catch (error) {
			// A failed rebuild must neither authorize writes of partial state nor
			// make a retry look like an echo of an already adopted file.
			host.settingsWriter.freeze();
			throw error;
		}
		if (read.kind === "loaded") host.settingsWriter.adopt(read.json, diskJson);
		if (savedData) host.localState.markInitialized();

		if (host.registry.needsSaveAfterLoad() || (read.kind === "loaded" && diskJson !== undefined && diskJson !== read.json)) {
			await host.saveSettings();
		}
	});
}

export interface ExternalReloadHost extends SettingsBootHost {

	settingsEditOpen: boolean;
	onExternalSettingsChange?(): Promise<void>;

	refreshThemeAppearance(): void;
	customCommands: { syncAll(): void };
	refreshCallouts(): void;
	settingsTab?: { containerEl: { isConnected: boolean }; display(): void };

	registerDomEvent?: (
		el: Document,
		type: "visibilitychange",
		callback: () => void,
	) => void;
}

export async function adoptExternalSettings(
	host: ExternalReloadHost,
): Promise<boolean> {
	return (await tryAdoptExternalSettings(host)) !== "applied";
}

export type ExternalAdoptionResult = "applied" | "deferred" | "unavailable";

/** Distinguish a transient sync read from a held editor or failed backup. */
export async function tryAdoptExternalSettings(
	host: ExternalReloadHost,
): Promise<ExternalAdoptionResult> {
	if (registryIsOwned(host)) return "deferred";

	const first = await readSettingsFile(host);
	if (registryIsOwned(host)) return "deferred";
	if (first.kind !== "loaded") return "unavailable";
	const conflicts = host.settingsWriter.mergesConcurrent ? await readSettingsConflictFiles(host) : [];
	if (registryIsOwned(host)) return "deferred";
	// An unchanged primary file can still have a newly delivered conflict copy.
	if (!host.settingsWriter.isFrozen && host.settingsWriter.matchesLastWrite(first.json) && conflicts.length === 0) return "applied";
	const read = await readSettledSettingsFile(host, {
		initial: first, isCancelled: () => host.settingsWriter.isDestroyed,
	});
	if (registryIsOwned(host)) return "deferred";

	if (read.kind !== "loaded") {
		console.warn(
			`[callout-studio] ignoring an external data.json change: ${read.kind}`,
		);
		return "unavailable";
	}

	if (!host.settingsWriter.isFrozen && host.settingsWriter.matchesLastWrite(read.json) && conflicts.length === 0) return "applied";

	return (await reloadFrom(host, read, conflicts)) ? "applied" : "deferred";
}

export async function reloadFrom(
	host: ExternalReloadHost,
	read: Extract<SettingsRead, { kind: "loaded" }>,
	conflicts: Partial<PluginData>[] = [],
): Promise<boolean> {
	if (registryIsOwned(host)) return false;
	let durable: unknown = null;
	if (host.settingsWriter.hasCheckpoint && !isFromNewerBuild(read.data)) {
		try { durable = await host.settingsWriter.recoveryCopy(); } catch (error) {
			host.settingsWriter.freeze();
			throw error;
		}
	}
	if (registryIsOwned(host)) return false;
	const before = host.registry.toSaveData();
	const snapshot = JSON.stringify(stableKeyOrder(before));
	const merged = isFromNewerBuild(read.data) ? read.data :
		host.settingsWriter.mergeExternal(read.data, before, durable ? [durable, ...conflicts] : conflicts) as Partial<PluginData>;
	if (!host.settingsWriter.isFrozen && host.settingsWriter.matchesLastWrite(read.json) &&
		host.settingsWriter.matchesLastWrite(JSON.stringify(merged)) && canonical(content(before)) === canonical(content(merged))) return true;
	if (!(await backUpBeforeAdoption(host, before, merged))) return false;
	if (durable && canonical(content(durable)) !== canonical(content(before)) &&
		!await backUpBeforeAdoption(host, durable as Partial<PluginData>, merged)) return false;
	for (const conflict of conflicts) {
		if (!await backUpBeforeAdoption(host, conflict, merged)) return false;
	}
	if (JSON.stringify(stableKeyOrder(read.data)) !== JSON.stringify(stableKeyOrder(merged)) &&
		!(await backUpBeforeAdoption(host, read.data, merged))) return false;
	// User edits made while the backup was being written must not disappear.
	if (registryIsOwned(host) || JSON.stringify(stableKeyOrder(host.registry.toSaveData())) !== snapshot) return false;
	host.settingsWriter.thaw();
	await host.settingsWriter.hold(async () => {
		await applySettingsRead(host, { kind: "loaded", data: merged, json: JSON.stringify(merged) }, read.json);
		if (host.settingsWriter.isDestroyed) return;
		host.refreshThemeAppearance();

		host.customCommands.syncAll();
	});
	if (host.settingsWriter.isDestroyed) return false;

	host.refreshCallouts();
	if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
	return true;
}
