/**
 * settings/menuItems.ts — the right-click menu's items as the settings show
 * and change them.
 *
 * Who calls it. The Customize right-click menu settings page
 * (declarative/menuPage.ts), and the version comparison
 * (recoveryCollections.ts), which names the items the same way.
 *
 * The main idea. Each role keeps an ordered list of `{ id, enabled }`
 * (`settings.contextMenu.items[role]`). The items that are on come first, in
 * the order the menu shows them; the ones that are off follow. The functions
 * here change that list and keep that order, so the window and the page cannot
 * disagree about where an item goes.
 */
import { DEFAULT_CONTEXT_MENU_ITEMS } from "../constants";
import type { CalloutRenderRole, ContextMenuItemConfig, ContextMenuItemId } from "../types";

/** i18n key for each menu item's label. Also names the entries in the setup comparison. */
export const ITEM_LABEL_KEY: Record<ContextMenuItemId, string> = {
	// `edit` is the stable persisted id; at runtime it creates unknown tokens.
	edit: "menuItem.createOrEdit",
	openSettings: "menuItem.openSettings",
	copyMarkdown: "menuItem.copyMarkdown",
	foldDefaults: "menuItem.foldDefaults",
	cutSection: "menuItem.cutSection",
	copySection: "menuItem.copySection",
	deleteSection: "menuItem.deleteSection",
};

/**
 * Each menu item's icon in the settings: the one the menu itself shows
 * (editor/contextmenu/items.ts). The fold item shows a different icon per
 * state there, so it has one of its own here.
 */
export const ITEM_ICON: Record<ContextMenuItemId, string> = {
	edit: "pencil",
	openSettings: "settings",
	copyMarkdown: "clipboard-copy",
	foldDefaults: "chevrons-down-up",
	cutSection: "scissors",
	copySection: "clipboard-copy",
	deleteSection: "trash-2",
};

/**
 * Turn `item` on or off, and move it to where the list keeps it: off to the
 * very end, on to just after the last item that is on.
 */
export function setMenuItemEnabled(
	items: ContextMenuItemConfig[],
	item: ContextMenuItemConfig,
	enabled: boolean,
): void {
	item.enabled = enabled;
	const from = items.indexOf(item);
	if (from !== -1) items.splice(from, 1);
	if (!enabled) {
		items.push(item);
		return;
	}
	let lastEnabled = -1;
	items.forEach((other, index) => {
		if (other.enabled) lastEnabled = index;
	});
	items.splice(lastEnabled + 1, 0, item);
}

/**
 * Move the item at `from` to `to`. The items that are on come first, so a
 * place among them is the same place in the whole list.
 */
export function moveMenuItem(items: ContextMenuItemConfig[], from: number, to: number): void {
	const [moved] = items.splice(from, 1);
	if (moved) items.splice(to, 0, moved);
}

/**
 * `role`'s items as shipped. Copies, the list and each item: later changes
 * must never touch the shipped defaults or another role's saved layout.
 */
export function defaultMenuItems(role: CalloutRenderRole): ContextMenuItemConfig[] {
	return DEFAULT_CONTEXT_MENU_ITEMS[role].map((item) => ({ ...item }));
}

/** Whether `items` are `role`'s items as shipped: the same ones, in order, on or off alike. */
export function isMenuRoleDefault(items: readonly ContextMenuItemConfig[], role: CalloutRenderRole): boolean {
	const defaults = DEFAULT_CONTEXT_MENU_ITEMS[role];
	return (
		items.length === defaults.length &&
		items.every((item, index) => item.id === defaults[index]?.id && item.enabled === defaults[index]?.enabled)
	);
}
