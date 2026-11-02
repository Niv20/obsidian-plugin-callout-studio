/**
 * ui/noticeAction.ts — a notice with one action button, drawn the way
 * Obsidian draws its own Undo after it updates links in your notes.
 *
 * Who calls it. The Undo after a note rewrite (settings/rewriteUndoNotice.ts),
 * and the two "Open settings" notices of a paused session
 * (settings/pausedIndicator.ts, manager/settingsNotices.ts).
 *
 * The main idea (findings S9-14, S9-V1 and S10-12). An Obsidian notice is
 * `div.notice` holding `div.notice-message`, and its own action buttons come
 * after the message as `div.notice-button-container > div.notice-cta`: accent
 * text with no underline, brighter under the pointer, and on a phone at the
 * end of the notice's line. Obsidian builds them with `Notice.addButton`, which
 * its typings do not declare, so this builds the same elements by hand on the
 * notice's public `containerEl`. The message is plain text, so the notice is
 * as compact as Obsidian's. (It used to be a paragraph with an underlined
 * white link under it, a line of empty space taller.)
 *
 * Obsidian hides a notice on any click on it, the button included, so the
 * action always runs with the notice already gone.
 */
import type { Notice } from "obsidian";
import { showNotice, type NoticeKind } from "./mascot/mascotNotices";
import { ACTION_NOTICE_MS } from "./noticeDuration";

/** The one thing a notice offers to do. */
export interface NoticeAction {
	/** The button's words, such as "Undo". */
	label: string;
	/** What pressing it does. */
	run: () => void;
}

/** A shown notice, and its button, for a caller that rewrites the words later. */
export interface ActionNotice {
	notice: Notice;
	buttonEl: HTMLElement;
}

/**
 * Show `message` with one action button under it, the mascot beside the words
 * like in every notice of the plugin (ui/mascot/mascotNotices.ts).
 *
 * @param kind What the notice tells the user, which decides what the mascot does
 *   (ui/mascot/mascotNotices.ts).
 * @param message The notice's sentence.
 * @param action The button's words and what it does.
 * @param duration How long the notice stays, in milliseconds; 0 keeps it up
 *   until it is clicked or hidden. Left out, a notice with a button stays
 *   {@link ACTION_NOTICE_MS}, long enough to read it and reach for the button.
 */
export function showActionNotice(kind: NoticeKind, message: string, action: NoticeAction, duration: number = ACTION_NOTICE_MS): ActionNotice {
	const notice = showNotice(kind, message, duration);
	const buttonEl = notice.containerEl
		.createDiv({ cls: "notice-button-container" })
		.createDiv({
			cls: "notice-cta cs-notice-action",
			text: action.label,
			// Obsidian's own notice button is a bare div; a role and a Tab stop
			// let a keyboard reach this one too.
			attr: { role: "button", tabindex: "0" },
		});
	const press = (): void => {
		notice.hide();
		action.run();
	};
	buttonEl.addEventListener("click", press);
	buttonEl.addEventListener("keydown", (evt) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Claimed, so Space does not also scroll whatever is behind the notice.
		evt.preventDefault();
		press();
	});
	return { notice, buttonEl };
}
