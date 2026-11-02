import type { ComboboxRowContract } from "./listboxPopupDom";

export interface ListboxPopupOptions<T> extends ComboboxRowContract<T> {
	/** Rows to offer for `query` — already filtered and ordered by the caller. */
	itemsFor(query: string): readonly T[];
	/** The words the field shows for a committed `item`. */
	labelOf(item: T): string;
	/** A row was chosen — by click or by Enter, never by blur. */
	onCommit(item: T): void;
	/** The highlight moved, or left it (`null`). Must be undoable by `null`. */
	onHighlight?(item: T | null): void;
	/**
	 * A line of plain text closing the list — the source menu's "3 more
	 * libraries available for download". Asked on every rebuild, so it can
	 * follow what changed while the popup was open; an empty string draws
	 * nothing. It is information, not a row: the arrow keys never reach it and
	 * pressing it does nothing.
	 */
	footerNote?(): string;
	/**
	 * Offered *instead of* the empty state when a non-empty query matches
	 * nothing. It is a real row: the keyboard reaches it.
	 */
	emptyAction?: {
		label(query: string): string;
		onSelect(query: string): void;
	};
	/** Accessible name for the field and its search box; emitted through a hidden referenced label. */
	ariaLabel: string;
	/** The search box's grey hint, such as "Search callouts…". Unused without one. */
	placeholder: string;
	/** False for a select-only picker: its list opens with no search box. */
	searchable?: boolean;
}
