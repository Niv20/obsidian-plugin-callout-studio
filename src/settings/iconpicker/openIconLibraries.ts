/**
 * settings/iconpicker/openIconLibraries.ts — the way to open the
 * **Manage icon libraries** window.
 *
 * Who calls it. Pick an icon's **Manage libraries** button (IconPickerModal.ts).
 * The settings show the same list as a page (declarative/iconLibrariesPage.ts),
 * which does the same first step itself.
 *
 * The main idea. The window must not open half ready, and the first step is
 * to read the pack files back from the disk. A library downloaded in an
 * earlier session reads as missing until its file has been read, and a window
 * opened before that would list a library the person already has under "to
 * download". (It reads only the packs not loaded yet, so a second call is
 * cheap.)
 *
 * What the window cannot know is told by the caller: the counts Pick an icon
 * has made, and the icon the callout editor holds unsaved (`editing`), which
 * the registry cannot know and which deleting a library has to account for.
 */
import type { EditedCallout } from "../../icons/iconLibraries";
import { IconLibrariesModal } from "./IconLibrariesModal";
import type { IconLibrariesHost } from "./IconLibrariesView";

/** The plugin, as far as opening the window is concerned. */
export type IconLibrariesPlugin = Pick<
	IconLibrariesHost,
	"app" | "settings" | "saveSettings" | "settingsWriter" | "registry" | "icons"
>;

/** What the caller tells the window beyond the plugin. */
export interface OpenIconLibrariesOptions {
	/** How many icons a library offers; the window shows no count without it. */
	countFor?: IconLibrariesHost["countFor"];
	/** The callout whose icon is being chosen, with the icon the editor holds. */
	editing?: EditedCallout;
	/**
	 * Called once the disk has been read, just before the window opens: the
	 * caller takes what it shows here, to tell afterwards what the window
	 * changed. Returning false opens nothing (the caller was closed while the
	 * disk was read).
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
