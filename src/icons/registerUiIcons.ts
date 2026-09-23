import { addIcon, removeIcon, type Plugin } from "obsidian";
import { t } from "../i18n";
import { QUICK_INSERT_ICON_ID, UI_ICON_CONTENT } from "./uiIcons";

/** Register before any ribbon, command or restored view asks for these IDs. */
export function registerUiIcons(plugin: Plugin): void {
	for (const [id, content] of Object.entries(UI_ICON_CONTENT)) {
		// addIcon supplies the outer SVG with a 0 0 100 100 viewBox.
		addIcon(id, `<g transform="scale(${100 / 24})">${content}</g>`);
		plugin.register(() => removeIcon(id));
	}
}

/** Called after locale preparation; opens the same window as its command. */
export function registerQuickInsertRibbon(plugin: Plugin & { openQuickInsert(): void }): void {
	plugin.addRibbonIcon(QUICK_INSERT_ICON_ID, t("quickInsert.title"), () => {
		plugin.openQuickInsert();
	});
}
