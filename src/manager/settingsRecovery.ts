import { readSettingsConflictFiles } from "./settingsConflictFiles";
/** Reconcile a durable local checkpoint before adopting the launch-time file. */
import { warnSettingsUnreadable } from "./settingsNotices";
import { isFromNewerBuild } from "./foreignFields";
import { backUpBeforeAdoption } from "./settingsConflictBackup";
import { canonical } from "./syncTree";
import type { SettingsBootHost } from "./settingsAdopt";
import type { SettingsRead } from "./settingsFile";
import type { PluginData } from "../types";

type Loaded = Extract<SettingsRead, { kind: "loaded" }>;

export async function recoverSettingsAtBoot(host: SettingsBootHost, incoming: Loaded): Promise<Loaded> {
	if (isFromNewerBuild(incoming.data)) return incoming;
	try {
		const saved = await host.settingsWriter.recoveryCopy() as Partial<PluginData> | null;
		if (host.settingsWriter.isDestroyed) return incoming;
		if (isFromNewerBuild(saved)) throw new Error("Settings recovery copy is from a newer build");
		const recovered = saved ? host.settingsWriter.recover(incoming.data, saved) : incoming.data;
		const conflicts = await readSettingsConflictFiles(host);
		// Each join uses the preceding snapshot as an unchanged local view.
		let merged = recovered as Partial<PluginData>;
		for (const conflict of conflicts) merged = host.settingsWriter.recover(conflict, merged) as Partial<PluginData>;
		if (canonical(merged) === canonical(incoming.data)) return incoming;
		for (const conflict of conflicts) {
			if (!await backUpBeforeAdoption(host, conflict, merged)) throw new Error("Cannot preserve conflict copy");
		}
		if ((saved && !await backUpBeforeAdoption(host, saved, merged)) ||
			!await backUpBeforeAdoption(host, incoming.data, merged)) throw new Error("Cannot preserve recovery conflict");
		return { kind: "loaded", data: merged, json: JSON.stringify(merged) };
	} catch (error) {
		// Reading the recovery copy must not become permission to replace it.
		host.settingsWriter.freeze();
		console.error("[callout-studio] settings recovery is unavailable", error);
		warnSettingsUnreadable();
		return incoming;
	}
}

export async function recoveryDisplay(host: SettingsBootHost): Promise<Loaded | { kind: "absent" }> {
	try {
		const saved = await host.settingsWriter.recoveryCopy() as Partial<PluginData> | null;
		if (saved) return { kind: "loaded", data: saved, json: JSON.stringify(saved) };
	} catch (error) { console.error("[callout-studio] cannot display settings recovery copy", error); }
	return { kind: "absent" };
}
