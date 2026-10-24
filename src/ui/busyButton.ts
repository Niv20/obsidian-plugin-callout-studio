/**
 * ui/busyButton.ts — a button whose work is running.
 *
 * Who calls it. Every button that starts something slow and stays on screen
 * while it runs: the editor's Save, the icon picker's Confirm while an icon
 * downloads, Retry while a language downloads.
 *
 * The main idea. Obsidian's own buttons keep their words and their width while
 * they work and show a small spinner over them (`mod-loading`, drawn by
 * app.css), instead of changing to "Saving…". The button is disabled, so a
 * second press cannot start the work twice, and `aria-busy` tells a screen
 * reader what the spinner shows.
 */

/** Show `buttonEl` as working (`busy`) or done. */
export function setButtonBusy(buttonEl: HTMLButtonElement, busy: boolean): void {
	buttonEl.disabled = busy;
	buttonEl.toggleClass("mod-loading", busy);
	buttonEl.setAttribute("aria-busy", String(busy));
}
