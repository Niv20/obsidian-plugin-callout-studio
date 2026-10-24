/**
 * usage/occurrencesViewFrame.ts — the fixed parts of the Find callouts
 * sidebar, and its format filter.
 *
 * Who calls it. usage/CalloutOccurrencesView.ts, and the guide scenes.
 *
 * The main idea (finding S10-05). The pane is laid out as Obsidian's Search
 * pane is: the type field in a `.search-row`, then the count line
 * (ui/sidebarFrame.ts), then the results, which alone scroll. The format
 * filter is a button in the pane's nav header that opens Obsidian's menu with
 * a ✓ on the current choice, as Search's sort button does; the button stays
 * lit (`.is-active`) while a format is chosen. It used to be a second field
 * beside the type field.
 */
import { Menu } from "obsidian";
import { t } from "../i18n";
import { createSidebarSummary, createSidebarToolbar } from "../ui/sidebarFrame";
import type { CalloutRenderRole } from "../types";

export const OCCURRENCE_ROLES: CalloutRenderRole[] = ["heading", "inline", "regular"];
export const occurrenceRoleLabel = (role: CalloutRenderRole): string => t({
	regular: "vaultStats.roleBlock", heading: "vaultStats.roleHeading", inline: "vaultStats.roleInline",
}[role]);

export function occurrenceButton(container: HTMLElement, action: string, label: string): HTMLButtonElement {
	return container.createEl("button", { text: label, attr: { type: "button", "data-action": action } });
}

/** Stable controls let an in-progress picker search survive index updates. */
export function createOccurrencesFrame(content: HTMLElement) {
	const toolbar = createSidebarToolbar(content);
	const searchRow = toolbar.createDiv({ cls: "search-row" });
	const pickerHost = searchRow.createDiv({ cls: "cs-occurrences-picker" });
	const summary = createSidebarSummary(toolbar, "cs-occurrences-summary");
	const scroll = content.createDiv({ cls: "cs-occurrences-scroll" });
	const status = scroll.createDiv({ cls: "cs-occurrences-status", attr: { role: "status", "aria-live": "polite" } });
	const failures = scroll.createDiv({ cls: "cs-occurrences-failures" });
	const results = scroll.createDiv({ cls: "cs-occurrences-results" });
	return { pickerHost, summary, scroll, status, failures, results };
}
export type OccurrencesFrame = ReturnType<typeof createOccurrencesFrame>;

/**
 * Open the format menu under the nav header's filter button: All formats,
 * then each format, a ✓ on the current one.
 *
 * @param button The filter button; the menu belongs to it, so a second press
 *   closes it.
 * @param current The format shown now, or `undefined` for all of them.
 * @param onPick What choosing a format does (`undefined` = all formats).
 * @returns The menu, so the view can close it when it closes.
 */
export function openFormatMenu(
	button: HTMLElement,
	current: CalloutRenderRole | undefined,
	onPick: (role: CalloutRenderRole | undefined) => void,
): Menu {
	const menu = new Menu();
	// Obsidian's HTML menu, as every simple choice in the plugin opens, rather
	// than the system menu.
	menu.setUseNativeMenu(false);
	const choices: Array<{ role: CalloutRenderRole | undefined; label: string }> = [
		{ role: undefined, label: t("usage.allRoles") },
		...OCCURRENCE_ROLES.map((role) => ({ role, label: occurrenceRoleLabel(role) })),
	];
	for (const choice of choices) {
		menu.addItem((item) => item
			.setTitle(choice.label)
			.setChecked(choice.role === current)
			.onClick(() => onPick(choice.role)));
	}
	// Under the button, as Obsidian opens its own sort menu.
	const rect = button.getBoundingClientRect();
	menu.setParentElement(button).showAtPosition(
		{ x: rect.x, y: rect.bottom, width: rect.width, overlap: true, left: true },
		button.ownerDocument,
	);
	return menu;
}
