/**
 * ui/bandedSortList.ts — a drag-to-reorder list split into two bands by a line.
 *
 * The list behind **Customize menu items** (enabled items above the line,
 * disabled ones below). An item can be reordered only among the items of its own
 * band — by its handle with the pointer (see ui/DragSortList.ts) or with
 * ArrowUp/ArrowDown on the focused handle — and never across the line. Moving
 * an item to the other band is the caller's business: a row's own control (a
 * toggle, a download or delete button) changes the item, then `animate` slides
 * every row that moved into its new place.
 *
 * The caller owns the array (`items()`, in display order: the first band, then
 * the second) and this module moves entries in it in place, so after
 * `onReorder` the caller only has to save what it holds.
 *
 * (Manage icon libraries used this list too, with captions under the line and
 * a scroll that followed a moved row, until it became three Obsidian setting
 * groups; those two options went with it.)
 */
import { setIcon } from "obsidian";
import { makeDragSortable } from "./DragSortList";
import { animateReorder } from "./flip";

export interface BandedSortListOptions<T> {
	/**
	 * The live array, in display order. Must return the same array on every
	 * call between renders: a reorder is made on it in place.
	 */
	items(): T[];
	/**
	 * Stable identity, stored as `data-cs-item-id`. It matches a row across a
	 * full rebuild, which is what lets `animate` slide it rather than snap.
	 */
	keyOf(item: T): string;
	/** True for an item below the line. */
	inLowerBand(item: T): boolean;
	/** Accessible name of every handle. */
	handleLabel: string;
	/** Fill a row before its handle: the label and the row's own control. */
	renderRow(row: HTMLElement, item: T): void;
	/** A drag or an arrow key moved an item; `items()` already shows the move. */
	onReorder(): void;
}

export interface BandedSortList {
	/** Rebuild every row from `items()`. */
	render(): void;
	/**
	 * Run `change` — which moves items within or between the bands — then
	 * rebuild, sliding every row that changed place.
	 */
	animate(change: () => void): void;
	/** Detach the drag listeners. */
	destroy(): void;
}

/**
 * FLIP identity of a child of the list — matches it across a full rebuild. A
 * row is its item's key; the line has no item, so it is matched by the key it
 * was given when it was drawn.
 */
const ROW_KEY = (el: HTMLElement): unknown => el.dataset.csItemId ?? el.dataset.csBandKey;

/**
 * Turn `listEl` into a banded list. Attach once to a container that stays put:
 * rows are rebuilt inside it, and the drag listener lives on the container so
 * it survives every rebuild.
 */
export function attachBandedSortList<T>(
	listEl: HTMLElement,
	opts: BandedSortListOptions<T>,
): BandedSortList {
	const render = (): void => {
		// Built apart and swapped in whole, never `listEl.empty()` followed by
		// the new rows. The row whose button was just pressed has focus, and a
		// browser that takes focus off a node being removed lays the page out on
		// the spot — with the rows after it already gone. The scroller is then
		// too short for where it was scrolled, clamps, and stays clamped once
		// the rows are back: a press near the top of a long list threw the whole
		// window to the top. `replaceChildren` removes and inserts in one step,
		// so the layout it forces still sees the full list.
		const rows = createDiv();
		const items = opts.items();
		items.forEach((item, index) => {
			// The line is its own sibling element rather than a border on the
			// first lower row, so lifting that row in a drag never carries the
			// line along: it stays fixed at the boundary between the bands.
			const previous = items[index - 1];
			if (previous !== undefined && opts.inLowerBand(item) && !opts.inLowerBand(previous)) {
				rows.createDiv({ cls: "cs-menu-band-divider" }).dataset.csBandKey = "line";
			}
			renderRow(rows, item);
		});
		listEl.replaceChildren(...Array.from(rows.childNodes));
	};

	const animate = (change: () => void): void => {
		animateReorder(
			listEl,
			() => {
				change();
				render();
			},
			{ keyOf: ROW_KEY },
		);
	};

	const renderRow = (into: HTMLElement, item: T): void => {
		const row = into.createDiv({ cls: "callout-studio-row cs-menu-row" });
		row.dataset.csItemId = opts.keyOf(item);
		if (opts.inLowerBand(item)) row.addClass("is-disabled");

		// The handle ends the row, after the row's own control, and draws
		// Obsidian's three-bar icon — as Obsidian's reorderable lists do.
		opts.renderRow(row, item);

		// Keyboard-operable as well as draggable: ↑/↓ on the handle, and
		// Alt+↑/↓ (Obsidian's key) works the same, as no modifier is checked.
		const handle = row.createDiv({ cls: "cs-drag-handle mod-drag-handle clickable-icon" });
		handle.setAttribute("role", "button");
		handle.setAttribute("tabindex", "0");
		handle.setAttribute("aria-label", opts.handleLabel);
		setIcon(handle, "menu");
		handle.addEventListener("keydown", (e) => {
			const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
			if (step === 0) return;
			const items = opts.items();
			// A pointer drag keeps these nodes, so the index from render time
			// may be stale: look the item up afresh on every press.
			const index = items.indexOf(item);
			const neighbour = items[index + step];
			// Only within the item's own band — the neighbour must share it,
			// exactly as the pointer drag is held to its band by `groupOf`.
			if (index === -1 || neighbour === undefined) return;
			if (opts.inLowerBand(neighbour) !== opts.inLowerBand(item)) return;
			e.preventDefault();
			animate(() => {
				items[index] = neighbour;
				items[index + step] = item;
			});
			opts.onReorder();
			focusHandleOf(listEl, opts.keyOf(item));
		});
	};

	const detachDrag = makeDragSortable(listEl, {
		rowSelector: ".cs-menu-row",
		handleSelector: ".cs-drag-handle",
		// Each band is its own group: a dragged row can reorder within its band
		// but treats every row of the other band as a wall it cannot cross.
		groupOf: (row) => row.hasClass("is-disabled"),
		onReorder: (from, to) => {
			const items = opts.items();
			const [moved] = items.splice(from, 1);
			if (moved === undefined) return;
			items.splice(to, 0, moved);
			// DragSortList already moved the live rows. Keeping them preserves
			// the next gesture's target while the previous drop settles.
			opts.onReorder();
		},
	});

	return { render, animate, destroy: detachDrag };
}

/** Return focus to an item's handle after a rebuild replaced the old one. */
function focusHandleOf(listEl: HTMLElement, key: string): void {
	const rows = Array.from(listEl.querySelectorAll<HTMLElement>(".cs-menu-row"));
	rows.find((row) => row.dataset.csItemId === key)
		?.querySelector<HTMLElement>(".cs-drag-handle")
		?.focus();
}
