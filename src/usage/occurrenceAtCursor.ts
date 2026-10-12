/**
 * usage/occurrenceAtCursor.ts — Which result card the caret is in.
 *
 * Find callouts marks the card for the callout under the caret, the way the
 * core Outline marks the heading the caret is under. It runs on caret moves, so
 * it reads the caret's own line and, for a block callout, walks up only the
 * quote the caret sits in. Only cards the sidebar has drawn are candidates: a
 * callout filtered out (or behind Show more) never matches, and the callout
 * around it does instead.
 */
import type { EditorPosition } from "obsidian";
import { scanLineForCalloutTokens, tokenEnd } from "../editor/calloutTokens";
import { headerQuoteDepth, type SourceLines } from "../editor/calloutExtent";
import { countQuoteMarkers } from "../editor/quotePrefix";
import type { CalloutOccurrence } from "./occurrenceTypes";

/** One note's drawn cards, by zero-based source line. */
export type OccurrencesByLine = ReadonlyMap<number, readonly CalloutOccurrence[]>;

/**
 * Innermost first: an inline pill the caret touches, a heading callout on the
 * caret's line, then the nearest block callout whose quote holds the caret.
 * A card whose line no longer reads as it was indexed (typing the index has
 * not caught up with yet) never matches; the next index update asks again.
 */
export function occurrenceAtCursor(
	lines: SourceLines,
	cursor: EditorPosition,
	byLine: OccurrencesByLine,
): CalloutOccurrence | null {
	if (byLine.size === 0 || cursor.line < 0 || cursor.line >= lines.lineCount()) return null;
	const current = (occurrence: CalloutOccurrence): boolean =>
		occurrence.lineText === lines.getLine(occurrence.line);
	const here = (byLine.get(cursor.line) ?? []).filter(current);
	if (here.some((occurrence) => occurrence.role === "inline")) {
		// The index keeps the bracket only; the pill also covers its `{…}` payload.
		const tokens = scanLineForCalloutTokens(lines.getLine(cursor.line));
		const touched = here.find((occurrence) => {
			if (occurrence.role !== "inline") return false;
			const token = tokens.find((candidate) => candidate.from === occurrence.from);
			return occurrence.from <= cursor.ch && cursor.ch <= (token ? tokenEnd(token) : occurrence.to);
		});
		if (touched) return touched;
	}
	const heading = here.find((occurrence) => occurrence.role === "heading");
	if (heading) return heading;
	// The callout holding a line is the nearest header above it no deeper than
	// the shallowest line between them; a blank or unquoted line ends the quote.
	let depth = Number.POSITIVE_INFINITY;
	for (let line = cursor.line; line >= 0; line--) {
		const text = lines.getLine(line);
		const headers = (byLine.get(line) ?? []).filter((occurrence) =>
			occurrence.role === "regular" && current(occurrence));
		// A header under a list item (`- > [!x]`) starts with the bullet, which
		// hides its `>` from a line-start count; the token knows its own depth.
		const lineDepth = Math.max(countQuoteMarkers(text), ...headers.map(blockDepth));
		if (text.trim() === "" || lineDepth === 0) return null;
		depth = Math.min(depth, lineDepth);
		const header = headers.find((occurrence) => blockDepth(occurrence) <= depth);
		if (header) return header;
	}
	return null;
}

const blockDepth = (occurrence: CalloutOccurrence): number =>
	Math.max(1, headerQuoteDepth(occurrence.lineText, occurrence.from));
