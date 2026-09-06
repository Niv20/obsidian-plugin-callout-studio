import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, TFile } from "obsidian";
import { createCalloutVaultSavePlan } from "../src/settings/editor/calloutVaultSavePlan";

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

function renameInput(app: App) {
	return { app, removedIds: ["old"], currentIds: ["new"], newId: "new",
		oldTitle: null, newTitle: "New", foldMarker: null };
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

	it("checks an unused id once without opening any note for writing", async () => {
		const h = vault({ "other.md": "> [!note] Other" });
		const plan = createCalloutVaultSavePlan(renameInput(h.app));
		assert.ok(plan);
		const seams = globalThis as { __CS_NOTICES__?: string[] };
		const previous = seams.__CS_NOTICES__;
		const messages: string[] = []; seams.__CS_NOTICES__ = messages;
		try {
			await plan();
			assert.equal(h.passes(), 1);
			assert.deepEqual(h.writes, []);
			assert.deepEqual(messages, []);
			assert.equal(h.contents.get("other.md"), "> [!note] Other");
		} finally { seams.__CS_NOTICES__ = previous; }
	});

	it("uses three passes when id, title and folding all change", async () => {
		const h = vault({ "used.md": "> [!old]+ Old", "other.md": "Plain text" });
		const plan = createCalloutVaultSavePlan({ ...renameInput(h.app), oldTitle: "Old", foldMarker: "-" });
		assert.ok(plan);
		await plan();
		assert.equal(h.passes(), 3);
		assert.equal(h.reads.length, 6);
		assert.deepEqual(h.writes, ["used.md", "used.md", "used.md"]);
		assert.equal(h.contents.get("used.md"), "> [!new]- New");
	});

	it("does not scan when no note changes are requested", () => {
		const h = vault({ "used.md": "> [!old] Old" });
		assert.equal(createCalloutVaultSavePlan({ ...renameInput(h.app), removedIds: [] }), null);
		assert.equal(h.passes(), 0);
	});
});
