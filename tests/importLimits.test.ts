import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import {
	assertImportStructure, assertImportTextSize, ImportLimitError,
	MAX_IMPORT_BYTES, MAX_IMPORT_COLLECTION, MAX_IMPORT_DEPTH, parseImportJson,
} from "../src/utils/importLimits";
import { ADMONITION_IMPORT } from "../src/settings/pluginImport/admonitionImportSource";
import { CALLOUT_MANAGER_IMPORT } from "../src/settings/pluginImport/calloutManagerImportSource";
import { probeVault } from "../src/settings/pluginImport/pluginImportSource";
import { processImportedJSON } from "../src/settings/sections/DataManagementSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { t } from "../src/i18n";
import { ImportReportModal } from "../src/utils/ImportReportModal";
import {
	fileInput, harness, importButton, pasteBox, pasteHarness, pasteSource, pressPaste,
	settle, stubReport, typeText,
} from "./support/pluginImportHarness";

describe("untrusted import resource budgets", () => {
	it("counts UTF-8 bytes and accepts the exact limit without a second byte buffer", () => {
		assert.doesNotThrow(() => assertImportTextSize("a".repeat(MAX_IMPORT_BYTES)));
		assert.throws(() => assertImportTextSize("a".repeat(MAX_IMPORT_BYTES + 1)), ImportLimitError);
		assert.throws(() => assertImportTextSize("א".repeat(MAX_IMPORT_BYTES / 2 + 1)), ImportLimitError);
		assert.doesNotThrow(() => assertImportTextSize("😀".repeat(MAX_IMPORT_BYTES / 4)));
		assert.throws(() => assertImportTextSize("😀".repeat(MAX_IMPORT_BYTES / 4 + 1)), ImportLimitError);
	});

	it("rejects nesting before parsing but ignores brackets, quotes and escapes inside strings", () => {
		const nested = (depth: number) => "[".repeat(depth) + "0" + "]".repeat(depth);
		assert.doesNotThrow(() => parseImportJson(nested(MAX_IMPORT_DEPTH)));
		assert.throws(() => parseImportJson(nested(20_000)), ImportLimitError);
		const text = '"\\' + "[{".repeat(100);
		assert.deepEqual(parseImportJson(JSON.stringify({ text })), { text });
		assert.deepEqual(parseImportJson('\uFEFF{"ok": true}'), { ok: true });
		assert.throws(() => parseImportJson('{"unterminated":"\\'), SyntaxError);
	});

	it("bounds breadth and total values, including unknown fields", () => {
		assert.doesNotThrow(() => parseImportJson(JSON.stringify(Array(MAX_IMPORT_COLLECTION).fill(0))));
		assert.throws(() => parseImportJson(JSON.stringify(Array(MAX_IMPORT_COLLECTION + 1).fill(0))), ImportLimitError);
		const broad = Object.fromEntries(Array.from({ length: MAX_IMPORT_COLLECTION + 1 }, (_, i) => [i, 0]));
		assert.throws(() => assertImportStructure(broad), ImportLimitError);
		assert.throws(() => parseImportJson(JSON.stringify(Array.from({ length: 100 }, () => Array<number>(600).fill(0)))), ImportLimitError);
	});

	it("rejects wide shallow containers and aggregate values before JSON.parse allocates them", () => {
		const original = JSON.parse;
		let parses = 0;
		JSON.parse = ((text: string) => { parses++; return original(text) as unknown; }) as typeof JSON.parse;
		try {
			assert.throws(() => parseImportJson("[" + "[],".repeat(100_000) + "[]]"), ImportLimitError);
			const broad = JSON.stringify(Array.from({ length: 100 }, () => Array<number>(600).fill(0)));
			assert.throws(() => parseImportJson(broad), ImportLimitError);
			assert.equal(parses, 0);
		} finally { JSON.parse = original; }
	});

	it("accepts exactly 50,000 values including nested containers and string keys", () => {
		const arrays = Array.from({ length: 49 }, () => Array<number>(1_000).fill(0));
		arrays.push(Array<number>(949).fill(0));
		assert.doesNotThrow(() => parseImportJson(JSON.stringify(arrays)));
		const objects = arrays.map(items => Object.fromEntries(items.map((_, i) => [i, 'escaped " [ , : \\'])));
		assert.doesNotThrow(() => parseImportJson(JSON.stringify(objects)));
		arrays[49]!.push(0);
		assert.throws(() => parseImportJson(JSON.stringify(arrays)), ImportLimitError);
	});

	it("handles prototype names as data and rejects cycles/getters without executing them", () => {
		const raw = parseImportJson('{"__proto__":{"polluted":true},"constructor":"literal"}') as Record<string, unknown>;
		assert.equal(Object.getPrototypeOf(raw), Object.prototype);
		assert.ok(Object.hasOwn(raw, "__proto__"));
		const cycle: unknown[] = [];
		cycle.push(cycle);
		assert.throws(() => assertImportStructure(cycle), ImportLimitError);
		let called = false;
		assert.throws(() => assertImportStructure({ get value() { called = true; return 1; } }), ImportLimitError);
		assert.equal(called, false);
		const shared = { icon: "pencil" };
		assert.doesNotThrow(() => assertImportStructure([shared, shared]));
	});

	for (const source of [ADMONITION_IMPORT, CALLOUT_MANAGER_IMPORT]) {
		it(`${source.pluginId} applies the budgets to file/paste readers`, () => {
			assert.deepEqual(source.fromText("[".repeat(100) + "0" + "]".repeat(100)), { errorKey: "import.err.tooComplex" });
			assert.deepEqual(source.fromText(" ".repeat(MAX_IMPORT_BYTES + 1)), { errorKey: "import.err.tooLarge" });
		});
	}

	it("rejects an oversized vault file before asking the adapter to read it", async () => {
		let reads = 0;
		const app = { vault: { configDir: ".obsidian", adapter: {
			exists: () => Promise.resolve(true),
			stat: () => Promise.resolve({ size: MAX_IMPORT_BYTES + 1 }),
			read: () => { reads++; return Promise.resolve("{}"); },
		} } } as unknown as App;
		assert.deepEqual(await probeVault(app, ADMONITION_IMPORT), { kind: "unreadable" });
		assert.equal(reads, 0);
	});

	it("still checks vault contents when a stat is stale", async () => {
		const app = { vault: { configDir: ".obsidian", adapter: {
			exists: () => Promise.resolve(true), stat: () => Promise.resolve({ size: 1 }),
			read: () => Promise.resolve("[".repeat(100) + "0" + "]".repeat(100)),
		} } } as unknown as App;
		assert.deepEqual(await probeVault(app, ADMONITION_IMPORT), { kind: "unreadable" });
	});

	it("rejects an oversized backup before reading it or touching the registry", async () => {
		const report = stubReport();
		let reads = 0;
		try {
			await processImportedJSON({ app: {} } as SettingsSectionContext, {
				size: MAX_IMPORT_BYTES + 1,
				text: () => { reads++; return Promise.resolve("[]"); },
			} as File);
			assert.equal(reads, 0);
			assert.deepEqual(report.seen, [{ fatal: true, keys: ["import.err.tooLarge"] }]);
		} finally { report.restore(); }
	});

	it("rejects an oversized competitor file before reading it", async () => {
		const h = harness();
		const report = stubReport();
		let reads = 0;
		try {
			h.modal.onOpen();
			await settle();
			Object.assign(fileInput(h), { files: [{ name: "big.json", size: MAX_IMPORT_BYTES + 1,
				text: () => { reads++; return Promise.resolve("[]"); },
			}] });
			fileInput(h).fire("change");
			importButton(h).fire("click");
			await settle();
			assert.equal(reads, 0);
			assert.deepEqual(h.rec.applied, []);
			assert.deepEqual(report.seen, [{ fatal: true, keys: ["import.err.tooLarge"] }]);
		} finally { h.destroy(); report.restore(); }
	});

	it("rejects oversized pasted text before the source reads it, and leaves it in the box", async () => {
		const h = pasteHarness();
		const report = stubReport();
		const big = "x".repeat(MAX_IMPORT_BYTES + 1);
		try {
			h.modal.onOpen();
			await settle();
			typeText(h, big);
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.fromText, []);
			assert.deepEqual(h.rec.applied, []);
			assert.deepEqual(report.seen, [{ fatal: true, keys: ["import.err.tooLarge"] }]);
			assert.equal(pasteBox(h).value.length, big.length, "still there to trim");
			assert.equal(importButton(h).getAttribute("aria-disabled"), "false");
		} finally { h.destroy(); report.restore(); }
	});

	it("keeps an oversized clipboard out of the box: Paste says so and changes nothing", async () => {
		const h = pasteHarness();
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			h.modal.onOpen();
			await settle();
			typeText(h, "previous");
			await pressPaste(h, "x".repeat(MAX_IMPORT_BYTES + 1));
			assert.deepEqual(notices, [t("import.err.tooLarge")]);
			assert.equal(pasteBox(h).value, "previous");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(h.rec.applied, ["text:previous"]);
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
			h.destroy();
		}
	});

	it("reports an unexpected planner failure and leaves the modal usable", async () => {
		const h = pasteHarness({ source: (rec) => ({ ...pasteSource(rec),
			fromText: () => ({ batch: { size: 1, plan: () => Promise.reject(new Error("bad input")) } }),
		}) });
		const report = stubReport();
		try {
			h.modal.onOpen();
			await settle();
			typeText(h, "data");
			importButton(h).fire("click");
			await settle();
			assert.deepEqual(report.seen, [{ fatal: true, keys: ["import.err.processingFailed"] }]);
			assert.equal(importButton(h).getAttribute("aria-disabled"), "false");
			assert.deepEqual(h.rec.applied, []);
		} finally { h.destroy(); report.restore(); }
	});

	it("bounds report DOM size and renders hostile labels as shortened text", () => {
		const h = harness();
		const hostile = '<img src="x" onerror="alert(1)">' + "x".repeat(10_000);
		const issues = Array.from({ length: 1_000 }, (_, index) => ({
			index, entryLabel: hostile, field: hostile, level: "error" as const,
			messageKey: "import.err.idEmpty", params: { value: hostile },
		}));
		const report = new ImportReportModal(h.modal.app, issues, 0, 1_000, true);
		Object.assign(report, { modalEl: h.modalEl, contentEl: h.contentEl,
			containerEl: h.modal.containerEl, scope: h.modal.scope, setTitle: () => report });
		try {
			report.onOpen();
			assert.equal(h.contentEl.querySelectorAll(".cs-import-issue").length, 200);
			assert.equal(h.contentEl.querySelectorAll("img").length, 0);
			assert.ok((h.contentEl.querySelector("code")?.textContent.length ?? Infinity) <= 501);
			assert.ok(h.contentEl.textContent.includes(t("import.reportTruncated", { shown: 200, total: 1_000 })));
		} finally { report.onClose(); h.destroy(); }
	});
});
