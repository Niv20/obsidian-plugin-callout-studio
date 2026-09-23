/**
 * settings/quickInsertToolbar.ts — the quick-insert window's search and filter.
 *
 * The two controls above the list, split out for the same reason the row is:
 * they own no state, only the widgets that report it. What a query means and
 * which source is stored stay with the window.
 */
import { t } from "../i18n";
import { SelectDropdown } from "../ui/selectDropdown";
import {
	isCalloutSourceFilter,
	type CalloutSourceFilter,
} from "../utils/calloutSearch";

export interface QuickInsertToolbarHandlers {
	/** The filter to show as selected: All initially, then the remembered choice. */
	filter: CalloutSourceFilter;
	/** Active theme name, or the localized generic fallback. */
	themeLabel: string;
	onQuery: (query: string) => void;
	onFilter: (filter: CalloutSourceFilter) => void;
	/** Arrow and Enter keys, handled by the window's list. */
	onKey: (ev: KeyboardEvent) => void;
}

/** Keep the optional theme choice in step with live ownership and theme changes. */
export function syncQuickInsertThemeOption(
	select: SelectDropdown | undefined,
	label: string,
	showTheme: boolean,
	filter: CalloutSourceFilter,
): CalloutSourceFilter {
	const effective = !showTheme && filter === "theme" ? "all" : filter;
	select?.setOptions([
		{ value: "all", label: t("quickInsert.sourceAll") },
		{ value: "builtin", label: t("quickInsert.sourceBuiltIn") },
		...(showTheme ? [{ value: "theme", label }] : []),
		{ value: "user", label: t("quickInsert.sourceUser") },
	]).setValue(effective);
	return effective;
}

/** Build the toolbar, its focus target, and the dropdown cleanup. */
export function buildQuickInsertToolbar(
	parent: HTMLElement,
	handlers: QuickInsertToolbarHandlers,
) {
	const toolbar = parent.createDiv({ cls: "cs-quick-insert-toolbar" });

	// The query is scoped to one insertion; the source choice is remembered.
	const search = toolbar.createEl("input", {
		type: "text",
		cls: "cs-quick-insert-search cs-text-control",
		placeholder: t("quickInsert.searchPlaceholder"),
	});
	search.addEventListener("input", () => handlers.onQuery(search.value));
	// Bound to the field rather than the window so typing and arrowing are the
	// same gesture. Left/Right are deliberately untouched — they move the caret,
	// and stealing them would break the search box itself.
	search.addEventListener("keydown", (ev) => handlers.onKey(ev));

	const filter = new SelectDropdown(toolbar, t("quickInsert.sourceAria"));
	filter.el.addClass("cs-quick-insert-filter");
	syncQuickInsertThemeOption(filter, handlers.themeLabel, true, handlers.filter);
	filter.onChange((value) => handlers.onFilter(isCalloutSourceFilter(value) ? value : "all"));
	return { search, filter, destroy: () => filter.destroy() };
}
export type QuickInsertToolbar = ReturnType<typeof buildQuickInsertToolbar>;

/** Search navigation belongs to the result list, not the source dropdown. */
export function quickInsertSearchKey(ev: KeyboardEvent, move: (delta: number) => void, insert: () => void): void {
	if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
		ev.preventDefault();
		move(ev.key === "ArrowDown" ? 1 : -1);
	} else if (ev.key === "Enter") {
		ev.preventDefault();
		insert();
	}
}
