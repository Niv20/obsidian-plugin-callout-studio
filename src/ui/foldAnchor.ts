/**
 * ui/foldAnchor.ts — fold a section without its heading
 * jumping away from under the pointer.
 *
 * Who calls it. The version details table (recoveryComparisonTable.ts), whose
 * section headings stay pinned while their rows scroll.
 *
 * The main idea. Collapsing a section whose heading is *pinned* takes the
 * content out from under it: the heading stops being stuck, drops back to its
 * own place above the fold, and everything below jumps up by the height of
 * what went away — the user clicks a heading and it vanishes upward, which is
 * the opposite of what a fold is supposed to feel like. {@link keepHeadingInPlace}
 * reads the heading's box, folds, reads it again, and hands the difference
 * back to the scroller: two reads and one write, on a click that was going to
 * happen anyway. It is a no-op for a heading that was not pinned, since only a
 * *stuck* box reports a different top before and after a change made below it.
 *
 * It is not a scroll *position* being saved and put back: it measures a real
 * box against a real layout, which is what makes it right when the content
 * above genuinely changed height.
 */

/**
 * The element `el` scrolls inside, or null: the nearest ancestor whose
 * `overflow-y` lets it scroll. (Obsidian's settings pane, `.vertical-tab-content`,
 * is found by name first, without asking for styles.)
 */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
	const known = el.closest<HTMLElement>(
		".vertical-tab-content, .vertical-tab-content-container",
	);
	if (known) return known;
	const view = el.ownerDocument?.defaultView;
	if (!view?.getComputedStyle) return null;
	for (let node = el.parentElement; node; node = node.parentElement) {
		const overflowY = view.getComputedStyle(node).overflowY;
		if (overflowY === "auto" || overflowY === "scroll") return node;
	}
	return null;
}

/**
 * A box's top edge, or null where there is nothing to measure.
 *
 * The absence is the guard, and it is load-bearing rather than defensive: the
 * DOM the suites run against has no layout at all (`tests/support/fakeDom.ts`
 * says so in its own header), so `getBoundingClientRect` is simply missing
 * there. Without a way to measure there is nothing to correct, and the fold
 * must go on working with no correction at all.
 */
function topOf(el: Element): number | null {
	return typeof el.getBoundingClientRect === "function"
		? el.getBoundingClientRect().top
		: null;
}

/**
 * Run `fold`, then leave `headingEl` on the pixel it was on.
 *
 * The measurement is guarded rather than assumed — see `topOf` for why the
 * absence of a rect is the guard, and why the fold itself must never depend on
 * one being there.
 */
export function keepHeadingInPlace(
	headingEl: HTMLElement,
	fold: () => void,
): void {
	const before = topOf(headingEl);
	fold();
	if (before === null) return;
	const after = topOf(headingEl);
	if (after === null) return;

	// Positive when the heading moved *up* — it was pinned, and the fold let it
	// go. Scrolling back by that much lands it where it was. The other direction
	// is the browser's own scrollTop clamp when the page got shorter, which has
	// already moved everything down by the right amount and needs no help.
	const drift = before - after;
	if (drift <= 0) return;
	const scroller = scrollParentOf(headingEl);
	if (scroller) scroller.scrollTop -= drift;
}
