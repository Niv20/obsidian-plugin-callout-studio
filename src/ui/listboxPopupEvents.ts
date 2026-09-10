/**
 * ui/listboxPopupEvents.ts — raw DOM events, turned into popup intentions.
 *
 * Split out of {@link ListboxPopup} because it answers a different question.
 * The popup decides *what* opening, filtering and committing mean; this decides
 * which gesture is which — and that is where all the browser's awkwardness
 * lives, so it is worth having somewhere it can be read on its own.
 *
 * Two of the three awkward parts are load-bearing and have already been bugs:
 *
 * - **Selecting the label on click.** The browser fires
 *   mousedown → focus → mouseup → click. A `select()` on focus is undone by
 *   mouseup, which places a caret. So the selection is made again on `click`,
 *   which runs last and sticks. This is the fix for the split-second selection
 *   flicker, and it applies when a click first enters the control so the full
 *   label is ready to overwrite without stealing later caret placement.
 *   Deliberately no `preventDefault()`: suppressing the native focus takes the
 *   on-screen keyboard with it on mobile.
 * - **The menu's `mousedown` preventDefault.** A click on a row is also a blur,
 *   and blur lands first. Killing the default keeps focus on the input so the
 *   row's own click still arrives and wins; without it every selection made
 *   with the mouse would revert before it committed.
 */

/** What the popup lets its events do to it. */
export interface PopupEventTarget {
	readonly el: HTMLElement;
	readonly controlEl: HTMLElement;
	readonly inputEl: HTMLInputElement;
	readonly menuEl: HTMLElement;
	isOpen(): boolean;
	open(): void;
	close(): void;
	searchable(): boolean;
	/** Re-filter for whatever is in the input now. */
	refilter(): void;
	/** Move the highlight by `delta`, clamped, without wrapping. */
	moveActive(delta: number): void;
	/** Take the highlighted row. */
	commitActive(): void;
}

/**
 * Wire every listener the popup needs, and return the teardown for the one that
 * outlives its element — the document-level click.
 */
export function wirePopupEvents(popup: PopupEventTarget): () => void {
	let selectOnControlClick = false;

	// The whole control opens, not just the input — a bigger tap target.
	popup.controlEl.addEventListener("mousedown", () => {
		selectOnControlClick = activeDocument.activeElement !== popup.inputEl;
	});
	popup.controlEl.addEventListener("click", (ev) => {
		if (ev.target !== popup.inputEl) {
			popup.inputEl.focus();
		}
		popup.open();
		if (popup.searchable() && selectOnControlClick) popup.inputEl.select();
		selectOnControlClick = false;
	});
	// Keyboard focus (Tab) never gets a mouseup, so the select() the popup does
	// on open is the whole story there.
	popup.inputEl.addEventListener("focus", () => popup.open());

	popup.inputEl.addEventListener("input", () => {
		if (!popup.searchable()) return;
		if (!popup.isOpen()) popup.open();
		else popup.refilter();
	});

	popup.inputEl.addEventListener("keydown", (ev) => onKeyDown(popup, ev));

	// See the header — this one line is what lets a mouse selection commit.
	popup.menuEl.addEventListener("mousedown", (ev) => ev.preventDefault());

	popup.inputEl.addEventListener("blur", () => popup.close());

	// What blur misses: a tap on an inert region that never moves focus.
	const onDocumentClick = (ev: unknown): void => {
		const target = (ev as MouseEvent | undefined)?.target as Node | null;
		if (!target || popup.el.contains(target)) return;
		popup.close();
	};
	activeDocument.addEventListener("click", onDocumentClick);
	return () => {
		activeDocument.removeEventListener("click", onDocumentClick);
	};
}

function onKeyDown(popup: PopupEventTarget, ev: KeyboardEvent): void {
	if (ev.key === "ArrowDown") {
		ev.preventDefault();
		if (!popup.isOpen()) popup.open();
		else popup.moveActive(1);
	} else if (ev.key === "ArrowUp") {
		ev.preventDefault();
		popup.moveActive(-1);
	} else if (ev.key === "Enter") {
		ev.preventDefault();
		if (!popup.isOpen()) popup.open();
		else popup.commitActive();
	} else if (ev.key === "Escape") {
		// Stopped as well as prevented: this popup lives inside modals that close
		// on Escape, and the first press belongs to whichever of the two is open.
		// Only a second press should reach the modal.
		ev.preventDefault();
		ev.stopPropagation();
		popup.close();
	}
}
