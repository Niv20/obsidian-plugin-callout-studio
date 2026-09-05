import { Notice } from "obsidian";
import { t } from "../i18n";
import type { SettingsWriter } from "./SettingsWriter";

const reported = new WeakSet<object>();

/** Handle background failures while preserving rejection for an awaiting editor. */
export function saveSettingsWithFeedback(
	owner: { settingsWriter: Pick<SettingsWriter, "save"> },
	onSettled: () => void,
): Promise<void> {
	const pending = owner.settingsWriter.save().finally(onSettled);
	void pending.then(
		() => { reported.delete(owner); },
		(error: unknown) => {
			console.error("[Callout Studio] settings save failed", error);
			if (reported.has(owner)) return;
			reported.add(owner);
			new Notice(t("notice.settingsSaveFailed"), 10000);
		},
	);
	return pending;
}
