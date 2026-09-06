import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { readSettingsConflictFiles } from "./settingsConflictFiles";
import { canonical, content } from "./syncTree";
import type { PluginData } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { readSettingsFile } from "./settingsFile";
import { readSettledSettingsFile } from "./settingsSettledRead";
import { isFromNewerBuild } from "./foreignFields";
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
	canContinue?: () => Promise<boolean>,
	acceptedCheckpoint?: unknown,
): Promise<boolean> {
	if (host.settingsWriter.isDestroyed) return false;
	const savedData: Partial<PluginData> | null =
		read.kind === "loaded" ? read.data : null;

	if (isFromNewerBuild(savedData)) {
		host.settingsWriter.freeze("newer-version");
		console.error(
			"[callout-studio] data.json was written by a newer version; " +
				"settings will not be written this session",
		);
		reportSettingsSaveFailure(host.settingsWriter);
	}

	return await host.settingsWriter.hold(async () => {
		let checkpointFailed = false;
		if (savedData && (!host.settingsWriter.isFrozen || canContinue) && !isFromNewerBuild(savedData) && host.settingsWriter.hasCheckpoint) {
			try { await host.settingsWriter.remember(acceptedCheckpoint ?? savedData); }
			catch (error) { checkpointFailed = true; host.settingsWriter.freeze("recovery-write"); console.error("[callout-studio] cannot checkpoint settings", error); }
		}
		if (host.settingsWriter.isDestroyed || (canContinue && !await canContinue())) return false;
		if (canContinue && !checkpointFailed && !isFromNewerBuild(savedData)) host.settingsWriter.thaw();
		try {
			host.registry.load(savedData);
		} catch (error) {
			// A failed rebuild must neither authorize writes of partial state nor
			// make a retry look like an echo of an already adopted file.
			host.settingsWriter.freeze("unreadable");
			throw error;
		}
		if (read.kind === "loaded") host.settingsWriter.adopt(read.json, diskJson);
		if (savedData) host.localState.markInitialized();
		if (canContinue && savedData && !host.settingsWriter.isFrozen && host.settingsWriter.hasCheckpoint) {
			try { await host.settingsWriter.remember(savedData); }
			catch (error) { host.settingsWriter.freeze("recovery-write"); console.error("[callout-studio] cannot checkpoint adopted settings", error); }
		}
		if (host.settingsWriter.isDestroyed) return false;

		if (host.registry.needsSaveAfterLoad() || (read.kind === "loaded" && diskJson !== undefined && diskJson !== read.json)) {
			await host.saveSettings();
		}
		return true;
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

export interface SettingsAdoptionOptions {
	/** An explicit editor action; background reloads still respect ownership. */
	editor?: boolean;
	force?: boolean;
	canApply?: (data: Partial<PluginData>) => boolean;
}

function adoptionIsHeld(host: ExternalReloadHost, options: SettingsAdoptionOptions): boolean {
	return options.editor ? host.settingsWriter.busy || host.settingsWriter.isDestroyed || host.registry.hasPreviewDefinition() : registryIsOwned(host);
}

/** Distinguish a transient sync read from a held editor or failed backup. */
export async function tryAdoptExternalSettings(
	host: ExternalReloadHost, options: SettingsAdoptionOptions = {},
): Promise<ExternalAdoptionResult> {
	if (adoptionIsHeld(host, options)) return "deferred";

	const first = await readSettingsFile(host);
	if (adoptionIsHeld(host, options)) return "deferred";
	if (first.kind !== "loaded") {
		host.settingsWriter.status.fail(first.kind === "absent" ? "missing" : "unreadable");
		return "unavailable";
	}
	const conflicts = host.settingsWriter.mergesConcurrent ? await readSettingsConflictFiles(host) : [];
	if (adoptionIsHeld(host, options)) return "deferred";
	// An unchanged primary file can still have a newly delivered conflict copy.
	if (!host.settingsWriter.isFrozen && !options.force && host.settingsWriter.matchesLastWrite(first.json) && conflicts.length === 0) {
		host.settingsWriter.confirmUnchangedRead(first.json);
		return "applied";
	}
	const read = await readSettledSettingsFile(host, {
		initial: first, isCancelled: () => host.settingsWriter.isDestroyed,
	});
	if (adoptionIsHeld(host, options)) return "deferred";

	if (read.kind !== "loaded") {
		host.settingsWriter.status.fail(read.kind === "absent" ? "missing" : "unreadable");
		console.warn(
			`[callout-studio] ignoring an external data.json change: ${read.kind}`,
		);
		return "unavailable";
	}

	if (!host.settingsWriter.isFrozen && !options.force && host.settingsWriter.matchesLastWrite(read.json) && conflicts.length === 0) {
		host.settingsWriter.confirmUnchangedRead(read.json);
		return "applied";
	}

	return (await reloadFrom(host, read, conflicts, options)) ? "applied" : "deferred";
}

const adopting = new WeakSet<ExternalReloadHost>();

export async function reloadFrom(
	host: ExternalReloadHost,
	read: Extract<SettingsRead, { kind: "loaded" }>,
	conflicts: Partial<PluginData>[] = [], options: SettingsAdoptionOptions = {},
): Promise<boolean> {
	if (adopting.has(host)) return false;
	adopting.add(host);
	try { return await applyExternalSettings(host, read, conflicts, options); }
	finally { adopting.delete(host); }
}

async function applyExternalSettings(
	host: ExternalReloadHost,
	read: Extract<SettingsRead, { kind: "loaded" }>,
	conflicts: Partial<PluginData>[] = [], options: SettingsAdoptionOptions = {},
): Promise<boolean> {
	if (adoptionIsHeld(host, options)) return false;
	let durable: Partial<PluginData> | null = null;
	if (host.settingsWriter.hasCheckpoint && !isFromNewerBuild(read.data)) {
		try { durable = await host.settingsWriter.recoveryCopy() as Partial<PluginData> | null; } catch (error) {
			host.settingsWriter.freeze("recovery-read");
			throw error;
		}
	}
	if (adoptionIsHeld(host, options)) return false;
	if (isFromNewerBuild(durable)) { host.settingsWriter.freeze("newer-version"); return false; }
	const before = host.registry.toSaveData();
	const snapshot = JSON.stringify(stableKeyOrder(before));
	const merged = isFromNewerBuild(read.data) ? read.data :
		host.settingsWriter.mergeExternal(read.data, before, durable ? [durable, ...conflicts] : conflicts) as Partial<PluginData>;
	if (!options.force && !host.settingsWriter.isFrozen && host.settingsWriter.matchesLastWrite(read.json) &&
		host.settingsWriter.matchesLastWrite(JSON.stringify(merged)) && canonical(content(before)) === canonical(content(merged))) return true;
	if (options.canApply && !options.canApply(merged)) {
		host.settingsWriter.status.fail("sync-conflict");
		return false;
	}
	if (!(await backUpBeforeAdoption(host, before, merged))) return false;
	if (durable && canonical(content(durable)) !== canonical(content(before)) &&
		!await backUpBeforeAdoption(host, durable, merged)) return false;
	for (const conflict of conflicts) {
		if (!await backUpBeforeAdoption(host, conflict, merged)) return false;
	}
	if (JSON.stringify(stableKeyOrder(read.data)) !== JSON.stringify(stableKeyOrder(merged)) &&
		!(await backUpBeforeAdoption(host, read.data, merged))) return false;
	// User edits made while the backup was being written must not disappear.
	if (adoptionIsHeld(host, options) || JSON.stringify(stableKeyOrder(host.registry.toSaveData())) !== snapshot) return false;
	let applied = false;
	await host.settingsWriter.hold(async () => {
		applied = await applySettingsRead(host, { kind: "loaded", data: merged, json: JSON.stringify(merged) }, read.json, async () => {
			// Check again after the checkpoint await. A user can open an editor
			// or sync can deliver another file while storage is still finishing.
			const latest = await readSettingsFile(host);
			if (latest.kind !== "loaded" || canonical(latest.data) !== canonical(read.data)) {
				host.settingsWriter.status.fail(latest.kind === "absent" ? "missing" : latest.kind === "unreadable" ? "unreadable" : "changed");
				return false;
			}
			return !adoptionIsHeld(host, options) && JSON.stringify(stableKeyOrder(host.registry.toSaveData())) === snapshot;
		}, durable ?? before);
		if (!applied) return;
		if (host.settingsWriter.isDestroyed) return;
		host.refreshThemeAppearance();

		host.customCommands.syncAll();
	});
	if (!applied || host.settingsWriter.isDestroyed) return false;

	host.refreshCallouts();
	if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
	return true;
}
