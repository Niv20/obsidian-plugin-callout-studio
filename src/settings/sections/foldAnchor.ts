/**
 * settings/sections/foldAnchor.ts — change the settings tab without the page
 * jumping out from under the reader.
 *
 * Two exports, one idea, and the idea is the same three lines both times: read a
 * box, make the change, read it again, and hand the difference back to the
 * scroller. Two reads and one write, on an event that was going to happen
 * anyway — nothing on the scroll path, no listener, no observer, no polling.
 *
 * **`keepHeadingInPlace`** is the click case. Collapsing a section whose heading
 * is *pinned* takes the content out from under it: the heading stops being
 * stuck, drops back to its own place above the fold, and everything below jumps
 * up by the height of what went away — the user clicks a heading and it vanishes
 * upward, which is the opposite of what a fold is supposed to feel like. It is
 * applied unconditionally because it is a no-op everywhere else. Only a *stuck*
 * box reports a different top before and after a change made below it, so a
 * heading that was not pinned measures zero and the scroller is never touched.
 *
 * **`keepScrollAnchored`** is the repaint case, and it is the one that answers a
 * bug report rather than a design goal. This tab renders straight into
 * Obsidian's settings scroller and rebuilds four of its sections asynchronously,
 * so a reader parked halfway down could be moved by a registry change, a theme
 * switch, an icon finishing its download or another device's `data.json`
 * arriving — none of which they did.
 *
 * Neither one is a scroll *position* being saved and put back. Both measure a
 * real box against a real layout, which is what makes them right when the
 * content above genuinely changed height instead of merely being redrawn.
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
 * A box's top edge, or null where there is nothing to measure.
 *
 * The absence is the guard, and it is load-bearing rather than defensive: the
 * DOM the suites run against has no layout at all (`tests/support/fakeDom.ts`
 * says so in its own header), so `getBoundingClientRect` is simply missing
 * there. Without a way to measure there is nothing to correct, and every caller
 * below must go on working with no correction at all.
 */
function topOf(el: Element): number | null {
	return typeof el.getBoundingClientRect === "function"
		? el.getBoundingClientRect().top
		: null;
}

/**
 * The topmost direct child of `containerEl` that the reader can actually see —
 * the first one whose bottom edge has not already passed above the scroller's
 * top edge.
 *
 * *Direct* child, deliberately, and it is the whole reason this is safe. The
 * repaints this anchors — `CalloutListsSection.renderAll`,
 * `CustomPalettesSection.renderList` — empty and refill containers nested
 * *inside* the section wrappers; the wrappers themselves, and every plain
 * section below them, are built once by `SettingsTab.display` and outlive the
 * mutation. So an anchor picked at this depth is still attached afterwards and
 * still measurable, which a deeper one usually would not be.
 */
function topmostVisibleChild(
	containerEl: HTMLElement,
	scroller: HTMLElement,
): Element | null {
	if (typeof scroller.getBoundingClientRect !== "function") return null;
	const edge = scroller.getBoundingClientRect().top;
	// `Element`, not `HTMLElement`: `children` is element-only already, and the
	// only thing asked of the anchor is its box and whether it is still
	// attached — both of which every element has. Narrowing further would buy
	// nothing and cost a cross-window `instanceof`.
	for (const child of Array.from(containerEl.children)) {
		if (typeof child.getBoundingClientRect !== "function") return null;
		const rect = child.getBoundingClientRect();
		// `>`, not `>=`: a child whose bottom lands exactly on the edge is the
		// last one already gone, not the first one still here.
		if (rect.bottom > edge) return child;
	}
	return null;
}

/**
 * Run `mutate`, then leave whatever the reader was looking at where it was.
 *
 * The settings tab renders straight into Obsidian's own scroller, and four of
 * its sections are rebuilt asynchronously — a registry change, a theme switch,
 * an icon download landing, another device's `data.json` arriving. All of that
 * happens *above* the fold, so without this the page moves under a reader who
 * did nothing, and where the transient document is shorter than the offset they
 * were at the browser clamps it outright and they lose their place entirely.
 *
 * Same two-reads-and-one-write shape as `keepHeadingInPlace` below, and the
 * same arithmetic, differing in the two ways that matter: the anchor is chosen
 * rather than handed in, and the correction runs in **both** directions. That
 * second one is not a generalisation for its own sake — content above the fold
 * can grow as well as shrink here (a theme section reappearing, a row gaining a
 * swatch), and a one-way guard would silently leave half the cases jumping.
 *
 * This does not fight Chromium's own scroll anchoring, and cannot double-count
 * it: reading `after` forces layout, so any adjustment the browser made has
 * already landed by then and the drift measured here is only what it left over.
 */
export function keepScrollAnchored(
	containerEl: HTMLElement,
	mutate: () => void,
): void {
	const scroller = scrollParentOf(containerEl);
	const anchor = scroller ? topmostVisibleChild(containerEl, scroller) : null;
	const before = anchor ? topOf(anchor) : null;

	mutate();

	// Nothing to correct with. The mutation has already run, which is the point:
	// the correction is an improvement on the repaint, never a condition of it.
	if (!scroller || !anchor || before === null) return;
	// The mutation reached further than expected and took the anchor with it. A
	// detached box reports zeros rather than failing, so measuring one would
	// hand the scroller a drift the size of the whole page.
	if (!anchor.isConnected) return;

	const after = topOf(anchor);
	if (after === null) return;

	// Positive when the anchor moved *down* — content above it grew — so the
	// scroller has to travel the same distance to put it back under the eye it
	// was under. Negative is the mirror of it and is corrected the same way.
	const drift = after - before;
	if (drift === 0) return;
	scroller.scrollTop += drift;
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
