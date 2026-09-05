/**
 * settings/sections/types.ts — Shared types for all settings section modules.
 *
 * Defines SettingsTabPlugin (what the settings tab needs from the plugin) and
 * SettingsSectionContext (the object passed to every render* function).
 * Using narrow structural interfaces here instead of the concrete plugin class
 * avoids tight coupling and potential import cycles.
 */
import type { App, Plugin, PluginManifest } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { DeviceLocalStore } from "../../manager/DeviceLocalStore";
import type { CSSInjector } from "../../manager/CSSInjector";
import type { CustomCommandManager } from "../../editor/CustomCommandManager";
import type { FixedCommandId } from "../../editor/commands";
import type { OutlineDecorator } from "../../outline/OutlineDecorator";
import type { PackDataStore } from "../../icons/PackDataStore";
import type { LocaleStore } from "../../i18n/LocaleStore";
import type {
	CalloutIcon,
	CalloutRenderRole,
	PluginSettings,
} from "../../types";

export type SettingsTabPlugin = Plugin & {
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	outlineDecorator: OutlineDecorator;
	manifest: PluginManifest;
	settings: PluginSettings;
	pruneSuspended: boolean;
	/** Read for one thing only: whether this session is writing at all. */
	settingsWriter: { isFrozen: boolean };
	/** Per-device state — the settings-list fold, above all. */
	localState: DeviceLocalStore;
	onIconCacheChange(cb: () => void): () => void;
	schedulePruneUnusedFallbacks(delayMs?: number): void;
	addUnknownCalloutsAsFallback(unknownIds: string[]): number;
	/**
	 * Keep discovery from auto-creating rows for these ids for a few seconds —
	 * what makes an explicit delete stick while the open editors are still
	 * showing the text it just rewrote.
	 */
	suppressCalloutRediscovery(ids: string[]): void;
	saveSettings(): Promise<void>;
	refreshCallouts(): void;
	refreshRenderModes(): void;
	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;
	/** Icon sources and their downloadable artwork, for the picker. */
	icons: { packs: PackDataStore };
	/** Downloaded translations, for the language picker. */
	locales: Pick<LocaleStore, "isReady">;
	/** Download the saved language if needed; resolves to whether it is usable. */
	ensureLocale(): Promise<boolean>;
	/** Re-render the surfaces that snapshot translated text. */
	applyLocaleChange(): void;
	/** The user's own commands, and the sweep that keeps them registered. */
	customCommands: CustomCommandManager;
	/** Switch one of the six fixed commands on or off, and persist it. */
	setFixedCommandEnabled(id: FixedCommandId, enabled: boolean): Promise<void>;
	/**
	 * Whether a discovered row is one the last prune scan confirmed is written
	 * nowhere in the vault — the check that keeps stale ids out of any list the
	 * user picks a callout from.
	 */
	isKnownZeroUsageFallback(id: string): boolean;
	restyleUncustomizedFallbackRows(): number;
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	ensureIconArtworkFor(icons: readonly CalloutIcon[]): Promise<void>;
	runVaultScan(markFirstRun?: boolean): Promise<number>;
};

export type SettingsSectionContext = {
	app: App;
	plugin: SettingsTabPlugin;
	display: () => void;
	/**
	 * Register a cleanup callback tied to the current settings render. Run when
	 * the tab is hidden or re-displayed — sections use it to unload long-lived
	 * resources (e.g. a live-preview Component) instead of leaking them.
	 */
	registerDisposer: (dispose: () => void) => void;
};
