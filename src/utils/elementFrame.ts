/**
 * utils/elementFrame.ts — an animation frame asked of the window that shows an
 * element, not of the main one.
 *
 * Plugin code runs in the main window's realm, so a bare `window` is always the
 * main window. In Obsidian 1.14 the settings open as a window of their own, and
 * every modal opened from them lands there too (`Modal.open` appends to
 * `activeWindow`). A frame asked of the main window while it is hidden — behind
 * the settings window, minimised, on another desktop — is held back by the
 * browser until it shows again, so a preview or a list scheduled that way froze
 * until the settings window closed. The window that draws the element is the
 * one the user is looking at.
 *
 * The handle keeps that window, because frame ids are per window: cancelling
 * one in another window could cancel an unrelated frame there.
 */

/** A pending frame and the window it was asked of. */
export interface FrameHandle {
	win: Window;
	id: number;
}

/** Run `callback` on the next frame of the window that owns `el`. */
export function requestFrameFor(el: Element, callback: () => void): FrameHandle {
	const win = el.ownerDocument.defaultView ?? window;
	return { win, id: win.requestAnimationFrame(callback) };
}

/** Cancel `handle` if there is one. Returns null, for `x = cancelFrame(x)`. */
export function cancelFrame(handle: FrameHandle | null): null {
	if (handle) handle.win.cancelAnimationFrame(handle.id);
	return null;
}
