/**
 * utils/noteRewriteUndo.ts — one step back for a vault-wide note rewrite.
 *
 * **Replace in vault** and **Convert uses to plain text** rewrite every note
 * that uses a callout, and had no undo: a wrong pick meant restoring notes
 * from a backup, if there was one. A rewrite now records each note's text
 * before and after it, in memory, for the most recent rewrite only and within
 * a size budget. Undo puts
 * back each note that still holds exactly what the rewrite left. A note edited
 * since is left alone and counted, never overwritten, and nothing is written
 * to a note the rewrite did not change.
 *
 * One journal can span several passes over the vault — the callout editor's
 * save rewrites ids, then titles, then fold marks — so a note may be recorded
 * more than once. Those records are chained into one: Undo has to go from the
 * last pass's text straight back to the first pass's, and two separate records
 * would each find the note holding something other than what they expect.
 */
import type { App, TFile } from "obsidian";

/** Text kept for one undo, in UTF-16 code units: about 64 MB. */
const BUDGET = 32 * 1024 * 1024;

interface RewrittenNote {
	path: string;
	before: string;
	after: string;
	/**
	 * The note changed between two passes of this journal — typed into while
	 * the save ran — so no single text before them all is its own. Undo leaves
	 * it alone, as it does a note edited after the rewrite.
	 */
	broken?: true;
}

export class NoteRewriteJournal {
	readonly notes: RewrittenNote[] = [];
	/** `notes` by path, so a later pass finds its note without a scan. */
	private byPath = new Map<string, RewrittenNote>();
	private size = 0;
	/** Too much text to keep: this rewrite offers no undo, rather than a partial one. */
	overflowed = false;

	record(path: string, before: string, after: string): void {
		if (this.overflowed) return;
		const earlier = this.byPath.get(path);
		if (earlier) {
			// A later pass over the same note. Chained only when it picked up
			// exactly where the earlier one left off; anything else means the
			// note was edited in between, and restoring the first `before` would
			// throw that edit away.
			if (earlier.after !== before) earlier.broken = true;
			this.size += after.length - earlier.after.length;
			earlier.after = after;
		} else {
			this.size += before.length + after.length;
			const note = { path, before, after };
			this.notes.push(note);
			this.byPath.set(path, note);
		}
		if (this.size > BUDGET) { this.overflowed = true; this.notes.length = 0; this.byPath.clear(); }
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
		if (!file || note.broken) { skipped++; continue; }
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
	return { restored, skipped };
}
