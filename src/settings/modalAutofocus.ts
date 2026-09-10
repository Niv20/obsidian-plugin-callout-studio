/**
 * settings/modalAutofocus.ts — where the cursor goes when a window opens.
 *
 * Two entry points, split by what the window is *for*, and the split is the
 * whole reason this is a module rather than a bare `.focus()` at each call site:
 *
 * - **A search window** — quick-insert, replace-callout — exists to be typed
 *   into. Nothing else in it does anything until a query is there, so it takes
 *   the cursor on every device, phone included: {@link autofocusOnOpen}.
 * - **A create window** — "New callout", "New color palette" — takes the cursor
 *   on the **desktop only**: {@link autofocusOnDesktop}.
 *
 * Whether a window is creating or editing stays the *caller's* question. This
 * module is handed a field or nothing and never decides, because an **edit**
 * opens on a filled-in form the user came to change one part of — usually not
 * the name — so taking the name field there costs a tap to get back out of.
 *
 * Both entry points refuse the DOM's own scroll-into-view via `preventScroll`,
 * which is the one kind of focus scroll that can be turned off outright.
 */
import { Platform } from "obsidian";

/**
 * Focus `input` as a window opens, on every device.
 *
 * Pass `null` or `undefined` to do nothing at all — that is the *edit* case, and
 * making it a no-op here is what lets a caller reach for an optional field
 * (`this.nameTextInput?.inputEl`) without guarding it twice.
 */
export function autofocusOnOpen(input: HTMLInputElement | null | undefined): void {
	input?.focus({ preventScroll: true });
}

/**
 * Focus `input` as a *create* window opens — on the desktop, and nowhere else.
 *
 * **Mobile and tablet deliberately get no autofocus, and the two platforms are
 * deliberately inconsistent here.** Raising the soft keyboard the instant a
 * create window appears shrinks the visual viewport out from under the form,
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
 * `Platform.isMobile` is true for phones **and** tablets, which is exactly the
 * set of devices that raise a soft keyboard.
 */
export function autofocusOnDesktop(input: HTMLInputElement | null | undefined): void {
	if (Platform.isMobile) return;
	autofocusOnOpen(input);
}
