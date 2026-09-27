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
import { withoutIncidental } from "./settingsGenesis";

function canonical(value: unknown): string {
	return JSON.stringify(stableKeyOrder(value));
}

/** Settings as far as a backup cares: picker memory and onboarding flags are not authored. */
function authored(settings: unknown): unknown {
	return withoutIncidental({ settings }).settings;
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
	return canonical(authored(current.settings ?? mergeSavedSettings({}))) !== canonical(authored(preferences)) ||
		canonical(collectForeignFields(content(current)).data) !== canonical(incomingForeign.data);
}

/**
 * Save `current` before `incoming` replaces any of it. `batch` collects every
 * copy one adoption saves, so tidying after a later copy keeps the earlier ones.
 */
export async function backUpBeforeAdoption(
	host: SettingsBackupHost & { settingsWriter?: Pick<SettingsWriter, "status"> }, current: Partial<PluginData>, incoming: Partial<PluginData>,
	batch?: Set<string>,
): Promise<boolean> {
	if (!settingsWouldDiscardRows(current, incoming) && !settingsWouldReplacePreferences(current, incoming)) return true;
	const path = await writeSettingsBackup(host, current, { batch });
	if (!path) {
		host.settingsWriter?.status.fail("backup");
		if (host.settingsWriter) reportSettingsSaveFailure(host.settingsWriter);
		else reportSettingsSaveFailure({}, undefined, settingsSaveMessage("backup"));
		return false;
	}
	console.debug("[callout-studio] settings recovery backup saved", path);
	return true;
}
