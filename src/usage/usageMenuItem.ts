import type { App, Menu } from "obsidian";
import { t } from "../i18n";
import { STATISTICS_ICON_ID } from "../icons/uiIcons";
import { getCalloutOccurrenceIndex } from "./occurrenceService";
import { openOccurrencesFromSettings } from "./openFromSettings";
import { onMenuHide } from "../ui/menuOnHide";

export interface UsageCount { fileCount: number; totalCount: number }

/** Observe the pass requested by prepareUsageMenu. Counts are never guesses. */
export function addUsageMenuItem(
	menu: Menu, app: App, ids: readonly string[],
): UsageCount | undefined {
	const index = getCalloutOccurrenceIndex(app);
	const usage = index.status === "ready" ? index.query(ids) : undefined;
	// DOM menus let a newly available count fade in without delaying opening.
	menu.setUseNativeMenu(false);
	let active = true;
	let unsubscribe = (): void => {};
	onMenuHide(menu, () => { active = false; unsubscribe(); });
	menu.addItem((item) => {
		let previousTitle: string | undefined;
		const update = (): void => {
			if (!active) return;
			const title = index.status === "ready"
				? t("usage.menuCount", { count: index.query(ids).totalCount })
				: t(index.status === "partial" ? "usage.menuIncomplete" : "usage.menu");
			if (title === previousTitle) return;
			const revealCount = index.status === "ready" && previousTitle === t("usage.menu");
			item.setTitle(revealCount ? fadeInUsageCount(title) : title);
			previousTitle = title;
		};
		item.setIcon(STATISTICS_ICON_ID).onClick(() => openOccurrencesFromSettings(app, ids));
		unsubscribe = index.subscribe(update);
		update();
	});
	return usage;
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
