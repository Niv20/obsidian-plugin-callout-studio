/**
 * ui/scrollToReveal.ts — scroll a container just far enough to show one of the
 * things inside it, and not at all when it is already shown.
 *
 * What `scrollIntoView({ block: "nearest" })` does, with the three differences
 * that matter to a list that is rebuilt and then slid into place (see
 * ui/flip.ts, which measures the rows right after the rebuild):
 *
 * - **Only the container it is given moves.** `scrollIntoView` walks every
 *   ancestor, so a window that is itself taller than its host would be nudged
 *   too.
 * - **A margin is kept** at the edge the row ends up beside, so a row that
 *   lands at the end of the list is not flush against the edge with nothing
 *   around it — and the caption above the first row of a group comes along.
 * - **It is instant by contract.** The caller's own slide animation starts from
 *   where every row was on screen, so a scroll that went on animating after the
 *   call (a theme's `scroll-behavior: smooth`) would be measured half done.
 */

/** A vertical extent, in the same coordinates as `getBoundingClientRect`. */
export interface Span {
	top: number;
	bottom: number;
}

/**
 * Air kept between a revealed row and the edge it was scrolled toward: room for
 * the group caption and the line above a group's first row (about 36px), and a
 * glimpse of the next row.
 */
export const REVEAL_MARGIN_PX = 40;

/**
 * How far `view` has to scroll — positive is down — for `item` to sit inside it
 * with `margin` to spare. 0 when it already does.
 *
 * The margin shrinks to what the room allows, so an item nearly as tall as the
 * view still has a position to be scrolled to; one taller than the view is
 * scrolled to by its top.
 */
export function scrollDeltaToReveal(item: Span, view: Span, margin: number): number {
	const room = view.bottom - view.top - (item.bottom - item.top);
	if (room < 0) return item.top - view.top;
	const inset = Math.min(margin, room / 2);
	if (item.top < view.top + inset) return item.top - (view.top + inset);
	if (item.bottom > view.bottom - inset) return item.bottom - (view.bottom - inset);
	return 0;
}

/**
 * Scroll `scroller` so `item` is in view, if it is not. `item` is read where it
 * lays out now, so call this once the list has been rebuilt and no slide is
 * applied to it.
 */
export function scrollToReveal(
	scroller: HTMLElement,
	item: HTMLElement,
	margin: number = REVEAL_MARGIN_PX,
): void {
	// The scrollport is the padding box: inside the borders, under the header.
	const top = scroller.getBoundingClientRect().top + scroller.clientTop;
	const delta = scrollDeltaToReveal(
		item.getBoundingClientRect(),
		{ top, bottom: top + scroller.clientHeight },
		margin,
	);
	if (delta !== 0) scroller.scrollTop += delta;
}
