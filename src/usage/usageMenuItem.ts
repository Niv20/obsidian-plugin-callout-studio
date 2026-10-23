import type { App, Menu, MenuItem } from "obsidian";
import { t } from "../i18n";
import { STATISTICS_ICON_ID } from "../icons/uiIcons";
import { getCalloutOccurrenceIndex } from "./occurrenceService";
import { openOccurrencesFromSettings } from "./openFromSettings";
import { onMenuHide } from "../ui/menuOnHide";
import { appendFaintCount } from "../ui/faintCount";
import { ROW_MENU_SECTION } from "../settings/sections/rowMenuSections";

export interface UsageCount { fileCount: number; totalCount: number }

/** Items in an open menu that only make sense while the callout is in use. */
interface UsageWatch { unused: () => boolean; items: MenuItem[] }
const watches = new WeakMap<Menu, UsageWatch>();

/** Observe the pass requested by prepareUsageMenu. Counts are never guesses. */
export function addUsageMenuItem(
	menu: Menu, app: App, ids: readonly string[],
): UsageCount | undefined {
	const index = getCalloutOccurrenceIndex(app);
	const usage = index.status === "ready" ? index.query(ids) : undefined;
	// Only a finished scan proves a callout unused; a partial one never does.
	const unused = (): boolean => index.status === "ready" && index.query(ids).fileCount === 0;
	const watch: UsageWatch = { unused, items: [] };
	watches.set(menu, watch);
	// DOM menus let a newly available count fade in without delaying opening.
	menu.setUseNativeMenu(false);
	let active = true;
	let unsubscribe = (): void => {};
	onMenuHide(menu, () => { active = false; unsubscribe(); watches.delete(menu); });
	menu.addItem((item) => {
		/** What the title last showed: "waiting", "incomplete" or the count. */
		let previous: string | undefined;
		const update = (): void => {
			if (!active) return;
			// Grey rather than gone: a count of 0 is still worth reading, and an
			// item that vanished under the pointer would move everything below it.
			const none = unused();
			item.setDisabled(none);
			for (const dependent of watch.items) dependent.setDisabled(none);
			const count = index.status === "ready" ? index.query(ids).totalCount : undefined;
			const shown = count !== undefined ? String(count)
				: index.status === "partial" ? "incomplete" : "waiting";
			if (shown === previous) return;
			if (count === undefined) {
				item.setTitle(t(index.status === "partial" ? "usage.menuIncomplete" : "usage.menu"));
			} else {
				// A count that arrives while the menu is open fades in.
				const arrivedWhileOpen = previous === "waiting";
				item.setTitle(usageTitle(count, arrivedWhileOpen));
			}
			previous = shown;
		};
		item.setSection(ROW_MENU_SECTION.find)
			.setIcon(STATISTICS_ICON_ID)
			.onClick(() => openOccurrencesFromSettings(app, ids));
		unsubscribe = index.subscribe(update);
		update();
	});
	return usage;
}

/**
 * Grey `item` out while this menu's count shows the callout unused, following
 * the count as it changes. A row offers *Replace in vault…* and *Convert uses
 * to plain text* while the count is still unknown; when it then lands on 0,
 * both would only open a window that changes nothing, or do nothing at all.
 * A menu without a usage item leaves `item` as it is.
 */
export function disableWhenUnused(menu: Menu, item: MenuItem): void {
	const watch = watches.get(menu);
	if (!watch) return;
	watch.items.push(item);
	item.setDisabled(watch.unused());
}

/**
 * "Find callouts" with its count, drawn as Obsidian draws a count: a small
 * faint number at the end of the row (`ui/faintCount.ts`), not "(12)".
 *
 * @param count How many times the callout is used in the vault.
 * @param fadeIn True when the count arrives after the menu opened, so the
 *   number fades in rather than popping into a menu the user is reading.
 */
function usageTitle(count: number, fadeIn: boolean): DocumentFragment {
	const fragment = createFragment();
	fragment.createSpan({ text: t("usage.menu") });
	const countEl = appendFaintCount(fragment, count);
	if (fadeIn) countEl.addClass("cs-usage-menu-count");
	return fragment;
}
