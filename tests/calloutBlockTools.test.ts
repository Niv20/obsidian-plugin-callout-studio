/**
 * tests/calloutBlockTools.test.ts — what the four command actions write.
 *
 * Runs the real editor transforms against an in-memory buffer, so the markdown
 * a user-built command produces is pinned down rather than reasoned about. The
 * id-less calls matter just as much: they are what the five fixed commands do,
 * and parameterizing those functions must not have changed them.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { Editor, EditorPosition } from "obsidian";
import {
	insertEmptyCallout,
	insertHeadingCallout,
	insertInlineCallout,
	wrapSelectionInCallout,
} from "../src/editor/CalloutBlockTools";
import type { CalloutDefinition } from "../src/types";

const def = (over: Partial<CalloutDefinition> = {}): CalloutDefinition => ({
	id: "warning",
	displayName: "Warning",
	icon: { type: "lucide", value: "alert-triangle" },
	colorLight: "#ff0000",
	colorDark: "#ff0000",
	foldable: false,
	defaultFolded: false,
	builtIn: true,
	source: "builtin",
	...over,
});

/**
 * The slice of Obsidian's Editor these transforms touch, over a plain string.
 * `|` in the source text marks the cursor; `[` … `]` marks a selection.
 */
class FakeEditor {
	private text: string;
	private anchor: EditorPosition = { line: 0, ch: 0 };
	private head: EditorPosition = { line: 0, ch: 0 };

	constructor(source: string) {
		const selStart = source.indexOf("«");
		const selEnd = source.indexOf("»");
		if (selStart !== -1 && selEnd !== -1) {
			const stripped =
				source.slice(0, selStart) +
				source.slice(selStart + 1, selEnd) +
				source.slice(selEnd + 1);
			this.text = stripped;
			this.anchor = this.posOf(selStart);
			this.head = this.posOf(selEnd - 1);
			return;
		}
		const caret = source.indexOf("|");
		this.text = caret === -1 ? source : source.replace("|", "");
		if (caret !== -1) {
			this.anchor = this.head = this.posOf(caret);
		}
	}

	private posOf(offset: number): EditorPosition {
		const before = this.text.slice(0, offset);
		const line = before.split("\n").length - 1;
		const lineStart = before.lastIndexOf("\n") + 1;
		return { line, ch: offset - lineStart };
	}

	private offsetOf(pos: EditorPosition): number {
		const lines = this.text.split("\n");
		let offset = 0;
		for (let i = 0; i < pos.line; i++) offset += (lines[i]?.length ?? 0) + 1;
		return offset + pos.ch;
	}

	value(): string {
		return this.text;
	}

	/** The buffer with `|` put back where the cursor ended up. */
	valueWithCursor(): string {
		const offset = this.offsetOf(this.head);
		return `${this.text.slice(0, offset)}|${this.text.slice(offset)}`;
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
			const a = this.offsetOf(this.anchor);
			const h = this.offsetOf(this.head);
			const wantMin = which === "from";
			return (wantMin ? a <= h : a > h) ? this.anchor : this.head;
		}
		return this.head;
	}

	getSelection(): string {
		const a = this.offsetOf(this.anchor);
		const h = this.offsetOf(this.head);
		return this.text.slice(Math.min(a, h), Math.max(a, h));
	}

	replaceRange(
		replacement: string,
		from: EditorPosition,
		to?: EditorPosition,
	): void {
		const start = this.offsetOf(from);
		const end = to ? this.offsetOf(to) : start;
		this.text =
			this.text.slice(0, start) + replacement + this.text.slice(end);
	}

	setCursor(pos: EditorPosition): void {
		this.anchor = this.head = pos;
	}
}

const editor = (source: string): FakeEditor => new FakeEditor(source);
const asEditor = (e: FakeEditor): Editor => e as unknown as Editor;

describe("wrapSelectionInCallout", () => {
	it("leaves the header open when no type is given", () => {
		// What the generic "Wrap in callout" command does: the cursor parks
		// after `[!` so the autocomplete can finish the header.
		const e = editor("hello| world");
		assert.strictEqual(wrapSelectionInCallout(asEditor(e)), true);
		assert.strictEqual(e.valueWithCursor(), "> [!|\n> hello world");
	});

	it("writes the finished header when a type is given", () => {
		const e = editor("hello| world");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.valueWithCursor(),
			"> [!warning] Warning|\n> hello world",
		);
	});

	it("carries the fold mark into the header", () => {
		const e = editor("hello|");
		wrapSelectionInCallout(asEditor(e), {
			def: def({ foldable: true, defaultFolded: true }),
		});
		assert.strictEqual(e.value(), "> [!warning]- Warning\n> hello");
	});

	it("wraps a multi-line selection, quoting every line", () => {
		const e = editor("«one\ntwo\nthree»");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> one\n> two\n> three",
		);
	});

	it("wraps an existing callout from the outside, not from within", () => {
		// The header prefix drops a level when the first content line is
		// already a callout header, so the new callout encloses the old one
		// rather than being buried inside it.
		const e = editor("> [!note] Note\n> inner| text");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> > [!note] Note\n> > inner text",
		);
	});

	it("opens an empty callout with a body line the cursor sits in", () => {
		// Nothing to wrap, so there is no content line to requote: the callout
		// is born with the line the first word goes on, and the cursor is
		// already there rather than behind the title.
		const e = editor("|");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(e.valueWithCursor(), "> [!warning] Warning\n> |");
	});

	it("keeps the cursor on an unfinished header, body line and all", () => {
		// The `[!` form has no type yet, so the autocomplete still needs the
		// cursor up on the header — and there is nothing to open a body for.
		const e = editor("|");
		wrapSelectionInCallout(asEditor(e));
		assert.strictEqual(e.valueWithCursor(), "> [!|\n>");
	});

	it("opens the body at the callout's own depth when nested", () => {
		// The blank line is inside an existing callout, so the new one is built
		// one level deeper and its body line is quoted to match.
		const e = editor("> [!note] Note\n>\n> |");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.valueWithCursor(),
			"> [!note] Note\n>\n> > [!warning] Warning\n> > |",
		);
	});

	it("does not wrap into the frontmatter block", () => {
		const e = editor("---\ntitle: x\n---\nbody|");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"---\ntitle: x\n---\n> [!warning] Warning\n> body",
		);
	});
});

describe("insertEmptyCallout", () => {
	it("leaves the header open when no type is given", () => {
		const e = editor("|");
		assert.strictEqual(insertEmptyCallout(asEditor(e)), true);
		assert.strictEqual(e.valueWithCursor(), "> [!|");
	});

	it("drops a finished callout onto a blank line", () => {
		// A finished header has nothing left to type into, so the callout comes
		// with the empty body line and the cursor lands after its `> ` — the
		// same thing the quick-insert window leaves behind.
		const e = editor("|");
		insertEmptyCallout(asEditor(e), { def: def() });
		assert.strictEqual(e.valueWithCursor(), "> [!warning] Warning\n> |");
	});

	it("adds the callout below a line that has content", () => {
		const e = editor("some text|");
		insertEmptyCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.valueWithCursor(),
			"some text\n\n> [!warning] Warning\n> |",
		);
	});

	it("keeps the following line out of the new callout", () => {
		// The body line is a lazy blockquote continuation waiting to happen:
		// without the separator the paragraph below would be swallowed into it.
		const e = editor("some text|\nnext paragraph");
		insertEmptyCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"some text\n\n> [!warning] Warning\n> \n\nnext paragraph",
		);
	});

	it("keeps the quote depth when inserting inside a callout", () => {
		const e = editor("> [!note] Note\n> body|");
		insertEmptyCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.valueWithCursor(),
			"> [!note] Note\n> body\n>\n> > [!warning] Warning\n> > |",
		);
	});
});

describe("insertHeadingCallout", () => {
	it("writes an untitled heading on a blank line", () => {
		const e = editor("|");
		assert.strictEqual(insertHeadingCallout(asEditor(e), def(), 2), true);
		assert.strictEqual(e.valueWithCursor(), "## [!warning]|");
	});

	it("uses the line's own text as the title", () => {
		const e = editor("Chapter one|");
		insertHeadingCallout(asEditor(e), def(), 3);
		assert.strictEqual(e.value(), "### [!warning] Chapter one");
	});

	it("re-levels a plain heading, keeping its title", () => {
		const e = editor("## Chapter one|");
		insertHeadingCallout(asEditor(e), def(), 4);
		assert.strictEqual(e.value(), "#### [!warning] Chapter one");
	});

	it("re-types an existing heading callout instead of nesting a token", () => {
		const e = editor("## [!note] Chapter one|");
		insertHeadingCallout(asEditor(e), def(), 2);
		assert.strictEqual(e.value(), "## [!warning] Chapter one");
	});

	it("changes level without disturbing the title", () => {
		const e = editor("## [!warning] Chapter one|");
		insertHeadingCallout(asEditor(e), def(), 5);
		assert.strictEqual(e.value(), "##### [!warning] Chapter one");
	});

	it("drops a title that is only the callout's own display name", () => {
		const e = editor("## [!note] Note|");
		insertHeadingCallout(asEditor(e), def(), 2, {
			isKnownDisplayName: (title) => title === "Note",
		});
		assert.strictEqual(e.value(), "## [!warning]");
	});

	it("clamps the level to a real heading", () => {
		const e = editor("|");
		insertHeadingCallout(asEditor(e), def(), 9);
		assert.strictEqual(e.value(), "###### [!warning]");
		const low = editor("|");
		insertHeadingCallout(asEditor(low), def(), 0);
		assert.strictEqual(low.value(), "# [!warning]");
	});

	it("never rewrites a quoted line, writing below the block instead", () => {
		// A heading callout only renders at column 0, so converting the line
		// in place would break the blockquote and render as nothing.
		const e = editor("> [!note] Note\n> body|");
		insertHeadingCallout(asEditor(e), def(), 2);
		assert.strictEqual(
			e.value(),
			"> [!note] Note\n> body\n\n## [!warning]",
		);
	});

	it("moves out of the frontmatter block rather than writing into it", () => {
		const e = editor("---\n|title: x\n---\nbody");
		insertHeadingCallout(asEditor(e), def(), 2);
		assert.strictEqual(
			e.value(),
			"---\ntitle: x\n---\n## [!warning] body",
		);
	});
});

describe("insertInlineCallout", () => {
	it("writes a pill at the cursor, followed by one space", () => {
		const e = editor("before |after");
		assert.strictEqual(insertInlineCallout(asEditor(e), def()), true);
		assert.strictEqual(e.valueWithCursor(), "before [!warning] |after");
	});

	it("does not double up a space that is already there", () => {
		const e = editor("before |  after");
		insertInlineCallout(asEditor(e), def());
		assert.strictEqual(e.valueWithCursor(), "before [!warning] | after");
	});

	it("adds the space when the cursor is at end of line", () => {
		const e = editor("text |");
		insertInlineCallout(asEditor(e), def());
		assert.strictEqual(e.valueWithCursor(), "text [!warning] |");
	});

	it("wraps a selection as a content pill when content is allowed", () => {
		const e = editor("say «this loudly» now");
		insertInlineCallout(asEditor(e), def(), { allowContent: true });
		assert.strictEqual(e.value(), "say [!warning]{this loudly} now");
	});

	it("leaves the selection alone when content pills are off", () => {
		const e = editor("say «this loudly» now");
		insertInlineCallout(asEditor(e), def(), { allowContent: false });
		assert.strictEqual(e.value(), "say [!warning] this loudly now");
	});

	it("refuses to wrap a selection whose braces do not balance", () => {
		// `{`/`}` nest by depth with no escape, so an unbalanced payload would
		// swallow the rest of the line.
		const e = editor("say «a } b» now");
		insertInlineCallout(asEditor(e), def(), { allowContent: true });
		assert.strictEqual(e.value(), "say [!warning] a } b now");
	});

	it("refuses to wrap a multi-line selection", () => {
		// Braces cannot span lines.
		const e = editor("«one\ntwo»");
		insertInlineCallout(asEditor(e), def(), { allowContent: true });
		assert.strictEqual(e.value(), "[!warning] one\ntwo");
	});
});
