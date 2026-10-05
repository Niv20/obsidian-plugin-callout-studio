/**
 * utils/settingsMerge.ts — rebuilding `PluginSettings` from saved or imported
 * data.
 *
 * One responsibility, and not the registry's: `mergeSavedSettings` answers
 * "what does this possibly-partial, possibly-ancient settings blob mean under
 * the current version", which the registry's `load()` asks on startup and
 * `settingsValidator` asks of every import file. It lived inside
 * `manager/CalloutRegistry.ts` for as long as the registry was its only caller;
 * it has had its own test file (`tests/settingsMerge.test.ts`) for far longer
 * than that.
 *
 * Every field is merged explicitly against `DEFAULT_SETTINGS` — a new settings
 * field MUST be handled here (and added to `DEFAULT_SETTINGS`) or it will be
 * silently dropped on load.
 *
 * "Explicitly" reaches all the way down, and has to. The nested sections used
 * to be built by spreading the saved object over the defaults, which is total
 * in *shape* and blind to anything extra the file carried: a key the current
 * version knows nothing about rode straight through, and since settings are
 * written back wholesale by both `toSaveData()` and `exportToJSONv2()`, it was
 * then re-saved forever and copied into every export file made afterwards.
 * Retiring a field by `delete`ing it by name only worked for the one field
 * anybody remembered to name. Naming the fields that *stay* is what makes
 * `settingsValidator`'s "unknown fields are dropped" promise true at depth.
 * `globalStyle` is the one section deep enough to have its own module for that
 * (`globalStyleMerge.ts`); everything else is named here.
 */
import type {
	ContextMenuItemConfig,
	ContextMenuItemId,
	ContextMenuSettings,
	LegacyPopupSettings,
	PluginSettings,
} from "../types";
import { DEFAULT_CONTEXT_MENU_ITEMS, DEFAULT_SETTINGS } from "../constants";
import { sanitizeCustomPalettes } from "./paletteSanitize";
import { mergeGlobalStyle } from "./globalStyleMerge";
import { isCalloutSourceFilter } from "./calloutSearch";
import { booleanPreference, clampGlobalStyle, localePreference } from "./settingsGuards";
import { sanitizeUserImages } from "./userImages";
import { sanitizeCustomCommands } from "./customCommands";
import { mergeIconLibraries, mergeIconSources } from "./iconSourcesMerge";

/**
 * The three per-item booleans the context menu had until 1.2.2, when it became
 * an ordered per-role list of items. Written by every 1.x build (and, before
 * the menu was renamed, inside the `popup` block).
 */
interface LegacyMenuToggles {
	showEditCallout?: boolean;
	showOpenSettings?: boolean;
	showCopyMarkdown?: boolean;
}

export type LegacySavedSettings = Partial<PluginSettings> & {
	popup?: Partial<LegacyPopupSettings> & LegacyMenuToggles;
	contextMenu?: Partial<ContextMenuSettings> & LegacyMenuToggles;
};

/** Which menu item each 1.x boolean switched off. */
const LEGACY_MENU_TOGGLES: Record<keyof LegacyMenuToggles, ContextMenuItemId> =
	{
		showEditCallout: "edit",
		showOpenSettings: "openSettings",
		showCopyMarkdown: "copyMarkdown",
	};

/**
 * The 1.x booleans read as the item states they meant, `{}` for any file that
 * carries none of them.
 *
 * Without this an upgrade silently switched hidden items back on: nothing
 * mapped the old shape onto the new one, so the defaults were appended whole
 * and a vault that had turned "Copy markdown" off got it back. Small and
 * reversible, but it is a setting changed without the user asking.
 *
 * The state applies to every role, not just the block callout the booleans
 * were written for. Heading and inline callouts did not exist in 1.x, so
 * nobody expressed an opinion about their menus — and "I don't want an Edit
 * entry in the callout right-click menu" is the opinion that was expressed.
 */
function legacyMenuState(
	savedSettings: LegacySavedSettings,
): Partial<Record<ContextMenuItemId, boolean>> {
	const state: Partial<Record<ContextMenuItemId, boolean>> = {};
	// `popup` first so the later `contextMenu` block wins, matching how
	// `enabled` below prefers the newer of the two names.
	for (const source of [savedSettings.popup, savedSettings.contextMenu]) {
		if (!source) continue;
		for (const [key, id] of Object.entries(LEGACY_MENU_TOGGLES)) {
			const value = (source as Record<string, unknown>)[key];
			if (typeof value === "boolean") state[id] = value;
		}
	}
	return state;
}

/**
 * Merges a saved per-role menu item list against that role's defaults:
 * keeps the user's order, drops unknown ids and duplicates, and appends
 * items introduced by newer plugin versions at the end. Tolerates arbitrary
 * junk (saved data and import files are untrusted).
 *
 * `legacy` supplies the on/off state for an appended item, which is how a 1.x
 * file's three booleans reach the list — the list itself is what those files
 * do not have. An item the saved list names already carries its own state, so
 * the newer shape always wins where both exist.
 */
function mergeMenuItems(
	saved: unknown,
	defaults: ContextMenuItemConfig[],
	legacy: Partial<Record<ContextMenuItemId, boolean>>,
): ContextMenuItemConfig[] {
	const knownIds = new Set<string>(defaults.map((d) => d.id));
	const merged: ContextMenuItemConfig[] = [];
	if (Array.isArray(saved)) {
		for (const entry of saved) {
			if (!entry || typeof entry !== "object") continue;
			const id = (entry as { id?: unknown }).id;
			if (typeof id !== "string" || !knownIds.has(id)) continue;
			if (merged.some((m) => m.id === id)) continue;
			merged.push({
				id: id as ContextMenuItemId,
				enabled: (entry as { enabled?: unknown }).enabled !== false,
			});
		}
	}
	for (const def of defaults) {
		if (merged.some((m) => m.id === def.id)) continue;
		merged.push({ ...def, enabled: legacy[def.id] ?? def.enabled });
	}
	return merged;
}

/**
 * Rebuilds a complete PluginSettings object from possibly-partial/legacy
 * saved data. Every field is merged explicitly against DEFAULT_SETTINGS —
 * a new settings field MUST be handled here (and added to DEFAULT_SETTINGS)
 * or it will be silently dropped on load. Shared by the registry loader and
 * the settings importer (import/export v2).
 */
export function mergeSavedSettings(
	savedSettings: LegacySavedSettings,
): PluginSettings {
	const savedGlobal = savedSettings.globalStyle as
		Partial<PluginSettings["globalStyle"]> | undefined;
	const legacyPopup = savedSettings.popup;
	const savedMenuItems = savedSettings.contextMenu?.items;
	const legacyMenu = legacyMenuState(savedSettings);
	return {
		globalStyle: clampGlobalStyle(mergeGlobalStyle(savedGlobal)),
		contextMenu: {
			enabled:
				booleanPreference(savedSettings.contextMenu?.enabled,
					booleanPreference(legacyPopup?.enabled, DEFAULT_SETTINGS.contextMenu.enabled)),
			items: {
				regular: mergeMenuItems(
					savedMenuItems?.regular,
					DEFAULT_CONTEXT_MENU_ITEMS.regular,
					legacyMenu,
				),
				heading: mergeMenuItems(
					savedMenuItems?.heading,
					DEFAULT_CONTEXT_MENU_ITEMS.heading,
					legacyMenu,
				),
				inline: mergeMenuItems(
					savedMenuItems?.inline,
					DEFAULT_CONTEXT_MENU_ITEMS.inline,
					legacyMenu,
				),
			},
		},
		autocomplete: {
			// Autocomplete is a core editor feature now. Keep the persisted
			// compatibility shape for older builds, but never let an old saved
			// opt-out disable it in this one.
			enabled: true,
		},
		iconSources: mergeIconSources(savedSettings.iconSources),
		iconLibraries: mergeIconLibraries(savedSettings.iconLibraries),
		headingCallouts: {
			enabled:
				booleanPreference(savedSettings.headingCallouts?.enabled,
					DEFAULT_SETTINGS.headingCallouts.enabled),
			// Outline/link cleaning + icons are always on and no longer
			// user-configurable; ignore any saved-off value from old data.
			refCleanTitles: true,
			refShowIcon: true,
			showFoldArrow:
				booleanPreference(savedSettings.headingCallouts?.showFoldArrow,
					DEFAULT_SETTINGS.headingCallouts.showFoldArrow),
		},
		inlineCallouts: {
			enabled:
				booleanPreference(savedSettings.inlineCallouts?.enabled,
					DEFAULT_SETTINGS.inlineCallouts.enabled),
			allowContent:
				booleanPreference(savedSettings.inlineCallouts?.allowContent,
					DEFAULT_SETTINGS.inlineCallouts.allowContent),
		},
		welcomeSeen:
			booleanPreference(savedSettings.welcomeSeen, DEFAULT_SETTINGS.welcomeSeen ?? false),
		tutorialWelcomeSeen:
			booleanPreference(savedSettings.tutorialWelcomeSeen, DEFAULT_SETTINGS.tutorialWelcomeSeen ?? false),
		competitorImportBannerHandled:
			savedSettings.competitorImportBannerHandled === true,
		fallbackCalloutId:
			typeof savedSettings.fallbackCalloutId === "string"
				? savedSettings.fallbackCalloutId
				: DEFAULT_SETTINGS.fallbackCalloutId,
		language: localePreference(savedSettings.language),
		customPalettes: sanitizeCustomPalettes(savedSettings.customPalettes),
		userImages: sanitizeUserImages(savedSettings.userImages),
		customCommands: sanitizeCustomCommands(savedSettings.customCommands),
		disabledFixedCommands: Array.isArray(savedSettings.disabledFixedCommands)
			? [
					...new Set(
						savedSettings.disabledFixedCommands.filter(
							(id): id is string => typeof id === "string",
						),
					),
				]
			: [],
		// An unknown value is not corruption to report — it may come from a newer
		// build. "all" is the safe first-run/fallback state because it cannot make
		// the list look unexpectedly empty.
		quickInsertSource: isCalloutSourceFilter(savedSettings.quickInsertSource)
			? savedSettings.quickInsertSource
			: DEFAULT_SETTINGS.quickInsertSource,
	};
}
