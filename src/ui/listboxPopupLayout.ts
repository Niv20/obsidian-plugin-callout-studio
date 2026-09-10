const COMBOBOX_MAX_HEIGHT_PX = 320;
const COMBOBOX_MENU_OFFSET_PX = 4;
const MENU_MAX_HEIGHT_VAR = "--cs-combobox-menu-max-height";

export function clearListboxMenuHeightCap(menuEl: HTMLElement): void {
	menuEl.setCssProps({ [MENU_MAX_HEIGHT_VAR]: "" });
}

export function syncListboxMenuHeightCap(
	controlEl: HTMLElement,
	menuEl: HTMLElement,
	currentTeardown: (() => void) | undefined,
	onResize: () => void,
): (() => void) | undefined {
	if (typeof window === "undefined") return currentTeardown;

	const rect = controlEl.getBoundingClientRect();
	const viewportHeight =
		window.visualViewport?.height ?? document.documentElement.clientHeight;
	if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
		return currentTeardown;
	}

	const available = viewportHeight - rect.bottom - COMBOBOX_MENU_OFFSET_PX;
	const cap = Math.max(
		0,
		Math.min(COMBOBOX_MAX_HEIGHT_PX, Math.floor(available)),
	);
	menuEl.setCssProps({ [MENU_MAX_HEIGHT_VAR]: `${cap}px` });

	if (currentTeardown) return currentTeardown;
	window.addEventListener("resize", onResize);
	window.visualViewport?.addEventListener("resize", onResize);
	return () => {
		window.removeEventListener("resize", onResize);
		window.visualViewport?.removeEventListener("resize", onResize);
	};
}
