import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { convertCalloutsToPlainTextInVault, countCalloutUsages, normalizeFoldMarkersInVault, replaceCalloutIdsInVault, replaceCalloutTitlesInVault } from "../src/utils/vaultCalloutScanner";
import { iterateDocumentCallouts } from "../src/editor/documentCallouts";

function vault(source: string): { app: App; read: () => string } {
	let text = source;
	const file = { path: "note.md" };
	const app = { vault: {
		getMarkdownFiles: () => [file],
		getAbstractFileByPath: (path: string) => path === file.path ? file : null,
		cachedRead: () => Promise.resolve(text), read: () => Promise.resolve(text),
		process: (_file: unknown, transform: (source: string) => string) => { text = transform(text); return Promise.resolve(text); },
	} } as unknown as App;
	return { app, read: () => text };
}

const examples = [
	"---\ntags: [!old]\n---",
	"```md\n%% [!old] never opens a comment\n```",
	"~~~\n> [!old]- Old title\n~~~",
	"    > [!old]- Old title\n    %% [!old]",
	"%%\n```\n> [!old]- Old title\n%%",
	"literal ``[!old] and ` [!old]`` syntax",
	"literal `code\n[!old]\ncode` syntax",
	"%% [!old] %% and %% > [!old]- Old title %%",
	"[!not%%[!old]%%real]",
	"[[note#[!old]]] [!old](https://example.com) \\[!old]",
];
const uses = [">   [!old|block]- Old title", "  ## [!old|heading] Old title", "Text [!old|inline]{payload} [!old]"];
const source = [...examples, ...uses].join("\n\n");
const usageCount = 4;

describe("document lexer and vault writers share strict exclusions", () => {
	it("counts exactly the actual references across all three roles", async () => {
		const v = vault(source);
		assert.deepEqual(await countCalloutUsages(v.app, ["old"]), { fileCount: 1, totalCount: usageCount });
		assert.equal(Array.from(iterateDocumentCallouts(source)).length, usageCount);
	});

	it("id replacement leaves every excluded byte and every metadata suffix intact", async () => {
		const v = vault(source);
		assert.equal(await replaceCalloutIdsInVault(v.app, ["old"], "new"), usageCount);
		for (const example of examples) assert.ok(v.read().includes(example), example);
		assert.ok(v.read().endsWith(uses.join("\n\n").replaceAll("[!old", "[!new")));
	});

	it("title replacement leaves code/comment examples and inline payloads untouched", async () => {
		const v = vault(source);
		assert.equal(await replaceCalloutTitlesInVault(v.app, ["old"], "Old title", "New title"), 2);
		for (const example of examples) assert.ok(v.read().includes(example), example);
		assert.ok(v.read().includes(">   [!old|block]- New title"));
		assert.ok(v.read().includes("  ## [!old|heading] New title"));
		assert.ok(v.read().includes(uses[2]!));
	});

	it("fold normalization affects real block headers only", async () => {
		const v = vault(source);
		assert.equal(await normalizeFoldMarkersInVault(v.app, ["old"], "+"), 1);
		for (const example of examples) assert.ok(v.read().includes(example), example);
		assert.ok(v.read().includes(">   [!old|block]+ Old title"));
	});

	it("plain text conversion preserves excluded examples while removing each real reference", async () => {
		const v = vault(source);
		assert.deepEqual(await convertCalloutsToPlainTextInVault(v.app, ["old"], "Old name"), { files: 1, blocks: usageCount });
		for (const example of examples) assert.ok(v.read().includes(example), example);
		assert.deepEqual(await countCalloutUsages(v.app, ["old"]), { fileCount: 0, totalCount: 0 });
		assert.ok(v.read().includes("Text Old name: payload Old name"));
	});

	it("renaming never touches unknown types merely because they share an appearance", async () => {
		const v = vault("[!note] [!unregistered]");
		assert.equal(await replaceCalloutIdsInVault(v.app, ["note"], "info"), 1);
		assert.equal(v.read(), "[!info] [!unregistered]");
	});

	it("rewrites real headers at arbitrary quote/list positions without moving their prefix", async () => {
		const v = vault("  >   [!old|x]- Title\n\n- > [!old]- Title\n\n>   > [!old]- Title");
		assert.equal(await normalizeFoldMarkersInVault(v.app, ["old"], "+"), 3);
		assert.equal(v.read(), "  >   [!old|x]+ Title\n\n- > [!old]+ Title\n\n>   > [!old]+ Title");
	});
});
