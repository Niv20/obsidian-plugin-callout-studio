import { t } from "../i18n";
import type { LegacyDiscoveryMigration } from "./DeviceLocalStore";
import { showNotice } from "../ui/mascot/mascotNotices";

/** Called after the saved UI locale has loaded. */
export function reportLegacyDiscoveryMigration(result: LegacyDiscoveryMigration): void {
	if (result.kind === "archived") {
		console.debug("[callout-studio] legacy discovery recovery copy saved", result.path);
	} else if (result.kind === "failed") {
		showNotice("problem", t("notice.legacyDiscoveryArchiveFailed"));
	}
}
