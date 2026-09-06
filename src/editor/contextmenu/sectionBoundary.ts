/** Section boundaries use the current editor's fold service when available. */
import { foldable } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import type { Editor } from "obsidian";
import { createDocumentLineFilter, stripInlineCode } from "../calloutTokens";

/** First line outside this section, or lineCount at EOF. */
export function sectionEndLine(editor: Editor, headingLine: number, level: number): number {
	const native = nativeSectionEnd(editor, headingLine);
	if (native !== null) return native;

	// Source-only/reading editors may have no fold service. Share the same
	// fence-length/frontmatter rules as the vault scanner; feed every line.
	const isContent = createDocumentLineFilter();
	let comment = false;
	let math = false;
	let htmlEnd: RegExp | "blank" | null = null;
	let paragraphStart: number | null = null;
	for (let line = 0; line < editor.lineCount(); line++) {
		const raw = editor.getLine(line);
		let text = raw;
		if (!comment && !math && !htmlEnd && /^ {0,3}>/.test(text)) {
			isContent("", line); paragraphStart = null; continue;
		}
		if (htmlEnd) {
			if (htmlEnd === "blank" ? !text.trim() : htmlEnd.test(text)) htmlEnd = null;
			isContent("", line); paragraphStart = null; continue;
		}
		// Comments can span lines and contain apparent headings/fences.
		if (comment) {
			const end = text.indexOf("-->");
			if (end < 0) { isContent("", line); paragraphStart = null; continue; }
			text = text.slice(end + 3); comment = false;
		}
		if (math) {
			if (/^ {0,3}\$\$\s*$/.test(text)) math = false;
			isContent("", line); paragraphStart = null; continue;
		}
		if (!isContent(text, line)) { paragraphStart = null; continue; }
		text = stripInlineCode(text);
		const html = htmlBlockEnd(text, paragraphStart === null);
		if (html) {
			htmlEnd = html === "blank" || !html.test(text) ? html : null;
			paragraphStart = null; continue;
		}
		let open = text.indexOf("<!--");
		while (open >= 0) {
			const end = text.indexOf("-->", open + 4);
			if (end < 0) { text = text.slice(0, open); comment = true; break; }
			text = text.slice(0, open) + text.slice(end + 3);
			open = text.indexOf("<!--");
		}
		if (/^ {0,3}\$\$\s*$/.test(text)) { math = !math; paragraphStart = null; continue; }
		if (comment) { paragraphStart = null; continue; }
		const atx = /^ {0,3}(#{1,6})(?:[ \t]+|$)/.exec(text);
		if (atx?.[1]) {
			if (line > headingLine && atx[1].length <= level) return line;
			paragraphStart = null;
			continue;
		}
		const setext = /^ {0,3}(=+|-+)[ \t]*$/.exec(text);
		if (setext && paragraphStart !== null) {
			const nextLevel = setext[1]?.[0] === "=" ? 1 : 2;
			if (paragraphStart > headingLine && nextLevel <= level) return paragraphStart;
			paragraphStart = null;
			continue;
		}
		// Quoted/list/indented-code content cannot start a top-level setext heading.
		if (!text.trim() || /^(?: {4}|\t)|^ {0,3}(?:>|[-+*]\s|\d+[.)]\s|<|(?:\*\s*){3,}|(?:_\s*){3,})/.test(text)) {
			paragraphStart = null;
		} else if (paragraphStart === null) paragraphStart = line;
	}
	return editor.lineCount();
}

/** Raw HTML blocks do not contain Markdown headings. */
function htmlBlockEnd(text: string, betweenParagraphs: boolean): RegExp | "blank" | null {
	const raw = /^ {0,3}<(script|pre|style|textarea)(?:\s|>|$)/i.exec(text);
	if (raw?.[1]) return new RegExp(`</${raw[1]}\\s*>`, "i");
	if (/^ {0,3}<\?/.test(text)) return /\?>/;
	if (/^ {0,3}<!\[CDATA\[/.test(text)) return /\]\]>/;
	if (/^ {0,3}<![A-Z]/.test(text)) return />/;
	if (/^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i.test(text)) return "blank";
	if (betweenParagraphs && /^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^<>]*)?\s*\/?>\s*$/.test(text)) return "blank";
	return null;
}

function nativeSectionEnd(editor: Editor, headingLine: number): number | null {
	const cm = (editor as Editor & { cm?: EditorView }).cm;
	if (!cm) return null;
	try {
		if (cm.state.doc.toString() !== editor.getValue()) return null;
		const heading = cm.state.doc.line(headingLine + 1);
		const range = foldable(cm.state, heading.from, heading.to);
		if (!range || range.from !== heading.to || range.to <= range.from) return null;
		const end = cm.state.doc.lineAt(range.to);
		return range.to === end.from && end.text !== "" ? end.number - 1 : end.number;
	} catch { return null; }
}
