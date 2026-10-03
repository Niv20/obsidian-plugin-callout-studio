import type { SettingsAdoptionOptions } from "../../manager/settingsAdopt";
import type { App } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
import type { SettingsWriter } from "../../manager/SettingsWriter";
import type { CSSInjector } from "../../manager/CSSInjector";
import type { IconService } from "../../icons/IconService";
import type {
	CalloutIcon,
	CalloutRenderRole,
	PluginSettings,
} from "../../types";

export interface CalloutEditorOptions {
	seedDisplayName?: string;
	/** A normalized token id to preserve verbatim while creating. */
	seedCalloutId?: string;
	/** The callout token already exists in a note (autocomplete or context menu). */
	createFromToken?: boolean;
}

export interface CalloutEditorPlugin {
	app: App;
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	settings: PluginSettings;
	settingsEditOpen: boolean;
	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed" | "matchesLastWrite"> & Partial<Pick<SettingsWriter, "status">>;
	saveSettings(): Promise<void>;
	retrySettingsRecovery?(options?: SettingsAdoptionOptions): Promise<boolean>;
	startFreshSettings?(): Promise<boolean>;

	refreshCallouts(): void;
	refreshRenderModes(): void;
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;

	/** Handed on to the icon picker, whose Icon libraries window deletes libraries. */
	icons: Pick<IconService, "packs" | "deleteLibrary">;

	customCommands: {
		migrateCalloutId(oldId: string, newId: string): void;
	};
}
