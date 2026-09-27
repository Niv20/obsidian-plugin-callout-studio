import { readSettingsConflictFiles } from "./settingsConflictFiles";
/** Reconcile a durable local checkpoint before adopting the launch-time file. */
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { SettingsPersistenceError } from "./settingsSaveStatus";
import { isFromNewerBuild } from "./foreignFields";
import { backUpBeforeAdoption } from "./settingsConflictBackup";
import { canonical } from "./syncTree";
import { hasSafeSettingsFileShape } from "./settingsFileShape";
import type { SettingsBootHost } from "./settingsAdopt";
import type { SettingsRead } from "./settingsFile";
import type { PluginData } from "../types";

type Loaded = Extract<SettingsRead, { kind: "loaded" }>;

export async function recoverSettingsAtBoot(host: SettingsBootHost, incoming: Loaded): Promise<Loaded> {
	if (isFromNewerBuild(incoming.data)) return incoming;
	try {
		const saved = await host.settingsWriter.recoveryCopy() as Partial<PluginData> | null;
		if (host.settingsWriter.isDestroyed) return incoming;
		if (isFromNewerBuild(saved)) throw new SettingsPersistenceError("newer-version", "Settings recovery copy is from a newer build");
		const recovered = saved ? host.settingsWriter.recover(incoming.data, saved) : incoming.data;
		const conflicts = await readSettingsConflictFiles(host);
		// Each join uses the preceding snapshot as an unchanged local view.
		let merged = recovered as Partial<PluginData>;
		for (const conflict of conflicts) merged = host.settingsWriter.recover(conflict, merged) as Partial<PluginData>;
		if (canonical(merged) === canonical(incoming.data)) return incoming;
		const batch = new Set<string>();
		for (const conflict of conflicts) {
			if (!await backUpBeforeAdoption(host, conflict, merged, batch)) throw new SettingsPersistenceError("backup", "Cannot preserve conflict copy");
		}
		if ((saved && !await backUpBeforeAdoption(host, saved, merged, batch)) ||
			!await backUpBeforeAdoption(host, incoming.data, merged, batch)) throw new SettingsPersistenceError("backup", "Cannot preserve recovery conflict");
		return { kind: "loaded", data: merged, json: JSON.stringify(merged) };
	} catch (error) {
		// Reading the recovery copy must not become permission to replace it.
		host.settingsWriter.freeze(error instanceof SettingsPersistenceError ? error.reason : "recovery-read");
		console.error("[callout-studio] settings recovery is unavailable", error);
		reportSettingsSaveFailure(host.settingsWriter, error);
		return incoming;
	}
}

export async function recoveryDisplay(host: SettingsBootHost): Promise<Loaded | { kind: "absent" }> {
	try {
		const saved = await host.settingsWriter.recoveryCopy() as Partial<PluginData> | null;
		if (isFromNewerBuild(saved)) host.settingsWriter.freeze("newer-version");
		// A later build's copy is kept, not displayed, when this build cannot read it.
		if (saved && hasSafeSettingsFileShape(saved)) return { kind: "loaded", data: saved, json: JSON.stringify(saved) };
	} catch (error) {
		// Replacing a damaged primary must not overwrite an unreadable recovery
		// copy without first preserving it through its own explicit action.
		if (host.settingsWriter.status.frozenReason !== "newer-version") host.settingsWriter.freeze("recovery-read");
		console.error("[callout-studio] cannot display settings recovery copy", error);
	}
	return { kind: "absent" };
}
