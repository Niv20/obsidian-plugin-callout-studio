/**
 * ui/menuScroll.ts — a long Obsidian menu that scrolls with the wheel, and not
 * with the mouse.
 *
 * Who calls it. SelectDropdown, right after it shows its menu. The language
 * list is the one long enough to need it.
 *
 * The main idea. On a computer Obsidian's menu cannot be scrolled with the
 * wheel: its list is `overflow: hidden`. Instead, a `mousemove` listener
 * Obsidian puts on the list sets the scroll position from where the pointer is
 * inside the menu, so a long list runs along under a moving mouse. And a row
 * that is half hidden at an edge is pulled into view the moment the pointer
 * lands on it (`Menu.select` calls `scrollIntoView`). Neither can be switched
 * off, because both are listeners Obsidian added first.
 *
 * So the menu is made scrollable (the `cs-wheel-menu` class, styles.css), and
 * around those two events we write the scroll position down before Obsidian's
 * listeners run (capture phase, which always comes first) and put it back after
 * they have (bubble phase; ours is added later, so it runs later). Both
 * happen inside the one event, so nothing is painted in between, and a wheel
 * scroll or an arrow key, which are not those events, move the list as usual.
 */

/** The menu Obsidian has just added to the end of the page, or null. */
export function findOpenMenu(doc: Document): HTMLElement | null {
	const menus = doc.body?.querySelectorAll<HTMLElement>(":scope > .menu");
	// The newest menu is the last; a menu has no sub-menu here, so it is ours.
	return menus && menus.length > 0 ? menus[menus.length - 1]! : null;
}

/**
 * Make `menuEl`'s list scroll with the wheel only, and open it on the row
 * `currentIndex`, so the current choice is in view without a scroll.
 *
 * Does nothing where Obsidian drew no list (a native menu, a test's stand-in).
 */
export function scrollMenuWithWheel(menuEl: HTMLElement, currentIndex: number): void {
	const scroller = menuEl.querySelector<HTMLElement>(":scope > .menu-scroll");
	if (!scroller) return;
	menuEl.addClass("cs-wheel-menu");

	// The two events that move the list by themselves: the pointer moving in the
	// menu, and the pointer landing on a row.
	let kept = 0;
	for (const type of ["mousemove", "pointerover"]) {
		menuEl.addEventListener(type, () => { kept = scroller.scrollTop; }, true);
		menuEl.addEventListener(type, () => {
			// Only a change is undone: setting the same value would stop a wheel
			// scroll that is still gliding.
			if (scroller.scrollTop !== kept) scroller.scrollTop = kept;
		});
	}

	revealCentered(scroller, currentIndex);
}

/** Scroll `scroller` so its `index`th row is in the middle, when the list is long enough to scroll. */
function revealCentered(scroller: HTMLElement, index: number): void {
	const row = scroller.querySelectorAll<HTMLElement>(".menu-item")[index];
	if (!row || scroller.scrollHeight <= scroller.clientHeight) return;
	const view = scroller.getBoundingClientRect();
	const at = row.getBoundingClientRect();
	scroller.scrollTop += at.top - view.top - (scroller.clientHeight - at.height) / 2;
}
