import { recoverSettingsAtBoot, recoveryDisplay } from "./settingsRecovery";
import { readSettledSettingsFile } from "./settingsSettledRead";
import { offerFreshStart, warnSettingsUnreadable } from "./settingsNotices";
import { watchForLateSettings } from "./settingsLateArrival";
import { applySettingsRead } from "./settingsAdopt";
import type { ExternalReloadHost } from "./settingsAdopt";

export interface SettingsBootResult {

	isFreshInstall: boolean;
}

export async function loadSettingsInto(
	host: ExternalReloadHost,
): Promise<SettingsBootResult> {
	const read = await readSettledSettingsFile(host, {
		isCancelled: () => host.settingsWriter.isDestroyed,
	});
	if (host.settingsWriter.isDestroyed) return { isFreshInstall: false };

	if (read.kind === "unreadable") {
		host.settingsWriter.freeze();
		console.error(
			"[callout-studio] data.json exists but could not be read; " +
				"settings will not be written this session",
		);
		warnSettingsUnreadable();

		await applySettingsRead(host, host.settingsWriter.hasCheckpoint ? await recoveryDisplay(host) : { kind: "absent" });

		if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	if (read.kind === "absent" && host.localState.hasInitialized) {
		host.settingsWriter.freeze();
		console.error(
			"[callout-studio] data.json is missing on a device that has run " +
				"before; settings will not be written this session",
		);
		offerFreshStart(host.app, () => {
			host.settingsWriter.thaw();
			void host.saveSettings();
		});

		await applySettingsRead(host, { kind: "absent" });

		if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	if (read.kind === "absent") {
		host.settingsWriter.freeze();
	}
	const recovered = read.kind === "loaded" && host.settingsWriter.hasCheckpoint ? await recoverSettingsAtBoot(host, read) : read;
	await applySettingsRead(host, recovered, read.kind === "loaded" ? read.json : undefined);

	if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
	return { isFreshInstall: read.kind === "absent" };
}
