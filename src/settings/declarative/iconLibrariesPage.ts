/**
 * settings/declarative/iconLibrariesPage.ts — the Icon libraries page of the
 * Colors and icons box.
 *
 * Who calls it. The settings tab, when it builds the main page
 * (settingsTree.ts).
 *
 * The main idea. The page shows the list that Pick an icon's **Manage
 * libraries** window shows, drawn by the same code
 * (iconpicker/IconLibrariesView.ts), so it is one list in two frames, never two
 * lists. The window stays with the picker, where a library is wanted most (when
 * the icon being looked for is not in the libraries the person has): the picker
 * and the callout editor under it are windows that cover the settings, so a
 * page could not serve them.
 *
 * The page draws itself (`page: () => new IconLibrariesPage(ctx)`): its rows
 * drag, slide and follow a download as it runs, and Obsidian drawing the page
 * again row by row would undo all three. The cost is the settings search,
 * which finds the page by its name only, not by the libraries' own names.
 *
 * Opening the page does what the window's opener does first
 * (iconpicker/openIconLibraries.ts), and counts the icons as well: it reads the
 * pack files back from the disk, so a library downloaded in an earlier session
 * is not listed under "to download", and counts every library's icons, and
 * only then draws.
 *
 * No editor is open behind the settings, but in Obsidian 1.14 the settings are
 * a window of their own, and an editor can be opened beside them from a note.
 * The page cannot see that editor's unsaved icon, so while one is open it
 * deletes no library and says why (`editorOpen`, in the list).
 */
import { SettingPage } from "obsidian";
import { t } from "../../i18n";
import { availableCount } from "../../icons/iconLibraries";
import type { IconSourceId } from "../../types";
import { scrollParentOf } from "../../ui/foldAnchor";
import { IconLibrariesView } from "../iconpicker/IconLibrariesView";
import { loadSourceCounts } from "../iconpicker/sourceCounts";
import type { SettingsTabPlugin } from "../sections/types";
import type { CsPage, TreeContext } from "./types";

/** The page's id: it keys the row that opens it, and names it in a page path. */
export const ICON_LIBRARIES_PAGE = "icon-libraries";

/**
 * The row that opens the page: its name, and at its end how many libraries
 * Pick an icon offers out of all of them, as Saved color palettes above it
 * ends with its count.
 */
export function iconLibrariesPage(ctx: TreeContext): CsPage {
	const value = iconLibrariesValue(ctx.plugin);
	return {
		type: "page",
		id: ICON_LIBRARIES_PAGE,
		name: t("iconLibraries.title"),
		...(value === undefined ? {} : { displayValue: value }),
		page: () => new IconLibrariesPage(ctx),
	};
}

/**
 * "3 of 9 available", or "All 9 available" once nothing is left to download or
 * show; undefined (nothing drawn) until the pack folder has been looked at,
 * which happens in the background at startup, long before the settings open.
 *
 * Per device, like the page it opens: the order and what was hidden sync, the
 * downloaded files do not. The settings tab's signature reads this too, so a
 * download, a deletion or the look itself draws the row again only when the
 * text changes (declarativeSettings.ts).
 */
export function iconLibrariesValue(plugin: Pick<SettingsTabPlugin, "settings" | "icons">): string | undefined {
	const { packs } = plugin.icons;
	const count = availableCount(plugin.settings.iconLibraries, (file) => packs.isOnDevice(file));
	if (!count) return undefined;
	return count.available === count.total
		? t("settings.iconLibrariesAll", { total: count.total })
		: t("settings.iconLibrariesCount", { available: count.available, total: count.total });
}

/** The page, which draws the list of libraries itself. */
export class IconLibrariesPage extends SettingPage {
	/** Bumped on every opening and when the page is left, so a late disk read draws nothing. */
	private generation = 0;
	/** The list on the page; null until it is drawn, and once the page is left. */
	private view: IconLibrariesView | null = null;

	constructor(private readonly ctx: TreeContext) {
		super();
	}

	/** Obsidian opened the page: read the disk and count, then draw the list. */
	display(): void {
		// A page opened a second time starts clean.
		this.hide();
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("cs-icon-libraries", "cs-icon-libraries-page");
		void this.draw(++this.generation);
	}

	/**
	 * Obsidian left the page: take the list away. A deletion under way goes on
	 * by itself, and nothing here waits for it.
	 */
	hide(): void {
		this.generation++;
		void this.view?.close();
		this.view = null;
	}

	private async draw(generation: number): Promise<void> {
		const { plugin } = this.ctx;
		const isCurrent = (): boolean => generation === this.generation;
		const counts = new Map<IconSourceId, number>();
		await Promise.all([plugin.icons.packs.loadAllFromDisk(), loadSourceCounts(counts, isCurrent)]);
		if (!isCurrent()) return;
		const view = new IconLibrariesView({
			app: plugin.app,
			settings: plugin.settings,
			saveSettings: () => plugin.saveSettings(),
			settingsWriter: plugin.settingsWriter,
			registry: plugin.registry,
			icons: plugin.icons,
			countFor: (id) => counts.get(id),
			editorOpen: () => plugin.settingsEditOpen,
		});
		this.view = view;
		view.open({
			containerEl: this.containerEl,
			descClass: "setting-page-desc",
			// The settings pane scrolls the page, under its sticky title bar.
			scroller: () => scrollParentOf(this.containerEl),
			coveredTop: () => this.titlebarEl.offsetHeight || 0,
		});
	}
}
