import { retryMissingSettingsRecovery } from "./missingSettingsRecovery";
import { isFromNewerBuild } from "./foreignFields";
import type { PluginData } from "../types";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { canonical } from "./syncTree";
import { Notice } from "obsidian";
import { t } from "../i18n";
import { readSettledSettingsFile } from "./settingsSettledRead";
import { tryAdoptExternalSettings, type ExternalReloadHost, type SettingsAdoptionOptions } from "./settingsAdopt";
import { registryIsOwned } from "./registryOwnership";
import { writeSettingsBackup } from "./settingsBackup";

/** Explicit retry. Missing data on a used device never authorizes a reset. */
export async function retrySettingsRecovery(host: ExternalReloadHost, options: SettingsAdoptionOptions = {}): Promise<boolean> {
	try {
		const result = await tryAdoptExternalSettings(host, { ...options, force: true });
		if (result !== "applied" || host.settingsWriter.isFrozen) {
			if (result === "unavailable" && host.settingsWriter.status.failure === "missing") await retryMissingSettingsRecovery(host, options);
			return false;
		}
		await host.saveSettings();
		return !host.settingsWriter.isDestroyed && !host.settingsWriter.isFrozen &&
			host.settingsWriter.matchesLastWrite(JSON.stringify(host.registry.toSaveData()), true);
	} catch (error) {
		console.error("[callout-studio] settings recovery retry failed", error);
		reportSettingsSaveFailure(host.settingsWriter, error);
		return false;
	}
}

/** Called only after the user confirms creating a replacement settings file. */
export async function startFreshSettings(host: ExternalReloadHost): Promise<boolean> {
	const writer = host.settingsWriter;
	if (writer.status.frozenReason !== "missing" || registryIsOwned(host)) return false;
	const cancelled = () => writer.isDestroyed || registryIsOwned(host) || writer.status.frozenReason !== "missing";
	const read = await readSettledSettingsFile(host, { isCancelled: cancelled });
	if (cancelled()) return false;
	if (read.kind !== "absent") {
		if (read.kind === "loaded") {
			const recovered = await retrySettingsRecovery(host);
			if (recovered) new Notice(t("saveStatus.settingsArrived"), 10000);
			return recovered;
		}
		writer.status.fail("unreadable");
		return false;
	}
	try {
		// Resetting must not erase the last independent recovery copy. Keep it
		// in a vault backup before the writer checkpoints the new settings.
		const saved = await writer.recoveryCopy() as Partial<PluginData> | null;
		if (isFromNewerBuild(saved)) { writer.freeze("newer-version"); return false; }
		if (saved) {
			try {
				const path = await writeSettingsBackup(host, saved);
				if (!path || canonical(JSON.parse(await host.app.vault.adapter.read(path))) !== canonical(saved)) {
					writer.status.fail("backup"); return false;
				}
			} catch (error) {
				writer.status.fail("backup");
				console.error("[callout-studio] cannot verify recovery backup before reset", error);
				return false;
			}
		}
		if (cancelled()) return false;
		// The writer checks the file again, including after its checkpoint.
		writer.thaw();
		await host.saveSettings();
		const savedNow = !writer.isDestroyed && !writer.isFrozen &&
			writer.matchesLastWrite(JSON.stringify(host.registry.toSaveData()), true);
		if (!savedNow && !writer.isDestroyed) writer.freeze("missing");
		return savedNow;
	} catch (error) {
		if (!writer.isDestroyed) {
			const reason = writer.status.reason;
			writer.freeze("missing");
			if (reason) writer.status.fail(reason);
		}
		console.error("[callout-studio] could not create replacement settings", error);
		return false;
	}
}
