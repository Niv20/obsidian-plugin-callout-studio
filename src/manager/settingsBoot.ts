/**
 * manager/settingsBoot.ts — reading `data.json` into a live registry.
 *
 * Two callers ask the identical question and must not answer it differently:
 * `onload`, and `onExternalSettingsChange` when another device's settings file
 * arrives mid-session. Both need the file parsed, the registry rebuilt, the
 * discovered rows put back from the device-local index, and a single write-back
 * when a load-time migration rewrote something — in that order, before anything
 * renders.
 *
 * Keeping it here rather than in `main.ts` is what stops the reload path from
 * being a shortened copy of the startup path, which is how a reload quietly
 * ends up skipping a migration.
 */
import type { PluginData } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { bootDiscoveryIndex } from "./discoveryIndexBoot";

/** What the load needs from the plugin. */
export interface SettingsBootHost {
	registry: CalloutRegistry;
	localState: DeviceLocalStore;
	loadData(): Promise<unknown>;
	saveSettings(): Promise<void>;
}

export interface SettingsBootResult {
	/**
	 * Nothing was on disk at all — a brand-new install, as opposed to a user
	 * who merely updated into this version. Drives where the welcome screen
	 * appears; see `settings/welcomeRouting.ts`.
	 */
	isFreshInstall: boolean;
}

/**
 * Read `data.json`, rebuild the registry from it, restore this device's
 * discovered rows, and flush once if any of that changed what should be on disk.
 */
export async function loadSettingsInto(
	host: SettingsBootHost,
): Promise<SettingsBootResult> {
	const savedData = (await host.loadData()) as Partial<PluginData> | null;
	host.registry.load(savedData);

	// Before the first inject, so the restored rows are in the sheet from the
	// start — exactly as theme rows are.
	const index = bootDiscoveryIndex(host.registry, host.localState, savedData);

	// A load-time migration that rewrote definitions is flushed right away, so
	// the cleaned-up list survives the next reload rather than waiting on
	// whatever incidental save happens to come first. `converged` is the same
	// need for the discovered rows the file should stop carrying.
	if (host.registry.needsSaveAfterLoad() || index.converged) {
		await host.saveSettings();
	}

	return {
		isFreshInstall:
			savedData == null || Object.keys(savedData).length === 0,
	};
}


/** What adopting an external change needs on top of {@link SettingsBootHost}. */
export interface ExternalReloadHost extends SettingsBootHost {
	/** True exactly while the callout editor owns the registry. */
	pruneSuspended: boolean;
	settingsWriter: SettingsWriter;
	/** @see registerThemeRowSync */
	resyncThemeRows(): void;
	customCommands: { syncAll(): void };
	refreshCallouts(): void;
	settingsTab?: { containerEl: { isConnected: boolean }; display(): void };
}

/**
 * Adopt a `data.json` that something other than us rewrote — a sync client
 * landing another device's settings, most often.
 *
 * Returns whether the adoption was **deferred**. A reload rebuilds the whole
 * registry, so running one while the callout editor is open would change or
 * remove the row being edited underneath the user. The caller holds the answer
 * and calls again when the modal closes.
 *
 * Two things have to happen that no ordinary load needs:
 *
 * - **The write guard's baseline is invalidated.** It is a claim about what
 *   *we* last wrote, and it has just stopped being true; leaving it standing
 *   lets a byte-identical comparison suppress the very write that would
 *   re-assert local state. See `utils/saveGuard.ts`.
 * - **The theme's overlay rows are re-derived.** `CalloutRegistry.load()`
 *   clears the callout map and those rows live in it; they are deliberately
 *   never persisted, so only a re-sweep brings them back — otherwise every
 *   theme-provided callout silently disappears until the next `css-change`.
 */
export async function adoptExternalSettings(
	host: ExternalReloadHost,
): Promise<boolean> {
	if (host.pruneSuspended || host.registry.hasPreviewDefinition()) return true;

	host.settingsWriter.invalidate();
	await loadSettingsInto(host);
	host.resyncThemeRows();
	// A command may point at a callout the incoming file does not define, or at
	// one it has just introduced.
	host.customCommands.syncAll();
	host.refreshCallouts();
	if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
	return false;
}
