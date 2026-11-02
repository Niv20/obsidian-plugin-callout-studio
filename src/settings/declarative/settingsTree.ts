/**
 * settings/declarative/settingsTree.ts — the whole settings tab, as the tree
 * Obsidian draws: the main page's boxes, in order, each opening its pages.
 *
 * Who calls it. DeclarativeSettings (declarativeSettings.ts), for the tab's
 * `getSettingDefinitions()`.
 *
 * The main idea. This file only puts the parts in order; each part is built
 * in its own module:
 *
 *   (the notices)                          bannerRows.ts
 *   Callouts from your theme ›             calloutListPage.ts (its page
 *                                            starts with the switch for the
 *                                            theme's styles: themeStylesSwitch.ts)
 *   My callout types ›                     calloutPages.ts
 *   Built-in callouts ›                    calloutListPage.ts
 *   Default fallback callout               generalRows.ts
 *   Colors and icons
 *     Saved color palettes ›               palettesPage.ts
 *     Icon libraries (opens a window)      iconLibrariesRow.ts
 *   Global styling                         stylePages.ts
 *   Menus and commands                     menuPage.ts, commandsPage.ts
 *   Import and export, Danger zone         mainPageGroups.ts
 *   (the footer: language, About, links)   footerGroup.ts
 *
 * Every box of the finished tree, at every depth, also carries the plugin's own
 * box class ({@link markBoxes}), which styles.css keys the rules for the
 * plugin's rows on.
 */
import { t } from "../../i18n";
import { bannersGroup } from "./bannerRows";
import { builtInCalloutsPage, themeCalloutsPage } from "./calloutListPage";
import { myCalloutsPage } from "./calloutPages";
import { commandsPage } from "./commandsPage";
import { footerGroup } from "./footerGroup";
import { fallbackRow } from "./generalRows";
import { iconLibrariesRow } from "./iconLibrariesRow";
import { dangerZoneGroup, importExportGroup } from "./mainPageGroups";
import { menuPage } from "./menuPage";
import { palettesPage } from "./palettesPage";
import { PLUGIN_BOX_CLASS } from "./rowParts";
import { calloutStyleGroup } from "./stylePages";
import type { CsGroup, CsItem, CsRender, TreeContext } from "./types";

/** The ids of the main page's own boxes (the others are named in their modules). */
export const MAIN_PAGE_BOXES = {
	callouts: "callouts",
	colorsAndIcons: "colors-and-icons",
	menus: "menus-and-commands",
} as const;

/**
 * The tab's tree.
 *
 * @param visitRow A row with nothing on screen whose drawing tells the tab it
 *   is open (declarativeSettings.ts); it goes in the first box, which every
 *   opening of the tab draws.
 */
export function settingsTree(ctx: TreeContext, visitRow: CsRender): CsItem[] {
	const banners = bannersGroup(ctx);
	const tree: CsItem[] = [
		{ ...banners, items: [visitRow, ...(banners.items ?? [])] },
		calloutsBox(ctx),
		colorsAndIconsBox(ctx),
		calloutStyleGroup(ctx),
		menusBox(ctx),
		importExportGroup(ctx),
		dangerZoneGroup(ctx),
		footerGroup(ctx),
	];
	markBoxes(tree);
	return tree;
}

/** The first box: the three callout pages and the fallback. */
function calloutsBox(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: MAIN_PAGE_BOXES.callouts,
		// Its first row shows only with a theme that has callouts (or while the
		// switch for them is off); the class keeps the line between rows off the
		// first one shown (styles.css).
		cls: "cs-callouts-box",
		items: [
			themeCalloutsPage(ctx),
			myCalloutsPage(ctx),
			builtInCalloutsPage(ctx),
			fallbackRow(ctx),
		],
	};
}

/**
 * Colors and icons: what a callout is drawn from, apart from its own
 * definition. The saved palettes are a page, as ever; the icon libraries are a
 * row that opens the window Pick an icon opens too, so the one window has two
 * doors and no second copy on a page.
 */
function colorsAndIconsBox(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: MAIN_PAGE_BOXES.colorsAndIcons,
		heading: t("settings.colorsAndIcons"),
		items: [palettesPage(ctx), iconLibrariesRow(ctx)],
	};
}

/** Menus and commands: the right-click menu's page and the commands' page. */
function menusBox(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: MAIN_PAGE_BOXES.menus,
		heading: t("settings.menusAndCommands"),
		items: [menuPage(ctx), commandsPage(ctx)],
	};
}

/**
 * Give every box of `items` (groups and lists, at every depth, through the
 * pages that hold them) the plugin's box class, keeping any class it already
 * has. The tree is built anew each time it is asked for, so changing its
 * boxes in place alters nothing that lives on.
 */
function markBoxes(items: readonly CsItem[]): void {
	for (const item of items) {
		if ("type" in item && (item.type === "group" || item.type === "list")) {
			item.cls = item.cls ? `${item.cls} ${PLUGIN_BOX_CLASS}` : PLUGIN_BOX_CLASS;
		}
		if ("items" in item && item.items) markBoxes(item.items);
	}
}
