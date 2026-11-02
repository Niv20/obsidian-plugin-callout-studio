/**
 * ui/sidebarParking.ts — keep a long results list from slowing the editor down.
 *
 * Who calls it. usage/CalloutOccurrencesView.ts (Find callouts) and
 * portable/PortableConversionView.ts (Review conversion) hand it the box their
 * file groups are drawn in, after every redraw. ui/sidebarResults.ts and
 * ui/sidebarActiveFile.ts call {@link unparkGroupOf} before they measure or
 * scroll to something inside a group.
 *
 * The main idea (measured 2026-10-31). Every arrow key in the editor makes the
 * browser bring the page's layout up to date, because CodeMirror moves the
 * page's text selection, and that takes longer the more elements are drawn
 * anywhere in the window, the sidebar's included even though it is off to the
 * side. Opening a note deep in the Find callouts list draws every row before
 * it, so 2,600 rows made each key press about 2 ms slower: a quarter of a
 * frame on a 120 Hz screen. Lines that enter or leave a callout were already
 * the slowest, so that is where the editor seemed to stick. Hiding the rows
 * with `content-visibility` or `contain` does not help (the elements still
 * exist for the browser); only taking them out of the layout does.
 *
 * So a file group that is more than a screen from the visible part of the
 * list is *parked*: it keeps its height, so the scrollbar and every other
 * group stay exactly where they were, but styles.css stops drawing what is
 * inside it (`display: none`, which costs nothing). Scrolling back towards it
 * draws it again. The groups stay in the DOM, so every lookup (the row for a
 * result, the card the caret is in) works the same whether a group is parked
 * or not; the only thing a parked row cannot do is be measured, which
 * {@link unparkGroupOf} takes care of.
 */

/** Added to a file group while its rows are parked; styles.css hides them. */
export const PARKED_CLASS = "is-parked";

/** The class of a file group (ui/sidebarResults.ts). */
const GROUP_CLASS = "cs-sidebar-file";

/** The height a parked group keeps; styles.css gives it that block size. */
const PARKED_SIZE = "--cs-parked-size";

/**
 * "Near" is within one screen of the scroller's edge, above and below, so a
 * scroll of up to a screen between two frames still lands on drawn groups.
 */
const NEAR_MARGIN = "100% 0px 100% 0px";

/** Draw `group` again, with its rows. */
function unpark(group: HTMLElement): void {
	group.removeClass(PARKED_CLASS);
	group.setCssProps({ [PARKED_SIZE]: "" });
}

/** Stop drawing `group`'s rows; it stays `height` pixels tall. */
function park(group: HTMLElement, height: number): void {
	group.setCssProps({ [PARKED_SIZE]: `${height}px` });
	group.addClass(PARKED_CLASS);
}

/**
 * If `element` is inside a parked group, or is one, draw the group again.
 * Call it before measuring the element or scrolling to it: a parked row has no
 * box to measure.
 */
export function unparkGroupOf(element: Element | null): void {
	const group = element?.closest<HTMLElement>(`.${GROUP_CLASS}.${PARKED_CLASS}`);
	if (group) unpark(group);
}

/** Watches one list's file groups and parks the ones that are far from the screen. */
export class SidebarParking {
	private observer: IntersectionObserver | null = null;

	/**
	 * @param scroller Returns the list's scroller (the observer's root), or
	 *   null while the view has none.
	 */
	constructor(private readonly scroller: () => HTMLElement | null) {}

	/**
	 * Watch the file groups now drawn straight inside `list`. Call it after
	 * every redraw: the earlier groups are gone, and the browser reports where
	 * each new one is, which also parks the ones that start out far away.
	 * A window that cannot watch (a test's stand-in) leaves every group drawn.
	 */
	watch(list: HTMLElement): void {
		this.stop();
		const root = this.scroller();
		const view = root?.ownerDocument.defaultView;
		if (!root || !view || typeof view.IntersectionObserver !== "function") return;
		const observer = new view.IntersectionObserver((entries) => this.update(root, entries), {
			root,
			rootMargin: NEAR_MARGIN,
		});
		this.observer = observer;
		for (const child of Array.from(list.children)) {
			if (child.classList.contains(GROUP_CLASS)) observer.observe(child);
		}
	}

	/** Stop watching; called on every redraw and when the view closes. */
	stop(): void {
		this.observer?.disconnect();
		this.observer = null;
	}

	/** The browser says some groups came near the screen or went away from it. */
	private update(root: HTMLElement, entries: IntersectionObserverEntry[]): void {
		// A hidden sidebar tab lays out at zero height, where nothing is near
		// anything. Leave every group as it is until the tab is shown again.
		if (root.clientHeight === 0) return;
		const focused = root.ownerDocument.activeElement;
		for (const entry of entries) {
			const group = entry.target as HTMLElement;
			// A redraw may have thrown the group away before this report came.
			if (!root.contains(group)) continue;
			const parked = group.classList.contains(PARKED_CLASS);
			if (entry.isIntersecting) {
				if (parked) unpark(group);
				continue;
			}
			// The height is what the group measured when the browser looked at it, so
			// parking it changes nothing on screen. A group with no height was not
			// laid out, and a group holding the focus would lose it (an element that is
			// not drawn cannot keep it).
			const height = entry.boundingClientRect.height;
			if (!parked && height > 0 && !group.contains(focused)) park(group, height);
		}
	}
}
