/** Read-only source occurrences. Registration/settings are deliberately absent. */
import { scanLineForCalloutTokens, type LineCalloutToken, type ScanLineOptions } from "./calloutTokens";
import { iterateMarkdownSourceSteps, type MarkdownSourceLine } from "./markdownExclusions";

export interface DocumentCalloutLine extends MarkdownSourceLine {
	tokens: LineCalloutToken[];
}

export interface DocumentCallout {
	token: LineCalloutToken;
	lineIndex: number;
	lineOffset: number;
}

/** Null steps let async consumers yield during preparation and very long lines. */
export function* iterateDocumentCalloutSteps(content: string, options: ScanLineOptions = {}): Generator<DocumentCalloutLine | null> {
	for (const line of iterateMarkdownSourceSteps(content)) {
		if (!line) { yield null; continue; }
		const tokens = line.visible.includes("[!") ? scanLineForCalloutTokens(line.lineText, {
			...options, visibleLine: line.visible, contentFrom: line.prefix.from,
			blockQuote: line.prefix.lastContainer === "quote",
		}) : [];
		yield { ...line, tokens };
	}
}

/** Every source line is yielded exactly once, including empty/excluded lines. */
export function* iterateDocumentCalloutLines(content: string, options: ScanLineOptions = {}): Generator<DocumentCalloutLine> {
	for (const line of iterateDocumentCalloutSteps(content, options)) if (line) yield line;
}

/**
 * One line as the whole document reads it: a fence opened ten lines up makes
 * it code, which the line on its own cannot know. Null past the last line.
 */
export function documentCalloutLineAt(content: string, lineIndex: number, options: ScanLineOptions = {}): DocumentCalloutLine | null {
	for (const line of iterateDocumentCalloutLines(content, options)) {
		if (line.lineIndex === lineIndex) return line;
	}
	return null;
}

/** Full original token spans, metadata, role, line and absolute line offset. */
export function* iterateDocumentCallouts(content: string, options: ScanLineOptions = {}): Generator<DocumentCallout> {
	for (const { tokens, lineIndex, lineOffset } of iterateDocumentCalloutLines(content, options)) {
		for (const token of tokens) yield { token, lineIndex, lineOffset };
	}
}
