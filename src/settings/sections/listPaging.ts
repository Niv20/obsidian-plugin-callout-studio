/**
 * settings/sections/listPaging.ts — the first 20 rows, then a button.
 *
 * A theme that names thirty callouts used to put thirty rows on screen before
 * anything else in the tab, and there is nothing on row 27 the user came for.
 * So a list past `LIST_PAGE_SIZE` shows that many and offers the rest.
 *
 * One press reveals everything rather than another page: the sections are
 * tens of rows, not thousands, and a second press would only be a second
 * chance to lose your place. (The icon picker pages repeatedly because its
 * grids run to thousands — see `iconpicker/IconGrid.ts`.)
 *
 * **Nothing is faded.** The rows carry an icon, two swatches and two buttons,
 * and dimming an interactive row to hint at more below it says "disabled"
 * instead. The button says how many are hidden, which is the fact the fade
 * would only have gestured at.
 */
import { t } from "../../i18n";

export const LIST_PAGE_SIZE = 20;

/**
 * Whether this section has been expanded past the cap. Held by the caller,
 * one per section, so the three page independently and a repaint — a refresh,
 * a theme change, another section's Load more — does not fold a list the user
 * already opened.
 */
export type PagingState = { expanded: boolean };

/**
 * A heading's "(N)" suffix. The count is always the full list a section has,
 * never the slice currently on screen — folding a section or leaving rows
 * behind the Load more button changes what is drawn, not how many the user
 * has. Shared rather than reimplemented per section so every heading agrees
 * on the shape without needing a key of its own in any of the 31 translated
 * locales.
 */
export const headingWithCount = (base: string, count: number): string =>
	`${base} (${count})`;

export function renderPagedList<T>(
	host: HTMLElement,
	items: T[],
	state: PagingState,
	renderItem: (listEl: HTMLElement, item: T) => void,
	onLoadMore: () => void,
): void {
	const listEl = host.createDiv({ cls: "callout-studio-callout-list" });
	const shown = state.expanded
		? items.length
		: Math.min(LIST_PAGE_SIZE, items.length);
	for (const item of items.slice(0, shown)) renderItem(listEl, item);

	const hidden = items.length - shown;
	if (hidden === 0) return;

	// Last child of the list, not a sibling of it: the list is already a column
	// flex box with the section's bottom margin on it, so the button inherits
	// the spacing instead of needing its own.
	const row = listEl.createDiv({ cls: "callout-studio-load-more" });
	// The count is a suffix on whatever `t()` returns — the same shape the list
	// headings use for their "(N)" — so it needs no key of its own in any of
	// the 31 translated locales.
	const btn = row.createEl("button", {
		text: `${t("iconPicker.loadMore")} (${hidden})`,
	});
	btn.addEventListener("click", () => {
		state.expanded = true;
		onLoadMore();
	});
}

/**
 * Load more removes the button it was pressed on, so focus would land back on
 * the document body and the reader would lose their place entirely. Send it
 * to the first row that just appeared instead — `tabindex="-1"` because the
 * row is a target for this jump, not a stop on the way through the tab.
 *
 * Depends only on the class `renderPagedList` gives its list, so it works for
 * any paged section, not just the callout lists it was written for.
 */
export function focusFirstRevealed(host: HTMLElement): void {
	const listEl = host.querySelector<HTMLElement>(
		".callout-studio-callout-list",
	);
	const row = listEl?.children[LIST_PAGE_SIZE];
	if (!(row instanceof HTMLElement)) return;
	row.setAttribute("tabindex", "-1");
	row.focus();
}
