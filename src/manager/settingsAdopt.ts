import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { readSettingsConflictFiles } from "./settingsConflictFiles";
import { canonical, content } from "./syncTree";
import type { PluginData } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { readSettingsFile } from "./settingsFile";
import { readSettledSettingsFile, type SettledSettingsFileHost } from "./settingsSettledRead";
import { isFromNewerBuild } from "./foreignFields";
import { registryIsOwned } from "./registryOwnership";
import { backUpBeforeAdoption } from "./settingsConflictBackup";
import { stableKeyOrder } from "../utils/stableJson";
import { unsavedChangesReplaced } from "./setupDifference";
import { Notice } from "obsidian";
import { t } from "../i18n";
import type { SettingsRead } from "./settingsFile";

export interface SettingsBootHost extends SettledSettingsFileHost {
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
		// Storage preflight, best effort: failing recovery storage does not stop
		// a device adopting or saving. See SettingsWriter.rememberIfPossible().
		if (savedData && (!host.settingsWriter.isFrozen || canContinue) && !isFromNewerBuild(savedData) && host.settingsWriter.hasCheckpoint) {
			await host.settingsWriter.rememberIfPossible(acceptedCheckpoint ?? savedData);
		}
		if (host.settingsWriter.isDestroyed || (canContinue && !await canContinue())) return false;
		if (canContinue && !isFromNewerBuild(savedData)) host.settingsWriter.thaw();
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
			await host.settingsWriter.rememberIfPossible(savedData);
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

function unavailableSettings(host: ExternalReloadHost, read: Exclude<SettingsRead, { kind: "loaded" }>): void {
	const writer = host.settingsWriter;
	// A later build's file: this build must not write over it at all.
	if (read.kind === "unreadable" && read.newer) { writer.freeze("newer-version"); return; }
	// Unreadable twice in a row (the queue's retries make that quick), so not
	// a read that landed mid-swap: pause, which is what offers the way out. A
	// later build's freeze, or unreadable recovery storage, is the more
	// specific story and stays.
	if (read.kind === "unreadable") {
		const again = writer.status.reason === "unreadable";
		if (again && !read.unsettled && (!writer.isFrozen || writer.status.frozenReason === "missing")) writer.freeze("unreadable");
		else writer.status.fail("unreadable");
		return;
	}
	// A genuinely new installation has no data.json until its first edit.
	// Foreground/watch events alone must not turn that into a recovery incident.
	if (writer.isFrozen || writer.hasRecoveryState || host.localState.hasInitialized) writer.protectMissingFile();
}

/** Distinguish a transient sync read from a held editor or failed backup. */
export async function tryAdoptExternalSettings(
	host: ExternalReloadHost, options: SettingsAdoptionOptions = {},
): Promise<ExternalAdoptionResult> {
	if (adoptionIsHeld(host, options)) return "deferred";

	const first = await readSettingsFile(host);
	if (adoptionIsHeld(host, options)) return "deferred";
	if (first.kind !== "loaded") {
		unavailableSettings(host, first);
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
		unavailableSettings(host, read);
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
	// What the file held when this device last saved: changes past it are unsaved.
	const lastSaved = host.settingsWriter.lastSaved as Partial<PluginData> | null;
	const merged = isFromNewerBuild(read.data) ? read.data :
		host.settingsWriter.mergeExternal(read.data, before, durable ? [durable, ...conflicts] : conflicts) as Partial<PluginData>;
	if (!options.force && !host.settingsWriter.isFrozen && host.settingsWriter.matchesLastWrite(read.json) &&
		host.settingsWriter.matchesLastWrite(JSON.stringify(merged)) && canonical(content(before)) === canonical(content(merged))) return true;
	if (options.canApply && !options.canApply(merged)) {
		host.settingsWriter.status.fail("sync-conflict");
		return false;
	}
	const batch = new Set<string>();
	if (!(await backUpBeforeAdoption(host, before, merged, batch))) return false;
	if (durable && canonical(content(durable)) !== canonical(content(before)) &&
		!await backUpBeforeAdoption(host, durable, merged, batch)) return false;
	for (const conflict of conflicts) {
		if (!await backUpBeforeAdoption(host, conflict, merged, batch)) return false;
	}
	if (JSON.stringify(stableKeyOrder(read.data)) !== JSON.stringify(stableKeyOrder(merged)) &&
		!(await backUpBeforeAdoption(host, read.data, merged, batch))) return false;
	// User edits made while the backup was being written must not disappear.
	if (adoptionIsHeld(host, options) || JSON.stringify(stableKeyOrder(host.registry.toSaveData())) !== snapshot) return false;
	let applied = false;
	await host.settingsWriter.hold(async () => {
		applied = await applySettingsRead(host, { kind: "loaded", data: merged, json: JSON.stringify(merged) }, read.json, async () => {
			// Check again after the checkpoint await. A user can open an editor
			// or sync can deliver another file while storage is still finishing.
			const latest = await readSettingsFile(host);
			if (latest.kind !== "loaded" || canonical(latest.data) !== canonical(read.data)) {
				if (latest.kind === "loaded") host.settingsWriter.status.fail("changed");
				else unavailableSettings(host, latest);
				return false;
			}
			return !adoptionIsHeld(host, options) && JSON.stringify(stableKeyOrder(host.registry.toSaveData())) === snapshot;
		}, durable ?? host.settingsWriter.stamped(before));
		if (!applied) return;
		if (host.settingsWriter.isDestroyed) return;
		host.refreshThemeAppearance();

		host.customCommands.syncAll();
	});
	if (!applied || host.settingsWriter.isDestroyed) return false;

	// A change made here that never reached the file lost to the incoming one.
	// The backup above holds it; say so, since nothing else would.
	if (lastSaved && unsavedChangesReplaced(lastSaved, before, merged) > 0) {
		new Notice(t("notice.unsavedChangesReplaced"), 15000);
	}

	host.refreshCallouts();
	if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
	return true;
}
