/**
 * settings/iconpicker/openIconLibraries.ts — open "Manage icon libraries"
 * from the settings page, not only from Pick an icon.
 *
 * Who calls it. The Manage icon libraries row of the declarative settings page
 * (declarative/mainPageGroups.ts), which exists so that searching the settings
 * for "icon" finds the window (decision 3 of the native-look plan).
 *
 * The main idea. The window normally opens from the icon picker, which has
 * already read the downloaded libraries back from disk and counted the icons in
 * each library. Opened from the settings, nothing has, so both happen here
 * first. No callout is being edited, so there is no unsaved icon to count.
 */
import { ICON_SOURCE_IDS, getSource } from "../../icons/registry";
import type { IconSourceId } from "../../types";
import { IconLibrariesModal, type IconLibrariesHost } from "./IconLibrariesModal";

/** What the window needs, less what this file works out itself. */
export type IconLibrariesPlugin = Omit<IconLibrariesHost, "countFor" | "editing">;

/** Open the window; resolves with whether anything changed once it closes. */
export async function openIconLibrariesWindow(plugin: IconLibrariesPlugin): Promise<boolean> {
	// A library downloaded in an earlier session reads as missing until its
	// file has been read back.
	await plugin.icons.packs.loadAllFromDisk();
	const counts = await countIconsPerLibrary();
	return new IconLibrariesModal({ ...plugin, countFor: (id) => counts.get(id) }).openAndWait();
}

/** How many icons each library offers; a library that cannot say is left out. */
async function countIconsPerLibrary(): Promise<Map<IconSourceId, number>> {
	const counts = new Map<IconSourceId, number>();
	for (const id of ICON_SOURCE_IDS) {
		try {
			const index = await getSource(id).loadIndex();
			counts.set(id, index.entries.length);
		} catch {
			// The window then shows no count for it, as the picker does.
		}
	}
	return counts;
}
