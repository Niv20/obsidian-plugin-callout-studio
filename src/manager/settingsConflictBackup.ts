/** Preserve local definitions before a synced file replaces or removes them. */
import { Notice } from "obsidian";
import type { PluginData } from "../types";
import { stableKeyOrder } from "../utils/stableJson";
import { t } from "../i18n";
import { writeSettingsBackup, type SettingsBackupHost } from "./settingsBackup";
import { mergeSavedSettings } from "../utils/settingsMerge";
import { collectForeignFields, withForeignSettings } from "./foreignFields";

function canonical(value: unknown): string {
	return JSON.stringify(stableKeyOrder(value));
}

export function settingsWouldDiscardRows(current: PluginData, incoming: Partial<PluginData>): boolean {
	const rows = new Map((incoming.callouts ?? []).map(row => [row.id, row]));
	return current.callouts.some(row =>
		canonical(row) !== canonical(rows.get(row.id)));
}

/** Palettes, image artwork, commands and preferences are authored data too. */
function settingsWouldReplacePreferences(current: PluginData, incoming: Partial<PluginData>): boolean {
	const incomingForeign = collectForeignFields(incoming);
	const preferences = withForeignSettings(mergeSavedSettings(incoming.settings ?? {}), incomingForeign);
	return canonical(current.settings) !== canonical(preferences) ||
		canonical(collectForeignFields(current).data) !== canonical(incomingForeign.data);
}

export async function backUpBeforeAdoption(
	host: SettingsBackupHost, current: PluginData, incoming: Partial<PluginData>,
): Promise<boolean> {
	if (!settingsWouldDiscardRows(current, incoming) && !settingsWouldReplacePreferences(current, incoming)) return true;
	const path = await writeSettingsBackup(host, current);
	if (!path) {
		new Notice(t("notice.settingsBackupFailed"), 10000);
		return false;
	}
	new Notice(t("notice.settingsBackupSaved", { path }), 10000);
	return true;
}
