import { scanLineForCalloutTokens, tokenEnd, type LineCalloutToken } from "../editor/calloutTokens";
import { iterateDocumentCalloutLines } from "../editor/documentCallouts";
import { convertCalloutLine, type Edit } from "./calloutPlainTextLine";
import { portableCalloutMasks } from "./portableCalloutExclusions";

export interface PortableCalloutConversion {
	content: string;
	count: number;
	headings: number;
	inline: number;
	/** Recognized tokens in unsupported open/nested payloads, left untouched. */
	skipped: number;
}

export interface PortableCalloutLineChange {
	/** One-based source line, with its original line ending preserved. */
	line: number;
	before: string;
	after: string;
	count: number;
	headings: number;
	inline: number;
	/** Approved, non-overlapping source ranges before block-syntax escaping. */
	edits: readonly Edit[];
}

/**
 * Convert plugin-only heading/inline syntax using original-source offsets.
 * Native block headers, protected examples and ambiguous payloads remain intact.
 * This deliberately does not consult the registry or display settings: a portable
 * note retains the type spelling written in its source even for unknown types.
 */
export function convertPortableCallouts(source: string, onChange?: (change: PortableCalloutLineChange) => void): PortableCalloutConversion {
	const result: PortableCalloutConversion = { content: source, count: 0, headings: 0, inline: 0, skipped: 0 };
	if (!source.includes("[!")) return result;
	const lines = Array.from(iterateDocumentCalloutLines(source));
	const masks = portableCalloutMasks(lines);
	const output = lines.map(({ lineText: line, prefix, lineIndex, tokens: originalTokens }) => {
		const visible = masks[lineIndex]!;
		const rescanned = scanLineForCalloutTokens(line, { visibleLine: visible, contentFrom: prefix.from, blockQuote: prefix.lastContainer === "quote" });
		const tokens = originalTokens.filter(token => visible.slice(token.from, token.to) === line.slice(token.from, token.to));
		if (!tokens.length) return line;
		const unsupported = new Set<LineCalloutToken>();
		const reparsedByFrom = new Map(rescanned.map(token => [token.from, token]));
		for (const token of tokens) {
			const reparsed = reparsedByFrom.get(token.from);
			// A new exclusion must never silently change which braces a pill owns.
			if (!reparsed || tokenEnd(reparsed) !== tokenEnd(token) || reparsed.contentOpen !== token.contentOpen) {
				unsupported.add(token);
				for (const child of tokens) if (child.from > token.from && child.from < Math.max(tokenEnd(token), reparsed ? tokenEnd(reparsed) : token.to)) unsupported.add(child);
			}
		}
		const { after, edits, count, headings, inline, skipped } = convertCalloutLine({ line, tokens, visible, prefix, unsupported });
		result.skipped += skipped;
		if (!count) return line;
		result.count += count;
		result.headings += headings;
		result.inline += inline;
		onChange?.({ line: lineIndex + 1, before: line, after, count, headings, inline, edits: edits.map(edit => ({ ...edit })) });
		return after;
	});
	result.content = output.join("\n");
	return result;
}
