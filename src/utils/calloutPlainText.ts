/**
 * utils/calloutPlainText.ts — Convert uses to plain text, for one callout type.
 *
 * The block callout is this file's own part: the outermost one is unwrapped,
 * header, `>` prefixes and all, and keeps its title as a line of its own; a
 * nested one keeps its parent's depth and loses only its `[!id]`. What heading
 * and inline tokens become is convertCalloutLine's, the same code Review
 * conversion runs, so the two never disagree about what a pill leaves behind.
 */
import { scanLineForCalloutTokens, type LineCalloutToken } from "../editor/calloutTokens";
import { iterateDocumentCalloutLines, type DocumentCalloutLine } from "../editor/documentCallouts";
import { splitFoldMark } from "../editor/calloutWriter";
import { calloutIdentity } from "./calloutId";
import { convertCalloutLine, plainTextLabel, type CalloutLineInput } from "./calloutPlainTextLine";

/**
 * A matching block header with its `[!id]` and fold mark gone. The outermost
 * one leaves only its title; a nested one keeps the parent's `>`, and its type
 * as written when it had no title. Native header scanning never looked inside
 * the title, so what is left is scanned again, as prose.
 */
function withoutHeader({ lineText, visible, prefix, tokens }: DocumentCalloutLine, outer: boolean): CalloutLineInput {
	const header = tokens[0]!;
	const { foldMark, title } = splitFoldMark(lineText.slice(header.to), header.role);
	const gap = title.length - title.replace(/^[ \t]+/, "").length;
	const from = outer ? 0 : header.from, to = header.to + foldMark.length + gap;
	const label = outer || title.trim() ? "" : plainTextLabel(header.rawId);
	const line = lineText.slice(0, from) + label + lineText.slice(to);
	const shown = visible.slice(0, from) + label + visible.slice(to);
	return {
		line, visible: shown,
		tokens: scanLineForCalloutTokens(line, { visibleLine: shown, contentFrom: from, blockQuote: false }),
		prefix: { from, quoteDepth: outer ? 0 : prefix.quoteDepth },
	};
}

/** Convert every use of `ids`, unwrapping each outermost block only once. */
export function calloutsToPlainText(content: string, ids: ReadonlySet<string>): { content: string; count: number } | null {
	const lines = Array.from(iterateDocumentCalloutLines(content));
	const take = (token: LineCalloutToken): boolean => ids.has(calloutIdentity(token.rawId));
	let unwrapping = false, count = 0;
	/** Visible text outside any quote, which a title written after it would join. */
	const isOpenProse = (index: number): boolean => {
		const above = lines[index];
		return above !== undefined && !/^[ \t]*>/.test(above.lineText) &&
			above.visible.replace(/\0/g, "").trim() !== "";
	};
	const converted = lines.map((source, index) => {
		const { lineText, tokens, visible, prefix } = source;
		if (!/^[ \t]*>/.test(lineText)) unwrapping = false;
		const header = tokens[0]?.role === "regular" && take(tokens[0]) ? tokens[0] : undefined;
		const outer = header !== undefined && prefix.listIndent === 0 && /^[ \t]*>[ \t]*$/.test(lineText.slice(0, header.from));
		if (outer) unwrapping = true;
		if (header) count++;
		const result = convertCalloutLine({
			...(header ? withoutHeader(source, outer) : { line: lineText, tokens, visible, prefix }),
			take,
		});
		count += result.count;
		const line = result.after;
		// The callout was a block of its own. Right under a paragraph, its
		// title would become that paragraph's next line without a blank one.
		if (outer && line.trim() !== "" && isOpenProse(index - 1)) return `\n${line}`;
		return unwrapping && !outer ? line.replace(/^([ \t]*)>[ \t]?/, "$1") : line;
	});
	return count ? { content: converted.join("\n"), count } : null;
}
