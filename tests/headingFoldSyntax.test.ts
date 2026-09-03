/**
 * tests/headingFoldSyntax.test.ts — 162: the heading role has no `+`/`-`, and
 * the blockquote role still has.
 *
 * `### [!type]-` used to fold a heading callout. The syntax was removed on
 * 2026-07-26 because it was a third way to say what two visible chevrons — the
 * native pre-heading arrow and this plugin's trailing `.cs-fold-arrow` — already
 * say, and unlike them it was invisible in the rendered note and lived only in
 * the source. Both chevrons are driven by CodeMirror fold state and never read a
 * marker, so nothing was lost by dropping it.
 *
 * What is left behind is a **grammar change that reads as no change at all**:
 * `### [!type]- Title` is still perfectly valid markdown, it just means
 * something else now — the callout `type` with the title `- Title`. Nothing
 * errors, nothing warns, and a rewriter that still believes in the old grammar
 * silently eats a character out of the user's title. That is the whole failure
 * mode this file exists for.
 *
 * Three claims, and they have to hold together or the removal is only half
 * done:
 *
 * - **The grammar does not mention it.** `HEADING_CALLOUT_RE` has no marker
 *   group, the token's `from`/`to` stop at the `]`, and everything past it is
 *   title — including a `-` glued straight to the bracket.
 * - **Nothing writes one.** `buildHeadingToken` emits no marker whatever the
 *   definition's fold defaults say, while `buildBlockHeaderToken` still does.
 * - **The blockquote role is untouched.** `> [!note]-` is Obsidian's own
 *   syntax and still works, and so do the two things built on it —
 *   `CALLOUT_FOLD_MARK_REGEX` behind the "Fold defaults" right-click group, and
 *   `normalizeFoldMarkersInVault` behind the editor's save. Both are anchored to
 *   `>` so a heading line cannot reach them.
 *
 * `normalizeFoldMarkersInVault` had no tests at all before this file, which
 * matters more than the count suggests: it is a **bulk writer over every
 * markdown file in the vault**, and the marker it is asked to write sits one
 * character away from text the user typed.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	HEADING_CALLOUT_RE,
	parseOutlineHeadingText,
	scanLineForCalloutTokens,
	type LineCalloutToken,
} from "../src/editor/calloutTokens";
import { CALLOUT_FOLD_MARK_REGEX } from "../src/editor/contextmenu/resolve";
import {
	buildBlockHeaderToken,
	buildHeadingToken,
	splitFoldMark,
} from "../src/editor/calloutWriter";
import { normalizeFoldMarkersInVault } from "../src/utils/vaultCalloutScanner";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../src/types";

/** The one token on a line, or a thrown assertion naming the line. */
function only(line: string): LineCalloutToken {
	const tokens = scanLineForCalloutTokens(line);
	assert.strictEqual(tokens.length, 1, `expected one token in ${line}`);
	return tokens[0] as LineCalloutToken;
}

/** The text a heading token leaves as its title — `(.*)` of the grammar. */
function headingTitle(line: string): string {
	const match = HEADING_CALLOUT_RE.exec(line);
	assert.ok(match, `not a heading callout: ${line}`);
	return match[3] ?? "";
}

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

/* -------------------------------------------------------------------------- */
/* The grammar                                                                */
/* -------------------------------------------------------------------------- */

describe("the heading grammar has no marker in it", () => {
	it("names no `+`/`-` at all", () => {
		// Stated against the pattern itself rather than only against its
		// behaviour: re-adding the group is the single edit that would undo all
		// of this, and it should fail here first, with this file's name on it.
		assert.doesNotMatch(HEADING_CALLOUT_RE.source, /\[[-+]{2}\]/);
	});

	it("reads a trailing `-` as the first character of the title", () => {
		assert.strictEqual(headingTitle("### [!tip]- Title"), "- Title");
		assert.strictEqual(headingTitle("### [!tip]+ Title"), "+ Title");
	});

	it("reads a marker with nothing after it as the whole title", () => {
		assert.strictEqual(headingTitle("### [!tip]-"), "-");
		assert.strictEqual(headingTitle("### [!tip]+"), "+");
	});

	it("consumes exactly one space as the separator, and no more", () => {
		// An Obsidian heading shows the spaces you write; swallowing a run of
		// them would make this role render unlike every other heading.
		assert.strictEqual(headingTitle("### [!tip]  spaced"), " spaced");
		assert.strictEqual(headingTitle("### [!tip] plain"), "plain");
	});

	it("has no separator to consume when the title is glued to the bracket", () => {
		assert.strictEqual(headingTitle("### [!tip]-glued"), "-glued");
		assert.strictEqual(headingTitle("### [!tip]glued"), "glued");
	});
});

describe("the heading token stops at the bracket", () => {
	it("spans `[!tip]` and not the `-` after it", () => {
		// The offsets are what every rewriter slices with. A `to` that reached
		// past the `]` would delete a character of the user's title on the next
		// type swap.
		const line = "### [!tip]- Title";
		const token = only(line);

		assert.strictEqual(token.role, "heading");
		assert.strictEqual(line.slice(token.from, token.to), "[!tip]");
		assert.strictEqual(line[token.to], "-");
	});

	it("counts a marker-only tail as a title, because that is what it is", () => {
		assert.strictEqual(only("### [!tip]-").hasTitle, true);
		assert.strictEqual(only("### [!tip]").hasTitle, false);
	});

	it("keeps the heading level and the rest of the roles unchanged", () => {
		const token = only("###### [!tip]+ Title");
		assert.strictEqual(token.headingLevel, 6);
		assert.strictEqual(token.rawId, "tip");
	});
});

/* -------------------------------------------------------------------------- */
/* Nothing writes one                                                          */
/* -------------------------------------------------------------------------- */

describe("the writers", () => {
	it("write no marker into a heading, whatever the fold defaults say", () => {
		assert.strictEqual(
			buildHeadingToken(def({ foldable: true, defaultFolded: true })),
			"[!warning]",
		);
		assert.strictEqual(
			buildHeadingToken(def({ foldable: true, defaultFolded: false })),
			"[!warning]",
		);
	});

	it("still write one into a blockquote header, which does fold that way", () => {
		// The contrast is the point: this is not a plugin-wide retreat from fold
		// markers, it is one role losing a syntax that was never Obsidian's.
		assert.strictEqual(
			buildBlockHeaderToken(def({ foldable: true, defaultFolded: true })),
			"[!warning]- Warning",
		);
	});

	it("keep a leading `-` that the user's own title starts with", () => {
		// The line `### [!warning]- Title` round-trips through a type swap: the
		// scanner hands `- Title` over as the existing title, and the writer has
		// to put it back rather than read it as a marker it is about to reissue.
		assert.strictEqual(
			buildHeadingToken(def(), { existingTitle: "- Title" }),
			"[!warning] - Title",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The reader, which is where the rule is actually enforced                   */
/* -------------------------------------------------------------------------- */

/**
 * `splitFoldMark` is the one place a `+`/`-` after a `]` is read as syntax, and
 * it takes the role as an argument for a reason that is easy to lose.
 *
 * Every reader of a fold mark used to state the role rule in its own shape. The
 * vault rewriter tested `token.role`; AutoComplete's `selectSuggestion` ran
 * `/^([+-]?)\s*(.*)$/` with no role in it at all, and was correct only because
 * the inline and heading branches `return` above it. That is a real guarantee
 * and an invisible one: nothing in the regex, its variable names or its comment
 * says the line is a blockquote, so tidying two early returns into a `switch`
 * with shared tail work would have started eating the first character of every
 * heading title beginning with `-` — a rewrite that looks like it worked.
 *
 * Passing the role in makes that a compiler-visible obligation instead. These
 * assertions are the property itself: for the two roles that have no fold
 * syntax, a leading `-` is title text no matter what the caller believes.
 */
describe("splitFoldMark reads the mark from the role, not from the caller", () => {
	it("takes the mark off a blockquote header", () => {
		assert.deepStrictEqual(splitFoldMark("- Title", "regular"), {
			foldMark: "-",
			title: " Title",
		});
		assert.deepStrictEqual(splitFoldMark("+ Title", "regular"), {
			foldMark: "+",
			title: " Title",
		});
	});

	it("leaves a heading's leading `-` in the title", () => {
		assert.deepStrictEqual(splitFoldMark("- Title", "heading"), {
			foldMark: "",
			title: "- Title",
		});
		assert.deepStrictEqual(splitFoldMark("+ Title", "heading"), {
			foldMark: "",
			title: "+ Title",
		});
	});

	it("leaves an inline pill's alone too", () => {
		// `[!note]-ish` is a pill followed by the user's prose; a pill has no
		// title of its own and no fold syntax to read.
		assert.deepStrictEqual(splitFoldMark("-ish", "inline"), {
			foldMark: "",
			title: "-ish",
		});
	});

	it("reports no mark when there is none, on every role", () => {
		for (const role of ["regular", "heading", "inline"] as const) {
			assert.deepStrictEqual(splitFoldMark(" Title", role), {
				foldMark: "",
				title: " Title",
			});
			assert.deepStrictEqual(splitFoldMark("", role), {
				foldMark: "",
				title: "",
			});
		}
	});
});


/* -------------------------------------------------------------------------- */
/* The blockquote role, which is untouched                                    */
/* -------------------------------------------------------------------------- */

describe("`> [!note]-` still means what it always meant", () => {
	it("leaves the token spanning the bracket, with the mark after it", () => {
		const line = "> [!note]- Title";
		const token = only(line);

		assert.strictEqual(token.role, "regular");
		assert.strictEqual(line.slice(token.from, token.to), "[!note]");
		assert.strictEqual(line[token.to], "-");
	});

	it("is what CALLOUT_FOLD_MARK_REGEX reads the mark out of", () => {
		assert.strictEqual(CALLOUT_FOLD_MARK_REGEX.exec("> [!note]- x")?.[3], "-");
		assert.strictEqual(CALLOUT_FOLD_MARK_REGEX.exec("> [!note]+ x")?.[3], "+");
		assert.strictEqual(
			CALLOUT_FOLD_MARK_REGEX.exec("> [!note] x")?.[3],
			undefined,
		);
	});

	it("and that regex cannot reach a heading line at all", () => {
		// Anchored to the quote prefix, so the removal did not have to be
		// re-stated in the context menu: a heading simply never matches.
		assert.strictEqual(CALLOUT_FOLD_MARK_REGEX.test("## [!note]- x"), false);
		assert.strictEqual(CALLOUT_FOLD_MARK_REGEX.test("a [!note]- x"), false);
	});
});

/* -------------------------------------------------------------------------- */
/* normalizeFoldMarkersInVault — the bulk writer                              */
/* -------------------------------------------------------------------------- */

/**
 * The slice of `App` the writer touches: list the files, read one, write one
 * back. Modelled on `vaultCalloutScanner.test.ts`'s, kept local because this
 * one also has to observe *whether* a file was written at all.
 */
function fakeApp(files: Record<string, string>): {
	app: App;
	content: (path: string) => string;
	writes: string[];
} {
	const store = new Map(Object.entries(files));
	const handles = Array.from(store.keys()).map((path) => ({ path }));
	const writes: string[] = [];
	const read = (file: { path: string }): Promise<string> =>
		Promise.resolve(store.get(file.path) ?? "");
	const app = {
		vault: {
			getMarkdownFiles: () => handles,
			read,
			cachedRead: read,
			getAbstractFileByPath: (path: string) =>
				handles.find((h) => h.path === path) ?? null,
			// The writer goes through `process`, which owns the read/write pair.
			// Recording the write here is what keeps "does not open the file for
			// writing when nothing changed" meaningful: the real `process` writes
			// whatever its callback returns, so the only thing that can spare an
			// unaffected note a write is not calling `process` on it at all.
			process: (file: { path: string }, fn: (data: string) => string) => {
				writes.push(file.path);
				const next = fn(store.get(file.path) ?? "");
				store.set(file.path, next);
				return Promise.resolve(next);
			},
			modify: (file: { path: string }, data: string) => {
				writes.push(file.path);
				store.set(file.path, data);
				return Promise.resolve();
			},
		},
	} as unknown as App;
	return { app, content: (path) => store.get(path) ?? "", writes };
}

/** Runs one document through the writer and hands back what it became. */
async function normalize(
	source: string,
	marker: "" | "+" | "-",
	ids: string[] = ["note"],
): Promise<{ text: string; count: number; wrote: boolean }> {
	const { app, content, writes } = fakeApp({ "note.md": source });
	const count = await normalizeFoldMarkersInVault(app, ids, marker);
	return { text: content("note.md"), count, wrote: writes.length > 0 };
}

describe("normalizeFoldMarkersInVault — what it rewrites", () => {
	it("adds the mark to a bare block header", async () => {
		assert.strictEqual((await normalize("> [!note] Hi", "-")).text, "> [!note]- Hi");
		assert.strictEqual((await normalize("> [!note] Hi", "+")).text, "> [!note]+ Hi");
	});

	it("swaps one mark for the other", async () => {
		assert.strictEqual((await normalize("> [!note]+ Hi", "-")).text, "> [!note]- Hi");
	});

	it("takes the mark off entirely for the empty marker", async () => {
		assert.strictEqual((await normalize("> [!note]- Hi", "")).text, "> [!note] Hi");
	});

	it("touches a title-less header the same way", async () => {
		assert.strictEqual((await normalize("> [!note]", "-")).text, "> [!note]-");
	});

	it("passes |metadata straight through", async () => {
		// The mark sits after the closing bracket, so the metadata is only ever
		// carried across — but an id-only pattern would skip the line entirely
		// and leave a piped occurrence with the wrong default.
		assert.strictEqual(
			(await normalize("> [!note|purple]+ Hi", "-")).text,
			"> [!note|purple]- Hi",
		);
		assert.strictEqual(
			(await normalize("> [!note|purple] Hi", "-")).text,
			"> [!note|purple]- Hi",
		);
	});

	it("matches the id however it is cased", async () => {
		assert.strictEqual((await normalize("> [!NOTE] Hi", "-")).text, "> [!NOTE]- Hi");
	});

	it("rewrites every id it is given, which is how aliases are covered", async () => {
		const { text } = await normalize(
			"> [!note] a\n> [!nb] b",
			"-",
			["note", "nb"],
		);
		assert.strictEqual(text, "> [!note]- a\n> [!nb]- b");
	});
});

describe("normalizeFoldMarkersInVault — what it must not touch", () => {
	it("leaves a heading callout alone, marker and all", async () => {
		// The removal's whole point at the vault level: `- Old Name` is a title
		// the user wrote, and normalizing it would silently delete a character
		// from it across every note at once.
		for (const line of ["## [!note]- Hi", "### [!note]+ Hi", "# [!note] Hi"]) {
			const { text, count } = await normalize(line, "-");
			assert.strictEqual(text, line);
			assert.strictEqual(count, 0);
		}
	});

	it("leaves an inline pill alone", async () => {
		assert.strictEqual(
			(await normalize("see [!note] for details", "-")).text,
			"see [!note] for details",
		);
	});

	it("leaves a callout it was not asked about alone", async () => {
		assert.strictEqual((await normalize("> [!tip] Hi", "-")).text, "> [!tip] Hi");
	});

	it("leaves a `[!note]` that merely follows a lone `>` on the line before", async () => {
		// The reason the quote run is `[ \t]` and not `\s`: with `\s` the run
		// crossed the newline, so an empty quote line followed by a paragraph
		// that happens to start with the token collected a fold mark it has no
		// business carrying — a callout is not what either line renders as.
		const { text, count } = await normalize(">\n[!note] Hi", "-");
		assert.strictEqual(text, ">\n[!note] Hi");
		assert.strictEqual(count, 0);
	});
});

describe("normalizeFoldMarkersInVault — nesting", () => {
	// The gap this suite was written to record, now closed. A callout inside
	// another callout is a callout: Obsidian renders it, folds it, and reads its
	// `+`/`-` exactly as it does at the top level. Anchoring to a single `>` left
	// every nested occurrence on the old default while its siblings moved — a
	// "fold defaults" change that silently did not apply to part of the vault.

	it("rewrites a nested header", async () => {
		assert.strictEqual((await normalize(">> [!note]+ Hi", "-")).text, ">> [!note]- Hi");
		assert.strictEqual((await normalize(">> [!note] Hi", "-")).text, ">> [!note]- Hi");
		assert.strictEqual((await normalize(">> [!note]- Hi", "")).text, ">> [!note] Hi");
	});

	it("reads the spaced spelling of the same nesting", async () => {
		// `> > [!note]` and `>> [!note]` are one thing to Obsidian, so they must
		// be one thing here — this is the tokenizer's own prefix, not a new one.
		assert.strictEqual(
			(await normalize("> > [!note]+ Hi", "-")).text,
			"> > [!note]- Hi",
		);
		assert.strictEqual(
			(await normalize(">>> [!note] Hi", "-")).text,
			">>> [!note]- Hi",
		);
	});

	it("keeps the quote prefix exactly as it was written", async () => {
		// The prefix is captured and re-emitted, so a rewrite must not tidy the
		// user's spacing into some canonical form.
		assert.strictEqual((await normalize(">>[!note] Hi", "-")).text, ">>[!note]- Hi");
		assert.strictEqual(
			(await normalize(">  [!note] Hi", "-")).text,
			">  [!note]- Hi",
		);
	});

	it("counts a nested occurrence beside its parent", async () => {
		const { text, count } = await normalize(
			"> [!note] outer\n>> [!note]+ inner",
			"-",
		);
		assert.strictEqual(text, "> [!note]- outer\n>> [!note]- inner");
		assert.strictEqual(count, 2);
	});

	it("still leaves a nested heading callout alone", async () => {
		// Depth is not what decides this — the role is. `>> ## [!note]-` is a
		// heading inside a quote, and its `-` is still the title's first
		// character.
		const { text, count } = await normalize(">> ## [!note]- Hi", "-");
		assert.strictEqual(text, ">> ## [!note]- Hi");
		assert.strictEqual(count, 0);
	});
});

describe("normalizeFoldMarkersInVault — how much it writes", () => {
	it("counts one per rewritten occurrence", async () => {
		const { count } = await normalize("> [!note] a\n> [!note]+ b\n> [!note]- c", "-");
		assert.strictEqual(count, 2);
	});

	it("does not open the file for writing when nothing changed", async () => {
		// Every write is a vault modification, which syncs, which re-renders.
		const { wrote, count } = await normalize("> [!note]- Hi", "-");
		assert.strictEqual(count, 0);
		assert.strictEqual(wrote, false);
	});

	it("is a no-op for an empty id list, without reading anything", async () => {
		const { app, writes } = fakeApp({ "note.md": "> [!note] Hi" });
		assert.strictEqual(await normalizeFoldMarkersInVault(app, [], "-"), 0);
		assert.deepStrictEqual(writes, []);
	});

	it("settles after one pass", async () => {
		const { app, content } = fakeApp({ "note.md": "> [!note] Hi" });
		await normalizeFoldMarkersInVault(app, ["note"], "-");
		assert.strictEqual(
			await normalizeFoldMarkersInVault(app, ["note"], "-"),
			0,
		);
		assert.strictEqual(content("note.md"), "> [!note]- Hi");
	});
});

/* -------------------------------------------------------------------------- */
/* The Outline pane, where the same `-` is even harder to see                  */
/* -------------------------------------------------------------------------- */

describe("the Outline pane reads a trailing `-` as title too", () => {
	// The pane strips the brackets, so `# [!note]- Title` arrives as
	// `!note- Title` with nothing but the file's own ids to delimit the type.
	// `resolveBareOutlineId` therefore refuses any candidate ending in `-`:
	// `note-` would normalize back to `note` and swallow a character that
	// belongs to the title.
	const isKnown = (id: string): boolean => id === "note";

	it("bracketed: everything past the `]` is the title", () => {
		const token = parseOutlineHeadingText("[!note]- Title", isKnown);
		assert.strictEqual(token?.rawId, "note");
		assert.strictEqual(token?.title, "- Title");
	});

	it("bracketless: the id stops before the `-`", () => {
		const token = parseOutlineHeadingText("!note- Title", isKnown);
		assert.strictEqual(token?.rawId, "note");
		assert.strictEqual(token?.title, "- Title");
	});

	it("bracketless with nothing after the marker", () => {
		const token = parseOutlineHeadingText("!note-", isKnown);
		assert.strictEqual(token?.rawId, "note");
		assert.strictEqual(token?.title, "-");
	});

	it("still parses the ordinary form the same way", () => {
		const token = parseOutlineHeadingText("!note Title", isKnown);
		assert.strictEqual(token?.rawId, "note");
		assert.strictEqual(token?.title, "Title");
	});
});
