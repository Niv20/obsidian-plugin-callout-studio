/**
 * settings/iconpicker/sourceCounts.ts — how many icons each library offers.
 *
 * Who calls it. Pick an icon (IconPickerModal.ts), which counts in the
 * background while it opens, and the settings' Icon libraries row
 * (declarative/iconLibrariesRow.ts), which counts before it opens the window.
 *
 * The main idea. Every library describes itself with an index that ships with
 * the plugin, so counting is offline. A library whose index cannot be read has
 * no count - the menu and the window then show none - rather than a wrong one.
 */
import type { IconSourceId } from "../../types";
import { ICON_SOURCE_IDS, getSource } from "../../icons/registry";

/**
 * Count the icons of every library into `counts`, one library at a time.
 *
 * @param isCurrent Asked after each library; false stops the counting (the
 *   picker was closed in the meantime).
 * @returns Whether it ran to the end.
 */
export async function loadSourceCounts(
	counts: Map<IconSourceId, number>,
	isCurrent: () => boolean = () => true,
): Promise<boolean> {
	for (const id of ICON_SOURCE_IDS) {
		try {
			const index = await getSource(id).loadIndex();
			if (!isCurrent()) return false;
			counts.set(id, index.entries.length);
		} catch (e) {
			if (!isCurrent()) return false;
			// A source that cannot describe itself simply shows no count.
			console.warn(`[CalloutStudio] could not count icons in "${id}"`, e);
		}
	}
	return true;
}
