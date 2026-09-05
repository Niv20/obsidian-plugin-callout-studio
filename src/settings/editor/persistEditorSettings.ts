import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { SettingsWriter } from "../../manager/SettingsWriter";

interface EditorPersistenceHost {
	registry: Pick<CalloutRegistry, "toSaveData">;
	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed" | "matchesLastWrite">;
	saveSettings(): Promise<void>;
}

/** A closed editor must mean the current definition reached the settings file. */
export async function persistEditorSettings(host: EditorPersistenceHost): Promise<boolean> {
	if (host.settingsWriter.isFrozen || host.settingsWriter.isDestroyed) return false;
	await host.saveSettings();
	// A frozen or stale write resolves without writing. Awaiting alone cannot
	// distinguish that protection from a successful save.
	return !host.settingsWriter.isFrozen && !host.settingsWriter.isDestroyed &&
		host.settingsWriter.matchesLastWrite(JSON.stringify(host.registry.toSaveData()));
}
