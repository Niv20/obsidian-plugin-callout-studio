import type {
	ComboboxRowContract,
	FooterRowSpec,
} from "./listboxPopupDom";

export interface ListboxPopupOptions<T> extends ComboboxRowContract<T> {
	/** Rows to offer for `query` — already filtered and ordered by the caller. */
	itemsFor(query: string): readonly T[];
	/** The text a committed `item` leaves in the closed input. */
	labelOf(item: T): string;
	/** A row was chosen — by click or by Enter, never by blur. */
	onCommit(item: T): void;
	/** The highlight moved, or left it (`null`). Must be undoable by `null`. */
	onHighlight?(item: T | null): void;
	/** One extra action pinned below the list — e.g. "+ New color…". */
	footerRow?: FooterRowSpec;
	/**
	 * Offered *instead of* the empty state when a non-empty query matches
	 * nothing. Unlike `footerRow` it is a real row: the keyboard reaches it.
	 */
	emptyAction?: {
		label(query: string): string;
		onSelect(query: string): void;
	};
	/** `aria-label` for the input. The caller owns the wording. */
	ariaLabel: string;
	placeholder: string;
	/** False for select-like pickers whose label should not behave like text. */
	searchable?: boolean;
}
