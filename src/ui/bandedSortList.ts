/**
 * ui/bandedSortList.ts — a drag-to-reorder list split into two bands by a line.
 *
 * The list behind **Customize menu items** (enabled items above the line,
 * disabled ones below) and **Icon libraries** (libraries in Pick an icon above,
 * the rest below). An item can be reordered only among the items of its own
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
 * A caller that wants the groups captioned — Icon libraries names the second
 * band's two kinds of library — says where a group starts with `captionOf`; the
 * caption comes with the same line as the boundary between the bands, and
 * dragging never carries it along (it is not a row).
 *
 * A caller whose row can change band by itself (a library finishing its
 * download) can also have the list scroll to follow it: `animate` takes the key
 * of the item to follow, and, when a `scroller` was given, brings that row into
 * view if it landed out of it. Without one, nothing ever scrolls.
 */
import { setIcon } from "obsidian";
import { makeDragSortable } from "./DragSortList";
import { animateReorder } from "./flip";
import { scrollToReveal } from "./scrollToReveal";

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
	/**
	 * The caption of the group `item` starts, shown above it, or null when
	 * `item` continues the group before it. `previous` is the item before it in
	 * display order, undefined for the first. A caption is set off from the
	 * rows above it by a line, unless it heads the very first row. Default: no
	 * captions.
	 */
	captionOf?(item: T, previous: T | undefined): string | null;
	/**
	 * The element that scrolls the list, for `animate` to scroll when it is asked
	 * to follow an item. Default: none, and a list that never scrolls itself.
	 */
	scroller?(): HTMLElement | null;
	/**
	 * Whether the row gets a handle. Default: every row. A row without one
	 * keeps a spacer the handle's width, so the names stay in one column.
	 */
	canMove?(item: T): boolean;
	/** Accessible name of every handle. */
	handleLabel: string;
	/** Fill a row after its handle: the label and the row's own control. */
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
	 *
	 * `follow`, asked once the rebuild is done, names the item to keep in view:
	 * if its row landed outside the scroller it is scrolled just far enough to
	 * show it, before the slide is measured, so each row slides from where it was
	 * on screen to where it now is on screen — the list scrolls with the row.
	 * It says undefined when no item should be followed, which is every move
	 * that is not the item's own.
	 */
	animate(change: () => void, follow?: () => string | undefined): void;
	/** Detach the drag listeners. */
	destroy(): void;
}

/**
 * FLIP identity of a child of the list — matches it across a full rebuild. A
 * row is its item's key; a line or a caption has no item, so it is matched by
 * the key it was given when it was drawn. Without one every line and caption
 * would share the identity `undefined`, and all of them would slide from the
 * place of the last one.
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
	const canMove = (item: T): boolean => opts.canMove?.(item) ?? true;

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
			// line along: it stays fixed at the boundary between the bands. A
			// caption is a sibling for the same reason.
			const previous = items[index - 1];
			const caption = opts.captionOf?.(item, previous) ?? null;
			const crossesLine = previous !== undefined && opts.inLowerBand(item) && !opts.inLowerBand(previous);
			if (previous !== undefined && (crossesLine || caption !== null)) {
				rows.createDiv({ cls: "cs-menu-band-divider" }).dataset.csBandKey = `line:${caption ?? ""}`;
			}
			if (caption !== null) {
				rows.createDiv({ cls: "cs-menu-band-caption", text: caption }).dataset.csBandKey = `caption:${caption}`;
			}
			renderRow(rows, item);
		});
		listEl.replaceChildren(...Array.from(rows.childNodes));
	};

	const animate = (change: () => void, follow?: () => string | undefined): void => {
		animateReorder(
			listEl,
			() => {
				change();
				render();
				revealRow(follow?.());
			},
			{ keyOf: ROW_KEY },
		);
	};

	/** Scroll the list's scroller to the row of `key`, if it is out of view. */
	const revealRow = (key: string | undefined): void => {
		const scroller = key === undefined ? null : opts.scroller?.();
		if (!scroller) return;
		const row = Array.from(listEl.querySelectorAll<HTMLElement>(".cs-menu-row"))
			.find((el) => el.dataset.csItemId === key);
		if (row) scrollToReveal(scroller, row);
	};

	const renderRow = (into: HTMLElement, item: T): void => {
		const row = into.createDiv({ cls: "callout-studio-row cs-menu-row" });
		row.dataset.csItemId = opts.keyOf(item);
		if (opts.inLowerBand(item)) row.addClass("is-disabled");

		if (!canMove(item)) {
			row.createDiv({ cls: "cs-drag-handle-spacer" });
			opts.renderRow(row, item);
			return;
		}

		// Keyboard-operable as well as draggable.
		const handle = row.createDiv({ cls: "cs-drag-handle" });
		handle.setAttribute("role", "button");
		handle.setAttribute("tabindex", "0");
		handle.setAttribute("aria-label", opts.handleLabel);
		setIcon(handle, "grip-vertical");
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

		opts.renderRow(row, item);
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
