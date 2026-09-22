import {
	CSS_CM_WIDGET,
	CSS_HEADING_HIDE_MARKS,
	CSS_HEADING_LINE,
	CSS_INLINE_TOKEN,
} from "../renderShared";

/** Keep a context click from selecting text or revealing a rendered callout. */
export function registerCalloutContextClickGuard(dom: HTMLElement): () => void {
	let contextClick = false;
	const reset = () => {
		contextClick = false;
	};
	const onMouseDown = (event: MouseEvent) => {
		const node = event.target as Node | null;
		const target =
			node?.nodeType === Node.ELEMENT_NODE
				? (node as Element)
				: node?.parentElement;
		contextClick =
			event.button === 2 &&
			target?.closest(".cm-editor") === dom &&
			target.closest(
				`.cm-line.${CSS_HEADING_LINE}.${CSS_HEADING_HIDE_MARKS}, ` +
					`.${CSS_INLINE_TOKEN}.${CSS_CM_WIDGET}`,
			) !== null;
		if (contextClick) event.preventDefault();
	};
	const onSelectStart = (event: Event) => {
		// Chromium can select a word when opening the native menu even when
		// mousedown was canceled. That selection can land on neighboring text
		// and reveal a heading's source, so guard the editor for this gesture.
		if (contextClick) event.preventDefault();
	};

	// Capture runs even on widgets whose ignoreEvent bypasses CM handlers.
	// Keep contextmenu untouched, and keep the guard through mouseup: on some
	// platforms the menu's native selection happens after the button is up.
	dom.addEventListener("mousedown", onMouseDown, true);
	dom.addEventListener("selectstart", onSelectStart, true);
	dom.addEventListener("keydown", reset, true);
	dom.addEventListener("touchstart", reset, true);
	return () => {
		dom.removeEventListener("mousedown", onMouseDown, true);
		dom.removeEventListener("selectstart", onSelectStart, true);
		dom.removeEventListener("keydown", reset, true);
		dom.removeEventListener("touchstart", reset, true);
	};
}
