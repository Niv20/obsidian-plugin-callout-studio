import { SettingsPersistenceError } from "./settingsSaveStatus";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { SettingsCheckpoint, type SettingsCheckpointStore } from "./settingsCheckpoint";
import { SettingsWriter } from "./SettingsWriter";
import { readSettingsFile, type SettingsFileHost } from "./settingsFile";

export interface SettingsWriterOwner extends SettingsFileHost {
	registry: { toSaveData(): unknown };
	localState?: { markInitialized(): void };

	saveData(data: unknown): Promise<void>;

	onExternalSettingsChange(): Promise<void>;
}

export function createSettingsWriter(
	owner: SettingsWriterOwner,
	checkpoint: SettingsCheckpointStore = new SettingsCheckpoint(owner.app, owner.manifest),
): SettingsWriter {
	const writer = new SettingsWriter({
		mergeConcurrent: true, checkpoint,
		build: () => owner.registry.toSaveData(),
		write: async (data) => {
			await owner.saveData(data);
			owner.localState?.markInitialized();
		},
		readCurrent: async () => {
			const read = await readSettingsFile(owner);
			if (read.kind === "unreadable") throw new SettingsPersistenceError("unreadable", "Settings are unreadable");
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
	});
	return writer;
}
