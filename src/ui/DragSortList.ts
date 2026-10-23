/**
 * ui/DragSortList.ts — Pointer-based drag-to-reorder for a vertical list.
 *
 * Attaches once to a list container whose direct children are the rows. A drag
 * starts on `pointerdown` over an element matching `handleSelector`. The dragged
 * row lifts and floats under the pointer (`transform: translateY`) while the DOM
 * is live-reordered as the pointer crosses neighbouring rows' midpoints; the
 * displaced neighbours slide into place with a FLIP animation instead of
 * snapping. On release the row settles into its slot and the net move is
 * reported via `onReorder(from, to)`.
 *
 * While the row floats, a placeholder marks the slot it lands in if released
 * now: an empty grey box from the theme's UI palette, the row's exact size,
 * under every row. It follows the slot from neighbour to neighbour, sliding
 * with them, and goes when the dropped row has settled onto it.
 *
 * Pointer Events are used (not HTML5 drag) so the same code works with mouse,
 * pen, and touch — the plugin runs on mobile (isDesktopOnly: false). The handle
 * must set `touch-action: none` in CSS so dragging from it does not scroll the
 * page, and the container must be positioned (`position: relative`), since the
 * placeholder is laid out against it. Because the container element itself
 * never moves, reordering its children keeps pointer capture intact for the
 * whole gesture.
 *
 * Motion honours `prefers-reduced-motion`: when reduced motion is requested the
 * float/slide/settle are skipped and reordering is instant (as it used to be).
 * There is no placeholder then either — the row never leaves its slot, so it
 * marks the slot itself.
 *
 * Given a `scroller`, a drag also scrolls it when the row is held near its top
 * or bottom edge, as Obsidian's own lists do (finding S4-12): a list taller
 * than the window can then be reordered end to end in one gesture. That keeps
 * working under reduced motion — it is how the row gets there, not decoration.
 */
import {
	REORDER_DURATION_MS,
	REORDER_EASING,
	animateReorder,
	cancelReorderAnimation,
	prefersReducedMotion,
} from "./flip";
import { cancelFrame, requestFrameFor, type FrameHandle } from "../utils/elementFrame";

export interface DragSortOptions {
	/** CSS selector matching each reorderable row (a direct child of container). */
	rowSelector: string;
	/** CSS selector for the drag handle inside a row. */
	handleSelector: string;
	/**
	 * Optional grouping key. A dragged row can only be reordered among rows that
	 * share its group; rows of other groups act as fixed walls it can never cross.
	 * Omit to treat the whole list as one group (unconstrained reorder). Used to
	 * keep the enabled and disabled menu-item bands separate.
	 */
	groupOf?: (row: HTMLElement) => unknown;
	/** Called once on release when the row's index actually changed. */
	onReorder: (fromIndex: number, toIndex: number) => void;
	/**
	 * The element that scrolls the list, for the edge auto-scroll. Read when a
	 * drag starts. Default: none, and a drag never scrolls anything.
	 */
	scroller?: () => HTMLElement | null;
}

/**
 * The edge auto-scroll's numbers, Obsidian's own (app.js): the zone is 50px
 * from the edge, or a third of the scroller's height if that is less, and the
 * scroll grows to 15px a frame as the pointer nears the very edge.
 */
const EDGE_ZONE_PX = 50;
const EDGE_MAX_STEP_PX = 15;

/**
 * How far `scroller` should scroll this frame for a pointer at `y`: negative
 * near its top edge, positive near its bottom one, 0 anywhere else.
 */
function edgeStep(scroller: HTMLElement, y: number): number {
	const box = scroller.getBoundingClientRect();
	const zone = Math.min(EDGE_ZONE_PX, box.height / 3);
	if (zone <= 0) return 0;
	// How deep into the zone the pointer is, from 0 at its inner edge to 1 at
	// the scroller's edge (and past it, held at 1).
	const depth = (into: number): number => Math.min(1, into / zone);
	if (y < box.top + zone) return -EDGE_MAX_STEP_PX * depth(box.top + zone - y);
	if (y > box.bottom - zone) return EDGE_MAX_STEP_PX * depth(y - (box.bottom - zone));
	return 0;
}

/** The drop placeholder's class; styles.css draws it. */
const PLACEHOLDER_CLASS = "cs-drag-placeholder";

/** Take a placeholder out, stopping any slide still moving it. */
function removePlaceholder(box: HTMLElement | null): void {
	if (!box) return;
	cancelReorderAnimation(box);
	box.remove();
}

/**
 * Make `container`'s rows drag-reorderable. Returns a cleanup function that
 * detaches all listeners.
 */
export function makeDragSortable(
	container: HTMLElement,
	opts: DragSortOptions,
): () => void {
	let dragging: HTMLElement | null = null;
	let startIndex = -1;
	let pointerId = -1;
	let reduceMotion = false;
	/** Pointer offset within the grabbed row, captured at pointerdown. */
	let grabOffset = 0;
	/** Current translateY applied to the dragged row (px). */
	let currentTransform = 0;
	/** Settling is cosmetic; it must never own a delayed reorder callback. */
	let stopSettling: (() => void) | null = null;
	/**
	 * The current drag's placeholder. Null between drags, and for the whole
	 * drag when motion is reduced. A dropped row's settle takes its
	 * placeholder along and removes it when it lands.
	 */
	let placeholder: HTMLElement | null = null;
	/** The pointer's latest height, kept for the frames that scroll between moves. */
	let lastY = 0;
	/** The scroller of the current drag, when the list was given one. */
	let scrollEl: HTMLElement | null = null;
	/** The edge auto-scroll's next frame, while a drag with a scroller runs. */
	let edgeFrame: FrameHandle | null = null;

	const rows = (): HTMLElement[] =>
		Array.from(container.querySelectorAll<HTMLElement>(opts.rowSelector)).filter(
			(row) => row.parentElement === container,
		);

	/**
	 * Lay `box` over the slot `row` holds in the list's layout: the row's own
	 * box less the transform that floats it. Measured rather than styled, so it
	 * is the row's exact size whatever the row holds. The list draws no border
	 * and does not scroll itself, so its box is the one `box` is placed in.
	 */
	const coverSlot = (box: HTMLElement, row: HTMLElement): void => {
		const slot = row.getBoundingClientRect();
		const list = container.getBoundingClientRect();
		box.setCssProps({
			"--cs-drag-placeholder-top": `${slot.top - currentTransform - list.top}px`,
			"--cs-drag-placeholder-left": `${slot.left - list.left}px`,
			"--cs-drag-placeholder-width": `${slot.width}px`,
			"--cs-drag-placeholder-height": `${slot.height}px`,
		});
	};

	/**
	 * Mark `row`'s slot. The box goes first in the list: a row sliding past it
	 * comes later in paint order, so it passes over the box rather than under
	 * it, and the dragged row is lifted above everything by its z-index.
	 */
	const createPlaceholder = (row: HTMLElement): HTMLElement => {
		const box = createDiv({ cls: PLACEHOLDER_CLASS, attr: { "aria-hidden": "true" } });
		container.insertBefore(box, container.firstChild);
		coverSlot(box, row);
		return box;
	};

	const onPointerMove = (e: PointerEvent): void => {
		if (!dragging || e.pointerId !== pointerId) return;
		e.preventDefault();
		lastY = e.clientY;
		track(lastY);
	};

	/**
	 * Put the dragged row where a pointer at `y` (window coordinates) means:
	 * into the slot it is over, and glued under the pointer. Run on every move,
	 * and again whenever the list scrolls under a pointer that has not moved.
	 */
	const track = (y: number): void => {
		const dragEl = dragging;
		if (!dragEl) return;

		// Rows the dragged one may reorder among: its own group only. Rows in
		// other groups are ignored here, so they act as fixed walls the dragged
		// row can never cross (e.g. enabled items never sink into the disabled
		// band, and vice versa).
		const groupOf = opts.groupOf;
		const dragGroup = groupOf ? groupOf(dragEl) : undefined;
		const siblings = rows().filter(
			(el) => el !== dragEl && (!groupOf || groupOf(el) === dragGroup),
		);

		// First same-group sibling whose vertical midpoint is below the pointer;
		// the dragged row should sit just before it. If none, it goes to the end
		// of its group — right after the last same-group sibling, never past a
		// wall into the next group.
		let ref: HTMLElement | null = null;
		for (const el of siblings) {
			const rect = el.getBoundingClientRect();
			if (y < rect.top + rect.height / 2) {
				ref = el;
				break;
			}
		}

		const last = siblings[siblings.length - 1] ?? null;
		let needsMove: boolean;
		let place: () => void;
		if (ref) {
			needsMove = dragEl.nextElementSibling !== ref;
			place = () => container.insertBefore(dragEl, ref);
		} else if (last) {
			// Move to the end of the group: immediately after its last member.
			needsMove = last.nextElementSibling !== dragEl;
			place = () => container.insertBefore(dragEl, last.nextElementSibling);
		} else {
			// Sole member of its group — nothing to reorder against.
			needsMove = false;
			place = () => {};
		}

		// Only reorder — and animate — when the slot actually changes, so ongoing
		// neighbour slides are not cancelled and restarted on every stationary
		// move. The FLIP slides the displaced neighbours; the dragged row is
		// skipped because it tracks the pointer itself (below). The placeholder
		// is moved to the new slot inside the same mutation, so the FLIP slides
		// it there too, in step with the neighbours trading places with it.
		if (needsMove) {
			animateReorder(
				container,
				() => {
					place();
					if (placeholder) coverSlot(placeholder, dragEl);
				},
				{ skip: (el) => el === dragEl },
			);
		}

		if (reduceMotion) return;
		// Glue the dragged row to the pointer. Reading its rendered top (which
		// still includes the previous transform) makes this self-correct for the
		// flow shift caused by the reorder above — no accumulator needed:
		//   new = (desiredTop) - (flowTop + oldTransform) + oldTransform
		//       = desiredTop - flowTop
		currentTransform =
			y - grabOffset - dragEl.getBoundingClientRect().top + currentTransform;
		dragEl.style.transform = `translateY(${currentTransform}px)`;
	};

	/**
	 * Obsidian's own "something is being dragged" state on the window's body: a
	 * grabbing cursor everywhere and no tooltips opening mid-drag. Every way a
	 * gesture ends goes through `detachGesture`, which clears it — a body left
	 * with it would keep the whole app's cursor grabbing.
	 */
	let grabbing = false;
	const setGrabbing = (on: boolean): void => {
		if (grabbing === on) return;
		grabbing = on;
		container.ownerDocument.body.toggleClass("is-grabbing", on);
	};

	/** The list scrolled (the edge auto-scroll, a wheel): the slot under the pointer moved. */
	const onScroll = (): void => track(lastY);

	/**
	 * Each frame of a drag, scroll the scroller if the pointer is held near one
	 * of its edges, then find the slot again: the rows moved, the pointer did not.
	 */
	const scheduleEdgeScroll = (): void => {
		edgeFrame = requestFrameFor(container, () => {
			edgeFrame = null;
			if (!dragging || !scrollEl) return;
			const step = edgeStep(scrollEl, lastY);
			if (step !== 0) {
				const before = scrollEl.scrollTop;
				scrollEl.scrollTop = before + step;
				if (scrollEl.scrollTop !== before) track(lastY);
			}
			scheduleEdgeScroll();
		});
	};

	const detachGesture = (): void => {
		const capturedId = pointerId;
		edgeFrame = cancelFrame(edgeFrame);
		scrollEl?.removeEventListener("scroll", onScroll);
		scrollEl = null;
		setGrabbing(false);
		dragging = null;
		startIndex = -1;
		pointerId = -1;
		currentTransform = 0;
		container.removeClass("cs-dragging");
		container.removeEventListener("pointermove", onPointerMove);
		container.removeEventListener("pointerup", onPointerUp);
		container.removeEventListener("pointercancel", onPointerUp);
		container.removeEventListener("lostpointercapture", onPointerUp);
		try {
			container.releasePointerCapture(capturedId);
		} catch {
			/* capture may already be gone (pointercancel/lostpointercapture) */
		}
	};

	const onPointerUp = (e: PointerEvent): void => {
		const dragEl = dragging;
		if (!dragEl || e.pointerId !== pointerId) return;
		const from = startIndex;
		const finalIndex = rows().indexOf(dragEl);
		const changed = finalIndex !== -1 && finalIndex !== from;
		const offset = currentTransform;
		// The row settles onto its placeholder, which goes when it lands. Taken
		// off the drag here so a new grab mid-settle draws its own.
		const box = placeholder;
		placeholder = null;
		detachGesture();

		const finish = (): void => {
			dragEl.removeClass("is-dragging");
			dragEl.style.removeProperty("transform");
			removePlaceholder(box);
		};

		if (!reduceMotion && Math.abs(offset) >= 0.5) {
			// Save independently of this slide: a later gesture must never be
			// interrupted by a stale animation callback rebuilding its rows.
			const anim = dragEl.animate(
				[
					{ transform: `translateY(${offset}px)` },
					{ transform: "translateY(0px)" },
				],
				{ duration: REORDER_DURATION_MS, easing: REORDER_EASING },
			);
			// Drop the inline follow-transform now: the animation overrides it while
			// running and, with no fill, the row rests at its natural slot after.
			dragEl.style.removeProperty("transform");
			const settle = (): void => {
				anim.removeEventListener("finish", settle);
				anim.removeEventListener("cancel", settle);
				stopSettling = null;
				anim.cancel();
				finish();
			};
			stopSettling = settle;
			anim.addEventListener("finish", settle, { once: true });
			anim.addEventListener("cancel", settle, { once: true });
		} else {
			finish();
		}

		if (changed) opts.onReorder(from, finalIndex);
	};

	const onPointerDown = (e: PointerEvent): void => {
		if (dragging || e.button !== 0) return; // ignore extra touches/buttons
		const target = e.target as HTMLElement | null;
		const handle = target?.closest(opts.handleSelector);
		if (!handle) return;
		const row = handle.closest(opts.rowSelector);
		if (!row?.instanceOf(HTMLElement) || row.parentElement !== container) return;

		e.preventDefault();
		const visualTop = row.getBoundingClientRect().top;
		stopSettling?.();
		// A neighbour may still be sliding from the previous move. Its animation
		// would otherwise override our inline pointer-following transform.
		cancelReorderAnimation(row);
		dragging = row;
		pointerId = e.pointerId;
		startIndex = rows().indexOf(row);
		reduceMotion = prefersReducedMotion();
		grabOffset = e.clientY - visualTop;
		lastY = e.clientY;
		currentTransform = reduceMotion ? 0 : visualTop - row.getBoundingClientRect().top;
		if (!reduceMotion) row.style.transform = `translateY(${currentTransform}px)`;
		container.addClass("cs-dragging");
		setGrabbing(true);
		row.addClass("is-dragging");
		if (!reduceMotion) placeholder = createPlaceholder(row);
		container.setPointerCapture(pointerId);
		container.addEventListener("pointermove", onPointerMove);
		container.addEventListener("pointerup", onPointerUp);
		container.addEventListener("pointercancel", onPointerUp);
		container.addEventListener("lostpointercapture", onPointerUp);
		scrollEl = opts.scroller?.() ?? null;
		if (scrollEl) {
			scrollEl.addEventListener("scroll", onScroll, { passive: true });
			scheduleEdgeScroll();
		}
	};

	container.addEventListener("pointerdown", onPointerDown);

	return () => {
		container.removeEventListener("pointerdown", onPointerDown);
		stopSettling?.();
		dragging?.removeClass("is-dragging");
		dragging?.style.removeProperty("transform");
		removePlaceholder(placeholder);
		placeholder = null;
		detachGesture();
		for (const row of rows()) cancelReorderAnimation(row);
	};
}
