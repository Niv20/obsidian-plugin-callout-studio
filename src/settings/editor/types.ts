import type { App } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { SettingsWriter } from "../../manager/SettingsWriter";
import type { CSSInjector } from "../../manager/CSSInjector";
import type { PackDataStore } from "../../icons/PackDataStore";
import type {
	CalloutIcon,
	CalloutRenderRole,
	PluginSettings,
} from "../../types";

export interface CalloutEditorPlugin {
	app: App;
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	settings: PluginSettings;
	settingsEditOpen: boolean;
	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed" | "matchesLastWrite">;
	saveSettings(): Promise<void>;

	refreshCallouts(): void;
	refreshRenderModes(): void;
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;

	icons: { packs: PackDataStore };

	customCommands: {
		migrateCalloutId(oldId: string, newId: string): void;
	};
}
