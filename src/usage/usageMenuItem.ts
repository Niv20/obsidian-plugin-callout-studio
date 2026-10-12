import type { App, Menu, MenuItem } from "obsidian";
import { t } from "../i18n";
import { STATISTICS_ICON_ID } from "../icons/uiIcons";
import { getCalloutOccurrenceIndex } from "./occurrenceService";
import { openOccurrencesFromSettings } from "./openFromSettings";
import { onMenuHide } from "../ui/menuOnHide";
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
		let previousTitle: string | undefined;
		const update = (): void => {
			if (!active) return;
			// Grey rather than gone: "(0)" is still worth reading, and an item
			// that vanished under the pointer would move everything below it.
			const none = unused();
			item.setDisabled(none);
			for (const dependent of watch.items) dependent.setDisabled(none);
			const title = index.status === "ready"
				? t("usage.menuCount", { count: index.query(ids).totalCount })
				: t(index.status === "partial" ? "usage.menuIncomplete" : "usage.menu");
			if (title === previousTitle) return;
			const revealCount = index.status === "ready" && previousTitle === t("usage.menu");
			item.setTitle(revealCount ? fadeInUsageCount(title) : title);
			previousTitle = title;
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

/** Preserve translated ordering and punctuation; only the added count fades. */
function fadeInUsageCount(title: string): string | DocumentFragment {
	const label = t("usage.menu");
	const position = title.indexOf(label);
	if (position < 0) return title;
	const fragment = createFragment();
	const before = title.slice(0, position);
	const after = title.slice(position + label.length);
	if (before) fragment.createSpan({ text: before, cls: "cs-usage-menu-count" });
	fragment.createSpan({ text: label });
	if (after) fragment.createSpan({ text: after, cls: "cs-usage-menu-count" });
	return fragment;
}
