import type { App, Plugin, PluginManifest } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { DeviceLocalStore } from "../../manager/DeviceLocalStore";
import type { SettingsWriter } from "../../manager/SettingsWriter";
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
	settingsEditOpen: boolean;

	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed" | "matchesLastWrite">;

	localState: DeviceLocalStore;
	onIconCacheChange(cb: () => void): () => void;

	saveSettings(): Promise<void>;
	refreshCallouts(): void;
	refreshRenderModes(): void;
	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;

	icons: { packs: PackDataStore };

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

	registerDisposer: (dispose: () => void) => void;
};
