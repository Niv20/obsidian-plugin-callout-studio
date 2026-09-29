/**
 * settings/modalAutofocus.ts — where the cursor goes when a window opens.
 *
 * Search and create windows place the cursor in their first text field on the
 * desktop. Phones and tablets leave it alone so opening a window never raises
 * the soft keyboard. Route modal-open focus through this helper rather than a
 * bare `.focus()` at each call site.
 *
 * Whether a window is creating or editing stays the *caller's* question. This
 * module is handed a field or nothing and never decides, because an **edit**
 * opens on a filled-in form the user came to change one part of — usually not
 * the name — so taking the name field there costs a tap to get back out of.
 *
 * Desktop focus refuses the DOM's own scroll-into-view via `preventScroll`.
 */
import { Platform } from "obsidian";

/**
 * Focus `input` as a window opens — on the desktop, and nowhere else.
 *
 * **Mobile and tablet deliberately get no autofocus.** Raising the soft
 * keyboard the instant a window appears shrinks the visual viewport,
 * and the WebView then scrolls to chase the caret — so the window the user just
 * opened jumps while they are still looking at it.
 *
 * We previously tried to keep the behaviour consistent across every device and
 * fix the jump instead of giving it up: focus on mobile too, then pin the
 * scroller's `scrollTop` for ~400ms (`KEYBOARD_SETTLE_MS`) while the keyboard
 * slid up, releasing early on the first `pointerdown`, `touchstart` or `wheel`.
 * That workaround did not work well — it still read as a delayed, clunky lurch —
 * and it cost every window a scroll listener and a disposer to carry, for a
 * problem no desktop user has. It has been removed rather than tuned. On a
 * phone or tablet the user now taps the field themselves: one tap, and no jump.
 *
 * `Platform.isMobile` is true for phones **and** tablets. An absent field is a
 * no-op too, so edit windows can pass an optional name field without a second
 * guard.
 */
export function autofocusOnDesktop(input: HTMLInputElement | null | undefined): void {
	if (Platform.isMobile) return;
	input?.focus({ preventScroll: true });
}
