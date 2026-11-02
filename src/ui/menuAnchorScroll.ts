/**
 * ui/menuAnchorScroll.ts — close an open Obsidian menu when the page it hangs
 * from scrolls.
 *
 * Who calls it. SelectDropdown, right after it shows its menu.
 *
 * The main idea. An Obsidian `Menu` opened with `showAtPosition` is placed once,
 * at window coordinates read when it opened, and nothing moves it afterwards.
 * Scroll the settings page (or the modal) behind it and the field goes with the
 * page while the menu stays where it was, pointing at nothing. So the menu is
 * closed instead, the way `openCalloutRowMenu` closes a row's menu.
 *
 * Only a scroll that carries the anchor counts: the page, or an element that
 * contains the anchor, and only when its position really changed (a scroll event
 * queued before the menu opened must not close it). The menu's own list is
 * another element, so wheel-scrolling a long list (the languages) is left alone.
 */
import { Platform } from "obsidian";

/**
 * Call `close` when anything that contains `anchor` scrolls.
 *
 * @returns The teardown for the document listener; call it when the menu hides.
 */
export function closeOnAnchorScroll(anchor: HTMLElement, close: () => void): () => void {
	// A phone's menu is a bottom sheet that never uses the anchor's position.
	if (Platform.isPhone) return () => {};
	const doc = anchor.ownerDocument;
	const positions = new Map<Element, { x: number; y: number }>();
	for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
		positions.set(parent, { x: parent.scrollLeft, y: parent.scrollTop });
	}
	const onScroll = (event: Event): void => {
		// A scroll of the page itself is reported on the document.
		const target = event.target === doc
			? doc.scrollingElement ?? doc.documentElement : event.target;
		const before = positions.get(target as Element);
		if (!before) return;
		const el = target as Element;
		if (el.scrollLeft !== before.x || el.scrollTop !== before.y) close();
	};
	// Capture: a scroll does not bubble, so only the capture phase sees an
	// ancestor's.
	doc.addEventListener("scroll", onScroll, { capture: true, passive: true });
	return () => doc.removeEventListener("scroll", onScroll, { capture: true });
}
