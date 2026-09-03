/**
 * tests/vaultCalloutScanner.test.ts — the three vault writers, on a fake vault.
 *
 * These are the only code paths that rewrite the user's notes in bulk, and the
 * rules worth pinning down are the ones a careless edit silently breaks: which
 * titles may be touched, that a fold mark and a `|metadata` always survive, and
 * that a delete leaves no `[!id]` anywhere — a leftover is a live reference that
 * discovery re-creates a row for, which is what used to make a delete look like
 * it had only reset the callout.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	convertCalloutsToPlainTextInVault,
	replaceCalloutIdsInVault,
	replaceCalloutTitlesInVault,
} from "../src/utils/vaultCalloutScanner";
import type { App } from "obsidian";

/**
 * The slice of `App` the writers actually touch: list the markdown files, read
 * one, write one back. `cachedRead` is only used by the scanners, but the same
 * store answers it so a test can mix the two.
 */
function fakeApp(files: Record<string, string>): {
	app: App;
	content: (path: string) => string;
} {
	const store = new Map(Object.entries(files));
	const handles = Array.from(store.keys()).map((path) => ({ path }));
	const read = (file: { path: string }): Promise<string> =>
		Promise.resolve(store.get(file.path) ?? "");
	const app = {
		vault: {
			getMarkdownFiles: () => handles,
			read,
			cachedRead: read,
			// The writers go through `process`, which owns the read/write pair;
			// the fake keeps the same identity contract the real vault has, so
			// the staleness guard in `forEachVaultFile` resolves each handle.
			getAbstractFileByPath: (path: string) =>
				handles.find((h) => h.path === path) ?? null,
			process: (file: { path: string }, fn: (data: string) => string) => {
				const next = fn(store.get(file.path) ?? "");
				store.set(file.path, next);
				return Promise.resolve(next);
			},
			modify: (file: { path: string }, data: string) => {
				store.set(file.path, data);
				return Promise.resolve();
			},
		},
	} as unknown as App;
	return { app, content: (path) => store.get(path) ?? "" };
}

/** Runs one line through a writer and hands back what the line became. */
async function rewrite(
	line: string,
	run: (app: App) => Promise<number>,
): Promise<{ line: string; count: number }> {
	const { app, content } = fakeApp({ "note.md": line });
	const count = await run(app);
	return { line: content("note.md"), count };
}

describe("replaceCalloutIdsInVault", () => {
	const swap = (line: string, titleSwap?: { from: string; to: string }) =>
		rewrite(line, (app) =>
			replaceCalloutIdsInVault(app, ["old"], "new", titleSwap),
		);
	const named = (line: string) =>
		swap(line, { from: "Old Name", to: "New Name" });

	it("swaps only the bracket span when no title swap is asked for", async () => {
		assert.strictEqual(
			(await swap("> [!old] Old Name")).line,
			"> [!new] Old Name",
		);
		assert.strictEqual((await swap("> [!old]")).line, "> [!new]");
	});

	it("carries the name across when the title is the old default", async () => {
		assert.strictEqual(
			(await named("> [!old] Old Name")).line,
			"> [!new] New Name",
		);
	});

	it("matches a default title case-insensitively and trimmed", async () => {
		assert.strictEqual(
			(await named("> [!old]   old NAME  ")).line,
			"> [!new] New Name",
		);
	});

	it("keeps a fold mark on its own side of the title", async () => {
		assert.strictEqual(
			(await named("> [!old]- Old Name")).line,
			"> [!new]- New Name",
		);
		assert.strictEqual(
			(await named("> [!old]+ Old Name")).line,
			"> [!new]+ New Name",
		);
	});

	it("leaves a title the user wrote themselves alone", async () => {
		assert.strictEqual(
			(await named("> [!old] read this first")).line,
			"> [!new] read this first",
		);
	});

	it("leaves a title-less header title-less", async () => {
		// Obsidian renders the new callout's own name for it, so adding one here
		// would only hard-code what is already right.
		assert.strictEqual((await named("> [!old]")).line, "> [!new]");
		assert.strictEqual((await named("> [!old]-")).line, "> [!new]-");
	});

	it("renames a heading callout's default title too", async () => {
		assert.strictEqual(
			(await named("### [!old] Old Name")).line,
			"### [!new] New Name",
		);
		assert.strictEqual((await named("### [!old]")).line, "### [!new]");
	});

	it("treats a heading's `-` as title text, not a fold mark", async () => {
		// A heading has no fold syntax, so `- Old Name` is the whole title and
		// correctly fails to match a swap of `Old Name`.
		assert.strictEqual(
			(await named("### [!old]- Old Name")).line,
			"### [!new]- Old Name",
		);
	});

	it("never titles an inline pill", async () => {
		assert.strictEqual(
			(await named("see [!old] for details")).line,
			"see [!new] for details",
		);
	});

	it("carries |metadata over, on both the id-only and the titled path", async () => {
		assert.strictEqual(
			(await swap("> [!old|purple] Old Name")).line,
			"> [!new|purple] Old Name",
		);
		assert.strictEqual(
			(await named("> [!old|purple] Old Name")).line,
			"> [!new|purple] New Name",
		);
	});

	it("never adds a title when the old name is empty", async () => {
		// An empty `from` would match every title-less header and invent a title
		// for it, which is never what a type swap means.
		assert.strictEqual(
			(await swap("> [!old]", { from: "   ", to: "New Name" })).line,
			"> [!new]",
		);
	});

	it("reports one replacement per token, titled or not", async () => {
		const { count } = await rewrite(
			"### [!old] Old Name and [!old] again",
			(app) =>
				replaceCalloutIdsInVault(app, ["old"], "new", {
					from: "Old Name",
					to: "New Name",
				}),
		);
		assert.strictEqual(count, 2);
	});

	it("rewrites every id form it is given", async () => {
		const { line } = await rewrite("> [!alias] Title", (app) =>
			replaceCalloutIdsInVault(app, ["old", "alias"], "new"),
		);
		assert.strictEqual(line, "> [!new] Title");
	});
});

describe("replaceCalloutTitlesInVault", () => {
	const rename = (line: string) =>
		rewrite(line, (app) =>
			replaceCalloutTitlesInVault(app, ["note"], "Old Title", "New Title"),
		);

	it("renames a block header's default title, fold mark intact", async () => {
		assert.strictEqual(
			(await rename("> [!note] Old Title")).line,
			"> [!note] New Title",
		);
		assert.strictEqual(
			(await rename("> [!note]- Old Title")).line,
			"> [!note]- New Title",
		);
	});

	it("leaves a title the user wrote alone", async () => {
		assert.strictEqual(
			(await rename("> [!note] something else")).line,
			"> [!note] something else",
		);
	});

	it("treats a heading's `-` as title text", async () => {
		assert.strictEqual(
			(await rename("## [!note]- Old Title")).line,
			"## [!note]- Old Title",
		);
		assert.strictEqual(
			(await rename("## [!note] Old Title")).line,
			"## [!note] New Title",
		);
	});

	it("never adds a title to a title-less header", async () => {
		assert.strictEqual((await rename("> [!note]")).line, "> [!note]");
	});
});

describe("convertCalloutsToPlainTextInVault", () => {
	const convert = (source: string) =>
		rewrite(source, (app) =>
			convertCalloutsToPlainTextInVault(app, ["zzz"], "Zzz").then(
				(r) => r.blocks,
			),
		);

	it("unwraps an outermost block, body and all", async () => {
		const { app, content } = fakeApp({
			"note.md": "> [!zzz] Title\n> body line\n\nafter",
		});
		await convertCalloutsToPlainTextInVault(app, ["zzz"], "Zzz");
		assert.strictEqual(content("note.md"), "Title\nbody line\n\nafter");
	});

	it("strips the token from a nested block but keeps its depth", async () => {
		// The `>` prefix belongs to the parent callout; unwrapping it here would
		// break the parent. Leaving the token would keep a live `[!zzz]`.
		assert.strictEqual((await convert(">> [!zzz] Title")).line, ">> Title");
		assert.strictEqual(
			(await convert("> > [!zzz] Title")).line,
			"> > Title",
		);
	});

	it("falls back to the display name when a nested block had no title", async () => {
		assert.strictEqual((await convert(">> [!zzz]")).line, ">> Zzz");
	});

	it("swallows a nested block's fold mark with its token", async () => {
		assert.strictEqual((await convert(">> [!zzz]- Title")).line, ">> Title");
		assert.strictEqual((await convert(">> [!zzz]+")).line, ">> Zzz");
	});

	it("sees through |metadata at either depth", async () => {
		// `> [!zzz|purple]` is the zzz callout carrying metadata, so the
		// outermost one still unwraps whole and the nested one still loses its
		// token — a piped spelling must not be a way to survive a delete.
		assert.strictEqual((await convert("> [!zzz|purple] Title")).line, "Title");
		assert.strictEqual(
			(await convert(">> [!zzz|purple] Title")).line,
			">> Title",
		);
	});

	it("leaves a nested block of another type alone", async () => {
		assert.strictEqual(
			(await convert(">> [!other] Title")).line,
			">> [!other] Title",
		);
	});

	it("still converts headings and pills", async () => {
		assert.strictEqual((await convert("### [!zzz] Title")).line, "### Title");
		assert.strictEqual((await convert("### [!zzz]")).line, "### Zzz");
		assert.strictEqual((await convert("see [!zzz] here")).line, "see Zzz here");
		assert.strictEqual(
			(await convert("[!zzz]{be careful}")).line,
			"Zzz: be careful",
		);
	});

	it("leaves no [!zzz] anywhere in a document that used every role", async () => {
		const { app, content } = fakeApp({
			"note.md": [
				"> [!zzz] Top",
				"> body",
				"",
				"> [!note] Parent",
				">> [!zzz] Nested",
				">> nested body",
				"",
				"### [!zzz] Heading",
				"a [!zzz] pill",
			].join("\n"),
		});
		await convertCalloutsToPlainTextInVault(app, ["zzz"], "Zzz");
		assert.ok(
			!content("note.md").includes("[!zzz]"),
			`leftover reference in:\n${content("note.md")}`,
		);
		// The parent callout is untouched.
		assert.ok(content("note.md").includes("> [!note] Parent"));
	});
});
