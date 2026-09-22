const COMBOBOX_MAX_HEIGHT_PX = 320;
const COMBOBOX_MENU_OFFSET_PX = 4;
const MENU_EDGE_GAP_PX = 8;
const MENU_MAX_HEIGHT_VAR = "--cs-combobox-menu-max-height";

export function clearListboxMenuHeightCap(menuEl: HTMLElement): void {
	menuEl.setCssProps({ [MENU_MAX_HEIGHT_VAR]: "" });
}

export function syncListboxMenuHeightCap(
	controlEl: HTMLElement,
	menuEl: HTMLElement,
	currentTeardown: (() => void) | undefined,
	onResize: () => void,
	clipEl?: HTMLElement,
): (() => void) | undefined {
	const doc = menuEl.ownerDocument;
	const view = doc.defaultView;
	if (!view) return currentTeardown;

	const rect = controlEl.getBoundingClientRect();
	const viewport = view.visualViewport;
	const viewportHeight =
		viewport?.height ?? doc.documentElement.clientHeight;
	if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
		return currentTeardown;
	}

	// A modal body may clip the menu before the visible viewport ends.
	const bottom = Math.min(
		(viewport?.offsetTop ?? 0) + viewportHeight,
		clipEl?.getBoundingClientRect().bottom ?? Infinity,
	);
	const available = bottom - MENU_EDGE_GAP_PX - rect.bottom - COMBOBOX_MENU_OFFSET_PX;
	const cap = Math.max(
		0,
		Math.min(COMBOBOX_MAX_HEIGHT_PX, Math.floor(available)),
	);
	menuEl.setCssProps({ [MENU_MAX_HEIGHT_VAR]: `${cap}px` });

	if (currentTeardown) return currentTeardown;
	view.addEventListener("resize", onResize);
	viewport?.addEventListener("resize", onResize);
	viewport?.addEventListener("scroll", onResize);
	const onScroll = (ev: Event): void => {
		if (!(ev.target instanceof view.Node) || !menuEl.contains(ev.target)) onResize();
	};
	doc.addEventListener("scroll", onScroll, true);
	const observer = typeof view.ResizeObserver === "function"
		? new view.ResizeObserver(onResize) : undefined;
	observer?.observe(controlEl);
	if (clipEl) observer?.observe(clipEl);
	return () => {
		view.removeEventListener("resize", onResize);
		viewport?.removeEventListener("resize", onResize);
		viewport?.removeEventListener("scroll", onResize);
		doc.removeEventListener("scroll", onScroll, true);
		observer?.disconnect();
	};
}
