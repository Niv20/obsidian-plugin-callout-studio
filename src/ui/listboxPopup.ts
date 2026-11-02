/**
 * ui/listboxPopup.ts — a field that opens a list to choose from, searchable or
 * not: Obsidian's combobox.
 *
 * Shared picker. `listboxPopupDom.ts` owns markup; `renderRow` supplies content.
 * The field is Obsidian's dropdown (ui/dropdownField.ts) and shows what is
 * committed; a searchable picker's list opens with a search box above it.
 *
 * **The query is separate from the committed choice**: every opening starts
 * with an empty search box and the whole list, and the field goes on showing
 * the committed choice while you search.
 * **Blur never commits**: leaving with half a word typed changes nothing:
 * guessing a choice would persist and sync a value nobody chose. Only an
 * explicit click, Enter, or select-only Space commits.
 */
import { Platform } from "obsidian";
import type { DropdownField } from "./dropdownField";
import {
	buildComboboxSkeleton,
	renderComboboxCreateRow,
	renderComboboxEmptyState,
	renderComboboxFooterNote,
	renderComboboxRows,
} from "./listboxPopupDom";
import { wirePopupEvents } from "./listboxPopupEvents";
import { captureMenuEscape } from "./menuEscape";
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
	/** The search box, or `null` for a select-only picker. */
	readonly inputEl: HTMLInputElement | null;
	/** The caller's slot before the field's words; the popup never draws in it. */
	readonly leadEl: HTMLElement;

	private readonly field: DropdownField;
	private readonly popupEl: HTMLElement;
	private readonly menuEl: HTMLElement;
	private readonly listboxId: string;
	private readonly options: ListboxPopupOptions<T>;

	/** What is committed. `undefined` while nothing ever has been. */
	private selected?: T;
	/** Display state for an unresolved selection, such as a deleted palette. */
	private missingSelectionLabel = "";
	private items: readonly T[] = [];
	private rowEls: HTMLElement[] = [];
	/** Into `items`, or -1 for "nothing highlighted". */
	private activeIndex = -1;
	private pointerActive = false;
	/** Index in `rowEls` of the "create it" row, when one is drawn. */
	private createRowIndex: number | null = null;
	private open = false;
	private disabled = false;
	private destroyed = false;
	private removeDocumentClick?: () => void;
	private removeMenuScope?: () => void;
	private removeWindowResize?: () => void;

	constructor(parent: HTMLElement, options: ListboxPopupOptions<T>) {
		this.options = options;
		this.listboxId = `cs-listbox-${listboxSeq++}`;

		const parts = buildComboboxSkeleton(parent, {
			ariaLabel: options.ariaLabel,
			placeholder: options.placeholder,
			listboxId: this.listboxId,
			searchable: options.searchable ?? true,
			onQuery: () => {
				if (this.open) this.rebuild();
			},
		});
		this.el = parts.root;
		this.field = parts.field;
		this.leadEl = parts.field.iconEl;
		this.popupEl = parts.popup;
		this.inputEl = parts.input;
		this.menuEl = parts.menu;

		if (!this.inputEl) this.el.addClass("is-select-only");
		this.wireEvents();
	}

	/* ---- public API ---- */

	/** The field: the element that takes focus, and that a label can name. */
	get fieldEl(): HTMLElement {
		return this.field.el;
	}

	/** Put the focus on the field, without opening the list. */
	focus(): void {
		this.field.focus();
	}

	/** Re-run `itemsFor` and repaint, keeping the query as typed. */
	setItems(): void {
		if (this.open) this.rebuild();
	}

	/**
	 * Move the selection without firing `onCommit`. An unresolved key shows
	 * `missingLabel` in the field; a nonempty label also keeps the lead visible.
	 */
	setSelected(key: string, missingLabel = ""): void {
		const match = this.options.itemsFor("").find((item) => this.options.keyOf(item) === key);
		this.selected = match;
		this.missingSelectionLabel = missingLabel;
		this.field.setText(match ? this.options.labelOf(match) : missingLabel);
		this.el.toggleClass("is-empty", !match && !missingLabel);
		if (this.open) this.rebuild();
	}

	/** The committed item, or `undefined`. */
	get value(): T | undefined {
		return this.selected;
	}

	setDisabled(disabled: boolean): void {
		disabled ||= this.destroyed;
		this.disabled = disabled;
		this.field.setDisabled(disabled);
		this.el.toggleClass("is-disabled", disabled);
		if (disabled) this.close();
	}

	/** Take the document listener back. **Every caller must call this.** */
	destroy(): void {
		this.destroyed = true;
		this.setDisabled(true);
		this.removeDocumentClick?.();
		this.removeDocumentClick = undefined;
	}

	/* ---- opening and closing ---- */

	private openMenu(): void {
		if (this.open || this.disabled) return;
		this.open = true;
		this.popupEl.removeClass("cs-combobox-popup-hidden");
		this.setExpanded(true);
		this.removeMenuScope = captureMenuEscape(
			this.el,
			() => this.open,
			() => this.dismiss(),
		);
		// The empty query is the first rule of the header.
		if (this.inputEl) this.inputEl.value = "";
		this.rebuild("");
		// Ready to type into. Not on a phone or tablet, where focusing it would
		// raise the keyboard over the list every time (modalAutofocus.ts): a
		// tap on the search box does that when it is wanted.
		if (!Platform.isMobile) this.inputEl?.focus({ preventScroll: true });
	}

	private setExpanded(open: boolean): void {
		this.field.setExpanded(open);
		this.inputEl?.setAttribute("aria-expanded", String(open));
	}

	private applyMenuHeightCap(): void {
		this.removeWindowResize = syncListboxMenuHeightCap(
			this.field.el,
			this.popupEl,
			this.removeWindowResize,
			() => this.applyMenuHeightCap(),
			undefined,
			this.menuEl,
		);
	}

	/**
	 * Close without choosing. The focus is left where it is: this runs when it
	 * is already moving elsewhere, or for the caller's own reasons.
	 */
	close(): void {
		if (!this.open) return;
		this.open = false;
		this.removeMenuScope?.();
		this.removeMenuScope = undefined;
		this.popupEl.addClass("cs-combobox-popup-hidden");
		this.setExpanded(false);
		clearListboxMenuHeightCap(this.popupEl);
		this.setActive(-1);
		this.options.onHighlight?.(null);
		this.removeWindowResize?.();
		this.removeWindowResize = undefined;
	}

	/**
	 * Close and give the focus back to the field, for a close the user asked
	 * for (Escape, a pick, a second click on the field). The search box is
	 * hidden with the list, and the focus would otherwise fall to the page.
	 * `byPointer` for a pick made with the mouse (see `DropdownField.focus`).
	 */
	private dismiss(byPointer = false): void {
		const wasOpen = this.open;
		this.close();
		if (wasOpen && !this.destroyed) this.field.focus(byPointer);
	}

	/** Put `text` in the search box, as if typed there, and filter for it. */
	private seedQuery(text: string): void {
		if (!this.inputEl || !this.open) return;
		this.inputEl.value = text;
		this.inputEl.setSelectionRange(text.length, text.length);
		this.rebuild();
	}

	/* ---- the list ---- */

	/** Redraw for `query`: the search box's text, unless `openMenu` forces `""`. */
	private rebuild(query = this.inputEl?.value ?? ""): void {
		this.activeIndex = -1;
		this.items = this.options.itemsFor(query);
		const selectedKey = this.selected ? this.options.keyOf(this.selected) : undefined;

		this.rowEls = renderComboboxRows(this.menuEl, {
			items: this.items,
			query,
			listboxId: this.listboxId,
			selectedKey,
			keyOf: (item) => this.options.keyOf(item),
			renderRow: (rowEl, item, q) => this.options.renderRow(rowEl, item, q),
			emptyText: (q) => this.options.emptyText(q),
			groupOf: this.options.groupOf && ((item) => this.options.groupOf!(item)),
			hideSingleGroup: this.options.hideSingleGroup,
			showSingleGroupKey: this.options.showSingleGroupKey,
			onPointerRow: (i) => this.restorePointerHighlight(i),
			onLeaveRow: () => this.clearPointerHighlight(),
			onClickRow: (i) => this.commit(i, true),
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
				rowEl.addEventListener("mouseenter", () => this.restorePointerHighlight(0));
				rowEl.addEventListener("mousemove", () => this.restorePointerHighlight(0));
				rowEl.addEventListener("mouseleave", () => this.clearPointerHighlight());
				rowEl.addEventListener("click", () => this.commit(0, true));
				this.rowEls.push(rowEl);
				this.createRowIndex = 0;
			} else {
				renderComboboxEmptyState(this.menuEl, this.options.emptyText(query));
			}
		}

		const note = this.options.footerNote?.() ?? "";
		if (note !== "") renderComboboxFooterNote(this.menuEl, note);

		// Open on the committed row. An unresolved selection opens idle rather
		// than making the first real option look chosen; typing still activates it.
		const at = this.items.findIndex((item) => this.options.keyOf(item) === selectedKey);
		const idleMissing = query === "" && this.missingSelectionLabel !== "";
		const active = at >= 0 ? at : idleMissing ? -1 : this.items.length > 0 ? 0 : -1;
		this.applyMenuHeightCap();
		this.setActive(active, { preview: false });
	}

	private clearPointerHighlight(): void {
		if (this.pointerActive) this.setActive(-1);
	}
	private restorePointerHighlight(index: number): void {
		if (!this.pointerActive || this.activeIndex !== index) this.setActive(index, { pointer: true });
	}
	private setActive(index: number, opts?: { preview?: boolean; pointer?: boolean }): void {
		this.rowEls[this.activeIndex]?.removeClass("is-active");
		this.activeIndex = index >= 0 && index < this.rowEls.length ? index : -1;
		this.pointerActive = opts?.pointer ?? false;

		const el = this.rowEls[this.activeIndex];
		if (el) {
			el.addClass("is-active");
			if (!this.pointerActive) el.scrollIntoView({ block: "nearest" });
			this.comboboxEl.setAttribute("aria-activedescendant", el.id);
		} else {
			// Removed, not emptied: an empty `aria-activedescendant` still names
			// an element to a screen reader, just a missing one.
			this.comboboxEl.removeAttribute("aria-activedescendant");
		}

		if (opts?.preview === false) return;
		this.options.onHighlight?.(this.items[this.activeIndex] ?? null);
	}

	/** The element that carries the combobox role: the search box, or a select-only field. */
	private get comboboxEl(): HTMLElement {
		return this.inputEl ?? this.field.el;
	}

	/** Take row `index`; `byPointer` when it was clicked rather than chosen with Enter. */
	private commit(index: number, byPointer = false): void {
		if (!this.open || this.disabled) return;
		if (this.createRowIndex !== null && index === this.createRowIndex) {
			const query = (this.inputEl?.value ?? "").trim();
			// Close first: whatever creates the item is going to take focus, and
			// a popup left open behind a modal is a popup nobody can dismiss.
			this.close();
			this.options.emptyAction?.onSelect(query);
			return;
		}
		const item = this.items[index];
		if (!item) return;
		this.selected = item;
		this.missingSelectionLabel = "";
		this.field.setText(this.options.labelOf(item));
		this.el.removeClass("is-empty");
		this.dismiss(byPointer);
		this.options.onCommit(item);
	}

	/* ---- events ---- */

	/** The narrow surface `wirePopupEvents` is allowed to drive. */
	private wireEvents(): void {
		this.removeDocumentClick = wirePopupEvents({
			el: this.el,
			fieldEl: this.field.el,
			inputEl: this.inputEl,
			popupEl: this.popupEl,
			menuEl: this.menuEl,
			isOpen: () => this.open,
			isDisabled: () => this.disabled,
			open: () => this.openMenu(),
			close: () => this.close(),
			dismiss: () => this.dismiss(),
			seedQuery: (text) => this.seedQuery(text),
			clearPointerHighlight: () => this.clearPointerHighlight(),
			activeIndex: () => this.activeIndex,
			labels: () => this.items.map((item) => this.options.labelOf(item)),
			moveActive: (delta) =>
				this.setActive(Math.max(0, Math.min(this.activeIndex + delta, this.rowEls.length - 1))),
			commitActive: () => this.commit(this.activeIndex),
		});
	}
}
