/**
 * ui/listboxPopup.ts — a text input with a filtering listbox under it.
 *
 * The plugin asks the user to pick one row out of a named list in several
 * places, and until this existed each one answered differently: a native
 * `<select>` for the fallback callout and the command editor (no icon, no
 * colour, no typing), a click-only button-and-menu for the colour palette, and
 * the `[!` popover in the editor — the one that got it right. This is that
 * popover's behaviour made reusable, so a picker cannot be worse just because
 * of where it sits. Markup and ARIA live in `listboxPopupDom.ts`; what a row
 * looks like is the caller's, through {@link ListboxPopupOptions.renderRow}.
 *
 * Two rules hold the whole design up. **The query is separate state from
 * `input.value`**: opening does not treat the committed label as a search for
 * itself — which would list exactly one row — it starts empty and selects the
 * text so the first keystroke replaces it. And **blur never commits**: leaving
 * with half a word typed reverts, because `fallbackCalloutId` is picked through
 * here and is persisted *and synced to every device*, so a picker that guessed
 * "probably the first match" would write a value nobody chose. A click and
 * Enter are the only two commits there are.
 *
 * The gestures that trigger all that live in `listboxPopupEvents.ts`.
 */
import {
	buildComboboxSkeleton,
	renderComboboxCreateRow,
	renderComboboxEmptyState,
	renderComboboxFooterRow,
	renderComboboxRows,
} from "./listboxPopupDom";
import { wirePopupEvents } from "./listboxPopupEvents";
import type { ListboxPopupOptions } from "./listboxPopupTypes";
import { clearListboxMenuHeightCap, syncListboxMenuHeightCap } from "./listboxPopupLayout";

/**
 * Interpolated on purpose: the style ratchet scans literals for class-shaped
 * names and skips any followed by `${`, so a hard-coded `"cs-listbox-0"` would
 * read as a class nobody styled.
 */
let listboxSeq = 0;

export class ListboxPopup<T> {
	readonly el: HTMLElement;
	readonly inputEl: HTMLInputElement;
	/** The caller's slot left of the input; the popup never draws in it. */
	readonly leadEl: HTMLElement;

	private readonly controlEl: HTMLElement;
	private readonly menuEl: HTMLElement;
	private readonly listboxId: string;
	private readonly options: ListboxPopupOptions<T>;

	/** What is committed. `undefined` while nothing ever has been. */
	private selected?: T;
	private items: readonly T[] = [];
	private rowEls: HTMLElement[] = [];
	/** Into `items`, or -1 for "nothing highlighted". */
	private activeIndex = -1;
	/** Index in `rowEls` of the "create it" row, when one is drawn. */
	private createRowIndex: number | null = null;
	private open = false;
	private disabled = false;
	private removeDocumentClick?: () => void;
	private removeWindowResize?: () => void;
	private readonly searchable: boolean;

	constructor(parent: HTMLElement, options: ListboxPopupOptions<T>) {
		this.options = options;
		this.searchable = options.searchable ?? true;
		this.listboxId = `cs-listbox-${listboxSeq++}`;

		const parts = buildComboboxSkeleton(parent, {
			ariaLabel: options.ariaLabel,
			placeholder: options.placeholder,
			listboxId: this.listboxId,
		});
		this.el = parts.root;
		this.controlEl = parts.control;
		this.leadEl = parts.lead;
		this.inputEl = parts.input;
		this.menuEl = parts.menu;

		if (!this.searchable) {
			this.el.addClass("is-select-only");
			this.inputEl.readOnly = true;
			this.inputEl.setAttribute("aria-autocomplete", "none");
		}

		this.wireEvents();
	}

	/* ---- public API ---- */

	/** Re-run `itemsFor` and repaint, keeping the query as typed. */
	setItems(): void {
		if (this.open) this.rebuild();
	}

	/**
	 * Move the committed selection *without* firing `onCommit`. A key matching
	 * nothing reads as nothing selected: empty input, plus `is-empty` on the root.
	 */
	setSelected(key: string): void {
		const match = this.options
			.itemsFor("")
			.find((item) => this.options.keyOf(item) === key);
		this.selected = match;
		this.inputEl.value = match ? this.options.labelOf(match) : "";
		this.el.toggleClass("is-empty", !match);
	}

	/** The committed item, or `undefined`. */
	get value(): T | undefined {
		return this.selected;
	}

	private groupOf(item: T): { key: string; label: string } {
		return this.options.groupOf?.(item) ?? { key: "", label: "" };
	}

	setDisabled(disabled: boolean): void {
		this.disabled = disabled;
		this.inputEl.disabled = disabled;
		this.el.toggleClass("is-disabled", disabled);
		if (disabled) this.close();
	}

	/** Take the document listener back. **Every caller must call this.** */
	destroy(): void {
		this.removeDocumentClick?.();
		this.removeDocumentClick = undefined;
		this.removeWindowResize?.();
		this.removeWindowResize = undefined;
		clearListboxMenuHeightCap(this.menuEl);
	}

	/* ---- opening and closing ---- */

	private openMenu(): void {
		if (this.open || this.disabled) return;
		this.open = true;
		this.menuEl.removeClass("cs-combobox-menu-hidden");
		this.controlEl.addClass("is-open");
		this.inputEl.setAttribute("aria-expanded", "true");
		this.applyMenuHeightCap();
		// The empty query, and the select, are the first rule of the header.
		this.rebuild("");
		if (this.searchable) this.inputEl.select();
	}

	private applyMenuHeightCap(): void {
		this.removeWindowResize = syncListboxMenuHeightCap(
			this.controlEl,
			this.menuEl,
			this.removeWindowResize,
			() => this.applyMenuHeightCap(),
		);
	}

	/** Close, reverting to the committed label — the header's second rule. */
	close(): void {
		if (!this.open) return;
		this.open = false;
		this.menuEl.addClass("cs-combobox-menu-hidden");
		this.controlEl.removeClass("is-open");
		this.inputEl.setAttribute("aria-expanded", "false");
		clearListboxMenuHeightCap(this.menuEl);
		this.inputEl.value = this.selected
			? this.options.labelOf(this.selected)
			: "";
		this.setActive(-1);
		this.options.onHighlight?.(null);
		this.removeWindowResize?.();
		this.removeWindowResize = undefined;
	}

	/* ---- the list ---- */

	/** Redraw for `query` — the input's text, unless `openMenu` forces `""`. */
	private rebuild(query = this.inputEl.value): void {
		this.activeIndex = -1;
		this.items = this.options.itemsFor(query);

		const selectedKey = this.selected
			? this.options.keyOf(this.selected)
			: undefined;

		this.rowEls = renderComboboxRows(this.menuEl, {
			items: this.items,
			query,
			listboxId: this.listboxId,
			selectedKey,
			keyOf: (item) => this.options.keyOf(item),
			renderRow: (rowEl, item, q) => this.options.renderRow(rowEl, item, q),
			emptyText: (q) => this.options.emptyText(q),
			groupOf: this.options.groupOf && ((i) => this.groupOf(i)),
			onEnterRow: (i) => this.setActive(i),
			onClickRow: (i) => this.commit(i),
		});

		// Nothing matched: offer to create it, or say so. The create row joins
		// `rowEls` so the keyboard reaches it, and `commit` knows it by index.
		this.createRowIndex = null;
		if (this.items.length === 0) {
			const action = this.options.emptyAction;
			if (action && query.trim() !== "") {
				const rowEl = renderComboboxCreateRow(
					this.menuEl,
					action.label(query.trim()),
					`${this.listboxId}-create`,
				);
				rowEl.addEventListener("mouseenter", () => this.setActive(0));
				rowEl.addEventListener("click", () => this.commit(0));
				this.rowEls.push(rowEl);
				this.createRowIndex = 0;
			} else {
				renderComboboxEmptyState(this.menuEl, this.options.emptyText(query));
			}
		}

		if (this.options.footerRow) {
			renderComboboxFooterRow(this.menuEl, this.options.footerRow, () =>
				this.setActive(-1),
			);
		}

		// Open on the committed row when it survived the filter, else the first.
		// Highlight only: opening has changed nothing, so previewing here would
		// repaint the callout on a mere glance at the list.
		const at = this.items.findIndex(
			(item) => this.options.keyOf(item) === selectedKey,
		);
		this.setActive(at >= 0 ? at : this.items.length > 0 ? 0 : -1, {
			preview: false,
		});
	}

	private setActive(index: number, opts?: { preview?: boolean }): void {
		this.rowEls[this.activeIndex]?.removeClass("is-active");
		this.activeIndex = index >= 0 && index < this.rowEls.length ? index : -1;

		const el = this.rowEls[this.activeIndex];
		if (el) {
			el.addClass("is-active");
			el.scrollIntoView({ block: "nearest" });
			this.inputEl.setAttribute("aria-activedescendant", el.id);
		} else {
			// Removed, not emptied: an empty `aria-activedescendant` still names
			// an element to a screen reader, just a missing one.
			this.inputEl.removeAttribute("aria-activedescendant");
		}

		if (opts?.preview === false) return;
		this.options.onHighlight?.(this.items[this.activeIndex] ?? null);
	}

	private commit(index: number): void {
		if (this.createRowIndex !== null && index === this.createRowIndex) {
			const query = this.inputEl.value.trim();
			// Close first: whatever creates the item is going to take focus, and
			// a popup left open behind a modal is a popup nobody can dismiss.
			this.close();
			this.options.emptyAction?.onSelect(query);
			return;
		}
		const item = this.items[index];
		if (!item) return;
		this.selected = item;
		this.inputEl.value = this.options.labelOf(item);
		this.el.removeClass("is-empty");
		this.close();
		this.options.onCommit(item);
	}

	/* ---- events ---- */

	/** The narrow surface `wirePopupEvents` is allowed to drive. */
	private wireEvents(): void {
		this.removeDocumentClick = wirePopupEvents({
			el: this.el,
			controlEl: this.controlEl,
			inputEl: this.inputEl,
			menuEl: this.menuEl,
			isOpen: () => this.open,
			open: () => this.openMenu(),
			close: () => this.close(),
			searchable: () => this.searchable,
			refilter: () => this.rebuild(),
			moveActive: (delta) =>
				this.setActive(
					delta > 0
						? Math.min(this.activeIndex + delta, this.rowEls.length - 1)
						: Math.max(this.activeIndex + delta, 0),
				),
			commitActive: () => this.commit(this.activeIndex),
		});
	}
}
