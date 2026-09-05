import { Notice } from "obsidian";
import { SettingsWriter } from "./SettingsWriter";
import { readSettingsFile, type SettingsFileHost } from "./settingsFile";
import { t } from "../i18n";

export interface SettingsWriterOwner extends SettingsFileHost {
	registry: { toSaveData(): unknown };
	localState?: { markInitialized(): void };

	saveData(data: unknown): Promise<void>;

	onExternalSettingsChange(): Promise<void>;
}

export function createSettingsWriter(
	owner: SettingsWriterOwner,
): SettingsWriter {
	return new SettingsWriter({
		build: () => owner.registry.toSaveData(),
		write: async (data) => {
			await owner.saveData(data);
			owner.localState?.markInitialized();
		},
		readCurrent: async () => {
			const read = await readSettingsFile(owner);
			if (read.kind === "unreadable") throw new Error("Settings are unreadable");
			return read.kind === "loaded" ? read.json : null;
		},
		onStaleWrite: () => {
			new Notice(t("notice.settingsChangedElsewhere"), 10000);
			void owner.onExternalSettingsChange();
		},
		// Once per freeze, and worth the interruption exactly because it is
		// once: the launch notice that announced the freeze was shown before
		// the user had looked at the screen, and this fires at the moment their
		// first change stops being real.
		onFrozenSave: () => {
			new Notice(t("notice.settingsNotSaved"), 10000);
		},
	});
}
