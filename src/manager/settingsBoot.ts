import { rememberMissingSettingsDisplay } from "./missingSettingsRecovery";
import { SettingsPersistenceError } from "./settingsSaveStatus";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { isFromNewerBuild } from "./foreignFields";
import type { PluginData } from "../types";
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
		warnSettingsUnreadable(host.settingsWriter);

		await applySettingsRead(host, host.settingsWriter.hasCheckpoint ? await recoveryDisplay(host) : { kind: "absent" });

		if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	let missingRecovery: Partial<PluginData> | null = null;
	if (read.kind === "absent" && host.settingsWriter.hasCheckpoint) {
		try { missingRecovery = await host.settingsWriter.recoveryCopy() as Partial<PluginData> | null; }
		catch (error) {
			host.settingsWriter.freeze("recovery-read");
			reportSettingsSaveFailure(host.settingsWriter, error);
			await applySettingsRead(host, { kind: "absent" });
			rememberMissingSettingsDisplay(host);
			watchForLateSettings(host);
			return { isFreshInstall: false };
		}
		if (host.settingsWriter.isDestroyed) return { isFreshInstall: false };
	}
	if (read.kind === "absent" && (host.localState.hasInitialized || missingRecovery)) {
		host.settingsWriter.freeze("missing");
		console.error(
			"[callout-studio] data.json is missing on a device that has run " +
				"before; settings will not be written this session",
		);
		if (isFromNewerBuild(missingRecovery)) {
			host.settingsWriter.freeze("newer-version");
			reportSettingsSaveFailure(host.settingsWriter);
		} else offerFreshStart(host.app, host.manifest.id);

		// Display the durable copy without making it the baseline for a file
		// that is absent. Confirmed recreation preserves these definitions.
		await host.settingsWriter.hold(async () => { host.registry.load(missingRecovery); });

		if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	if (read.kind === "absent") {
		host.settingsWriter.freeze("missing");
	}
	const recovered = read.kind === "loaded" && host.settingsWriter.hasCheckpoint ? await recoverSettingsAtBoot(host, read) : read;
	try { await applySettingsRead(host, recovered, read.kind === "loaded" ? read.json : undefined); }
	catch (error) {
		// A failed migration flush must leave the loaded UI available to retry.
		if (!(error instanceof SettingsPersistenceError)) throw error;
		reportSettingsSaveFailure(host.settingsWriter, error);
	}

	if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
	return { isFreshInstall: read.kind === "absent" };
}
