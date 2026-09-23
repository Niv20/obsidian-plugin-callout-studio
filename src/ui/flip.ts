/**
 * ui/flip.ts — FLIP (First-Last-Invert-Play) reorder animation.
 *
 * Wrap a DOM mutation that reorders a container's children and each row that
 * moves slides smoothly from its old position to its new one instead of
 * snapping. Works whether the mutation moves existing nodes (drag) or rebuilds
 * them from scratch (a full re-render) — in the latter case pass a `keyOf` that
 * returns a stable identity per row so old and new nodes can be matched.
 *
 * The slide runs through the Web Animations API, so nothing lingers in the
 * inline style and there is no cleanup to schedule. To stay smooth when a fast
 * drag re-reorders mid-slide, the "before" position is measured while any
 * previous slide is still applied (its rendered spot) and the in-flight slide is
 * cancelled before the "after" position is read — so the new slide starts from
 * exactly where the row currently is. Honours `prefers-reduced-motion` by
 * skipping the animation and just running the mutation.
 */

/** Default slide duration, matching the ~120-200ms eases used across styles.css. */
export const REORDER_DURATION_MS = 180;

/** True when the OS asks for reduced motion; animations should be skipped. */
export function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface AnimateReorderOptions {
	/**
	 * Stable identity for a row, used to match old and new nodes. Defaults to the
	 * node itself — correct when the mutation keeps nodes and only moves them.
	 * Pass an id-based key when the mutation recreates the rows.
	 */
	keyOf?: (el: HTMLElement) => unknown;
	/** Rows for which this returns true are left untouched (e.g. a row that is
	 *  being pointer-dragged and tracks the pointer itself). */
	skip?: (el: HTMLElement) => boolean;
	duration?: number;
}

/** In-flight slide per row, so a rapid re-reorder can cancel and restart cleanly. */
const slideAnims = new WeakMap<HTMLElement, Animation>();

/** Hand a sliding row back to direct manipulation without competing transforms. */
export function cancelReorderAnimation(row: HTMLElement): void {
	slideAnims.get(row)?.cancel();
	slideAnims.delete(row);
}

/**
 * Run `mutate` (which reorders `container`'s direct children) and animate every
 * row that changed position with a FLIP slide.
 */
export function animateReorder(
	container: HTMLElement,
	mutate: () => void,
	opts: AnimateReorderOptions = {},
): void {
	const { keyOf = (el) => el, skip, duration = REORDER_DURATION_MS } = opts;

	if (prefersReducedMotion()) {
		mutate();
		return;
	}

	const kids = (): HTMLElement[] =>
		Array.from(container.children).filter((c): c is HTMLElement =>
			c.instanceOf(HTMLElement),
		);

	// First: record where each row currently renders (including any in-flight
	// slide transform — that is its visual position right now).
	const before = new Map<unknown, number>();
	for (const el of kids()) {
		if (skip?.(el)) continue;
		before.set(keyOf(el), el.getBoundingClientRect().top);
	}

	// Last: apply the reorder.
	mutate();

	// Invert + Play: slide each surviving row from where it was to where it is.
	for (const el of kids()) {
		if (skip?.(el)) continue;
		const oldTop = before.get(keyOf(el));
		if (oldTop === undefined) continue; // freshly added row — nothing to slide from

		// Cancel any in-flight slide so the rect below is the true new flow
		// position; `oldTop` already captured where the row visually was.
		cancelReorderAnimation(el);
		const dy = oldTop - el.getBoundingClientRect().top;
		if (Math.abs(dy) < 0.5) continue;

		const anim = el.animate(
			[{ transform: `translateY(${dy}px)` }, { transform: "translateY(0px)" }],
			{ duration, easing: "ease" },
		);
		slideAnims.set(el, anim);
		anim.addEventListener("finish", () => {
			if (slideAnims.get(el) === anim) slideAnims.delete(el);
		});
	}
}
