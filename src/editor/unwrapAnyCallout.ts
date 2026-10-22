/**
 * editor/unwrapAnyCallout.ts — "Unwrap from callout", for all three formats.
 *
 * One command takes off whichever callout is innermost at the cursor: an
 * inline pill the cursor touches, then the heading callout on the cursor's
 * line, then the block callout the line sits in. Block callouts keep their
 * own unwrap (CalloutBlockTools); a pill or a heading token becomes plain
 * text through `convertCalloutLine`, the same code **Convert uses to plain
 * text** writes notes with, so the two can never leave different text behind.
 */
import { Notice, type Editor, type EditorPosition } from "obsidian";
import { t } from "../i18n";
import { convertCalloutLine, type Edit } from "../utils/calloutPlainTextLine";
import { unwrapCalloutAtSelection } from "./CalloutBlockTools";
import { tokenEnd, type LineCalloutToken } from "./calloutTokens";
import { documentCalloutLineAt } from "./documentCallouts";

/**
 * The pill or heading token to take off, or null to fall through to the block
 * the line sits in. A pill wins over the heading it is written in, the way the
 * block it is written in loses to it: innermost first.
 */
const pickToken = (
	tokens: readonly LineCalloutToken[],
	from: EditorPosition,
	to: EditorPosition,
): LineCalloutToken | null => {
	const pills = tokens.filter((token) => token.role === "inline");
	// Tokens come in source order, so of two the cursor touches the later is
	// the one nested in the other, or the one the cursor is at the front of.
	const atCursor = pills.filter((token) => token.from <= from.ch && from.ch <= tokenEnd(token));
	if (atCursor.length > 0) return atCursor[atCursor.length - 1]!;
	// A selection on one line may start just before the pill it means.
	const selected = from.line === to.line
		? pills.find((token) => token.from < to.ch && from.ch < tokenEnd(token))
		: undefined;
	return selected ?? tokens.find((token) => token.role === "heading") ?? null;
};

/**
 * Where `ch` lands once `edits` are applied. Inside the removed token it goes
 * to the same place in the text that stays — the pill's own words — or to
 * where the token was, when nothing of it stays.
 */
const mapCh = (ch: number, edits: readonly Edit[], target: LineCalloutToken): number => {
	let shift = 0;
	for (const edit of edits) {
		if (ch >= edit.to) {
			shift += edit.text.length - (edit.to - edit.from);
			continue;
		}
		if (ch > edit.from) {
			const kept = target.content ? target.content.from + 1 : edit.to;
			return edit.from + shift + Math.min(Math.max(ch - kept, 0), edit.text.length);
		}
		break;
	}
	return ch + shift;
};

/**
 * Take one callout off at the cursor — or, with a selection, at its start —
 * keeping its content. Returns whether anything changed.
 */
export const unwrapCalloutAtCursor = (editor: Editor): boolean => {
	const head = editor.getCursor("head");
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");

	const lexed = documentCalloutLineAt(editor.getValue(), from.line);
	const target = lexed ? pickToken(lexed.tokens, from, to) : null;
	if (!lexed || !target) return unwrapCalloutAtSelection(editor);

	const { lineText: line, tokens, visible, prefix } = lexed;
	const result = convertCalloutLine({ line, tokens, visible, prefix, take: (token) => token === target });
	if (result.count === 0) {
		new Notice(t("notice.unwrapLeftAsIs"));
		return false;
	}

	editor.replaceRange(
		result.after,
		{ line: from.line, ch: 0 },
		{ line: from.line, ch: editor.getLine(from.line).length },
	);
	const at = head.line === from.line ? head.ch : from.ch;
	editor.setCursor({
		line: from.line,
		ch: Math.min(mapCh(at, result.edits, target), result.after.length),
	});
	return true;
};
