/**
 * tests/support/selectionEditor.ts — an editor over a string that keeps a
 * selection, for the commands whose answer depends on one.
 *
 * `⎸` marks a bare cursor and `«…»` a selection, anchor at `«` and head at
 * `»` — written `»…«` it runs backwards, head first. Not `|`, which
 * `tests/calloutBlockTools.test.ts` uses: the text under test here is full of
 * table cells and `[!id|metadata]`.
 *
 * `edits` counts the writes, because a command is one Undo step only when it
 * is one `replaceRange`.
 */
import type { Editor, EditorPosition } from "obsidian";

export class SelectionEditor {
	private text: string;
	private anchor: EditorPosition = { line: 0, ch: 0 };
	private head: EditorPosition = { line: 0, ch: 0 };
	/** How many `replaceRange` calls the editor took. */
	edits = 0;

	constructor(source: string) {
		const open = source.indexOf("«");
		const close = source.indexOf("»");
		if (open !== -1 && close !== -1) {
			const first = Math.min(open, close);
			const second = Math.max(open, close);
			this.text = source.slice(0, first) + source.slice(first + 1, second) + source.slice(second + 1);
			const anchorAt = open < close ? open : open - 1;
			const headAt = close < open ? close : close - 1;
			this.anchor = this.posOf(anchorAt);
			this.head = this.posOf(headAt);
			return;
		}
		const caret = source.indexOf("⎸");
		this.text = caret === -1 ? source : source.replace("⎸", "");
		if (caret !== -1) this.anchor = this.head = this.posOf(caret);
	}

	private posOf(offset: number): EditorPosition {
		const before = this.text.slice(0, offset);
		return { line: before.split("\n").length - 1, ch: offset - (before.lastIndexOf("\n") + 1) };
	}

	private offsetOf(pos: EditorPosition): number {
		const lines = this.text.split("\n");
		let offset = 0;
		for (let i = 0; i < pos.line; i++) offset += (lines[i]?.length ?? 0) + 1;
		return offset + pos.ch;
	}

	getValue(): string {
		return this.text;
	}

	lineCount(): number {
		return this.text.split("\n").length;
	}

	getLine(n: number): string {
		return this.text.split("\n")[n] ?? "";
	}

	getCursor(which?: "anchor" | "head" | "from" | "to"): EditorPosition {
		if (which === "anchor") return this.anchor;
		if (which === "from" || which === "to") {
			const anchorFirst = this.offsetOf(this.anchor) <= this.offsetOf(this.head);
			return (which === "from") === anchorFirst ? this.anchor : this.head;
		}
		return this.head;
	}

	getSelection(): string {
		const a = this.offsetOf(this.anchor);
		const h = this.offsetOf(this.head);
		return this.text.slice(Math.min(a, h), Math.max(a, h));
	}

	replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition): void {
		this.edits++;
		const start = this.offsetOf(from);
		const end = to ? this.offsetOf(to) : start;
		this.text = this.text.slice(0, start) + replacement + this.text.slice(end);
	}

	setCursor(pos: EditorPosition): void {
		this.anchor = this.head = pos;
	}

	focus(): void {}

	/** The buffer with `⎸` put back where the cursor ended up. */
	valueWithCursor(): string {
		const offset = this.offsetOf(this.head);
		return `${this.text.slice(0, offset)}⎸${this.text.slice(offset)}`;
	}
}

export const selectionEditor = (source: string): SelectionEditor => new SelectionEditor(source);

/** The code under test is typed against the real `Editor`. */
export const asEditor = (editor: SelectionEditor): Editor => editor as unknown as Editor;
