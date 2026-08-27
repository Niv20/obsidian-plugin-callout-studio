/**
 * settings/sections/foldAnchor.ts — fold a section without the page jumping.
 *
 * Collapsing a section whose heading is *pinned* takes the content out from
 * under it. The heading stops being stuck, drops back to its own place above the
 * fold, and everything below jumps up by the height of what went away: the user
 * clicks a heading and it vanishes upward, which is the opposite of what a fold
 * is supposed to feel like.
 *
 * Reading the heading's box on both sides of the fold says exactly how far it
 * moved, and handing that back to the scroller puts it back. Two reads and one
 * write, on a click — nothing on the scroll path, no listener, no polling.
 *
 * It is applied unconditionally because it is a no-op everywhere else. Only a
 * *stuck* box reports a different top before and after a change made below it,
 * so a heading that was not pinned — the "Saved color palettes" one that shares
 * the disclosure helper, or any of the three still below the fold — measures
 * zero and the scroller is never touched.
 */

/**
 * The element `el` scrolls inside, or null.
 *
 * The settings pane by name first: Obsidian's `.vertical-tab-content` is both
 * the scroller and, on a plugin tab, the element the plugin renders into (see
 * `SettingsTab.display`), and `hotkeyLink` already reaches for the same pair.
 * The walk behind it is what keeps this honest if that stops being true — a
 * phone puts a `.vertical-tab-content-inner` in between, and the overflow could
 * move up to the container.
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
 * Run `fold`, then leave `headingEl` on the pixel it was on.
 *
 * The measurement is guarded rather than assumed: the DOM the suites run
 * against has no layout at all (`tests/support/fakeDom.ts` says so in its own
 * header), so `getBoundingClientRect` is simply absent there. That absence *is*
 * the guard — without a way to measure there is nothing to correct, and the fold
 * itself must not depend on one.
 */
export function keepHeadingInPlace(
	headingEl: HTMLElement,
	fold: () => void,
): void {
	const measure = (): number | null =>
		typeof headingEl.getBoundingClientRect === "function"
			? headingEl.getBoundingClientRect().top
			: null;

	const before = measure();
	fold();
	if (before === null) return;
	const after = measure();
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
