/**
 * utils/noteRewriteUndo.ts — one step back for a vault-wide note rewrite.
 *
 * **Replace in vault** and **Delete** rewrite every note that uses a callout,
 * and had no undo: a wrong pick meant restoring notes from a backup, if there
 * was one. A rewrite now records each note's text before and after it, in
 * memory, for the most recent rewrite only and within a size budget. Undo puts
 * back each note that still holds exactly what the rewrite left. A note edited
 * since is left alone and counted, never overwritten, and nothing is written
 * to a note the rewrite did not change.
 */
import type { App, TFile } from "obsidian";

/** Text kept for one undo, in UTF-16 code units: about 64 MB. */
const BUDGET = 32 * 1024 * 1024;

interface RewrittenNote { path: string; before: string; after: string }

export class NoteRewriteJournal {
	readonly notes: RewrittenNote[] = [];
	private size = 0;
	/** Too much text to keep: this rewrite offers no undo, rather than a partial one. */
	overflowed = false;
	/** Anything besides the notes to put back, such as a deleted callout type. */
	afterUndo: (() => void | Promise<void>) | null = null;

	record(path: string, before: string, after: string): void {
		if (this.overflowed) return;
		this.size += before.length + after.length;
		if (this.size > BUDGET) { this.overflowed = true; this.notes.length = 0; return; }
		this.notes.push({ path, before, after });
	}
}

let last: NoteRewriteJournal | null = null;

/** Keep `journal` as the rewrite Undo reverses, if it can be reversed whole. */
export function keepForUndo(journal: NoteRewriteJournal): boolean {
	last = journal.notes.length > 0 && !journal.overflowed ? journal : null;
	return last !== null;
}

/** Whether `journal` is still the one Undo would reverse. */
export function canUndo(journal: NoteRewriteJournal): boolean {
	return last === journal;
}

/** Reverse `journal`, once: see the module comment for what is and is not restored. */
export async function undoNoteRewrite(app: App, journal: NoteRewriteJournal): Promise<{ restored: number; skipped: number }> {
	if (last !== journal) return { restored: 0, skipped: 0 };
	last = null;
	let restored = 0, skipped = 0;
	const files = new Map<string, TFile>(app.vault.getMarkdownFiles().map(file => [file.path, file]));
	for (const note of journal.notes) {
		// Moved or deleted since: nothing at that path to put back.
		const file = files.get(note.path);
		if (!file) { skipped++; continue; }
		let putBack = false;
		try {
			await app.vault.process(file, (content) => {
				if (content !== note.after) return content;
				putBack = true;
				return note.before;
			});
		} catch (error) {
			console.warn("[callout-studio] could not undo the rewrite of", note.path, error);
			putBack = false;
		}
		if (putBack) restored++; else skipped++;
	}
	await journal.afterUndo?.();
	return { restored, skipped };
}
