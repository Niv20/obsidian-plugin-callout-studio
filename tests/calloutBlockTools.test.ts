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
	unwrapCalloutAtSelection,
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

	it("writes the caller's fold mark over the definition's", () => {
		// What a user-built command with a fold state does: the command owns
		// the answer, so it can add a mark the callout does not have...
		const added = editor("hello|");
		wrapSelectionInCallout(asEditor(added), { def: def(), foldMark: "-" });
		assert.strictEqual(added.value(), "> [!warning]- Warning\n> hello");

		// ...and remove one the callout does have. This is the case that makes
		// a "Non-foldable" command honest against a callout imported from
		// Callout Manager, which stamps `foldable: true` on everything.
		const removed = editor("hello|");
		wrapSelectionInCallout(asEditor(removed), {
			def: def({ foldable: true }),
			foldMark: "",
		});
		assert.strictEqual(removed.value(), "> [!warning] Warning\n> hello");
	});

	it("wraps a multi-line selection, quoting every line", () => {
		const e = editor("«one\ntwo\nthree»");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> one\n> two\n> three",
		);
	});

	it("keeps every wrapped callout a block callout of its own", () => {
		// The blank line between two callouts is what keeps them apart. It
		// belongs to the new callout's body, one `>` deep — requoting it at the
		// inner callouts' depth fuses them into one blockquote, and every
		// header after the first becomes body text that renders as an inline
		// pill.
		const e = editor(
			"«> [!note] A\n> body A\n\n> [!tip] B\n> body B\n\n> [!info] C\n> body C»",
		);
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n" +
				"> > [!note] A\n> > body A\n>\n" +
				"> > [!tip] B\n> > body B\n>\n" +
				"> > [!info] C\n> > body C",
		);
	});

	it("keeps a wrapped callout's own blank lines inside it", () => {
		// A `>` line is a paragraph break inside the callout, not a gap between
		// callouts, so it moves one level deeper with the rest of the callout.
		const e = editor("«> [!note] A\n> one\n>\n> two\n\n> [!tip] B\n> three»");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n" +
				"> > [!note] A\n> > one\n> >\n> > two\n>\n" +
				"> > [!tip] B\n> > three",
		);
	});

	it("puts plain text between wrapped callouts in the new callout's body", () => {
		const e = editor("«> [!note] A\n> one\n\nbetween\n\n> [!tip] B\n> two»");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n" +
				"> > [!note] A\n> > one\n>\n> between\n>\n" +
				"> > [!tip] B\n> > two",
		);
	});

	it("wraps sibling callouts nested inside a blockquote", () => {
		const e = editor("«> > [!note] A\n> > one\n>\n> > [!tip] B\n> > two»");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> > [!warning] Warning\n" +
				"> > > [!note] A\n> > > one\n> >\n" +
				"> > > [!tip] B\n> > > two",
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

/**
 * Where the new callout goes. One rule covers every case: it opens inside the
 * innermost callout holding what was pointed at, and a callout's header line
 * stands for the whole callout. Before that rule, the answer depended on
 * whether a blank line happened to sit between the cursor and the header —
 * the first paragraph of a callout was wrapped from the outside, and any other
 * paragraph from the inside.
 */
describe("wrapSelectionInCallout: where the callout goes", () => {
	it("nests inside a callout when the cursor is in its text", () => {
		const e = editor("> [!note] Note\n> inner| text");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!note] Note\n> > [!warning] Warning\n> > inner text",
		);
	});

	it("wraps a whole callout from the outside when the cursor is on its header", () => {
		const e = editor("> [!note] Note|\n> one\n>\n> two");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> > [!note] Note\n> > one\n> >\n> > two",
		);
	});

	it("takes the whole callout once a selection reaches its header", () => {
		// Only half the body is selected, but a callout cannot be wrapped in
		// halves: the rest of it comes along rather than being left behind.
		const e = editor("«> [!note] Note\n> one»\n>\n> two");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> > [!note] Note\n> > one\n> >\n> > two",
		);
	});

	it("wraps only the selected line of a callout, inside it", () => {
		// The line below was glued to the selected one; the blank `>` written
		// between them is what stops it sliding into the new callout.
		const glued = editor("> [!bug] Bug\n> «a»\n> b");
		wrapSelectionInCallout(asEditor(glued), { def: def() });
		assert.strictEqual(
			glued.value(),
			"> [!bug] Bug\n> > [!warning] Warning\n> > a\n>\n> b",
		);

		// With a paragraph break already there, `b` must stay in the bug
		// callout. It used to be moved out of it, into the new one.
		const apart = editor("> [!bug] Bug\n> «a»\n>\n> b");
		wrapSelectionInCallout(asEditor(apart), { def: def() });
		assert.strictEqual(
			apart.value(),
			"> [!bug] Bug\n> > [!warning] Warning\n> > a\n>\n> b",
		);
	});

	it("nests in the innermost callout, not the outermost", () => {
		const e = editor(
			"> [!note] Outer\n> text\n> > [!tip] Inner\n> > inner| text",
		);
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!note] Outer\n> text\n> > [!tip] Inner\n" +
				"> > > [!warning] Warning\n> > > inner text",
		);
	});

	it("reads a `[!…]` further down a callout as text, not as a header", () => {
		// A paragraph that opens with an inline pill is still a paragraph of
		// the note callout; it is not a callout of its own to wrap whole.
		const e = editor("> [!note] Note\n> text\n>\n> [!tip] pill| here");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!note] Note\n> text\n>\n> > [!warning] Warning\n> > [!tip] pill here",
		);
	});

	it("takes every callout a selection reaches into, whole", () => {
		const e = editor("> [!note] A\n> «x\n\n> [!tip] B\n> y»\n> z");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> > [!note] A\n> > x\n>\n> > [!tip] B\n> > y\n> > z",
		);
	});

	it("stays inside a plain blockquote", () => {
		// A plain quote has no header to stand for it, so everything in it
		// counts as its text.
		const e = editor("> quote| one\n> quote two");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> > [!warning] Warning\n> > quote one\n> > quote two",
		);
	});
});

describe("wrapSelectionInCallout: what it takes", () => {
	it("takes the paragraph under a bare cursor", () => {
		const e = editor("one\ntw|o\nthree\n\nfour");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> one\n> two\n> three\n\nfour",
		);
	});

	it("leaves a heading out of the paragraph under it", () => {
		const e = editor("## Title\ntext|\nmore");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"## Title\n\n> [!warning] Warning\n> text\n> more",
		);
	});

	it("takes only the selected lines of a paragraph", () => {
		// The paragraph is split where the selection starts and ends, and a
		// blank line on each side keeps the three parts apart.
		const e = editor("one\n«two\nthree»\nfour");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"one\n\n> [!warning] Warning\n> two\n> three\n\nfour",
		);
	});

	it("leaves out a line the selection only reaches the start of", () => {
		// What dragging over whole lines, or Shift+Down, leaves behind.
		const e = editor("«one\n»two\nthree");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> one\n\ntwo\nthree",
		);
	});

	it("writes an empty callout on a blank line and leaves its neighbours alone", () => {
		// It used to wrap both paragraphs around the blank line instead.
		const e = editor("para one\n|\npara two");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.valueWithCursor(),
			"para one\n\n> [!warning] Warning\n> |\n\npara two",
		);
	});

	it("keeps a blank line between the callout and a callout right below it", () => {
		// Written straight above `> > [!tip]`, the new callout's lines would
		// run on into the tip's quote and swallow its header as text.
		const e = editor("> [!note] Outer\n> text|\n> > [!tip] Inner\n> > body");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!note] Outer\n> > [!warning] Warning\n> > text\n>\n> > [!tip] Inner\n> > body",
		);
	});
});

describe("wrapSelectionInCallout: blocks it never cuts", () => {
	it("takes a whole code block, and reads callout syntax in it as code", () => {
		const e = editor("```md\n> [!note]\n> te|xt\n```");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> ```md\n> > [!note]\n> > text\n> ```",
		);
	});

	it("ends a code block where its callout ends", () => {
		// An unclosed fence inside a callout used to run to the end of the
		// note, dragging everything after it into the callout.
		const e = editor("> [!note] Note\n> ```\n> code\n\nafter|");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!note] Note\n> ```\n> code\n\n> [!warning] Warning\n> after",
		);
	});

	it("takes a whole table from its header row", () => {
		const e = editor("Intro\n| a | b |\n| --- | --- |\n| «1» | 2 |\n| 3 | 4 |");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"Intro\n\n> [!warning] Warning\n> | a | b |\n> | --- | --- |\n> | 1 | 2 |\n> | 3 | 4 |",
		);
	});

	it("takes a list item together with its indented sub-items", () => {
		const e = editor("- one\n- «two»\n  - two a\n  - two b\n- three");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"- one\n\n> [!warning] Warning\n> - two\n>   - two a\n>   - two b\n\n- three",
		);
	});

	it("does not read a tab-indented line as quoted", () => {
		const e = editor("- «one\n\t- one a»\n- two");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> - one\n> \t- one a\n\n- two",
		);
	});

	it("takes an HTML block whole", () => {
		const e = editor("«<details>»\n<summary>S</summary>\nbody\n</details>");
		wrapSelectionInCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!warning] Warning\n> <details>\n> <summary>S</summary>\n> body\n> </details>",
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

	it("takes a fold mark from the caller too", () => {
		// Both block actions write the same header line, so an "Insert new"
		// command has the same three fold states a wrapping one does.
		const e = editor("|");
		insertEmptyCallout(asEditor(e), { def: def(), foldMark: "+" });
		assert.strictEqual(e.valueWithCursor(), "> [!warning]+ Warning\n> |");

		const removed = editor("|");
		insertEmptyCallout(asEditor(removed), {
			def: def({ foldable: true, defaultFolded: true }),
			foldMark: "",
		});
		assert.strictEqual(removed.value(), "> [!warning] Warning\n> ");
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

	it("keeps the paragraphs around a blank line out of the callout", () => {
		// The bare `[!` header is a paragraph line, so the one below it would
		// run on into it as a lazy continuation. It used to.
		const e = editor("para one\n|\npara two");
		insertEmptyCallout(asEditor(e));
		assert.strictEqual(e.valueWithCursor(), "para one\n\n> [!|\n\npara two");
	});

	it("keeps sibling callouts apart when it lands between them", () => {
		// Written over the `>` that separated them, at their depth, the new
		// callout would have fused all three into one quote.
		const e = editor("> [!note] Outer\n> > [!tip] A\n> > x\n>|\n> > [!info] B\n> > y");
		insertEmptyCallout(asEditor(e), { def: def() });
		assert.strictEqual(
			e.value(),
			"> [!note] Outer\n> > [!tip] A\n> > x\n>\n" +
				"> > [!warning] Warning\n> > \n>\n" +
				"> > [!info] B\n> > y",
		);
	});

	it("opens right under a callout's header, with no blank line between", () => {
		const e = editor("> [!note] Note\n>|\n> text");
		insertEmptyCallout(asEditor(e));
		assert.strictEqual(e.value(), "> [!note] Note\n> > [!\n>\n> text");
	});

	it("does not double a blank line that is already there", () => {
		const e = editor("> [!note] Note\n> text|\n>\n> more");
		insertEmptyCallout(asEditor(e));
		assert.strictEqual(
			e.value(),
			"> [!note] Note\n> text\n>\n> > [!\n>\n> more",
		);
	});

	it("never writes into the properties", () => {
		// From inside them, the callout goes where the note's text begins —
		// onto that line when it is blank, above it when it is not.
		const above = editor("---\ntitle: x|\n---\nbody");
		insertEmptyCallout(asEditor(above));
		assert.strictEqual(above.valueWithCursor(), "---\ntitle: x\n---\n> [!|\n\nbody");

		const onto = editor("---\ntitle: x|\n---\n\nbody");
		insertEmptyCallout(asEditor(onto));
		assert.strictEqual(onto.valueWithCursor(), "---\ntitle: x\n---\n> [!|\n\nbody");

		const only = editor("---\ntitle: x|\n---");
		insertEmptyCallout(asEditor(only), { def: def() });
		assert.strictEqual(
			only.valueWithCursor(),
			"---\ntitle: x\n---\n> [!warning] Warning\n> |",
		);
	});

	it("does not read a tab-indented line as quoted", () => {
		// It used to count the tab as a `>` and nest the callout in a quote
		// that was not there.
		const e = editor("- item\n\t- sub|\n- next");
		insertEmptyCallout(asEditor(e));
		assert.strictEqual(e.value(), "- item\n\t- sub\n\n> [!\n\n- next");
	});
});

describe("unwrapCalloutAtSelection", () => {
	it("takes one level off the callout and drops a header with no title", () => {
		const e = editor("> [!note]\n> one\n>\n> two|");
		assert.strictEqual(unwrapCalloutAtSelection(asEditor(e)), true);
		assert.strictEqual(e.valueWithCursor(), "one\n\ntwo|");
	});

	it("keeps the title where the header was, as deleting a callout type does", () => {
		// Only the `[!type]` token and its fold mark go. Converting a deleted
		// type to plain text leaves the same line behind.
		const e = editor("> [!warning]- Don't delete the database\n> body|");
		unwrapCalloutAtSelection(asEditor(e));
		assert.strictEqual(e.valueWithCursor(), "Don't delete the database\nbody|");
	});

	it("keeps a paragraph that opens with an inline pill", () => {
		// The `[!tip]` line is text in the note's body, not a callout of its
		// own. Taken for a header, it used to be deleted — with the cursor on
		// it or anywhere below it — and the note left half unwrapped.
		const below = editor("> [!note]\n> text\n>\n> [!tip] pill\n> more|");
		unwrapCalloutAtSelection(asEditor(below));
		assert.strictEqual(below.value(), "text\n\n[!tip] pill\nmore");

		const on = editor("> [!note]\n> text\n>\n> [!tip] pi|ll");
		unwrapCalloutAtSelection(asEditor(on));
		assert.strictEqual(on.value(), "text\n\n[!tip] pill");
	});

	it("reads a `[!…]` on a callout's second line as its text", () => {
		const e = editor("> [!note]\n> [!tip] second\n> body|");
		unwrapCalloutAtSelection(asEditor(e));
		assert.strictEqual(e.value(), "[!tip] second\nbody");
	});

	it("never takes a line of code for a header", () => {
		const e = editor("> [!note]\n> ```md\n> > [!tip] exam|ple\n> ```");
		unwrapCalloutAtSelection(asEditor(e));
		assert.strictEqual(e.value(), "```md\n> [!tip] example\n```");
	});

	it("unwraps only the innermost callout", () => {
		const e = editor("> [!note] Outer\n> text\n>\n> > [!tip]\n> > inner| body");
		unwrapCalloutAtSelection(asEditor(e));
		assert.strictEqual(e.value(), "> [!note] Outer\n> text\n>\n> inner body");
	});

	it("keeps the callout's text apart from a paragraph right above it", () => {
		// The callout was a block of its own; without the blank line its
		// first line would join that paragraph.
		const root = editor("para\n> [!note] Title\n> body|");
		unwrapCalloutAtSelection(asEditor(root));
		assert.strictEqual(root.value(), "para\n\nTitle\nbody");

		const nested = editor("> [!note] Outer\n> text\n> > [!tip] T\n> > inner| body");
		unwrapCalloutAtSelection(asEditor(nested));
		assert.strictEqual(nested.value(), "> [!note] Outer\n> text\n>\n> T\n> inner body");
	});

	it("adds no blank line under the header of the callout it was in", () => {
		const e = editor("> [!note] Outer\n> > [!tip]\n> > inner| body");
		unwrapCalloutAtSelection(asEditor(e));
		assert.strictEqual(e.valueWithCursor(), "> [!note] Outer\n> inner| body");
	});

	it("keeps a callout indented under a list item inside that item", () => {
		// The indentation used to be stripped along with the `>`, which moved
		// the text out to the list item's own line.
		const e = editor("- item\n  > [!note] x\n  > body|\n- next");
		unwrapCalloutAtSelection(asEditor(e));
		assert.strictEqual(e.value(), "- item\n\n  x\n  body\n- next");
	});

	it("finds a callout right after a tab-indented list line", () => {
		// Counted as a quote marker, the tab made the header look like the
		// second line of a quote, and the callout was not found at all.
		const e = editor("- item\n\tcontinuation\n> [!note]\n> body|");
		unwrapCalloutAtSelection(asEditor(e));
		assert.strictEqual(e.value(), "- item\n\tcontinuation\n\nbody");
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
	for (const closing of ["---", "..."]) {
		it(`preserves metadata-only frontmatter ending in ${closing} at EOF`, () => {
			const e = editor(`---\n|tags: [x]\n${closing}`);
			insertHeadingCallout(asEditor(e), def(), 2);
			assert.strictEqual(e.value(), `---\ntags: [x]\n${closing}\n\n## [!warning]`);
		});
	}
	it("uses the existing body line when frontmatter has a final newline", () => {
		const e = editor("---\n|tags: [x]\n---\n");
		insertHeadingCallout(asEditor(e), def(), 2);
		assert.strictEqual(e.value(), "---\ntags: [x]\n---\n## [!warning]");
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
