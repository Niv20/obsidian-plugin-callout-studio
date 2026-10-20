import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, TFile } from "obsidian";
import { createCalloutVaultSavePlan } from "../src/settings/editor/calloutVaultSavePlan";
import { keepForUndo, undoNoteRewrite, type NoteRewriteJournal } from "../src/utils/noteRewriteUndo";

function vault(notes: Record<string, string>) {
	const contents = new Map(Object.entries(notes));
	const files = [...contents.keys()].map((path) => ({ path }));
	const reads: string[] = [];
	const writes: string[] = [];
	let passes = 0;
	const app = { vault: {
		getMarkdownFiles: () => { passes++; return files; },
		getAbstractFileByPath: (path: string) => files.find((file) => file.path === path),
		cachedRead: (file: TFile) => { reads.push(file.path); return Promise.resolve(contents.get(file.path)!); },
		process: (file: TFile, transform: (text: string) => string) => {
			writes.push(file.path);
			contents.set(file.path, transform(contents.get(file.path)!));
			return Promise.resolve(contents.get(file.path)!);
		},
	} } as unknown as App;
	return { app, contents, reads, writes, passes: () => passes };
}

/** What the plan announced, and the journal it offered Undo for. */
function announcements() {
	const said: Array<{ message: string; journal: NoteRewriteJournal }> = [];
	return { said, announce: (message: string, journal: NoteRewriteJournal) => { said.push({ message, journal }); } };
}

function renameInput(app: App, announce = announcements().announce) {
	return { app, rewrites: [{ forms: ["old"], toId: "new" }], titles: null, fold: null, announce };
}

describe("editor vault save traversal budget", () => {
	it("renames in one vault pass and does not repeat completed work", async () => {
		const h = vault({ "used.md": "> [!old] Old", "other.md": "Plain text" });
		const plan = createCalloutVaultSavePlan(renameInput(h.app));
		assert.ok(plan);
		await plan();
		assert.equal(h.passes(), 1);
		assert.deepEqual(h.reads, ["used.md", "other.md"]);
		assert.deepEqual(h.writes, ["used.md"]);
		assert.equal(h.contents.get("used.md"), "> [!new] Old");
		await plan();
		assert.equal(h.passes(), 1);
	});

	it("checks an unused id once, opens no note for writing and says nothing", async () => {
		const h = vault({ "other.md": "> [!note] Other" });
		const told = announcements();
		const plan = createCalloutVaultSavePlan(renameInput(h.app, told.announce));
		assert.ok(plan);
		await plan();
		assert.equal(h.passes(), 1);
		assert.deepEqual(h.writes, []);
		assert.deepEqual(told.said, []);
		assert.equal(h.contents.get("other.md"), "> [!note] Other");
	});

	it("uses three passes when id, title and folding all change", async () => {
		// Titles and fold marks go first, over the ids the notes carry before
		// the rewrite: the callout's own (`new`) and the one rewritten into it.
		const h = vault({ "used.md": "> [!old]+ Old", "other.md": "Plain text" });
		const plan = createCalloutVaultSavePlan({
			...renameInput(h.app),
			titles: { forms: ["new", "old"], from: "Old", to: "New" },
			fold: { forms: ["new", "old"], to: "-" },
		});
		assert.ok(plan);
		await plan();
		assert.equal(h.passes(), 3);
		assert.equal(h.reads.length, 6);
		assert.deepEqual(h.writes, ["used.md", "used.md", "used.md"]);
		assert.equal(h.contents.get("used.md"), "> [!new]- New");
	});

	it("does not scan when no note changes are requested", () => {
		const h = vault({ "used.md": "> [!old] Old" });
		assert.equal(createCalloutVaultSavePlan({ ...renameInput(h.app), rewrites: [] }), null);
		assert.equal(createCalloutVaultSavePlan({ ...renameInput(h.app), rewrites: [{ forms: [], toId: "new" }] }), null);
		assert.equal(h.passes(), 0);
	});

	it("rewrites each group of ids to its own callout", async () => {
		const h = vault({ "a.md": "> [!test] Test\n> [!essai] Essai", "b.md": "> [!kept] Kept" });
		const plan = createCalloutVaultSavePlan({
			...renameInput(h.app),
			rewrites: [
				{ forms: ["test"], toId: "abstract", titleSwap: { from: ["Test"], to: "Abstract" } },
				{ forms: ["essai"], toId: "tip", titleSwap: { from: ["Essai", "Abstract"], to: "Tip" } },
			],
		});
		assert.ok(plan);
		await plan();
		assert.equal(h.contents.get("a.md"), "> [!abstract] Abstract\n> [!tip] Tip");
		assert.equal(h.contents.get("b.md"), "> [!kept] Kept");
	});
});

describe("one Undo for everything a save wrote", () => {
	it("announces once, after the last pass, and Undo puts every note back", async () => {
		const notes = { "a.md": "> [!old]+ Old\n> body", "b.md": "> [!new] Old" };
		const h = vault(notes);
		const told = announcements();
		const plan = createCalloutVaultSavePlan({
			...renameInput(h.app, told.announce),
			titles: { forms: ["new", "old"], from: "Old", to: "New" },
			fold: { forms: ["new", "old"], to: "-" },
		});
		assert.ok(plan);
		await plan();
		assert.equal(told.said.length, 1, "one notice for the three passes");
		assert.equal(h.contents.get("a.md"), "> [!new]- New\n> body");
		assert.equal(h.contents.get("b.md"), "> [!new]- New");

		const journal = told.said[0]!.journal;
		assert.equal(keepForUndo(journal), true);
		const { restored, skipped } = await undoNoteRewrite(h.app, journal);
		assert.deepEqual({ restored, skipped }, { restored: 2, skipped: 0 });
		assert.deepEqual(Object.fromEntries(h.contents), notes, "three passes over one note undo as one");
	});

	it("a retry that finishes the work offers Undo for the failed attempt's notes too", async () => {
		const notes = { "a.md": "> [!old] Old", "b.md": "> [!old] Old" };
		const h = vault(notes);
		const process = h.app.vault.process.bind(h.app.vault);
		let failB = true;
		h.app.vault.process = ((file: TFile, transform: (text: string) => string) =>
			failB && file.path === "b.md" ? Promise.reject(new Error("locked")) : process(file, transform)) as typeof h.app.vault.process;
		const told = announcements();
		const plan = createCalloutVaultSavePlan(renameInput(h.app, told.announce));
		assert.ok(plan);
		await assert.rejects(plan());
		assert.equal(told.said.length, 0, "nothing is announced for an attempt that failed");
		failB = false;
		await plan();
		assert.equal(told.said.length, 1);
		const journal = told.said[0]!.journal;
		assert.equal(keepForUndo(journal), true);
		await undoNoteRewrite(h.app, journal);
		assert.deepEqual(Object.fromEntries(h.contents), notes);
	});
});
