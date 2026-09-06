/** Keep source escape decisions attached to text as content pills split it. */
import { scanLineForCalloutTokens, stripInlineCode, stripWikilinks } from "../editor/calloutTokens";
import { blankInlineMath } from "../editor/inlineContent";
import { splitCalloutMetadata } from "../utils/calloutId";

export interface InlineEscapePlan {
	allows(node: Text, from: number): boolean;
	split(node: Text, at: number): Text;
}

interface Candidate { node: Text; from: number; key: string; }
const keyOf = (id: string, metadata: string): string => JSON.stringify([id, metadata]);

/** Build once before either inline pass mutates the DOM. No-source exports keep their existing rendering. */
export function createInlineEscapePlan(
	el: HTMLElement,
	getSectionLines: () => string[] | null,
	excludeSelector: string,
	isHeadingLeading: (node: Text) => boolean,
): InlineEscapePlan {
	const pass = { allows: () => true, split: (node: Text, at: number) => node.splitText(at) };

	const candidates: Candidate[] = [];
	const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
		acceptNode: node => node.parentElement?.closest(excludeSelector)
			? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
	});
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		for (const token of scanLineForCalloutTokens(node.textContent ?? "", { inlineContent: false })) {
			if (token.role !== "inline" || (token.from === 0 && isHeadingLeading(node as Text))) continue;
			candidates.push({ node: node as Text, from: token.from, key: keyOf(token.rawId, token.metadata) });
		}
	}
	if (candidates.length === 0) return pass;
	const lines = getSectionLines();
	if (!lines || !lines.join("\n").includes("\\[!")) return pass;
	const sequence: Array<{ key: string; escaped: boolean }> = [];
	for (const rawLine of lines) {
		const line = blankInlineMath(stripWikilinks(stripInlineCode(rawLine)));
		const entries: Array<{ from: number; key: string; escaped: boolean }> = [];
		for (const token of scanLineForCalloutTokens(line, { inlineContent: false })) {
			if (token.role === "inline") entries.push({ from: token.from, key: keyOf(token.rawId, token.metadata), escaped: false });
		}
		for (const match of line.matchAll(/\\\[!([^\][\n\r]+)\]/g)) {
			const parts = splitCalloutMetadata(match[1] ?? "");
			if (parts.id.trim()) entries.push({ from: match.index + 1, key: keyOf(parts.id, parts.metadata), escaped: true });
		}
		entries.sort((a, b) => a.from - b.from);
		sequence.push(...entries);
	}
	// A changed/nested renderer can remove or reorder candidates. Do not turn
	// uncertain text into pills merely because its escape slash was consumed.
	if (sequence.length !== candidates.length || candidates.some((candidate, i) => candidate.key !== sequence[i]?.key)) {
		return { ...pass, allows: () => false };
	}

	const flags = new WeakMap<Text, Map<number, boolean>>();
	candidates.forEach((candidate, index) => {
		let nodeFlags = flags.get(candidate.node);
		if (!nodeFlags) { nodeFlags = new Map(); flags.set(candidate.node, nodeFlags); }
		nodeFlags.set(candidate.from, sequence[index]?.escaped !== false);
	});
	return {
		allows: (node, from) => flags.get(node)?.get(from) === false,
		split(node, at) {
			const tail = node.splitText(at);
			const nodeFlags = flags.get(node);
			if (nodeFlags) {
				const tailFlags = new Map<number, boolean>();
				for (const [from, escaped] of nodeFlags) {
					if (from < at) continue;
					nodeFlags.delete(from);
					tailFlags.set(from - at, escaped);
				}
				flags.set(tail, tailFlags);
			}
			return tail;
		},
	};
}
