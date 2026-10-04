/** Follow the actual flex wrap, including translated controls and larger text. */
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
