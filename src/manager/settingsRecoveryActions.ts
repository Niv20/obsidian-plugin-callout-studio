import { retryMissingSettingsRecovery } from "./missingSettingsRecovery";
import { isFromNewerBuild } from "./foreignFields";
import type { PluginData } from "../types";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { settingsWriteReason } from "./settingsSaveStatus";
import { canonical } from "./syncTree";
import { Notice, normalizePath } from "obsidian";
import { t } from "../i18n";
import { readSettledSettingsFile } from "./settingsSettledRead";
import { tryAdoptExternalSettings, type ExternalReloadHost, type SettingsAdoptionOptions } from "./settingsAdopt";
import { registryIsOwned } from "./registryOwnership";
import { writeSettingsBackup } from "./settingsBackup";

/** Explicit retry. Missing data on a used device never authorizes a reset. */
export async function retrySettingsRecovery(host: ExternalReloadHost, options: SettingsAdoptionOptions = {}): Promise<boolean> {
	try {
		const result = await tryAdoptExternalSettings(host, { ...options, force: true });
		// A first-ever write may have failed before creating data.json. Its
		// explicit retry still has ordinary fresh-install write authority;
		// an untouched fresh install or a lost prior file does not gain it here.
		const retryInitialWrite = result === "unavailable" && !host.settingsWriter.isFrozen &&
			!host.settingsWriter.hasRecoveryState && !host.localState.hasInitialized &&
			["write", "write-permission", "write-space", "recovery-write"].includes(host.settingsWriter.status.failure ?? "");
		if ((result !== "applied" && !retryInitialWrite) || host.settingsWriter.isFrozen) {
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
	const snapshot = canonical(host.registry.toSaveData());
	// The writer owns serialization during restoration, so its own busy flag
	// is deliberately excluded from this snapshot/ownership check.
	const isCurrent = () => !writer.isDestroyed && !host.settingsEditOpen && !host.registry.hasPreviewDefinition() &&
		writer.status.frozenReason === "missing" && canonical(host.registry.toSaveData()) === snapshot;
	const cancelled = () => !isCurrent() || writer.busy;
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
		const restored = await writer.restoreMissing(isCurrent, async () => {
			// Preserve the independent recovery copy before checkpointing the
			// displayed settings. The writer stays frozen and busy throughout.
			const saved = await writer.recoveryCopy() as Partial<PluginData> | null;
			if (!isCurrent()) return false;
			if (isFromNewerBuild(saved)) { writer.freeze("newer-version"); return false; }
			// A remote uninstall may have removed the whole plugin directory.
			// Only this explicit action recreates it; a missing checkpoint must
			// not make success depend on a backup's incidental mkdir.
			const dir = normalizePath(host.manifest.dir ?? `${host.app.vault.configDir}/plugins/${host.manifest.id}`);
			try {
				if (!await host.app.vault.adapter.exists(dir)) await host.app.vault.adapter.mkdir(dir);
			} catch (error) {
				writer.status.fail(settingsWriteReason(error));
				console.error("[callout-studio] could not prepare settings recovery directory", error);
				return false;
			}
			if (!isCurrent()) return false;
			if (saved) {
				try {
					const path = await writeSettingsBackup(host, saved);
					if (!path || canonical(JSON.parse(await host.app.vault.adapter.read(path))) !== canonical(saved)) {
						writer.status.fail("backup"); return false;
					}
				} catch (error) {
					writer.status.fail("backup");
					console.error("[callout-studio] cannot verify settings recovery backup", error);
					return false;
				}
			}
			return isCurrent();
		});
		if (!restored || writer.isDestroyed) return false;
		// A started adapter write cannot be cancelled. If settings changed
		// during it, save that follow-up through the ordinary freshness guard.
		await host.saveSettings();
		return !writer.isDestroyed && !writer.isFrozen &&
			writer.matchesLastWrite(JSON.stringify(host.registry.toSaveData()), true);
	} catch (error) {
		console.error("[callout-studio] could not restore missing settings", error);
		return false;
	}
}
