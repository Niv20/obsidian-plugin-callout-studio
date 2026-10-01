/**
 * ui/blockedButton.ts — a main button that cannot act says why when it is pressed.
 *
 * A `disabled` button swallows the click, so it can only go quiet: the user is
 * left looking at a dimmed button with no way to learn what it is waiting for —
 * a name still to be typed, a choice still to be made, a draft still to be
 * confirmed with Enter. The callout editor's Save, the quick-insert Insert and
 * the plugin import's Import already answer the press instead of ignoring it.
 * This is that answer, shared, so every main button that can be blocked answers
 * it the same way:
 *
 * - {@link paintBlocked} dims the button — `aria-disabled` and `cs-btn-disabled`,
 *   which Obsidian styles exactly like `disabled` — and leaves it focusable and
 *   clickable.
 * - {@link explainIfBlocked} is the first line of its click handler: while there
 *   is a reason, the press shows it in a notice and the handler stops there.
 *
 * Both take the same reason — the sentence a method like `saveBlockedReason()`
 * returns, or null when the button can act — so the look and the words cannot
 * disagree: a button is dimmed exactly when pressing it would explain something,
 * and what that is gets decided in one place. The click recomputes the reason
 * rather than trusting the last paint, so a state that changed without a redraw
 * is still answered truthfully.
 *
 * Not for a button that is merely busy. Its label already says "Saving…" or
 * "Scanning…", pressing it teaches nothing, and `disabled` is the right tool.
 */
import { Notice } from "obsidian";

/** The explanation still on screen, so pressing again replaces it rather than stacking another. */
let showing: Notice | null = null;

/**
 * How long a sentence stays up: Obsidian's own five seconds, stretched at about
 * 60 ms a character once the sentence is long enough to need more to read.
 */
const readingTime = (text: string): number => Math.min(12000, Math.max(5000, text.length * 60));

/**
 * Dim `button` while `reason` is set — and only dim it: it keeps focus and keeps
 * receiving the click, which is what lets {@link explainIfBlocked} answer it.
 */
export function paintBlocked(button: HTMLElement, reason: string | null): void {
	const blocked = reason !== null;
	button.setAttribute("aria-disabled", String(blocked));
	button.toggleClass("cs-btn-disabled", blocked);
}

/**
 * Tell the user why the button is blocked. Returns true when it was, and the
 * click handler stops there: `if (explainIfBlocked(this.saveBlockedReason())) return;`.
 */
export function explainIfBlocked(reason: string | null): boolean {
	if (reason === null) return false;
	showing?.hide();
	showing = new Notice(reason, readingTime(reason));
	return true;
}
