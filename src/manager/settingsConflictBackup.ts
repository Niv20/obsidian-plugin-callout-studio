import type { SettingsWriter } from "./SettingsWriter";
import { content } from "./syncTree";
/** Preserve local definitions before a synced file replaces or removes them. */
import type { PluginData } from "../types";
import { stableKeyOrder } from "../utils/stableJson";
import { settingsSaveMessage } from "./settingsSaveMessage";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { writeSettingsBackup, type SettingsBackupHost } from "./settingsBackup";
import { mergeSavedSettings } from "../utils/settingsMerge";
import { collectForeignFields, withForeignSettings } from "./foreignFields";

function canonical(value: unknown): string {
	return JSON.stringify(stableKeyOrder(value));
}

export function settingsWouldDiscardRows(current: Partial<PluginData>, incoming: Partial<PluginData>): boolean {
	const rows = new Map((incoming.callouts ?? []).map(row => [row.id, row]));
	return (current.callouts ?? []).some(row =>
		canonical(row) !== canonical(rows.get(row.id)));
}

/** Palettes, image artwork, commands and preferences are authored data too. */
function settingsWouldReplacePreferences(current: Partial<PluginData>, incoming: Partial<PluginData>): boolean {
	const incomingForeign = collectForeignFields(content(incoming));
	const preferences = withForeignSettings(mergeSavedSettings(incoming.settings ?? {}), incomingForeign);
	return canonical(current.settings ?? mergeSavedSettings({})) !== canonical(preferences) ||
		canonical(collectForeignFields(content(current)).data) !== canonical(incomingForeign.data);
}

export async function backUpBeforeAdoption(
	host: SettingsBackupHost & { settingsWriter?: Pick<SettingsWriter, "status"> }, current: Partial<PluginData>, incoming: Partial<PluginData>,
): Promise<boolean> {
	if (!settingsWouldDiscardRows(current, incoming) && !settingsWouldReplacePreferences(current, incoming)) return true;
	const path = await writeSettingsBackup(host, current);
	if (!path) {
		host.settingsWriter?.status.fail("backup");
		if (host.settingsWriter) reportSettingsSaveFailure(host.settingsWriter);
		else reportSettingsSaveFailure({}, undefined, settingsSaveMessage("backup"));
		return false;
	}
	console.debug("[callout-studio] settings recovery backup saved", path);
	return true;
}
