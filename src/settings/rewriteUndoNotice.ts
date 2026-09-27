/**
 * settings/rewriteUndoNotice.ts — the notice a note rewrite ends with, and its
 * way back. @see utils/noteRewriteUndo.ts for what Undo restores and skips.
 */
import { Notice } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { canUndo, keepForUndo, undoNoteRewrite, type NoteRewriteJournal } from "../utils/noteRewriteUndo";

/** Show `message`; when the rewrite can be undone whole, with an Undo link. */
export function noticeWithUndo(app: App, message: string, journal: NoteRewriteJournal): void {
	if (!keepForUndo(journal)) { new Notice(message); return; }
	const frag = createFragment();
	frag.createEl("p", { text: message });
	const link = frag.createEl("a", { text: t("vault.undoRewrite"), cls: "cs-notice-action" });
	const notice = new Notice(frag, 15000);
	link.addEventListener("click", (event) => {
		event.preventDefault();
		notice.hide();
		if (!canUndo(journal)) return;
		void undoNoteRewrite(app, journal).then(({ restored, skipped }) => {
			if (skipped > 0) new Notice(t("vault.undoPartial", { count: restored, skipped }), 10000);
			else new Notice(t("vault.undoRestored", { count: restored }));
		}, (error: unknown) => {
			console.error("[callout-studio] could not undo the note rewrite", error);
		});
	});
}
