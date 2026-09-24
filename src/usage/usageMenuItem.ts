import type { App, Menu } from "obsidian";
import { t } from "../i18n";
import { STATISTICS_ICON_ID } from "../icons/uiIcons";
import { getCalloutOccurrenceIndex } from "./occurrenceService";
import { openOccurrencesFromSettings } from "./openFromSettings";

export interface UsageCount { fileCount: number; totalCount: number }

/** The menu stays usable while the first index pass runs. Counts are never guesses. */
export function addUsageMenuItem(
	menu: Menu, app: App, ids: readonly string[],
): UsageCount | undefined {
	const index = getCalloutOccurrenceIndex(app);
	const usage = index.status === "ready" ? index.query(ids) : undefined;
	// DOM menus allow the label to update while a first scan is running.
	menu.setUseNativeMenu(false);
	let active = true;
	let unsubscribe = (): void => {};
	menu.onHide(() => { active = false; unsubscribe(); });
	menu.addItem((item) => {
		const update = (): void => {
			if (!active) return;
			const result = index.query(ids);
			const title = index.status === "ready"
				? t("usage.menuCount", { count: result.totalCount })
				: t(index.status === "partial" ? "usage.menuIncomplete" : "usage.menuLoading");
			item.setTitle(title).setIcon(STATISTICS_ICON_ID);
		};
		item.onClick(() => openOccurrencesFromSettings(app, ids));
		unsubscribe = index.subscribe(update);
		update();
	});
	if (index.status !== "ready") void index.ensureFresh().catch(() => {
		// The view shows read failures; later source changes retry automatically.
	});
	return usage;
}
