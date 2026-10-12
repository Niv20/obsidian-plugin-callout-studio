/**
 * editor/calloutExtent.ts — How much of the source one callout covers.
 *
 * Two sidebar features ask, and their answers have to agree with each other
 * and with how the note renders: the landing flash after a result is clicked
 * (what to scroll to and light up), and cursor-follow (is the caret inside a
 * callout). The block rule is the one wrap and unwrap already use
 * (CalloutBlockTools' findContainingCallout): a callout runs from its header
 * down to the first blank line, or the first line quoted shallower than it.
 */
import type { CalloutRenderRole } from "../types";
import { scanLineForCalloutTokens, tokenEnd } from "./calloutTokens";
import { countQuoteMarkers, opensCallout, stripLeadingQuoteTokens } from "./quotePrefix";

/** A document read line by line: an Editor, a CodeMirror doc, or split text. */
export interface SourceLines {
	getLine(line: number): string;
	lineCount(): number;
}

export function linesOf(content: string): SourceLines {
	const lines = content.split("\n");
	return { getLine: (line) => lines[line] ?? "", lineCount: () => lines.length };
}

/** What a sidebar result covers in its note. */
export interface CalloutExtent {
	/** `"span"` is a range that is no callout token (a link a conversion repairs). */
	kind: CalloutRenderRole | "span";
	/** Zero-based and inclusive. Only a block callout spans more than one line. */
	startLine: number;
	endLine: number;
	/** Columns on `startLine`: the token (with any `{…}` payload), or the span. */
	from: number;
	to: number;
}

/** The `>` markers in front of a header token: how deep the quote it opens sits. */
export const headerQuoteDepth = (lineText: string, from: number): number =>
	lineText.slice(0, from).split(">").length - 1;

/** Last line of the callout a header `depth` quotes deep opens on `headerLine`. */
export function blockCalloutEndLine(lines: SourceLines, headerLine: number, depth: number): number {
	let last = headerLine;
	for (let line = headerLine + 1; line < lines.lineCount(); line++) {
		const text = lines.getLine(line);
		if (text.trim() === "" || countQuoteMarkers(text) < depth) break;
		last = line;
	}
	return last;
}

/**
 * Whether `line` opens a block callout. `[!…]` is a header only on the first
 * line of its quote; further down the same quote it is body text.
 */
export function isBlockHeaderLine(lines: SourceLines, line: number): boolean {
	const text = lines.getLine(line);
	return opensCallout(
		stripLeadingQuoteTokens(text).text,
		countQuoteMarkers(text),
		line > 0 ? countQuoteMarkers(lines.getLine(line - 1)) : 0,
	);
}

/**
 * The callout whose token overlaps columns `from`–`to` of `line`, or a plain
 * span over those columns when no token does. Null only for a missing line.
 */
export function calloutExtentAt(lines: SourceLines, line: number, from: number, to = from): CalloutExtent | null {
	if (line < 0 || line >= lines.lineCount()) return null;
	const text = lines.getLine(line);
	const tokens = scanLineForCalloutTokens(text);
	const token = tokens.find((candidate) => candidate.from === from) ??
		tokens.find((candidate) => candidate.from < Math.max(to, from + 1) && tokenEnd(candidate) > from);
	if (!token) return { kind: "span", startLine: line, endLine: line, from, to: Math.max(from, to) };
	const extent = { startLine: line, endLine: line, from: token.from, to: tokenEnd(token) };
	if (token.role !== "regular") return { kind: token.role, ...extent };
	const depth = Math.max(1, headerQuoteDepth(text, token.from));
	return { kind: "regular", ...extent, endLine: blockCalloutEndLine(lines, line, depth) };
}
