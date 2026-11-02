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
 *   Callouts from your theme ›             calloutListPage.ts
 *     Use your theme's callout styles      generalRows.ts
 *   My callout types ›, Add new callout    calloutPages.ts
 *   Built-in callouts ›                    calloutListPage.ts
 *   Default fallback callout, Language     generalRows.ts
 *   Callout style                          stylePages.ts (with palettesPage.ts)
 *   Menus and commands                     menuPage.ts, commandsPage.ts
 *   Import and export,
 *   Danger zone, About                     mainPageGroups.ts
 */
import { t } from "../../i18n";
import { bannersGroup } from "./bannerRows";
import { builtInCalloutsPage, themeCalloutsPage } from "./calloutListPage";
import { addCalloutRow, myCalloutsPage } from "./calloutPages";
import { commandsPage } from "./commandsPage";
import { fallbackRow, languageRows, themeStylesRow } from "./generalRows";
import { aboutGroup, dangerZoneGroup, importExportGroup } from "./mainPageGroups";
import { menuPage } from "./menuPage";
import { calloutStyleGroup } from "./stylePages";
import type { CsGroup, CsItem, CsRender, TreeContext } from "./types";

/** The ids of the main page's own boxes (the others are named in their modules). */
export const MAIN_PAGE_BOXES = { callouts: "callouts", menus: "menus-and-commands" } as const;

/**
 * The tab's tree.
 *
 * @param visitRow A row with nothing on screen whose drawing tells the tab it
 *   is open (declarativeSettings.ts); it goes in the first box, which every
 *   opening of the tab draws.
 */
export function settingsTree(ctx: TreeContext, visitRow: CsRender): CsItem[] {
	const banners = bannersGroup(ctx);
	return [
		{ ...banners, items: [visitRow, ...(banners.items ?? [])] },
		calloutsBox(ctx),
		calloutStyleGroup(ctx),
		menusBox(ctx),
		importExportGroup(ctx),
		dangerZoneGroup(ctx),
		aboutGroup(ctx),
	];
}

/** The first box: the three callout pages, adding a callout, the fallback and the language. */
function calloutsBox(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: MAIN_PAGE_BOXES.callouts,
		// Its first two rows show only with a theme that has callouts; the class
		// keeps the line between rows off the first one shown (styles.css).
		cls: "cs-callouts-box",
		items: [
			themeCalloutsPage(ctx),
			themeStylesRow(ctx),
			myCalloutsPage(ctx),
			addCalloutRow(ctx),
			builtInCalloutsPage(ctx),
			fallbackRow(ctx),
			...languageRows(ctx),
		],
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
