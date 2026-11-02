/**
 * ui/resetArrow.ts — how a ↺ ("back to the default") arrow hides while there
 * is nothing to go back to.
 *
 * Who calls it. Every screen whose ↺ keeps its place in the layout: the style
 * pages' sliders and boxes, the Commands and right-click menu pages' headings,
 * the callout editor's icon adjustments and the Icon libraries window.
 * (The arrows that sit beside a field which grows into their place, such as the
 * Language row's, leave the layout instead: `cs-hidden`, set by
 * editor/fieldResetButton.ts.)
 *
 * The main idea. One rule for every ↺ in the plugin: it is there only while
 * something differs from the default. It is never dimmed (a grey arrow says
 * "not now" and is clutter) and never left live with nothing to do. The arrow
 * is drawn once, and a class says whether it shows, so nothing is rebuilt: the
 * toggle costs microseconds (measured: about 10 µs with the page's style and
 * layout recalculated), where drawing the whole page again costs milliseconds.
 *
 * Why `visibility: hidden` (`.cs-reset-idle`, styles.css) and not `opacity: 0`.
 * A transparent element is still on the page: it takes the pointer (its tooltip
 * appears over nothing, and a click lands on it), it takes the Tab key, and a
 * screen reader reads it. `visibility: hidden` removes all of that and keeps
 * the arrow's room, so nothing beside it moves at the moment it appears (a
 * slider's track must not jump under the pointer in the middle of a drag).
 */

/** The class that hides an arrow but keeps its room (styles.css). */
export const RESET_IDLE_CLASS = "cs-reset-idle";

/**
 * Show `resetEl` only while something differs from the default.
 *
 * @param resetEl The arrow's element: an Obsidian extra button.
 * @param idle True when everything is already the default, so the arrow hides.
 */
export function paintResetIdle(resetEl: HTMLElement, idle: boolean): void {
	resetEl.toggleClass(RESET_IDLE_CLASS, idle);
	// Hidden already keeps it out of the Tab order and away from screen readers;
	// the attribute says the same to code that asks (and to the tests).
	resetEl.setAttribute("aria-disabled", String(idle));
}
