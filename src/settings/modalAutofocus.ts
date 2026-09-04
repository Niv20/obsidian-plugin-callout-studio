/**
 * settings/modalAutofocus.ts — put the cursor in a window's first field without
 * moving the view.
 *
 * Two rules, and the second is the whole reason this is a module rather than a
 * bare `.focus()` at each call site:
 *
 * 1. **Only where the window is creating something.** A *new* callout or
 *    palette opens on an empty name the user has to fill in before anything
 *    else works, so the cursor belongs there and the phone keyboard coming up
 *    with it is the point. An *edit* opens on a filled-in form the user came to
 *    change one part of — usually not the name — so taking the name field there
 *    costs a tap to get back out of, and on a phone it throws the keyboard over
 *    the form they opened the window to look at. That call is the caller's:
 *    this module is handed a field or nothing, and never decides.
 *
 * 2. **Without moving the body.** Focusing scrolls in two separate ways, and
 *    only one of them is ours to refuse:
 *
 *    - the DOM's own scroll-into-view on focus, which `preventScroll` turns
 *      off outright; and
 *    - the soft keyboard, which is the one that actually shows up as the bug.
 *      It is not a scroll *we* asked for — the WebView shrinks the visual
 *      viewport out from under the page as the keyboard slides up, and then
 *      scrolls to keep the caret inside what is left. `preventScroll` has no
 *      say over it because by then the focus call has long returned.
 *
 *    So the second one is answered after the fact instead: hold the body's
 *    scroll where it was until the keyboard has finished arriving. The field
 *    being focused is the *first* one in the window, so "where it was" is the
 *    top and the caret is already inside the standing viewport — there is
 *    nothing the keyboard could scroll to that is worth the jump.
 *
 * The hold gives way to the user the moment they touch the window, so it can
 * never read as a scroll that will not take. Desktop pays for none of this: no
 * keyboard arrives, nothing scrolls, and the listeners come off on the timer.
 */
/**
 * How long to hold the body still after focusing. Covers the keyboard's slide-in
 * (~250-300ms on iOS, less on Android) with enough margin for the scroll that
 * lands at the end of it, and is short enough that a user who reaches for the
 * window in that time releases it themselves via {@link RELEASE_EVENTS}.
 */
const KEYBOARD_SETTLE_MS = 400;

/**
 * Gestures that mean the user is driving now, so the hold must stop. Deliberately
 * not `keydown`: typing into the field we just focused is the expected next
 * event, and it is not a request to scroll away from it.
 */
const RELEASE_EVENTS = ["pointerdown", "touchstart", "wheel"] as const;

/** A disposer for a window that never focused anything. */
const NOTHING_TO_RELEASE = (): void => undefined;

/**
 * Focus `input` as a window opens, and keep `scroller` from moving while the
 * soft keyboard arrives.
 *
 * `scroller` is the window's one scroll container — `contentEl`, per the band
 * diagram in `modalChrome`. It is asked for rather than read off a `Modal`
 * because the scroller is the only part of the window this needs, and naming it
 * is what makes the hold below legible at the call site.
 *
 * Pass `null` for the field to do nothing at all — that is the *edit* case, and
 * making it a no-op here is what lets a caller reach for an optional field
 * (`this.nameTextInput?.inputEl`) without guarding it twice.
 *
 * @returns a disposer to call from `onClose()`. The hold also expires on its own
 * after {@link KEYBOARD_SETTLE_MS}, so this is about not outliving the window
 * rather than about leaking: Obsidian reuses `contentEl` across open/close, so a
 * listener left on it would be sitting on the *next* window too.
 */
export function autofocusOnOpen(
	scroller: HTMLElement,
	input: HTMLInputElement | null | undefined,
): () => void {
	if (!input) return NOTHING_TO_RELEASE;

	const restingTop = scroller.scrollTop;

	input.focus({ preventScroll: true });

	let released = false;
	let settleTimer = 0;

	const holdStill = (): void => {
		if (scroller.scrollTop !== restingTop) scroller.scrollTop = restingTop;
	};

	const release = (): void => {
		if (released) return;
		released = true;
		window.clearTimeout(settleTimer);
		scroller.removeEventListener("scroll", holdStill);
		for (const type of RELEASE_EVENTS) {
			scroller.removeEventListener(type, release);
		}
	};

	scroller.addEventListener("scroll", holdStill);
	for (const type of RELEASE_EVENTS) {
		scroller.addEventListener(type, release);
	}
	settleTimer = window.setTimeout(release, KEYBOARD_SETTLE_MS);

	return release;
}
