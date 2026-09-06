import {
	createDocumentLineFilter, scanLineForCalloutTokens, tokenEnd,
	type LineCalloutToken,
} from "../editor/calloutTokens";
import { splitFoldMark } from "../editor/calloutWriter";
import { calloutIdentity } from "./calloutId";

interface Edit { from: number; to: number; text: string; count: number }

function applyEdits(source: string, from: number, to: number, edits: Edit[]): string {
	let result = source.slice(from, to);
	for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
		result = result.slice(0, edit.from - from) + edit.text + result.slice(edit.to - from);
	}
	return result;
}

/** Build non-overlapping edits using only offsets/token exclusions in the source. */
function rewriteLine(line: string, tokens: LineCalloutToken[], ids: ReadonlySet<string>, name: string, outer: boolean) {
	const edits: Edit[] = [];
	for (const token of [...tokens].sort((a, b) => b.from - a.from)) {
		// Consume previously planned children into their original payload. No
		// generated prose, escape or code span is scanned a second time.
		const children = token.content
			? edits.filter(edit => edit.from >= token.content!.from + 1 && edit.to <= token.content!.to - 1)
			: [];
		for (const child of children) edits.splice(edits.indexOf(child), 1);
		// A payload inside a surviving pill remains literal payload, as it was
		// before conversion; only an unwrapped parent exposes its inner tokens.
		if (!ids.has(calloutIdentity(token.rawId))) continue;
		const count = 1 + children.reduce((total, edit) => total + edit.count, 0);
		if (token.role === "inline") {
			const payload = token.content
				? applyEdits(line, token.content.from + 1, token.content.to - 1, children).trim()
				: "";
			edits.push({ from: token.from, to: tokenEnd(token), text: payload ? `${name}: ${payload}` : name, count });
		} else {
			const { foldMark, title } = splitFoldMark(line.slice(token.to), token.role);
			const gap = title.length - title.replace(/^[ \t]+/, "").length;
			edits.push({
				from: outer && token.role === "regular" ? 0 : token.from,
				to: token.to + foldMark.length + gap,
				text: outer || title.trim() ? "" : name, count,
			});
		}
	}
	return { line: applyEdits(line, 0, line.length, edits), count: edits.reduce((total, edit) => total + edit.count, 0) };
}

/** Convert matching source tokens while unwrapping each outer block only once. */
export function calloutsToPlainText(content: string, ids: ReadonlySet<string>, displayName: string): { content: string; count: number } | null {
	const lines = content.split("\n"), isContentLine = createDocumentLineFilter();
	let unwrapping = false, count = 0;
	const converted = lines.map((line, index) => {
		if (!line.startsWith(">")) unwrapping = false;
		const tokens = isContentLine(line, index) ? scanLineForCalloutTokens(line) : [];
		const header = tokens[0]?.role === "regular" ? tokens[0] : undefined;
		const matchingHeader = header !== undefined && ids.has(calloutIdentity(header.rawId));
		const outer = matchingHeader && /^>[ \t]*$/.test(line.slice(0, header.from));
		if (outer) unwrapping = true;
		if (matchingHeader) {
			// Native header scanning excludes its title. Once the header is
			// removed, matching tokens there must be converted as source prose.
			const masked = "x" + " ".repeat(header.to - 1) + line.slice(header.to);
			tokens.push(...scanLineForCalloutTokens(masked));
		}
		const result = rewriteLine(line, tokens, ids, displayName.trim(), outer);
		count += result.count;
		return unwrapping && !outer ? result.line.replace(/^>[ \t]?/, "") : result.line;
	});
	return count ? { content: converted.join("\n"), count } : null;
}
