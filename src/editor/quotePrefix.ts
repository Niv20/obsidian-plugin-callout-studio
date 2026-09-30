/**
 * editor/quotePrefix.ts — Blockquote prefix arithmetic over a single line.
 *
 * Every callout transform is really a question about `>` markers: how many a
 * line carries, how much text they cost, and what a line at a given depth
 * looks like. Kept apart from the transforms themselves (CalloutBlockTools,
 * fenceBlocks) so the regexes that define "a quote token" have a single home.
 * There are two readings: the lenient one — the lazy `> ` with an optional
 * space, and the tab an indented continuation uses instead — which unwrap
 * leans on, and the strict one wrapping measures depth with
 * (`splitQuoteMarkers`).
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

const QUOTE_MARKER_REGEX = /^> ?/;

/**
 * The `>` markers that open a line, read the strict way wrapping needs.
 *
 * The first marker must start the line and each next one must follow straight
 * on, after at most one space; a tab or an indented `>` ends the run. Those
 * belong to a list item or to indented text, so wrapping has to carry them as
 * content rather than let them decide how deep the line is. The lenient
 * tokens above stay as they are for unwrap, which does want to reach a
 * callout indented under a list item.
 */
export const splitQuoteMarkers = (
	line: string,
	maxMarkers = Number.POSITIVE_INFINITY,
): { depth: number; text: string } => {
	let text = line;
	let depth = 0;
	while (depth < maxMarkers) {
		const match = QUOTE_MARKER_REGEX.exec(text);
		if (!match) break;
		text = text.slice(match[0].length);
		depth += 1;
	}
	return { depth, text };
};

/**
 * How many `>` markers open a line, indented or not. Unlike the lenient tokens
 * above, a bare tab is not one: it indents what follows. This is the count to
 * compare with the line above when asking whether a quote starts here, where
 * a tab-indented list line counted as quoted would hide the callout after it.
 */
export const countQuoteMarkers = (line: string): number => {
	const markers = /^(?:\s*>)*/.exec(line)?.[0] ?? "";
	return markers.split(">").length - 1;
};

const CALLOUT_HEADER_REGEX = /^\[![^\]]*\]/;

/**
 * Whether a line opens a callout, given its text past the markers, its depth,
 * and the depth of the line above (0 when there is none).
 *
 * `[!…]` makes a header only on the first line of its quote, where the line
 * above sits shallower. Further down a quote it is text inside that quote,
 * which renders as an inline pill, and treating it as a header is how a
 * transform ends up splitting a callout or deleting the line.
 */
export const opensCallout = (
	text: string,
	depth: number,
	depthAbove: number,
): boolean => depth > 0 && depth > depthAbove && CALLOUT_HEADER_REGEX.test(text);
