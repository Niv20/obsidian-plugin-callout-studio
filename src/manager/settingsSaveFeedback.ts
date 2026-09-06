import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import type { SettingsWriter } from "./SettingsWriter";

/** Handle background failures while preserving rejection for an awaiting editor. */
export function saveSettingsWithFeedback(
	owner: { settingsWriter: Pick<SettingsWriter, "save"> & Partial<Pick<SettingsWriter, "status">> },
	onSettled: () => void,
): Promise<void> {
	const pending = owner.settingsWriter.save().finally(onSettled);
	void pending.then(
		() => undefined,
		(error: unknown) => {
			console.error("[Callout Studio] settings save failed", error);
			reportSettingsSaveFailure(owner.settingsWriter, error);
		},
	);
	return pending;
}
