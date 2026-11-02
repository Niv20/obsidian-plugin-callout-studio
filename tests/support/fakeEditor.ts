/**
 * tests/support/fakeEditor.ts — Obsidian's `Editor`, over a plain string.
 *
 * The editor-integration modules are all *text* transforms wearing an editor
 * interface: `sectionOps` computes a range and replaces it, `AutoComplete`
 * rewrites the token it triggered on, `resolve.ts` reads lines and converts
 * offsets. None of that needs CodeMirror — it needs a buffer that answers
 * `getLine`/`lineCount`/`getRange`/`replaceRange` truthfully and keeps a cursor.
 *
 * `tests/calloutBlockTools.test.ts` has a private editor of its own, older and
 * narrower (no `getRange`, no offset conversion). It is deliberately left alone:
 * its cursor/selection literals (`|`, `«…»`) are the readable half of that
 * suite, and rewriting a passing suite to share code is churn, not coverage.
 *
 * Offsets here count one character per newline, exactly as CodeMirror and
 * Obsidian's own `posToOffset` do.
 */
import type { Editor, EditorPosition } from "obsidian";

export class FakeEditor {
	private lines: string[];
	private cursor: EditorPosition = { line: 0, ch: 0 };
	/** Every `replaceRange` this editor took, in order. */
	readonly edits: Array<{
		text: string;
		from: EditorPosition;
		to: EditorPosition | undefined;
	}> = [];
	/** How many times something asked for focus. */
	focusCount = 0;

	constructor(source: string) {
		this.lines = source.split("\n");
	}

	/* ---- reads ---- */

	getValue(): string {
		return this.lines.join("\n");
	}

	lineCount(): number {
		return this.lines.length;
	}

	lastLine(): number {
		return this.lines.length - 1;
	}

	getLine(n: number): string {
		return this.lines[n] ?? "";
	}

	getCursor(): EditorPosition {
		return this.cursor;
	}

	getRange(from: EditorPosition, to: EditorPosition): string {
		return this.getValue().slice(this.posToOffset(from), this.posToOffset(to));
	}

	getSelection(): string {
		return "";
	}

	/* ---- offsets ---- */

	posToOffset(pos: EditorPosition): number {
		let offset = 0;
		for (let line = 0; line < pos.line; line++) {
			offset += this.getLine(line).length + 1;
		}
		return offset + pos.ch;
	}

	offsetToPos(offset: number): EditorPosition {
		let remaining = offset;
		for (let line = 0; line < this.lines.length; line++) {
			const width = this.getLine(line).length;
			if (remaining <= width) return { line, ch: remaining };
			remaining -= width + 1;
		}
		return { line: this.lastLine(), ch: this.getLine(this.lastLine()).length };
	}

	/* ---- writes ---- */

	replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void {
		this.edits.push({ text, from, to });
		const start = this.posToOffset(from);
		const end = to ? this.posToOffset(to) : start;
		const value = this.getValue();
		this.lines = (value.slice(0, start) + text + value.slice(end)).split("\n");
	}

	setCursor(pos: EditorPosition): void {
		this.cursor = pos;
	}

	focus(): void {
		this.focusCount++;
	}

	/** The buffer with `|` put back where the cursor ended up. */
	valueWithCursor(): string {
		const offset = this.posToOffset(this.cursor);
		const value = this.getValue();
		return `${value.slice(0, offset)}|${value.slice(offset)}`;
	}
}

/** The code under test is typed against the real `Editor`. */
export const asEditor = (editor: FakeEditor): Editor => editor as unknown as Editor;

export const editor = (source: string): FakeEditor => new FakeEditor(source);
