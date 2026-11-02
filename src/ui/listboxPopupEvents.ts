/**
 * ui/listboxPopupEvents.ts — raw DOM events, turned into popup intentions.
 *
 * Split out of {@link ListboxPopup} because it answers a different question.
 * The popup decides *what* opening, filtering and committing mean; this decides
 * which gesture is which — and that is where all the browser's awkwardness
 * lives, so it is worth having somewhere it can be read on its own.
 *
 * Two parts are load-bearing and have already been bugs:
 *
 * - **The popover's `mousedown` preventDefault.** A click on a row is also a
 *   blur of whatever holds the focus, and blur lands first. Killing the
 *   default keeps the focus where it is, so the row's own click still arrives
 *   and wins; without it every selection made with the mouse would close the
 *   list before it committed. The search box itself is left out: a press there
 *   has to place the text cursor.
 * - **Blur that stays inside.** Opening a searchable picker moves the focus
 *   from the field into its search box, and a press on the field moves it
 *   back. Neither is the user leaving, so a blur closes the list only when the
 *   focus goes somewhere outside the picker.
 */

import { createFieldKeyHandler, createSearchKeyHandler } from "./listboxPopupKeyboard";

/** What the popup lets its events do to it. */
export interface PopupEventTarget {
	readonly el: HTMLElement;
	readonly fieldEl: HTMLElement;
	/** The search box, or `null` for a select-only picker. */
	readonly inputEl: HTMLInputElement | null;
	/** Obsidian's popover around the search box and the list. */
	readonly popupEl: HTMLElement;
	readonly menuEl: HTMLElement;
	isOpen(): boolean;
	isDisabled(): boolean;
	open(): void;
	/** Close without moving the focus: it is already going elsewhere. */
	close(): void;
	/** Close and give the focus back to the field. */
	dismiss(): void;
	/** Put `text` in the search box and filter for it. */
	seedQuery(text: string): void;
	/** Move the highlight by `delta`, clamped, without wrapping. */
	moveActive(delta: number): void;
	activeIndex(): number;
	labels(): readonly string[];
	/** End a pointer preview without disturbing keyboard navigation. */
	clearPointerHighlight(): void;
	/** Take the highlighted row. */
	commitActive(): void;
}

/**
 * Wire every listener the popup needs, and return the teardown for the one that
 * outlives its element — the document-level click.
 */
export function wirePopupEvents(popup: PopupEventTarget): () => void {
	const doc = popup.fieldEl.ownerDocument;

	// A click on the field opens the list, and a second click closes it, as on
	// Obsidian's own dropdowns.
	popup.fieldEl.addEventListener("click", () => {
		if (popup.isDisabled()) return;
		if (popup.isOpen()) popup.dismiss();
		else popup.open();
	});
	popup.fieldEl.addEventListener("keydown", createFieldKeyHandler(popup));
	popup.inputEl?.addEventListener("keydown", createSearchKeyHandler(popup));

	// See the header: this one line is what lets a mouse selection commit.
	popup.popupEl.addEventListener("mousedown", (ev) => {
		if (ev.target !== popup.inputEl) ev.preventDefault();
	});
	popup.menuEl.addEventListener("mouseleave", () => popup.clearPointerHighlight());

	// See the header: only a blur that leaves the picker closes it.
	const onBlur = (ev: FocusEvent | undefined): void => {
		const next = ev?.relatedTarget as Node | null | undefined;
		if (next && popup.el.contains(next)) return;
		popup.close();
	};
	popup.fieldEl.addEventListener("blur", onBlur);
	popup.inputEl?.addEventListener("blur", onBlur);

	// What blur misses: a tap on an inert region that never moves focus.
	const onDocumentClick = (ev: unknown): void => {
		const target = (ev as MouseEvent | undefined)?.target as Node | null;
		if (!target || popup.el.contains(target)) return;
		popup.close();
	};
	doc.addEventListener("click", onDocumentClick);
	return () => {
		doc.removeEventListener("click", onDocumentClick);
	};
}
