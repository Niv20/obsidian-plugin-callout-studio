/**
 * The counts behind the callout editor's "Update your notes?" question: one pass
 * over the vault, three numbers per id, each with the notes it came from.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { scanIdNoteStats, sumTallies } from "../src/utils/idNoteStats";

function vault(notes: Record<string, string>, unreadable: string[] = []) {
	const handles = Object.keys(notes).map((path) => ({ path }));
	let reads = 0;
	const app = { vault: {
		getMarkdownFiles: () => handles,
		getAbstractFileByPath: (path: string) => handles.find((file) => file.path === path) ?? null,
		cachedRead: (file: { path: string }) => {
			reads++;
			return unreadable.includes(file.path) ? Promise.reject(new Error("locked")) : Promise.resolve(notes[file.path]!);
		},
	} } as unknown as App;
	return { app, reads: () => reads };
}

describe("scanIdNoteStats", () => {
	const notes = {
		"a.md": "> [!test] Test\n> body\n> [!test]- Folded\nAnd an [!test] pill.",
		"b.md": "## [!test] Test\n> [!a b]+ Old name\n> [!a-b] Old name",
		"c.md": "```\n> [!test] in code\n```\n---\n> [!other] Test",
	};

	it("counts every use of each id, in one pass, keyed by identity", async () => {
		const h = vault(notes);
		const stats = await scanIdNoteStats(h.app, ["test", "a b", "unused"]);
		assert.equal(h.reads(), 3, "each note read once for every id together");
		assert.equal(stats.get("test")?.uses.count, 4);
		assert.deepEqual([...stats.get("test")!.uses.files].sort(), ["a.md", "b.md"]);
		assert.equal(stats.get("a-b")?.uses.count, 2, "`a b` and `a-b` are one id");
		assert.equal(stats.get("unused")?.uses.count, 0);
	});

	it("counts block callouts whose fold mark differs — never a heading's title", async () => {
		const stats = await scanIdNoteStats(vault(notes).app, ["test", "a b"], { fold: "-" });
		// `> [!test] Test` differs, `> [!test]- Folded` does not; the heading and
		// the pill have no fold syntax at all.
		assert.equal(stats.get("test")?.foldDiffers.count, 1);
		assert.equal(stats.get("a-b")?.foldDiffers.count, 2);
	});

	it("counts whole titles, case-insensitively, on blocks and headings only", async () => {
		const stats = await scanIdNoteStats(vault(notes).app, ["test", "a b"], { title: "old NAME" });
		assert.equal(stats.get("a-b")?.titled.count, 2);
		assert.equal(stats.get("test")?.titled.count, 0);
		const named = await scanIdNoteStats(vault(notes).app, ["test"], { title: "test" });
		assert.equal(named.get("test")?.titled.count, 2, "the block and the heading, not the pill");
	});

	it("adds tallies across ids without counting a note twice", async () => {
		const stats = await scanIdNoteStats(vault(notes).app, ["test", "a b"]);
		const both = sumTallies([stats.get("test")!.uses, stats.get("a-b")!.uses]);
		assert.equal(both.count, 6);
		assert.equal(both.files.size, 2);
	});

	it("rejects rather than report a partial count", async () => {
		await assert.rejects(scanIdNoteStats(vault(notes, ["b.md"]).app, ["test"]));
	});
});
