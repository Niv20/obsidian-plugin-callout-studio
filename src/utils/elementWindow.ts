/**
 * utils/elementWindow.ts — acting in the window that shows an element, and
 * moving with the element when it is shown in another one.
 *
 * Who calls it. Code that makes something *for one window* on behalf of an
 * element of the settings: the observer that fits a row's ids line
 * (settings/sections/idsLineFit.ts) and the one that pins a style preview
 * under its page's title bar (settings/declarative/stylePages.ts).
 *
 * The main idea. In Obsidian 1.14 the settings are a window of their own, and
 * their rows are drawn by the main window and moved there afterwards. Plugin
 * code runs in the main window's realm, so asked what window an element is in
 * while it is being drawn, the answer is the main window, and it is wrong a
 * moment later. That matters for anything that belongs to a window. A
 * `ResizeObserver` hears only the elements of the window that made it
 * (measured in Obsidian 1.14.5: made by the main window, it heard the
 * settings window being resized not once), and a frame asked of a window that
 * is hidden never comes (see elementFrame.ts).
 *
 * So {@link followWindow} starts what is wanted in the window that shows the
 * element, and starts it again in the new window, after stopping it in the
 * old, whenever Obsidian says (`onWindowMigrated`) the element has moved.
 */

/** The window that shows `el` now: the main window when it is shown nowhere yet. */
export function windowOf(el: Element): Window {
	return el.ownerDocument.defaultView ?? window;
}

/**
 * Make something in the window that shows `el`, and make it again in the
 * window `el` is moved to.
 *
 * @param start Makes what is wanted in `win`, and returns what takes it away
 *   again. It is called with the window that shows `el` now, and each time
 *   `el` moves to another window, after the last one's undo has run.
 * @returns What stops following `el` and takes away what was last made.
 */
export function followWindow(el: HTMLElement, start: (win: Window) => () => void): () => void {
	let undo = start(windowOf(el));
	const stopListening = el.onWindowMigrated((win) => {
		undo();
		undo = start(win);
	});
	return () => {
		stopListening();
		undo();
	};
}
