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
import type { Editor } from "obsidian";

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
