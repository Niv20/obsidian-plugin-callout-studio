/**
 * settings/modalChrome.ts — the one window shell every Callout Studio window
 * wears: Obsidian's own shell for long dialogs.
 *
 * What it is for. Obsidian hands a plugin a few boxes —
 * `modalEl > (closeEl, headerEl > titleEl, contentEl)` — and no opinion about
 * what to do with them. Obsidian's own long dialogs (Publish, the attachment
 * cleanup, Keychain) all use the same answer, and so does every window here:
 *
 *   ┌───────────────────────────────┐
 *   │ title                       ✕ │  header  — fixed, no line under it
 *   │ content …                     │  body    — the ONLY part that scrolls
 *   ├───────────────────────────────┤
 *   │              [Cancel] [Save]  │  button bar — fixed, a line over it; optional
 *   └───────────────────────────────┘
 *
 * The main idea. Two of Obsidian's own classes do all of it, so the look comes
 * from Obsidian's stylesheet (and a theme's) rather than from ours:
 *
 * - `mod-scrollable-content` on the window makes the body the one scroller,
 *   with Obsidian's 16px insets and no line under the title;
 * - `modal-button-container` is the button bar. Obsidian lines its buttons up
 *   at the end on a computer and stacks them full-width on a phone or tablet,
 *   with the main action on top and Cancel (`mod-cancel`) under it.
 *
 * Until 2026-10-23 the plugin drew its own shell instead: a ruled title band,
 * wider margins in the editors and its own footer row (decision 15 of the
 * native-look plan replaced it).
 *
 * Who calls it. Every window's `onOpen` calls {@link applyModalChrome}, puts
 * its buttons in the bar it returns, and makes its Cancel with
 * {@link addCancelButton}. This module also owns the window's keyboard scope,
 * so an open dropdown gets the first Escape (`ui/menuEscape.ts`).
 */
import type { Modal } from "obsidian";
import { installModalMenuScope, removeModalMenuScope } from "../ui/menuEscape";

export interface ModalChromeOptions {
	/** Build the button bar and return it. Omit for windows with no actions. */
	footer?: boolean;
}

/** The classes this module puts on the window, so it can take them off again. */
const WINDOW_CLASSES = ["cs-modal", "mod-scrollable-content"];

/**
 * Dress `modal` in the standard shell.
 *
 * Safe to call again on a modal that is being reopened: Obsidian reuses
 * `modalEl` across open/close, so a previous button bar is removed rather than
 * duplicated.
 *
 * Every window wearing this shell must set a title (`setTitle` or
 * `titleEl.setText`). An unnamed window reads as an unlabelled box, which is
 * how two windows once shipped; there is deliberately no headerless variant.
 *
 * (The two `export function applyModalChrome(...)` lines without a body are
 * TypeScript "overloads": they tell the compiler that asking for a footer
 * always gives back an element, so a caller never has to check for `null`.)
 *
 * @returns the button bar when `footer` is set, otherwise `null`.
 */
export function applyModalChrome(
	modal: Modal,
	options: ModalChromeOptions & { footer: true },
): HTMLElement;
export function applyModalChrome(
	modal: Modal,
	options?: ModalChromeOptions,
): HTMLElement | null;
export function applyModalChrome(
	modal: Modal,
	options: ModalChromeOptions = {},
): HTMLElement | null {
	const { modalEl, containerEl } = modal;
	installModalMenuScope(modal);
	// `cs-modal` is the plugin's own hook (its surface colours, its row rules);
	// `mod-scrollable-content` is Obsidian's long-dialog shell.
	// `...` spreads the list into separate arguments: addClass("cs-modal", …).
	modalEl.addClass(...WINDOW_CLASSES);
	detachButtonBar(modalEl);

	// Marks the window's backdrop layer for styles.css, which paints the dim
	// behind a stacked window on mobile itself (see "Stacked windows on mobile"
	// there for why Obsidian's own backdrop can't be relied on).
	//
	// The count is trustworthy here: `Modal.open()` appends `containerEl` to the
	// document BEFORE it calls `onOpen()`, and this runs from `onOpen()`, so this
	// window is already in the tally and `> 1` means one was open underneath it.
	// `toggleClass` rather than `addClass` because Obsidian reuses `containerEl`
	// across open/close — a window reopened over nothing must lose the class.
	containerEl.addClass("cs-modal-container");
	containerEl.toggleClass(
		"cs-modal-stacked",
		containerEl.ownerDocument.querySelectorAll(".modal-container").length > 1,
	);

	if (!options.footer) return null;
	// After `.modal-content`, as Obsidian's own dialogs build it, so it stays
	// pinned under the scrolling body.
	return modalEl.createDiv({ cls: "modal-button-container" });
}

/**
 * Add a window's Cancel button to its button bar.
 *
 * Obsidian marks Cancel with `mod-cancel` (what its own `setCancel()` does),
 * and its button bar relies on the mark: on a phone or tablet, where the
 * buttons stack, Cancel goes under the main action. Making every Cancel here
 * means none can miss it.
 *
 * @param bar The bar {@link applyModalChrome} returned.
 * @param label The button's words, usually "Cancel".
 * @param onClick What a press does, usually closing the window.
 * @returns The button, for a caller that needs to keep it.
 */
export function addCancelButton(
	bar: HTMLElement,
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	const button = bar.createEl("button", { text: label, cls: "mod-cancel" });
	button.addEventListener("click", onClick);
	return button;
}

/**
 * Undo {@link applyModalChrome}. Worth calling from `onClose()` on a modal whose
 * button bar holds listeners, since the bar is a sibling of `.modal-content`
 * and so survives the usual `contentEl.empty()`.
 */
export function removeModalChrome(modal: Modal): void {
	removeModalMenuScope(modal);
	const { modalEl, containerEl } = modal;
	detachButtonBar(modalEl);
	modalEl.removeClasses(WINDOW_CLASSES);
	containerEl.removeClasses(["cs-modal-container", "cs-modal-stacked"]);
}

/** Remove the window's button bar, if it has one (a direct child of `.modal`). */
function detachButtonBar(modalEl: HTMLElement): void {
	modalEl.findAll(":scope > .modal-button-container").forEach((el) => el.detach());
}
