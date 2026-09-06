/**
 * tests/headingSectionOps.test.ts — what a heading callout "owns".
 *
 * `sectionOps.ts` is three one-liners over one piece of real reasoning:
 * {@link getHeadingSectionRange}. Cut / copy / delete all act on whatever range
 * it returns, so every way it can be wrong is a way the user loses text they
 * did not select — and these are single editor transactions with no
 * confirmation modal in front of them, precisely because the range is supposed
 * to be exactly the section.
 *
 * Three decisions are pinned here:
 *
 * - the section ends before the next heading of the **same or a higher** level,
 *   so nested (deeper) headings are swallowed and a sibling is not;
 * - a section that does not reach end-of-document consumes the newline that
 *   follows it, and one that does cannot (there is none) — the difference
 *   between deleting a block and leaving a blank line behind;
	 * - Markdown heading boundaries are not just a `#` count: no space after the
 *   hashes is not a heading, and seven hashes is not a heading either.
 *
 * The clipboard is checked as a side effect rather than mocked away, because
 * "cut copies before it deletes" and "delete writes nothing" is the only thing
 * separating the three exported operations from each other.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	copyHeadingSection,
	captureSectionTarget,
	cutHeadingSection,
	deleteHeadingSection,
	getHeadingSectionRange,
} from "../src/editor/contextmenu/sectionOps";
import { asEditor, editor } from "./support/fakeEditor";
import type { App, MarkdownView } from "obsidian";

/* -------------------------------------------------------------------------- */
/* Clipboard                                                                  */
/* -------------------------------------------------------------------------- */

/** Everything written to the clipboard since the last {@link clipboard} call. */
const writes: string[] = [];

// Node ships its own `navigator` as a getter-only accessor on `globalThis`, so
// it has to be redefined rather than assigned. Installed once at module scope —
// `node --test` gives each test *file* its own process, so nothing leaks.
Object.defineProperty(globalThis, "navigator", {
	configurable: true,
	value: {
		clipboard: {
			writeText: (text: string) => {
				writes.push(text);
				return Promise.resolve();
			},
		},
	},
});

/** Start a test's clipboard log empty and hand it back to assert on. */
function clipboard(): string[] {
	writes.length = 0;
	return writes;
}

/* -------------------------------------------------------------------------- */
/* The range                                                                  */
/* -------------------------------------------------------------------------- */

describe("getHeadingSectionRange — where the section ends", () => {
	const doc = [
		"## [!tip] First", // 0
		"body of first", // 1
		"", // 2
		"### deeper", // 3
		"still inside first", // 4
		"## [!note] Second", // 5
		"body of second", // 6
	].join("\n");

	it("runs from the heading line to just before the next heading of the same level", () => {
		const e = editor(doc);
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		assert.deepStrictEqual(range.from, { line: 0, ch: 0 });
		assert.deepStrictEqual(range.to, { line: 5, ch: 0 });
		assert.strictEqual(
			range.text,
			"## [!tip] First\nbody of first\n\n### deeper\nstill inside first\n",
		);
	});

	it("swallows deeper headings — an H3 does not end an H2 section", () => {
		const e = editor(doc);
		const range = getHeadingSectionRange(asEditor(e), 0, 2);
		assert.ok(range.text.includes("### deeper"));
		assert.ok(range.text.includes("still inside first"));
	});

	it("stops at a higher-level heading too, not only an equal one", () => {
		const e = editor(
			["### [!tip] Sub", "body", "# Top level", "after"].join("\n"),
		);
		const range = getHeadingSectionRange(asEditor(e), 0, 3);

		assert.deepStrictEqual(range.to, { line: 2, ch: 0 });
		assert.strictEqual(range.text, "### [!tip] Sub\nbody\n");
	});

	it("runs to end-of-document when nothing closes it", () => {
		const e = editor(["## [!tip] Only", "body", "tail"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		// No newline to consume at EOF, so `to` is the end of the last line
		// rather than the start of the one after it.
		assert.deepStrictEqual(range.to, { line: 2, ch: 4 });
		assert.strictEqual(range.text, "## [!tip] Only\nbody\ntail");
	});

	it("covers a heading that is the last line of the document", () => {
		const e = editor(["intro", "## [!tip] Last"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 1, 2);

		assert.deepStrictEqual(range.from, { line: 1, ch: 0 });
		assert.deepStrictEqual(range.to, { line: 1, ch: 14 });
		assert.strictEqual(range.text, "## [!tip] Last");
	});

	it("returns an empty-bodied section when the next heading follows immediately", () => {
		const e = editor(["## [!tip] A", "## [!note] B"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		assert.deepStrictEqual(range.to, { line: 1, ch: 0 });
		assert.strictEqual(range.text, "## [!tip] A\n");
	});
});

describe("getHeadingSectionRange — what counts as a heading", () => {
	it("needs whitespace after the hashes, exactly as markdown does", () => {
		// `##Bold` is not a heading, so it cannot close the section above it.
		const e = editor(["## [!tip] A", "##NotAHeading", "body"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		assert.ok(range.text.includes("##NotAHeading"));
		assert.ok(range.text.endsWith("body"));
	});

	it("accepts a tab as that whitespace", () => {
		const e = editor(["## [!tip] A", "body", "##\tTabbed"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		assert.deepStrictEqual(range.to, { line: 2, ch: 0 });
	});

	it("ignores a run of seven hashes — markdown caps headings at six", () => {
		const e = editor(["# [!tip] A", "####### seven", "body"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 0, 1);

		assert.ok(range.text.includes("####### seven"));
	});

	it("recognizes headings indented by up to three spaces", () => {
		const e = editor(["## [!tip] A", "  ## indented", "body"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		assert.strictEqual(range.text, "## [!tip] A\n");
	});

	it("does not look at the heading line it was given", () => {
		// The level is passed in, not re-derived: the caller already resolved the
		// heading callout and knows it. A line that is not a heading at all still
		// yields the range the caller asked for.
		const e = editor(["plain line", "body", "## Next"].join("\n"));
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		assert.deepStrictEqual(range.from, { line: 0, ch: 0 });
		assert.deepStrictEqual(range.to, { line: 2, ch: 0 });
	});
});

/* -------------------------------------------------------------------------- */
/* The three operations                                                       */
/* -------------------------------------------------------------------------- */

describe("copy / cut / delete", () => {
	const source = ["## [!tip] A", "body", "## [!note] B", "tail"].join("\n");

	it("copy puts the section on the clipboard without the trailing newline", async () => {
		const log = clipboard();
		const e = editor(source);
		const range = getHeadingSectionRange(asEditor(e), 0, 2);

		assert.strictEqual(range.text, "## [!tip] A\nbody\n");
		await copyHeadingSection(range);

		assert.deepStrictEqual(log, ["## [!tip] A\nbody"]);
		// …and leaves the document alone.
		assert.strictEqual(e.getValue(), source);
	});

	it("copy trims exactly one newline, never a blank line the user wrote", async () => {
		const log = clipboard();
		const e = editor(
			["## [!tip] A", "body", "", "## [!note] B"].join("\n"),
		);
		await copyHeadingSection(getHeadingSectionRange(asEditor(e), 0, 2));

		assert.deepStrictEqual(log, ["## [!tip] A\nbody\n"]);
	});

	it("cut copies first, then removes the range", async () => {
		const log = clipboard();
		const e = editor(source);
		await cutHeadingSection(asEditor(e), getHeadingSectionRange(asEditor(e), 0, 2));

		assert.deepStrictEqual(log, ["## [!tip] A\nbody"]);
		assert.strictEqual(e.getValue(), "## [!note] B\ntail");
	});

	it("delete removes the range and writes nothing to the clipboard", () => {
		const log = clipboard();
		const e = editor(source);
		deleteHeadingSection(
			asEditor(e),
			getHeadingSectionRange(asEditor(e), 0, 2),
		);

		assert.deepStrictEqual(log, []);
		assert.strictEqual(e.getValue(), "## [!note] B\ntail");
	});

	it("deletes a trailing section without leaving an empty line behind", () => {
		const e = editor(source);
		deleteHeadingSection(
			asEditor(e),
			getHeadingSectionRange(asEditor(e), 2, 2),
		);

		// The last section has no newline to consume, so the line before it
		// keeps its own — and no blank line is left at the end.
		assert.strictEqual(e.getValue(), "## [!tip] A\nbody\n");
	});

	it("both writers go through a single replaceRange, so undo restores it whole", async () => {
		const cut = editor(source);
		await cutHeadingSection(
			asEditor(cut),
			getHeadingSectionRange(asEditor(cut), 0, 2),
		);
		const del = editor(source);
		deleteHeadingSection(
			asEditor(del),
			getHeadingSectionRange(asEditor(del), 0, 2),
		);

		assert.strictEqual(cut.edits.length, 1);
		assert.strictEqual(del.edits.length, 1);
	});
});

describe("cut clipboard failures and stale targets", () => {
	const source = "## [!note] First\nbody\n## Second\ntail";
	it("preserves all text when copying rejects", async (test) => {
		test.mock.method(navigator.clipboard, "writeText", async () => { throw new Error("denied"); });
		const e = editor(source);
		assert.strictEqual(await cutHeadingSection(asEditor(e), getHeadingSectionRange(asEditor(e), 0, 2)), false);
		assert.strictEqual(e.getValue(), source);
	});
	it("waits for success and refuses a document changed during the copy", async (test) => {
		let complete!: () => void;
		test.mock.method(navigator.clipboard, "writeText", () => new Promise<void>((resolve) => { complete = resolve; }));
		const e = editor(source);
		const cut = cutHeadingSection(asEditor(e), getHeadingSectionRange(asEditor(e), 0, 2));
		assert.strictEqual(e.getValue(), source);
		e.replaceRange("new ", { line: 1, ch: 0 });
		complete();
		assert.strictEqual(await cut, false);
		assert.strictEqual(e.getValue(), source.replace("body", "new body"));
	});
	it("refuses a different file even when its text is identical", async (test) => {
		let complete!: () => void;
		test.mock.method(navigator.clipboard, "writeText", () => new Promise<void>((resolve) => { complete = resolve; }));
		const e = editor(source);
		const view = { file: { path: "a.md" }, editor: asEditor(e), leaf: {} };
		const leaf = { view };
		view.leaf = leaf;
		const app = { workspace: { getLeavesOfType: () => [leaf] } } as unknown as App;
		const guard = captureSectionTarget(app, view as unknown as MarkdownView, asEditor(e));
		const cut = cutHeadingSection(asEditor(e), getHeadingSectionRange(asEditor(e), 0, 2), guard);
		view.file = { path: "b.md" };
		complete();
		assert.strictEqual(await cut, false);
		assert.strictEqual(e.getValue(), source);
	});
});
