/**
 * settings/declarative/menuPage.ts — the Customize right-click menu settings
 * page.
 *
 * Who calls it. The settings tab, for the main page's Menus and commands box
 * ({@link menuPage}).
 *
 * The main idea. The page is laid out like Obsidian's own Ribbon settings:
 * for each callout role (heading, inline, block) two of Obsidian's lists:
 * - the items the role's menu shows, in their order, each with its icon, a
 *   drag handle (and Alt+↑/↓) to move it and ✕ to hide it, and ↺ in the
 *   heading that puts the role's menu back as shipped, shown only while the
 *   menu differs from it;
 * - "Hidden from the … menu", the items it hides, shown only while there are
 *   some. A press on one brings it back, at the end of the menu.
 * Each hidden list's heading names its role, so no two boxes share a key
 * (finding M6).
 *
 * The rows are plain rows, because Obsidian draws an icon only on those, and
 * the settings search finds the page by its name but none of its rows
 * (decision 12). Every change goes through menuItems.ts, as the window's do,
 * and is saved at once. While saving is paused nothing changes: a drag puts
 * the row back, and ✕, a hidden item and ↺ say why.
 */
import { t, type LocaleKey } from "../../i18n";
import type { CalloutRenderRole, ContextMenuItemConfig } from "../../types";
import { paintResetIdle } from "../../ui/resetArrow";
import {
	defaultMenuItems,
	isMenuRoleDefault,
	ITEM_ICON,
	ITEM_LABEL_KEY,
	moveMenuItem,
	setMenuItemEnabled,
} from "../menuItems";
import { refuseWhilePaused } from "./pausedGuards";
import { boxResetButton, pageIntroBox } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsAction, CsEmpty, CsGroup, CsList, CsPage, CsRender, TreeContext } from "./types";

/** The ids of the page and its box that is not seen. */
export const MENU_PAGE = { page: "right-click-menu", intro: "menu-intro" } as const;

/** The roles, in the order the page shows them. */
const ROLES: CalloutRenderRole[] = ["heading", "inline", "regular"];

/** Each role's two headings: its menu, and what its menu hides. */
const ROLE_HEADINGS: Record<CalloutRenderRole, { shown: LocaleKey; hidden: LocaleKey }> = {
	heading: { shown: "menuCustomize.heading", hidden: "menuCustomize.hiddenHeading" },
	inline: { shown: "menuCustomize.inline", hidden: "menuCustomize.hiddenInline" },
	regular: { shown: "menuCustomize.regular", hidden: "menuCustomize.hiddenRegular" },
};

/** The row that opens the page, and the page. */
export function menuPage(ctx: TreeContext): CsPage {
	return {
		type: "page",
		id: MENU_PAGE.page,
		name: t("menuCustomize.title"),
		desc: t("settings.customizeMenuDesc"),
		items: [introBox(ctx), ...ROLES.flatMap((role) => [shownList(ctx, role), hiddenList(ctx, role)])],
	};
}

/**
 * A box that is not seen, holding a row that draws nothing but repaints the
 * ↺s (see {@link paintRoleResets}).
 */
function introBox(ctx: TreeContext): CsGroup {
	return { ...pageIntroBox(MENU_PAGE.intro), items: [repaintResetsRow(ctx)] };
}

/**
 * A row with nothing on screen whose drawing paints each role's ↺. Obsidian
 * draws a row every time it draws the page, so this catches what
 * {@link saveMenu} cannot see: a change that arrived from another device. The
 * menus' own rows are plain and cannot do it, and a row added to a list would
 * count as one of its items (Alt+↓ on the last item would move it onto it), so
 * it lives in this box.
 */
function repaintResetsRow(ctx: TreeContext): CsRender {
	return {
		id: "menu-resets-repaint",
		name: "",
		searchable: false,
		visible: false,
		render: guardRender("menu reset arrows", () => paintRoleResets(ctx)),
	};
}

/* ---- ↺ in each menu's heading ---- */

/**
 * Each role's ↺ element, kept per tab.
 *
 * Obsidian makes a box's heading buttons once, when it first draws the box,
 * from the tree that drew it. Every later redraw brings a new tree whose own
 * `extraButtons` are never called, so a variable inside the tree's builder
 * cannot hand the arrow to the next tree. The tab's context is the one thing
 * every tree shares, so the arrows are kept under it. (A `WeakMap` lets an
 * entry go when its tab does.)
 */
const roleResets = new WeakMap<TreeContext, Map<CalloutRenderRole, HTMLElement>>();

/** Keep `role`'s ↺ for the repaints to come, and paint it for the menu as it is now. */
function keepRoleReset(ctx: TreeContext, role: CalloutRenderRole, resetEl: HTMLElement): void {
	let arrows = roleResets.get(ctx);
	if (!arrows) {
		arrows = new Map();
		roleResets.set(ctx, arrows);
	}
	arrows.set(role, resetEl);
	paintRoleReset(ctx, role, resetEl);
}

/** Show `role`'s ↺ only while its menu differs from the shipped one. */
function paintRoleReset(ctx: TreeContext, role: CalloutRenderRole, resetEl: HTMLElement): void {
	paintResetIdle(resetEl, isMenuRoleDefault(itemsOf(ctx, role), role));
}

/** Paint every role's ↺ from the live settings. */
function paintRoleResets(ctx: TreeContext): void {
	for (const [role, resetEl] of roleResets.get(ctx) ?? []) paintRoleReset(ctx, role, resetEl);
}

/** `role`'s items now, read from the live settings every time. */
function itemsOf(ctx: TreeContext, role: CalloutRenderRole): ContextMenuItemConfig[] {
	return ctx.plugin.settings.contextMenu.items[role];
}

/** Save the menu, paint the ↺s for it at once, and draw the page again to show it. */
function saveMenu(ctx: TreeContext): void {
	void ctx.plugin.saveSettings();
	paintRoleResets(ctx);
	ctx.redraw();
}

/** The items `role`'s menu shows: each with its handle and ✕, and ↺ in the heading. */
function shownList(ctx: TreeContext, role: CalloutRenderRole): CsList {
	const writer = ctx.plugin.settingsWriter;
	const shown = itemsOf(ctx, role).filter((item) => item.enabled);
	const heading = t(ROLE_HEADINGS[role].shown);
	return {
		type: "list",
		id: `menu-${role}`,
		heading,
		extraButtons: [
			boxResetButton(
				writer,
				heading,
				() => {
					if (isMenuRoleDefault(itemsOf(ctx, role), role)) return;
					ctx.plugin.settings.contextMenu.items[role] = defaultMenuItems(role);
					saveMenu(ctx);
				},
				(resetEl) => keepRoleReset(ctx, role, resetEl),
			),
		],
		// ✕ hides the item: it moves to the role's hidden list. The rows are
		// the items that are on, in order, so the index is a place among them
		// (looked up in the live settings, which another device may have
		// replaced since the page was drawn).
		onDelete: refuseWhilePaused(writer, (index: number) => {
			const items = itemsOf(ctx, role);
			const item = items.filter((other) => other.enabled)[index];
			if (!item) return;
			setMenuItemEnabled(items, item, false);
			saveMenu(ctx);
		}),
		onReorder: refuseWhilePaused(
			writer,
			(from: number, to: number) => {
				moveMenuItem(itemsOf(ctx, role), from, to);
				saveMenu(ctx);
			},
			// Obsidian has moved the row already: drawing again puts it back.
			() => ctx.redraw(),
		),
		items: shown.map((item) => itemRow(role, item)),
	};
}

/** One item the menu shows: its icon and its name (Obsidian adds the handle and ✕). */
function itemRow(role: CalloutRenderRole, item: ContextMenuItemConfig): CsEmpty {
	return {
		id: `menu-${role}-${item.id}`,
		name: t(ITEM_LABEL_KEY[item.id]),
		icon: ITEM_ICON[item.id],
		searchable: false,
	};
}

/** The items `role`'s menu hides; a press brings one back. Shown only while there are some. */
function hiddenList(ctx: TreeContext, role: CalloutRenderRole): CsList {
	const writer = ctx.plugin.settingsWriter;
	return {
		type: "list",
		id: `menu-${role}-hidden`,
		heading: t(ROLE_HEADINGS[role].hidden),
		visible: () => itemsOf(ctx, role).some((item) => !item.enabled),
		items: itemsOf(ctx, role)
			.filter((item) => !item.enabled)
			.map((item): CsAction => ({
				id: `menu-${role}-hidden-${item.id}`,
				name: t(ITEM_LABEL_KEY[item.id]),
				icon: ITEM_ICON[item.id],
				searchable: false,
				action: refuseWhilePaused(writer, () => {
					// Found again by id, in the live settings.
					const items = itemsOf(ctx, role);
					const live = items.find((other) => other.id === item.id);
					if (!live) return;
					setMenuItemEnabled(items, live, true);
					saveMenu(ctx);
				}),
			})),
	};
}
