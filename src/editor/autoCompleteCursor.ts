/**
 * editor/autoCompleteCursor.ts — where the cursor lands after a suggestion.
 *
 * Picking a callout from the popover is two separate jobs: writing the token
 * (calloutWriter, per role) and then putting the cursor where the user would
 * have put it. This is the second one, and it is deferred rather than immediate
 * — Obsidian closes the popover and restores its own selection first, so the
 * placement has to happen after that frame or it is simply overwritten.
 *
 * The rule is Enter's: a pick that finished a new callout opens a new line
 * below it, the way Enter at the end of that line would — carrying the header's
 * `>` prefix for a block callout, bare for a heading callout, which has no body
 * of its own. The line is always *opened*, never borrowed: turning the blank
 * line that separates the callout from the next paragraph into its body would
 * leave the two touching, and the first word typed would pull that paragraph
 * in as a lazy continuation. The one exception is a block callout whose body
 * already starts on the next line (what "Wrap in callout" leaves), where the
 * cursor goes to that body instead of opening an empty line above it.
 *
 * A pick that only changed an existing callout's type has nothing to open: the
 * cursor goes to the end of that line, where the title the user kept is.
 */
import type { Editor, EditorPosition } from "obsidian";
import { scanLineForCalloutTokens } from "./calloutTokens";

const CALLOUT_QUOTE_PREFIX_REGEX = /^((?:\s*> ?|\t)+)/;

const quotePrefixOf = (line: string): string =>
	CALLOUT_QUOTE_PREFIX_REGEX.exec(line)?.[1] ?? "";

const countQuoteTokens = (prefix: string): number =>
	(prefix.match(/>/g) ?? []).length;

/**
 * Put the cursor on the line a finished callout's content starts on, opening
 * that line when there is not one already.
 */
function moveToCalloutContent(
	editor: Editor,
	line: number,
	role: "regular" | "heading",
): void {
	const header = editor.getLine(line);
	// A header with no `>` of its own is the legacy bare `[!` block reading
	// (inline callouts off), which has always been given a `> ` body.
	const prefix = role === "heading" ? "" : quotePrefixOf(header) || "> ";
	const nextLine = line + 1;

	if (role === "regular" && nextLine < editor.lineCount()) {
		const nextPrefix = quotePrefixOf(editor.getLine(nextLine));
		if (countQuoteTokens(nextPrefix) >= countQuoteTokens(prefix)) {
			editor.setCursor({ line: nextLine, ch: nextPrefix.length });
			return;
		}
	}

	editor.replaceRange(`\n${prefix}`, { line, ch: header.length });
	editor.setCursor({ line: nextLine, ch: prefix.length });
}

/**
 * Place the cursor for a pick that wrote a `role` token on `line`, once the
 * popover has finished closing. `finishedNewCallout` is whether the pick
 * completed a callout that had no title yet, rather than retyping one.
 */
export function placeCursorAfterPick(
	editor: Editor,
	line: number,
	role: "regular" | "heading",
	finishedNewCallout: boolean,
): void {
	window.requestAnimationFrame(() => {
		window.setTimeout(() => {
			if (line >= editor.lineCount()) return;
			if (finishedNewCallout) {
				moveToCalloutContent(editor, line, role);
				return;
			}
			editor.setCursor({ line, ch: editor.getLine(line).length });
		}, 50);
	});
}

/**
 * Put the cursor at `pos` now, and again once the popover has closed if
 * Obsidian's selection restore moved it — but only while the line is still
 * exactly as the pick left it. A user fast enough to type in that window keeps
 * their keystroke and their cursor: re-asserting over an edited line would put
 * the cursor back behind what they just typed.
 *
 * For the picks that leave the cursor inside the token — Tab, and `|` — which
 * cannot use {@link placeCursorAfterPick}'s plain deferral for exactly that
 * reason: the next keystroke lands right there and is expected to. `then`
 * runs after the re-assert, for work that needs the settled cursor.
 */
export function parkCursor(
	editor: Editor,
	pos: EditorPosition,
	then?: () => void,
): void {
	editor.setCursor(pos);
	const expected = editor.getLine(pos.line);
	window.requestAnimationFrame(() => {
		window.setTimeout(() => {
			if (pos.line >= editor.lineCount()) return;
			if (editor.getLine(pos.line) !== expected) return;
			const now = editor.getCursor();
			if (now.line !== pos.line || now.ch !== pos.ch) editor.setCursor(pos);
			then?.();
		}, 50);
	});
}

/**
 * Leave an inline token the way Enter does: past `afterCh` (just after the
 * token), with exactly one space between it and whatever follows, so the user
 * keeps writing on the SAME line — an inline pick must not break the paragraph.
 *
 * A `{…}` right after the `]` is the pill's own text, and a space there would
 * turn it into literal prose (see inlineContent.ts), so the cursor goes past
 * the payload instead and nothing is added.
 */
export function landAfterInlineToken(
	editor: Editor,
	line: number,
	afterCh: number,
): void {
	const text = editor.getLine(line);
	if (text[afterCh] === "{") {
		const token = scanLineForCalloutTokens(text).find((t) => t.to === afterCh);
		editor.setCursor({ line, ch: token?.content ? token.content.to : afterCh });
		return;
	}
	if (text[afterCh] !== " ") {
		editor.replaceRange(" ", { line, ch: afterCh });
	}
	editor.setCursor({ line, ch: afterCh + 1 });
}
