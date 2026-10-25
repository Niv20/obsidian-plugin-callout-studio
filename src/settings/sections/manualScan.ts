/**
 * settings/sections/manualScan.ts — Scan for callouts: the vault
 * scan the user starts from the settings.
 *
 * Who calls it. The Scan for callouts row on the My callout types page
 * (declarative/calloutPages.ts), which runs {@link runManualScan} and reads
 * {@link scanRunning} to say "Scanning…" while it runs.
 *
 * The main idea. One scan at a time per plugin: a second press while one runs,
 * or a press while saving is paused, does nothing. The rows are refreshed by
 * the registry's change round when the scan adds callouts, so nothing here
 * redraws the settings.
 */
import { Notice } from "obsidian";
import { t } from "../../i18n";
import type { SettingsTabPlugin } from "./types";

/**
 * The plugins whose scan is running now. A WeakSet: it holds no plugin alive,
 * and an unloaded plugin's entry goes with it.
 */
const running = new WeakSet<SettingsTabPlugin>();

/** Whether a scan started from the settings is running now. */
export function scanRunning(plugin: SettingsTabPlugin): boolean {
	return running.has(plugin);
}

/**
 * Scan the vault for callout types, unless a scan is already running or
 * saving is paused, and say how many were added. The scan is marked as
 * running before the first wait, so a caller that draws the page right after
 * calling this already sees it running.
 */
export async function runManualScan(plugin: SettingsTabPlugin): Promise<void> {
	if (running.has(plugin) || plugin.settingsWriter.isFrozen) return;
	running.add(plugin);
	try {
		const added = await plugin.runVaultScan();
		new Notice(t("settings.rescanComplete", { count: String(added) }));
	} catch (error) {
		console.error("[callout-studio] manual discovery failed", error);
		new Notice(t("manualDiscovery.failed"), 10000);
	} finally {
		running.delete(plugin);
	}
}
