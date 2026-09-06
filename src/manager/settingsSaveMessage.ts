import { en } from "../i18n/en";
import type { SettingsSaveReason } from "./settingsSaveStatus";

export function settingsSaveMessage(reason: SettingsSaveReason | null | undefined): string {
	switch (reason) {
		case "missing": return en["saveStatus.missing"]!;
		case "unreadable": return en["saveStatus.unreadable"]!;
		case "newer-version": return en["notice.settingsNewerVersion"]!;
		case "recovery-read": return en["saveStatus.recoveryRead"]!;
		case "recovery-write": return en["saveStatus.recoveryWrite"]!;
		case "backup": return en["notice.settingsBackupFailed"]!;
		case "write-permission": return en["saveStatus.writePermission"]!;
		case "write-space": return en["saveStatus.writeSpace"]!;
		case "write": return en["saveStatus.write"]!;
		case "changed": return en["saveStatus.changed"]!;
		case "sync-conflict": return en["saveStatus.syncConflict"]!;
		default: return en["editor.saveFailed"]!;
	}
}
