/** CodeMirror supplies document context; language-free previews use a weak cache. */
import type { EditorState, Text } from "@codemirror/state";
import { language, syntaxTree } from "@codemirror/language";
import { scanLineForCalloutTokens, tokenEnd, type LineCalloutToken, type ScanLineOptions } from "../calloutTokens";
import { markdownPrefix } from "../markdownContainers";
import { iterateMarkdownSourceLines, type MarkdownSourceLine } from "../markdownExclusions";

const contexts = new WeakMap<Text, Map<number, MarkdownSourceLine>>();
const excluded = /codeblock|frontmatter|yaml|inline-code|math|comment/i;

function sourceLine(state: EditorState, from: number): MarkdownSourceLine | undefined {
	let lines = contexts.get(state.doc);
	if (!lines) {
		lines = new Map(Array.from(iterateMarkdownSourceLines(state.doc.toString()), line => [line.lineOffset, line]));
		contexts.set(state.doc, lines);
	}
	return lines.get(state.doc.lineAt(from).from);
}

/** Unparsed regions stay raw until the language worker publishes their context. */
export function excludedEditorRange(state: EditorState, from: number, to: number): boolean {
	if (!state.facet(language)) {
		const line = sourceLine(state, from);
		if (!line) return true;
		const start = from - line.lineOffset, end = to - line.lineOffset;
		return line.visible.slice(start, end) !== line.lineText.slice(start, end);
	}
	const tree = syntaxTree(state);
	if (to > tree.length) return true;
	for (const position of [from + 1, Math.max(from + 1, to - 1)]) {
		for (let node = tree.resolveInner(position, 0); node; ) {
			if (excluded.test(node.name)) return true;
			const parent = node.parent;
			if (!parent) break;
			node = parent;
		}
	}
	return false;
}

export function editorLineCalloutTokens(state: EditorState, from: number, text: string, options: ScanLineOptions = {}): LineCalloutToken[] {
	if (!state.facet(language)) {
		const context = sourceLine(state, from);
		return context ? scanLineForCalloutTokens(text, {
			...options, visibleLine: context.visible, contentFrom: context.prefix.from,
			blockQuote: context.prefix.lastContainer === "quote",
		}) : [];
	}
	// The language tree decides indented-code context; list continuations may
	// legitimately indent a token by four or more spaces.
	const indent = /^[ \t]*/.exec(text)?.[0].length ?? 0;
	const prefix = markdownPrefix(text.slice(indent));
	const inline = Array.from(iterateMarkdownSourceLines(`x ${text}`))[0];
	return scanLineForCalloutTokens(text, {
		...options, visibleLine: inline?.visible.slice(2) ?? "", contentFrom: indent + prefix.from,
		blockQuote: prefix.lastContainer === "quote",
	}).filter(token => !excludedEditorRange(state, from + token.from, from + tokenEnd(token)));
}
