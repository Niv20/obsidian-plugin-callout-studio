/**
 * settings/editor/types.ts — Narrow plugin interface required by the editor sub-modules.
 *
 * Defines CalloutEditorPlugin: a structural interface with only the properties
 * and methods that CalloutEditor, CalloutEditorSave, CalloutEditorValidation,
 * and CalloutEditorIconRenderer actually need. Using this interface instead of
 * the concrete plugin class breaks circular import chains.
 */
import type { App } from "obsidian";
import type { CalloutRegistry } from "../../manager/CalloutRegistry";
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
	pruneSuspended: boolean;
	saveSettings(): Promise<void>;
	/**
	 * Re-inject the CSS and re-render open notes. Needed by the theme callout
	 * preview, which shares this interface: nudging a heading icon changes the
	 * emitted `.cs-*` rules, and Reading view keeps baked DOM.
	 */
	refreshCallouts(): void;
	refreshRenderModes(): void;
	schedulePruneUnusedFallbacks(delayMs?: number): void;
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;
	/** Icon sources and their downloadable artwork, for the picker. */
	icons: { packs: PackDataStore };
	/**
	 * Only the one method the save path needs: an id change here is a remove
	 * plus an add, which nothing downstream can tell apart from a delete, so
	 * the user's commands have to be pointed at the new id explicitly.
	 */
	customCommands: {
		migrateCalloutId(oldId: string, newId: string): void;
	};
}
