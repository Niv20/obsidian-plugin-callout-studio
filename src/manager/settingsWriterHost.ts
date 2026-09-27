import { Notice } from "obsidian";
import { t } from "../i18n";
import { SettingsPersistenceError, settingsWriteReason } from "./settingsSaveStatus";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { SettingsCheckpoint, type SettingsCheckpointStore } from "./settingsCheckpoint";
import { SettingsHistory, type SettingsHistoryStore } from "./settingsHistory";
import { SettingsWriter } from "./SettingsWriter";
import { PRIMARY_IO_TIMEOUT_MS, readSettingsFile, type SettingsFileHost } from "./settingsFile";
import { withTimeout } from "../utils/withTimeout";
import { canonical } from "./syncTree";
import { isUntouchedSettings, settingsGenesis } from "./settingsGenesis";

export interface SettingsWriterOwner extends SettingsFileHost {
	registry: { toSaveData(): unknown };
	localState?: { markInitialized(): void };

	saveData(data: unknown): Promise<void>;

	onExternalSettingsChange(): Promise<void>;
}

export function createSettingsWriter(
	owner: SettingsWriterOwner,
	checkpoint: SettingsCheckpointStore = new SettingsCheckpoint(owner.app, owner.manifest),
	history: SettingsHistoryStore = new SettingsHistory(owner.app, owner.manifest),
): SettingsWriter {
	const writer = new SettingsWriter({
		mergeConcurrent: true, checkpoint, history,
		genesis: settingsGenesis,
		isUntouched: data => isUntouchedSettings(data),
		build: () => owner.registry.toSaveData(),
		write: async (data) => {
			// Some Obsidian versions swallow adapter failures inside saveData.
			// Resolve only after reading back the intended settings, including
			// when the adapter replaced the file and then reported an error.
			let failure: unknown;
			// A write that never answers is a failed write; the read-back below
			// still accepts it if it did land.
			try {
				await withTimeout(owner.saveData(data), PRIMARY_IO_TIMEOUT_MS,
					() => new SettingsPersistenceError("write", "Storage did not respond"));
			} catch (error) { failure = error; }
			const read = await readSettingsFile(owner);
			if (read.kind !== "loaded" || canonical(read.data) !== canonical(data)) {
				throw failure instanceof Error ? failure :
					new SettingsPersistenceError(settingsWriteReason(failure), failure ?? "Settings write could not be verified");
			}
			owner.localState?.markInitialized();
		},
		readCurrent: async () => {
			const read = await readSettingsFile(owner);
			if (read.kind === "unreadable") {
				throw new SettingsPersistenceError(read.newer ? "newer-version" : "unreadable", "Settings are unreadable");
			}
			return read.kind === "loaded" ? read.json : null;
		},
		onStaleWrite: () => {
			reportSettingsSaveFailure(writer);
			void owner.onExternalSettingsChange().catch(error => {
				console.error("[callout-studio] settings reload failed", error);
			});
		},
		// Once per freeze, and worth the interruption exactly because it is
		// once: the launch notice that announced the freeze was shown before
		// the user had looked at the screen, and this fires at the moment their
		// first change stops being real.
		onFrozenSave: () => {
			reportSettingsSaveFailure(writer);
		},
		// Not a failure: the settings file holds every change. Said once, so a
		// device whose recovery storage is full knows it is less protected.
		onCheckpointStale: () => { new Notice(t("notice.recoveryCopyStale"), 10000); },
	});
	return writer;
}
