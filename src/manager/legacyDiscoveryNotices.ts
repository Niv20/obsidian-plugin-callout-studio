import { Notice } from "obsidian";
import { t } from "../i18n";
import type { LegacyDiscoveryMigration } from "./DeviceLocalStore";

/** Called after the saved UI locale has loaded. */
export function reportLegacyDiscoveryMigration(result: LegacyDiscoveryMigration): void {
	if (result.kind === "archived") {
		new Notice(t("notice.legacyDiscoveryArchived", { path: result.path }), 12000);
	} else if (result.kind === "failed") {
		new Notice(t("notice.legacyDiscoveryArchiveFailed"), 12000);
	}
}
