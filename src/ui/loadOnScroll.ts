/**
 * ui/loadOnScroll.ts — load the next page of a list as the reader scrolls
 * towards its end, as Obsidian's Search pane does, instead of a "Show more"
 * button.
 *
 * Who calls it. usage/CalloutOccurrencesView.ts and
 * portable/PortableConversionView.ts; each draws 100 results at a time.
 *
 * The main idea (finding S10-07). The list ends in an empty marker element
 * (`.cs-load-more-sentinel`). An `IntersectionObserver` watches it inside the
 * list's scroller, with a margin of about one screen below, so the next page
 * is drawn a little before the reader reaches the end. Each redraw makes a new
 * marker, and {@link LoadOnScroll.watch} moves the observer to it. A window
 * without `IntersectionObserver` (the tests' stand-in) keeps the old button,
 * which {@link canLoadOnScroll} lets the list ask about before drawing.
 */

/** Whether `doc`'s window can watch a list's end; when it cannot, the list keeps its button. */
export function canLoadOnScroll(doc: Document): boolean {
	// `?.`: a test's stand-in window may have no `IntersectionObserver` at all.
	return typeof doc.defaultView?.IntersectionObserver === "function";
}

/** The class of the empty element a list ends in while it has more to load. */
export const LOAD_MORE_SENTINEL = "cs-load-more-sentinel";

/** Watches one list's end marker at a time, and loads the next page when it nears. */
export class LoadOnScroll {
	private observer: IntersectionObserver | null = null;

	/**
	 * @param scroller Returns the list's scroller (the observer's root), or
	 *   null while the view has none.
	 * @param loadMore Draws the next page; it redraws the list, so it calls
	 *   {@link watch} again with the new marker.
	 */
	constructor(
		private readonly scroller: () => HTMLElement | null,
		private readonly loadMore: () => void,
	) {}

	/**
	 * Watch `sentinel`, the marker the list now ends in, or stop watching
	 * (`null`: everything is drawn). Any earlier marker is let go.
	 */
	watch(sentinel: HTMLElement | null): void {
		this.stop();
		const root = this.scroller();
		const view = root?.ownerDocument.defaultView;
		if (!sentinel || !root || !view || typeof view.IntersectionObserver !== "function") return;
		this.observer = new view.IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				// A hidden sidebar tab lays out at zero height, where everything
				// "intersects"; nothing is being scrolled there.
				if (root.clientHeight === 0) return;
				this.stop();
				this.loadMore();
			},
			{ root, rootMargin: "0px 0px 100% 0px" },
		);
		this.observer.observe(sentinel);
	}

	/** Stop watching; called on every redraw and when the view closes. */
	stop(): void {
		this.observer?.disconnect();
		this.observer = null;
	}
}
