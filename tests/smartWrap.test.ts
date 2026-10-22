/**
 * tests/smartWrap.test.ts — which callout "Wrap in callout" and "Insert empty
 * callout" write, and what they leave for the autocomplete to finish.
 *
 * Neither command asks for a format; the cursor's place answers it. A heading
 * becomes a heading callout, part of a line an inline pill, and whole lines a
 * block callout — so each case here is a place, and the form it must get.
 * Every fallback is the block callout the two commands always wrote, which is
 * why most of the edge cases below assert nothing more than "block".
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { Notice } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import {
	chooseInsertForm,
	chooseWrapForm,
	insertAtCursor,
	wrapAtCursor,
	type FormSettings,
} from "../src/editor/smartCallout";
import { t } from "../src/i18n";
import { asEditor, selectionEditor } from "./support/selectionEditor";

const settings = (
	over: { heading?: boolean; inline?: boolean; content?: boolean } = {},
): FormSettings => ({
	headingCallouts: { ...DEFAULT_SETTINGS.headingCallouts, enabled: over.heading ?? true },
	inlineCallouts: { enabled: over.inline ?? true, allowContent: over.content ?? true },
});

/** Run Wrap; return the buffer with `⎸` at the cursor, and whether the picker opens. */
const wrap = (source: string, with_ = settings()): { text: string; opens: boolean } => {
	const ed = selectionEditor(source);
	const opens = wrapAtCursor(asEditor(ed), with_);
	return { text: ed.valueWithCursor(), opens };
};

const insert = (source: string, with_ = settings()): { text: string; opens: boolean } => {
	const ed = selectionEditor(source);
	const opens = insertAtCursor(asEditor(ed), with_);
	return { text: ed.valueWithCursor(), opens };
};

const wrapKind = (source: string, with_ = settings()): string =>
	chooseWrapForm(asEditor(selectionEditor(source)), with_).kind;

const insertKind = (source: string, with_ = settings()): string =>
	chooseInsertForm(asEditor(selectionEditor(source)), with_).kind;

const lastNotice = (): string => String((Notice as unknown as { last?: { message: unknown } }).last?.message);

describe("Wrap in callout: a heading becomes a heading callout", () => {
	it("from a cursor anywhere on it", () => {
		assert.deepStrictEqual(wrap("## My ⎸title\nbody"), { text: "## [!⎸] My title\nbody", opens: true });
		assert.deepStrictEqual(wrap("⎸# Top"), { text: "# [!⎸] Top", opens: true });
	});

	it("from a selection of the whole heading, its # marks included", () => {
		assert.strictEqual(wrap("«## My title»").text, "## [!⎸] My title");
		assert.strictEqual(wrap("»## My title«").text, "## [!⎸] My title");
		assert.strictEqual(wrap("## «My title»").text, "## [!⎸] My title");
		// Shift+Down from the start of the line ends on the next one.
		assert.strictEqual(wrap("«## My title\n»body").text, "## [!⎸] My title\nbody");
	});

	it("from a selection that reaches into the # marks", () => {
		assert.strictEqual(wrap("#«# My» title").text, "## [!⎸] My title");
	});

	it("reads closing # marks as part of the heading, not of its title", () => {
		assert.strictEqual(wrap("## «My title» ##").text, "## [!⎸] My title ##");
	});

	it("gives a heading with no title a token of its own", () => {
		assert.strictEqual(wrap("##⎸").text, "## [!⎸]");
		assert.strictEqual(wrap("## ⎸").text, "## [!⎸]");
	});

	it("says so, and changes nothing, when the heading is a callout already", () => {
		for (const source of ["## [!tip] My ⎸title", "## [!tip] «My title»", "«## [!tip] My title»", "## [!t«ip] My» title"]) {
			const result = wrap(source);
			assert.strictEqual(result.opens, false, source);
			assert.strictEqual(result.text.replace("⎸", ""), source.replace(/[«»⎸]/g, ""), source);
			assert.strictEqual(lastNotice(), t("notice.headingAlreadyCallout"), source);
		}
	});

	it("is a line like any other while heading callouts are off", () => {
		assert.strictEqual(wrapKind("## My ⎸title", settings({ heading: false })), "block");
	});

	it("only at the start of a line, outside any quote", () => {
		assert.strictEqual(wrapKind(" ## My ⎸title"), "block");
		assert.strictEqual(wrapKind("> ## My ⎸title"), "block");
		assert.strictEqual(wrapKind("```\n## My ⎸title\n```"), "block");
		assert.strictEqual(wrapKind("#tag ⎸here"), "block");
	});
});

describe("Wrap in callout: part of a line becomes an inline pill", () => {
	it("around the selected words, with the cursor in its type", () => {
		assert.deepStrictEqual(wrap("Some «text» here"), { text: "Some [!⎸]{text} here", opens: true });
	});

	it("leaves out the space at either end of the selection", () => {
		assert.strictEqual(wrap("Some« text »here").text, "Some [!⎸]{text} here");
	});

	it("inside a heading's title", () => {
		assert.strictEqual(wrap("## My «title» here").text, "## My [!⎸]{title} here");
		assert.strictEqual(wrap("## [!tip] My «title»").text, "## [!tip] My [!⎸]{title}");
	});

	it("falls back to the heading when the pill would open the title", () => {
		// `## [!x]{My}` is the heading callout `x` titled `{My}`, not a pill.
		assert.strictEqual(wrap("## «My» title").text, "## [!⎸] My title");
	});

	it("inside a callout's body, a list item and a table cell", () => {
		assert.strictEqual(wrap("> [!tip]\n> Some «text»").text, "> [!tip]\n> Some [!⎸]{text}");
		assert.strictEqual(wrap("- an «item» here").text, "- an [!⎸]{item} here");
		assert.strictEqual(wrap("| a | b «c» |\n|---|---|").text, "| a | b [!⎸]{c} |\n|---|---|");
	});

	it("around a whole code span", () => {
		assert.strictEqual(wrap("a «`code`» b").text, "a [!⎸]{`code`} b");
	});

	it("is one edit, so one Undo takes it back", () => {
		const ed = selectionEditor("Some «text» here");
		wrapAtCursor(asEditor(ed), settings());
		assert.strictEqual(ed.edits, 1);
	});
});

describe("Wrap in callout: everything else is a block, as it always was", () => {
	it("a whole line, list item or task", () => {
		assert.strictEqual(wrapKind("«Some text here»"), "block");
		assert.strictEqual(wrapKind("- «item text»"), "block");
		assert.strictEqual(wrapKind("- [ ] «task text»"), "block");
		assert.strictEqual(wrapKind("> «quoted text»"), "block");
		assert.strictEqual(wrap("«Some text here»").text, "> [!⎸\n> Some text here");
	});

	it("more than one line, headings and all", () => {
		assert.strictEqual(wrapKind("«## Head\ntext»"), "block");
		assert.strictEqual(wrapKind("one «line\nand» two"), "block");
	});

	it("a bare cursor in a paragraph, a blank line, or a selection of only space", () => {
		assert.strictEqual(wrapKind("Some ⎸text"), "block");
		assert.strictEqual(wrapKind("a\n⎸\nb"), "block");
		assert.strictEqual(wrapKind("Some« »text"), "block");
	});

	it("where a pill cannot be one", () => {
		// The start of a quoted line is a callout header, to Obsidian and here.
		assert.strictEqual(wrapKind("> «Some» text"), "block");
		assert.strictEqual(wrapKind("a `co«de»` b"), "block");
		assert.strictEqual(wrapKind("```\nsome «code»\n```"), "block");
		assert.strictEqual(wrapKind("see [[No«te»]] here"), "block");
		assert.strictEqual(wrapKind("a [!t«ip]{x} b»"), "block");
		assert.strictEqual(wrapKind("a «{b» c"), "block");
		// A `|` would split the cell the pill sits in.
		assert.strictEqual(wrapKind("| «a | b» |\n|---|---|"), "block");
		// A block callout's header is Obsidian's title, with no pills in it.
		assert.strictEqual(wrapKind("> [!tip] My «title»"), "block");
		assert.strictEqual(wrapKind("---\nkey: «val»\n---"), "block");
	});

	it("while pills, or the text inside them, are off", () => {
		assert.strictEqual(wrapKind("Some «text» here", settings({ inline: false })), "block");
		assert.strictEqual(wrapKind("Some «text» here", settings({ content: false })), "block");
		assert.strictEqual(wrapKind("## My «title» here", settings({ content: false })), "heading");
	});
});

describe("Insert empty callout: a new callout of the form that fits here", () => {
	it("a block on a blank line, as it always was", () => {
		assert.strictEqual(insertKind("a\n\n⎸\nb"), "block");
		assert.strictEqual(insertKind("> ⎸"), "block");
		assert.strictEqual(insertKind("- ⎸"), "block");
	});

	it("a heading callout at the start of a heading", () => {
		assert.deepStrictEqual(insert("## ⎸My title"), { text: "## [!⎸] My title", opens: true });
		assert.strictEqual(insert("#⎸# My title").text, "## [!⎸] My title");
	});

	it("an inline pill anywhere in text", () => {
		assert.deepStrictEqual(insert("Some te⎸xt"), { text: "Some te[!⎸]xt", opens: true });
		assert.strictEqual(insert("Some text⎸").text, "Some text[!⎸]");
		assert.strictEqual(insert("⎸Some text").text, "[!⎸]Some text");
		assert.strictEqual(insert("## My ti⎸tle").text, "## My ti[!⎸]tle");
		assert.strictEqual(insert("## [!tip] My title⎸").text, "## [!tip] My title[!⎸]");
		assert.strictEqual(insert("- [ ] ⎸task").text, "- [ ] [!⎸]task");
		assert.strictEqual(insert("a `code`⎸ b").text, "a `code`[!⎸] b");
	});

	it("never takes the selection in", () => {
		assert.strictEqual(insert("Some «text»").text, "Some text[!⎸]");
	});

	it("says so on a heading callout's own token", () => {
		const result = insert("## [!ti⎸p] My title");
		assert.strictEqual(result.opens, false);
		assert.strictEqual(lastNotice(), t("notice.headingAlreadyCallout"));
	});

	it("falls back to a block below the line where no pill fits", () => {
		for (const source of [
			"> ⎸text",
			"- ⎸[ ] task",
			"a `co⎸de` b",
			"```\nco⎸de\n```",
			"a [!ti⎸p] b",
			"a ⎸{x} b",
			"> [!tip] Ti⎸tle",
		]) {
			assert.strictEqual(insertKind(source), "block", source);
		}
		assert.strictEqual(insertKind("Some te⎸xt", settings({ inline: false })), "block");
		assert.strictEqual(insert("Some te⎸xt", settings({ inline: false })).text, "Some text\n\n> [!⎸");
	});

	it("takes a heading as text while heading callouts are off", () => {
		assert.strictEqual(insertKind("## My ⎸title", settings({ heading: false })), "inline");
		// Right after the # marks a pill would be a heading token all the same.
		assert.strictEqual(insertKind("## ⎸My title", settings({ heading: false })), "block");
	});
});
