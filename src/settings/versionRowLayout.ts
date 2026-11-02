/**
 * settings/versionRowLayout.ts — tells each version card whether its buttons
 * have wrapped onto a line of their own.
 *
 * Who calls it. The Version history page, once it has drawn its cards
 * (declarative/versionHistoryPage.ts).
 *
 * The main idea. A card is a flex row: the words, then the eye, the bin and
 * Restore. When the card is narrow (a phone, a translation with long words) the
 * buttons drop under the words, and the two counts that are stacked beside them
 * can then share one line. CSS cannot ask "did my sibling wrap?", so this looks
 * at where the two parts actually ended up and puts the class
 * `cs-recovery-controls-wrapped` on the card that wrapped.
 */

/** Follow the actual flex wrap, including translated controls and larger text. Returns what stops following. */
export function observeVersionRowLayout(list: HTMLElement): () => void {
	const rows = Array.from(list.querySelectorAll<HTMLElement>(".cs-recovery-row"));
	const sync = (): void => {
		for (const row of rows) {
			const info = row.querySelector<HTMLElement>(".setting-item-info");
			const control = row.querySelector<HTMLElement>(".setting-item-control");
			if (!info || !control) continue;
			const text = info.getBoundingClientRect();
			const actions = control.getBoundingClientRect();
			row.toggleClass("cs-recovery-controls-wrapped",
				text.height > 0 && actions.height > 0 && actions.top >= text.bottom - 0.5);
		}
	};
	const view = list.ownerDocument.defaultView;
	const observer = view && typeof view.ResizeObserver === "function"
		? new view.ResizeObserver(sync) : undefined;
	for (const row of rows) {
		observer?.observe(row);
		for (const element of Array.from(row.querySelectorAll<HTMLElement>(".setting-item-info, .setting-item-control"))) {
			observer?.observe(element);
		}
	}
	sync();
	return () => observer?.disconnect();
}
