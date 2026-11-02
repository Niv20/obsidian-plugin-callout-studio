/**
 * settings/iconpicker/openIconLibraries.ts — the one way to open the
 * **Manage icon libraries** window.
 *
 * Who calls it. Pick an icon's **Manage libraries** button (IconPickerModal.ts)
 * and the settings' **Icon libraries** row (declarative/iconLibrariesRow.ts).
 *
 * The main idea. One window with two doors, and both go through here, so
 * neither can open it half ready. What every door must do first is the same:
 * read the pack files back from the disk. A library downloaded in an earlier
 * session reads as missing until its file has been read, and a window opened
 * before that would list a library the person already has under "to download".
 * (It reads only the packs not loaded yet, so a second call is cheap.)
 *
 * What differs is told by the caller. Pick an icon has the counts it has made
 * and the icon the callout editor holds unsaved (`editing`), which the
 * registry cannot know and which deleting a library has to account for. The
 * settings have neither: no editor is open behind them, which their row sees to.
 */
import type { EditedCallout } from "../../icons/iconLibraries";
import { IconLibrariesModal, type IconLibrariesHost } from "./IconLibrariesModal";

/** The plugin, as far as opening the window is concerned. */
export type IconLibrariesPlugin = Pick<
	IconLibrariesHost,
	"app" | "settings" | "saveSettings" | "settingsWriter" | "registry" | "icons"
>;

/** What a door tells the window beyond the plugin. */
export interface OpenIconLibrariesOptions {
	/** How many icons a library offers; the window shows no count without it. */
	countFor?: IconLibrariesHost["countFor"];
	/** The callout whose icon is being chosen, with the icon the editor holds. */
	editing?: EditedCallout;
	/**
	 * Called once the disk has been read, just before the window opens: the
	 * door takes what it shows here, to tell afterwards what the window changed.
	 * Returning false opens nothing (the door was closed while the disk was read).
	 */
	beforeOpen?: () => boolean;
}

/**
 * Open the window and resolve, once it closes, with whether anything changed.
 * Resolves false without opening when `beforeOpen` says not to.
 */
export async function openIconLibraries(
	plugin: IconLibrariesPlugin,
	options: OpenIconLibrariesOptions = {},
): Promise<boolean> {
	await plugin.icons.packs.loadAllFromDisk();
	if (options.beforeOpen && !options.beforeOpen()) return false;
	return new IconLibrariesModal({
		app: plugin.app,
		settings: plugin.settings,
		saveSettings: () => plugin.saveSettings(),
		settingsWriter: plugin.settingsWriter,
		registry: plugin.registry,
		icons: plugin.icons,
		countFor: options.countFor ?? (() => undefined),
		editing: options.editing,
	}).openAndWait();
}
