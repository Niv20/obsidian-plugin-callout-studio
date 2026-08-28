/**
 * editor/activeTypingIds.ts — the callout ids the user is in the middle of
 * typing, read from the live CodeMirror buffer.
 *
 * Discovery scans a file through `cachedRead`, which answers with what is on
 * disk. This answers with what is under the cursor *right now*, and the gap
 * between the two is the whole point: an id still being typed must not be
 * auto-created, because the new row would be fed straight back into the
 * autocomplete dropdown the user is typing into. Committing is modelled as the
 * cursor leaving the line.
 *
 * Lives here rather than in `manager/` because everything it touches is an
 * editor concern — `workspace.activeEditor`, a cursor, and the same line
 * tokenizer the editor surfaces use.
 *
 * ## Ask this on the write path only
 *
 * "The cursor is on the line" is evidence of typing **only when something was
 * just written**. Opening a note also makes it `workspace.activeEditor`, with
 * the cursor at line 0 — so for the ordinary note, one that *starts* with
 * `> [!alpha]`, the id sits on the cursor's line through no act of the user's.
 *
 * Asking on that path is what made `file-open` discovery look broken while
 * working perfectly: the scan ran, found the id, filtered it out as
 * "in progress", and discarded it. Every note whose callout was on the line
 * the cursor happened to land on was silently skipped, which is most notes —
 * and the only id that still reached the settings list was whichever one the
 * settings tab's own (unfiltered) sweep of the visible tab could see.
 *
 * The distinction is not a heuristic. Opening a note is not typing in it, and
 * the content the scan read came off disk, already committed. Nothing is lost
 * by not asking: the half-typed id this protects is one the user is still
 * editing, and editing it produces a write, which is the path that does ask.
 */
import type { App, TFile } from "obsidian";
import { normalizeCalloutId } from "../utils/calloutId";
import { scanLineForCalloutTokens } from "./calloutTokens";

/**
 * If the active editor is editing `file`, the (lowercased) ids of every callout
 * token — regular, heading, or inline — on the cursor's line; otherwise `null`.
 *
 * `null` covers three distinct cases that all mean the same thing to a caller:
 * no editor is active at all, the active editor is on a different file, and the
 * cursor's line holds no callout token.
 */
export function activeTypingCalloutIds(
	app: App,
	file: TFile,
): Set<string> | null {
	const active = app.workspace.activeEditor;
	if (!active?.editor || active.file !== file) return null;
	const editor = active.editor;
	const line = editor.getLine(editor.getCursor().line); // live buffer
	const ids = new Set<string>();
	// Token ids are normalized exactly like the vault scanner's, so multi-word
	// IDs with spaces match identically.
	for (const token of scanLineForCalloutTokens(line)) {
		const id = normalizeCalloutId(token.rawId);
		if (id) ids.add(id);
	}
	return ids.size > 0 ? ids : null;
}
