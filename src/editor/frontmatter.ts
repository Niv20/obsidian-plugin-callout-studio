import type { Editor } from "obsidian";

/** Last protected property line, or -1 when there is no closed frontmatter. */
export function findFrontmatterEnd(editor: Editor): number {
	if (editor.lineCount() === 0 || editor.getLine(0).trim() !== "---") return -1;
	for (let line = 1; line < editor.lineCount(); line++) {
		const text = editor.getLine(line).trim();
		if (text === "---" || text === "...") return line;
	}
	return -1;
}

/** A metadata-only note needs new body lines, never a clamped YAML delimiter. */
export function appendAfterFrontmatter(editor: Editor, frontmatterEnd: number, heading: string): boolean {
	if (frontmatterEnd < 0 || frontmatterEnd !== editor.lineCount() - 1) return false;
	const end = { line: frontmatterEnd, ch: editor.getLine(frontmatterEnd).length };
	editor.replaceRange(`\n\n${heading}`, end);
	editor.setCursor({ line: frontmatterEnd + 2, ch: heading.length });
	return true;
}
