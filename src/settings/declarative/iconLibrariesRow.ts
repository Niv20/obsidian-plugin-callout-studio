/**
 * settings/declarative/iconLibrariesRow.ts — the Icon libraries row of the
 * Colors and icons box.
 *
 * Who calls it. The settings tab, when it builds the main page
 * (settingsTree.ts).
 *
 * The main idea. The row is a door, not a page: its button opens the same
 * **Manage icon libraries** window that Pick an icon's **Manage libraries**
 * button opens (iconpicker/openIconLibraries.ts), so there is one window, one
 * set of rules, and nothing on the page behind it that could disagree with it.
 * Pick an icon keeps its own door, which is where a library is wanted most:
 * when the icon being looked for is not in the libraries the person has.
 * (A page of the settings was tried first; it could be reached only from the
 * picker, whose window covers the settings, and closing it would lose the icon
 * being chosen. A row on the settings has no such problem.)
 *
 * While a callout editor is open the row explains instead of opening the
 * window. The editor holds its icon unsaved, which the registry cannot see, so
 * deleting the library that icon came from would go unasked, and this door has
 * no way to learn the icon (Pick an icon hands it over). Nothing should be able
 * to reach the row with an editor on top; this is the cheap guard for the day
 * something does.
 *
 * The row searches under the libraries' own names (Tabler, Font Awesome, ...).
 * It has no end value: which libraries are on this device is per device, and
 * the window says it.
 */
import { t } from "../../i18n";
import type { IconSourceId } from "../../types";
import { openIconLibraries } from "../iconpicker/openIconLibraries";
import { loadSourceCounts } from "../iconpicker/sourceCounts";
import { buttonRow } from "./rowParts";
import type { CsRender, TreeContext } from "./types";

/** The row's id: it keys the row and names it in a jump, so it never changes. */
export const ICON_LIBRARIES_ROW = "icon-libraries";

/** Names, not words to translate: the libraries the row manages. */
const LIBRARY_NAMES = [
	"Lucide", "Tabler", "Material", "Emoji", "Octicons", "Font Awesome", "RPG Awesome", "Simple Icons",
];

/** Icon libraries: a name, a sentence, and the button that opens the window. */
export function iconLibrariesRow(ctx: TreeContext): CsRender {
	return buttonRow({
		id: ICON_LIBRARIES_ROW,
		name: t("iconLibraries.title"),
		desc: t("settings.iconLibrariesDesc"),
		aliases: LIBRARY_NAMES,
		buttonText: t("iconPicker.manageLibraries"),
		blockedReason: () => (ctx.plugin.settingsEditOpen ? t("settings.iconLibrariesEditorOpen") : null),
		registerIn: ctx.rows,
		// The promise keeps Obsidian's spinner on the button until the window
		// closes, which also keeps a second press from opening a second window
		// while the counts are still being made.
		onClick: () => openFromSettings(ctx),
	});
}

/** Count the icons, then open the window; resolves once it has closed. */
async function openFromSettings(ctx: TreeContext): Promise<void> {
	const counts = new Map<IconSourceId, number>();
	await loadSourceCounts(counts);
	await openIconLibraries(ctx.plugin, { countFor: (id) => counts.get(id) });
}
