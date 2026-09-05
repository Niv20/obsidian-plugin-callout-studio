import type { PluginData } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { readSettingsFile } from "./settingsFile";
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
): Promise<void> {
	if (host.settingsWriter.isDestroyed) return;
	const savedData: Partial<PluginData> | null =
		read.kind === "loaded" ? read.data : null;

	if (read.kind === "loaded") host.settingsWriter.adopt(read.json);

	if (isFromNewerBuild(savedData)) {
		host.settingsWriter.freeze();
		console.error(
			"[callout-studio] data.json was written by a newer version; " +
				"settings will not be written this session",
		);
		warnSettingsFromNewerVersion();
	}

	await host.settingsWriter.hold(async () => {
		host.registry.load(savedData);
		if (savedData) host.localState.markInitialized();

		if (host.registry.needsSaveAfterLoad()) {
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
	if (registryIsOwned(host)) return true;

	const read = await readSettingsFile(host);
	if (registryIsOwned(host)) return true;

	if (read.kind !== "loaded") {
		console.warn(
			`[callout-studio] ignoring an external data.json change: ${read.kind}`,
		);
		return true;
	}

	if (host.settingsWriter.matchesLastWrite(read.json)) return false;

	return !(await reloadFrom(host, read));
}

export async function reloadFrom(
	host: ExternalReloadHost,
	read: Extract<SettingsRead, { kind: "loaded" }>,
): Promise<boolean> {
	if (registryIsOwned(host)) return false;
	const before = host.registry.toSaveData();
	const snapshot = JSON.stringify(stableKeyOrder(before));
	if (!(await backUpBeforeAdoption(host, before, read.data))) return false;
	// User edits made while the backup was being written must not disappear.
	if (registryIsOwned(host) || JSON.stringify(stableKeyOrder(host.registry.toSaveData())) !== snapshot) return false;
	host.settingsWriter.thaw();
	await host.settingsWriter.hold(async () => {
		await applySettingsRead(host, read);
		if (host.settingsWriter.isDestroyed) return;
		host.refreshThemeAppearance();

		host.customCommands.syncAll();
	});
	if (host.settingsWriter.isDestroyed) return false;

	host.refreshCallouts();
	if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
	return true;
}
