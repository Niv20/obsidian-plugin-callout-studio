/**
 * editor/quotePrefix.ts — Blockquote prefix arithmetic over a single line.
 *
 * Every callout transform is really a question about `>` markers: how many a
 * line carries, how much text they cost, and what a line at a given depth
 * looks like. Kept apart from the transforms themselves (CalloutBlockTools,
 * fenceBlocks) so the one regex that defines "a quote token" has a single home
 * — the lazy `> ` with an optional space, and the tab an indented continuation
 * uses instead.
 */

export interface QuoteStripResult {
	text: string;
	removedLength: number;
	removedUnits: number;
}

const LEADING_QUOTE_TOKEN_REGEX = /^(?:\s*> ?|\t)/;

/** Peel quote tokens off the front of a line, up to `maxTokens` of them. */
export const stripLeadingQuoteTokens = (
	line: string,
	maxTokens = Number.POSITIVE_INFINITY,
): QuoteStripResult => {
	let remaining = line;
	let removedLength = 0;
	let removedUnits = 0;

	while (removedUnits < maxTokens) {
		const match = LEADING_QUOTE_TOKEN_REGEX.exec(remaining);
		if (!match?.[0]) break;
		remaining = remaining.slice(match[0].length);
		removedLength += match[0].length;
		removedUnits += 1;
	}

	return {
		text: remaining,
		removedLength,
		removedUnits,
	};
};

/** How deep inside blockquotes a line sits. */
export const countLeadingQuoteTokens = (line: string): number =>
	stripLeadingQuoteTokens(line).removedUnits;

/** Whether a line is empty once its quote markers are taken off. */
export const isBlankCalloutLine = (line: string): boolean =>
	stripLeadingQuoteTokens(line).text.trim() === "";

/** The `> ` run that puts a line at `nestLevel` deep. */
export const buildPrefix = (nestLevel: number): string =>
	"> ".repeat(nestLevel);
