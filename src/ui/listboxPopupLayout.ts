const COMBOBOX_MAX_HEIGHT_PX = 320;
const COMBOBOX_MENU_OFFSET_PX = 4;
const MENU_EDGE_GAP_PX = 8;
const MENU_MAX_HEIGHT_VAR = "--cs-combobox-menu-max-height";
const MENU_MAX_WIDTH_VAR = "--cs-dropdown-menu-max-width";
const MENU_OFFSET_X_VAR = "--cs-dropdown-menu-offset-x";
const CLIPPING_OVERFLOW = /^(auto|scroll|hidden|clip)$/;

interface ClipBoundary {
	el: HTMLElement;
	x: boolean;
	y: boolean;
}

function clippingAncestors(menuEl: HTMLElement, clipEl?: HTMLElement): ClipBoundary[] {
	const boundaries: ClipBoundary[] = [];
	const view = menuEl.ownerDocument.defaultView;
	for (let ancestor = menuEl.parentElement; ancestor; ancestor = ancestor.parentElement) {
		const style = view?.getComputedStyle?.(ancestor);
		const x = CLIPPING_OVERFLOW.test(style?.overflowX ?? "");
		const y = CLIPPING_OVERFLOW.test(style?.overflowY ?? "");
		if (x || y) boundaries.push({ el: ancestor, x, y });
	}
	// Keep the explicit boundary for callers whose content box is the limit,
	// including while its overflow styling is being applied during opening.
	if (clipEl && !boundaries.some(({ el }) => el === clipEl))
		boundaries.push({ el: clipEl, x: true, y: true });
	return boundaries;
}

export function clearListboxMenuHeightCap(menuEl: HTMLElement): void {
	menuEl.removeClass("cs-dropdown-menu-above");
	menuEl.setCssProps({
		[MENU_MAX_HEIGHT_VAR]: "",
		[MENU_MAX_WIDTH_VAR]: "",
		[MENU_OFFSET_X_VAR]: "",
	});
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
	const boundaries = clippingAncestors(menuEl, clipEl);

	const rect = controlEl.getBoundingClientRect();
	const viewport = view.visualViewport;
	const viewportHeight =
		viewport?.height ?? doc.documentElement.clientHeight;
	if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
		return currentTeardown;
	}

	let top = viewport?.offsetTop ?? 0;
	let bottom = top + viewportHeight;
	let left = viewport?.offsetLeft ?? 0;
	let right = left + (viewport?.width ?? doc.documentElement.clientWidth);
	// Intersect all clipping ancestors, not only the nearest modal: a sidebar
	// or the icon grid's scroll body can end well before that outer boundary.
	for (const boundary of boundaries) {
		const clipRect = boundary.el.getBoundingClientRect();
		if (boundary.y) {
			top = Math.max(top, clipRect.top);
			bottom = Math.min(bottom, clipRect.bottom);
		}
		if (boundary.x) {
			left = Math.max(left, clipRect.left);
			right = Math.min(right, clipRect.right);
		}
	}
	top += MENU_EDGE_GAP_PX;
	bottom -= MENU_EDGE_GAP_PX;
	left += MENU_EDGE_GAP_PX;
	right -= MENU_EDGE_GAP_PX;
	if (Number.isFinite(right) && right > left) {
		const width = Math.max(0, Math.min(rect.width, right - left));
		const rtl = view.getComputedStyle?.(controlEl).direction === "rtl";
		const anchoredLeft = rtl ? rect.right - width : rect.left;
		const menuLeft = Math.max(left, Math.min(anchoredLeft, right - width));
		menuEl.setCssProps({
			[MENU_MAX_WIDTH_VAR]: `${Math.floor(right - left)}px`,
			[MENU_OFFSET_X_VAR]: `${menuLeft - anchoredLeft}px`,
		});
	}
	const below = Math.max(0, bottom - rect.bottom - COMBOBOX_MENU_OFFSET_PX);
	const above = Math.max(0, rect.top - top - COMBOBOX_MENU_OFFSET_PX);
	// scrollHeight retains the uncapped content height while the popup is
	// scrolling. Using its rendered height instead makes a capped menu flip
	// back and forth on each resize or surrounding scroll.
	const border = Math.max(0, (menuEl.offsetHeight ?? 0) - menuEl.clientHeight);
	const naturalHeight = Math.min(COMBOBOX_MAX_HEIGHT_PX,
		(menuEl.scrollHeight || COMBOBOX_MAX_HEIGHT_PX) + border);
	const opensAbove = naturalHeight > below && above > below;
	menuEl.toggleClass("cs-dropdown-menu-above", opensAbove);
	const triggerVisible = rect.bottom > top && rect.top < bottom;
	const cap = triggerVisible
		? Math.max(0, Math.min(COMBOBOX_MAX_HEIGHT_PX, Math.floor(opensAbove ? above : below)))
		: 0;
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
	for (const { el } of boundaries) observer?.observe(el);
	return () => {
		view.removeEventListener("resize", onResize);
		viewport?.removeEventListener("resize", onResize);
		viewport?.removeEventListener("scroll", onResize);
		doc.removeEventListener("scroll", onScroll, true);
		observer?.disconnect();
		clearListboxMenuHeightCap(menuEl);
	};
}
