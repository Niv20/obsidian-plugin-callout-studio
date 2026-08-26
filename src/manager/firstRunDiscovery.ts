/**
 * manager/firstRunDiscovery.ts — the one-time post-install vault scan.
 *
 * Lives beside `CalloutDiscovery` rather than in `main.ts` because it is a
 * decision, not wiring: it picks between a silent auto-scan and a consent
 * modal, and it owns when the `firstRunCompleted` flag may be written. `main.ts`
 * keeps only the `onLayoutReady` call that starts it.
 */
import { Notice } from "obsidian";
import type { App } from "obsidian";
import { FirstRunScanModal } from "../utils/FirstRunScanModal";
import { HEAVY_VAULT_FILE_THRESHOLD } from "../constants";
import { t } from "../i18n";
import type { PluginSettings } from "../types";

/**
 * What the scan needs from the plugin. Narrow and structural, like the other
 * manager hosts, so nothing here depends on the concrete plugin class.
 */
export interface FirstRunDiscoveryHost {
	app: App;
	settings: PluginSettings;
	registry: { settings: PluginSettings };
	runVaultScan(markFirstRun?: boolean): Promise<number>;
	saveSettings(): Promise<void>;
}

/**
 * One-time post-install discovery. Picks between a silent auto-scan
 * (small vaults) and a consent modal (large vaults). The
 * `firstRunCompleted` flag is only persisted after the chosen path
 * finishes, so an interrupted run will retry on the next launch.
 */
export async function runFirstRunDiscovery(
	plugin: FirstRunDiscoveryHost,
): Promise<void> {
	// Re-check the flag — onLayoutReady can fire after another flow
	// (e.g. an import) already ran a scan and flipped the flag.
	if (plugin.settings.firstRunCompleted) return;

	const fileCount = plugin.app.vault.getMarkdownFiles().length;

	if (fileCount < HEAVY_VAULT_FILE_THRESHOLD) {
		// Small vault — auto-scan silently.
		try {
			const added = await plugin.runVaultScan(false);
			if (added > 0) {
				new Notice(
					t("firstRun.autoScanComplete", {
						count: String(added),
					}),
				);
			}
		} catch (e) {
			console.error("[CalloutStudio] first-run auto scan failed", e);
				new Notice(t("firstRun.autoScanFailed"));
		}
		plugin.registry.settings.firstRunCompleted = true;
		await plugin.saveSettings();
		return;
	}

	// Large vault — ask the user first.
	await new FirstRunScanModal(plugin.app, fileCount, async () => {
		const added = await plugin.runVaultScan(false);
		new Notice(
			t("settings.rescanComplete", {
				count: String(added),
			}),
		);
	}).prompt();
	plugin.registry.settings.firstRunCompleted = true;
	await plugin.saveSettings();
}
