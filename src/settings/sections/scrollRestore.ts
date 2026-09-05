/**
 * settings/sections/scrollRestore.ts — keeping the reader where they were when
 * the settings page rebuilds under them.
 *
 * `SettingsTab.display()` empties its container and renders every section
 * again, and it is not only called when somebody opens the tab: an external
 * `data.json` landing re-runs it (`manager/settingsAdopt.ts`), and so does a
 * locale download. Both used to drop a reader at the top of a fifteen-section
 * page, mid-scroll, for a change they did not make. Nothing distinguishes those
 * from a genuine open, and nothing needs to — a freshly opened pane is at 0, so
 * the restore is already a no-op there.
 *
 * ## Why once is not enough
 *
 * The obvious version assigns `scrollTop` back once every section has rendered,
 * and that is right for a page whose height is final at that moment. This one's
 * is not: rows carry icons and user images that resolve after the synchronous
 * pass, and each one that lands makes the page taller. A position assigned past
 * the end of the shorter page is **clamped by the browser**, and the clamped
 * value is what the reader is left at — which reads exactly like the page
 * having jumped to the top on its own, and is what two separate issue reports
 * described while scrolling a long callout list.
 *
 * So the restore happens twice: immediately, which is right in the common case
 * and avoids a visible flash, and again on the next frame **only if the first
 * one was clamped short**. Correcting upward only is what keeps it from
 * fighting a reader who scrolled deliberately in that one frame.
 */

/**
 * Remember where `el` is scrolled to, and hand back the restore.
 *
 * Call before emptying the container; call the result once every section is
 * back in. A container that was at the top hands back a no-op, so neither
 * caller has to check.
 */
export function captureScroll(el: HTMLElement): () => void {
	const target = el.scrollTop;
	if (target <= 0) return () => undefined;
	return () => {
		if (!el.isConnected) return;
		el.scrollTop = target;
		// Late-loading rows grow the page; a clamped assignment above is what
		// reads as "it jumped back to the top".
		window.requestAnimationFrame(() => {
			if (el.isConnected && el.scrollTop < target) el.scrollTop = target;
		});
	};
}
