/**
 * settings/quickInsertToolbar.ts — the quick-insert window's search and filter.
 *
 * The two controls above the list, split out for the same reason the row is:
 * they own no state, only the widgets that report it. What a query means and
 * which source is stored stay with the window.
 */
import { t } from "../i18n";
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
	parent: HTMLElement,
	label: string,
	showTheme: boolean,
	filter: CalloutSourceFilter,
): CalloutSourceFilter {
	const effective = !showTheme && filter === "theme" ? "all" : filter;
	const select = parent.querySelector<HTMLSelectElement>(
		".cs-quick-insert-filter",
	);
	if (!select) return effective;
	const options = Array.from(select.querySelectorAll<HTMLOptionElement>("option"));
	const theme = options.find((option) => option.value === "theme");
	if (!showTheme) {
		theme?.remove();
	} else if (theme) {
		theme.setText(label);
	} else {
		const option = select.createEl("option", { text: label });
		option.value = "theme";
		const user = options.find((candidate) => candidate.value === "user");
		select.insertBefore(option, user ?? null);
	}
	select.value = effective;
	return effective;
}

/** Build the toolbar into `parent` and return its search field to focus. */
export function buildQuickInsertToolbar(
	parent: HTMLElement,
	handlers: QuickInsertToolbarHandlers,
): HTMLInputElement {
	const toolbar = parent.createDiv({ cls: "cs-quick-insert-toolbar" });

	// The query is scoped to one insertion; the source choice is remembered.
	const search = toolbar.createEl("input", {
		type: "text",
		cls: "cs-quick-insert-search",
		placeholder: t("quickInsert.searchPlaceholder"),
	});
	search.addEventListener("input", () => handlers.onQuery(search.value));
	// Bound to the field rather than the window so typing and arrowing are the
	// same gesture. Left/Right are deliberately untouched — they move the caret,
	// and stealing them would break the search box itself.
	search.addEventListener("keydown", (ev) => handlers.onKey(ev));

	const select = toolbar.createEl("select", {
		cls: "cs-quick-insert-filter dropdown",
		attr: { "aria-label": t("quickInsert.sourceAria") },
	});
	const sourceOptions: readonly [CalloutSourceFilter, string][] = [
		["all", t("quickInsert.sourceAll")],
		["builtin", t("quickInsert.sourceBuiltIn")],
		["theme", handlers.themeLabel],
		["user", t("quickInsert.sourceUser")],
	];
	for (const [value, text] of sourceOptions) {
		select.createEl("option", { text }).value = value;
	}
	select.value = handlers.filter;
	select.addEventListener("change", () => {
		handlers.onFilter(
			isCalloutSourceFilter(select.value) ? select.value : "all",
		);
	});
	return search;
}
