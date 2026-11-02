import { t } from "../i18n";
import type { SettingsSaveReason } from "./settingsSaveStatus";

export function settingsSaveMessage(reason: SettingsSaveReason | null | undefined): string {
	switch (reason) {
		case "missing":
			return t("saveStatus.missing");
		case "unreadable":
			return t("saveStatus.unreadable");
		case "newer-version":
			return t("notice.settingsNewerVersion");
		case "recovery-read":
			return t("saveStatus.recoveryRead");
		case "recovery-write":
			return t("saveStatus.recoveryWrite");
		case "backup":
			return t("notice.settingsBackupFailed");
		case "write-permission":
			return t("saveStatus.writePermission");
		case "write-space":
			return t("saveStatus.writeSpace");
		case "write":
			return t("saveStatus.write");
		case "changed":
			return t("saveStatus.changed");
		case "sync-conflict":
			return t("saveStatus.syncConflict");
		default:
			return t("editor.saveFailed");
	}
}
