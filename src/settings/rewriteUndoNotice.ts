/**
 * settings/rewriteUndoNotice.ts — the notice a note rewrite ends with, and its
 * way back. @see utils/noteRewriteUndo.ts for what Undo restores and skips.
 */
import type { App } from "obsidian";
import { t } from "../i18n";
import { showActionNotice } from "../ui/noticeAction";
import { canUndo, keepForUndo, undoNoteRewrite, type NoteRewriteJournal } from "../utils/noteRewriteUndo";
import { showNotice } from "../ui/mascot/mascotNotices";

/**
 * Show `message` with an Undo button that runs `undo` once, for as long as the
 * notice is up (ten seconds, ACTION_NOTICE_MS in ui/noticeDuration.ts). For a
 * change that touched no note — a deleted callout type — so there is no journal
 * to reverse, only the one thing to put back.
 */
export function noticeWithUndoAction(message: string, undo: () => void): void {
	showActionNotice("success", message, { label: t("vault.undoRewrite"), run: undo });
}

/** Show `message`; when the rewrite can be undone whole, with an Undo button. */
export function noticeWithUndo(app: App, message: string, journal: NoteRewriteJournal): void {
	if (!keepForUndo(journal)) {
		showNotice("success", message);
		return;
	}
	noticeWithUndoAction(message, () => {
		if (!canUndo(journal)) return;
		void undoNoteRewrite(app, journal).then(
			({ restored, skipped }) => {
				if (skipped > 0) showNotice("warning", t("vault.undoPartial", { count: restored, skipped }));
				else showNotice("restored", t("vault.undoRestored", { count: restored }));
			},
			(error: unknown) => {
				console.error("[callout-studio] could not undo the note rewrite", error);
			},
		);
	});
}
