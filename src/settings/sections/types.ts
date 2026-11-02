/**
 * settings/sections/types.ts — the two types every settings module shares.
 *
 * - `SettingsTabPlugin`: the part of the plugin the settings may use. Written
 *   as its own type, not as the plugin class, so a test can hand over a small
 *   object with just these members, and so this folder never imports main.ts.
 * - `SettingsContext`: what a settings flow is handed to do its work.
 */
import type { SettingsAdoptionOptions } from "../../manager/settingsAdopt";
import type { App, Plugin, PluginManifest } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { DeviceLocalStore } from "../../manager/DeviceLocalStore";
import type { SettingsWriter } from "../../manager/SettingsWriter";
import type { SettingsRecoveryService } from "../../manager/settingsRecoveryService";
import type { CSSInjector } from "../../manager/CSSInjector";
import type { CustomCommandManager } from "../../editor/CustomCommandManager";
import type { FixedCommandId } from "../../editor/commands";
import type { OutlineDecorator } from "../../outline/OutlineDecorator";
import type { IconService } from "../../icons/IconService";
import type { LocaleStore } from "../../i18n/LocaleStore";
import type { ThemeCalloutsOff } from "../../manager/theme/themeCalloutsOff";
import type {
	CalloutDefinition,
	CalloutIcon,
	CalloutRenderRole,
	PluginSettings,
} from "../../types";

/** The plugin, as far as the settings are concerned (see the module header). */
export type SettingsTabPlugin = Plugin & {
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	outlineDecorator: OutlineDecorator;
	manifest: PluginManifest;
	settings: PluginSettings;
	settingsEditOpen: boolean;

	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed" | "matchesLastWrite" | "commit"> & Partial<Pick<SettingsWriter, "status" | "persists" | "openVisit">>;

	localState: DeviceLocalStore;
	onIconCacheChange(cb: () => void): () => void;

	saveSettings(): Promise<void>;
	retrySettingsRecovery?(options?: SettingsAdoptionOptions): Promise<boolean>;
	/** Earlier setups and the paused-saving actions; absent on minimal hosts. */
	recovery?: SettingsRecoveryService;
	startFreshSettings?(): Promise<boolean>;
	refreshCallouts(): void;
	refreshRenderModes(): void;
	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;

	/** The pack files, and deleting a whole library (the icon picker's Icon libraries window). */
	icons: Pick<IconService, "packs" | "deleteLibrary">;

	locales: Pick<LocaleStore, "isReady" | "state" | "onChange" | "prepare">;

	/** The switch that takes the theme's callout styling away; absent on minimal hosts. */
	themeCalloutsOff?: Pick<ThemeCalloutsOff, "ensure">;

	ensureLocale(): Promise<boolean>;

	applyLocaleChange(): void;

	customCommands: CustomCommandManager;

	setFixedCommandEnabled(id: FixedCommandId, enabled: boolean): Promise<void>;

	restyleUncustomizedFallbackRows(): number;
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	ensureIconArtworkFor(icons: readonly CalloutIcon[]): Promise<void>;
	runVaultScan(beforeSave?: () => Promise<void>): Promise<number>;
};

/**
 * What the settings' flows are handed: the rows, the ⋮ menu's actions, the
 * import, export and reset flows. The settings tab builds one
 * (declarative/declarativeSettings.ts); tests build small ones by hand.
 */
export type SettingsContext = {
	app: App;
	plugin: SettingsTabPlugin;
	/** Draw the settings again, after a change the pages must show. */
	redraw: () => void;
	/** Open My callout types and flash a callout's row (after a duplicate, say). */
	revealCallout?: (def: CalloutDefinition) => void;
	/** Run `dispose` when the user leaves the settings tab. */
	registerDisposer: (dispose: () => void) => void;
};
