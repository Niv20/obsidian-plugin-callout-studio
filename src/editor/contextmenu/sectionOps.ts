/**
 * editor/contextmenu/sectionOps.ts — Whole-section operations for heading
 * callouts.
 *
 * A heading callout "owns" its section: the heading line plus everything up
 * to (but not including) the next heading of the same or a higher level.
 * Cut / copy / delete act on that entire range. These are single editor
 * transactions, so Ctrl/Cmd+Z restores them — no confirmation modal is used
 * (unlike DEFINITION deletion, which is guarded elsewhere).
 */
import { Notice, type App, type Editor, type EditorPosition, type MarkdownView } from "obsidian";
import { t } from "../../i18n";
import { sectionEndLine } from "./sectionBoundary";

export interface HeadingSectionRange {
	from: EditorPosition;
	to: EditorPosition;
	text: string;
}

/**
 * Compute the section range for a heading callout at `headingLine`.
 * The range starts at the heading line and ends just before the next
 * heading whose level ≤ `level` (or at end-of-document).
 */
export function getHeadingSectionRange(
	editor: Editor,
	headingLine: number,
	level: number,
): HeadingSectionRange {
	const lastLine = editor.lineCount() - 1;
	const endLine = Math.min(lastLine, sectionEndLine(editor, headingLine, level) - 1);

	const from: EditorPosition = { line: headingLine, ch: 0 };
	// Include the trailing newline so the whole block (and the blank line it
	// leaves behind) is removed cleanly — except at end-of-document, where
	// there is no newline to consume.
	const to: EditorPosition =
		endLine < lastLine
			? { line: endLine + 1, ch: 0 }
			: { line: endLine, ch: editor.getLine(endLine).length };

	return { from, to, text: editor.getRange(from, to) };
}

/** Copy the whole section to the clipboard (trailing newline trimmed). */
export async function copyHeadingSection(range: HeadingSectionRange): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(range.text.replace(/\n$/, ""));
		return true;
	} catch {
		new Notice(t("notice.clipboardWriteFailed"));
		return false;
	}
}

/** Capture ownership before a menu/clipboard wait can switch the note. */
export function captureSectionTarget(app: App, view: MarkdownView | null, editor: Editor): () => boolean {
	const file = view?.file;
	return () => {
		try {
			return !!view && !!file && view.file === file && view.editor === editor &&
				view.leaf?.view === view && app.workspace.getLeavesOfType("markdown").includes(view.leaf);
		} catch { return false; }
	};
}

/** Delete only after copying succeeds and both the document and owner still match. */
export async function cutHeadingSection(
	editor: Editor,
	range: HeadingSectionRange,
	canDelete: () => boolean = () => true,
): Promise<boolean> {
	if (!canDelete()) return false;
	const before = editor.getValue();
	if (!await copyHeadingSection(range)) return false;
	if (!canDelete() || editor.getValue() !== before) {
		new Notice(t("notice.sectionChangedAfterCopy"));
		return false;
	}
	editor.replaceRange("", range.from, range.to);
	return true;
}

/** Delete the whole section (undoable via the editor's history). */
export function deleteHeadingSection(
	editor: Editor,
	range: HeadingSectionRange,
): void {
	editor.replaceRange("", range.from, range.to);
}
