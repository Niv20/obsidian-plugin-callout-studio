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
import type {
	CalloutDefinition,
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
	settingsEditOpen: boolean;

	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed" | "matchesLastWrite" | "commit"> & Partial<Pick<SettingsWriter, "status" | "persists">>;

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

	locales: Pick<LocaleStore, "isReady">;

	ensureLocale(): Promise<boolean>;

	applyLocaleChange(): void;

	customCommands: CustomCommandManager;

	setFixedCommandEnabled(id: FixedCommandId, enabled: boolean): Promise<void>;

	restyleUncustomizedFallbackRows(): number;
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	ensureIconArtworkFor(icons: readonly CalloutIcon[]): Promise<void>;
	runVaultScan(): Promise<number>;
};

export type SettingsSectionContext = {
	app: App;
	plugin: SettingsTabPlugin;
	display: () => void;
	/** Reveal a newly created row even when it sorts beyond the first page. */
	revealCallout?: (def: CalloutDefinition) => void;

	registerDisposer: (dispose: () => void) => void;
};
