import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { getCalloutOccurrenceIndex } from "../src/usage/CalloutOccurrenceIndex";
import { scanCalloutOccurrences, scanCalloutOccurrencesAsync } from "../src/usage/scanCalloutOccurrences";
import { fingerprintCalloutContent, iterateContentFingerprint } from "../src/usage/contentFingerprint";
import { deferred, occurrenceVault } from "./occurrenceIndexHarness";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
before(() => { Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis }); });
after(() => {
	if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

describe("saved-note occurrence index", () => {
	it("is lazy, shared per vault, and coalesces simultaneous consumers", async () => {
		const h = occurrenceVault({ "a.md": "> [!not-registered] A" });
		const index = getCalloutOccurrenceIndex(h.app);
		assert.equal(getCalloutOccurrenceIndex(h.app), index);
		assert.equal(index.status, "idle");
		assert.equal(index.query().totalCount, 0);
		assert.deepEqual(h.reads, []);
		const first = index.ensureFresh();
		assert.equal(index.ensureFresh(), first);
		await first;
		assert.equal(index.status, "ready");
		assert.deepEqual(h.reads, ["a.md"]);
		assert.equal(index.query(["not registered"]).totalCount, 1);
		assert.equal(index.markdownFileCount, 1);
		assert.equal(index.scannedFileCount, 1);
		const revision = index.revision;
		await index.ensureFresh();
		assert.deepEqual(h.reads, ["a.md"], "an unchanged second visit reuses parsed data");
		assert.equal(index.revision, revision, "warm lookups do not flash a loading state");
	});

	it("unions aliases and file sets, while retaining roles and exact source locations", async () => {
		const h = occurrenceVault({
			"a.md": "> [!My note|red] A\r\n## [!my-note] H\r\nProse [!alias] and [!my note]",
			"b.md": "[!alias]",
			"c.md": "Other text",
		});
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		const result = index.query(["MY NOTE", "my-note", "alias", "alias"]);
		assert.equal(result.totalCount, 5);
		assert.equal(result.fileCount, 2);
		assert.deepEqual(result.roles, { regular: 1, heading: 1, inline: 3 });
		assert.deepEqual(result.occurrences.map((entry) => [entry.path, entry.line, entry.from, entry.to]), [
			["a.md", 0, 2, 16], ["a.md", 1, 3, 13], ["a.md", 2, 6, 14], ["a.md", 2, 19, 29], ["b.md", 0, 0, 8],
		]);
		assert.equal(result.occurrences[0]?.lineText, "> [!My note|red] A");
		assert.equal(index.query(["my-note", "alias"], "inline").totalCount, 3);
		assert.equal(index.query([]).totalCount, 0);
	});

	it("reparses only modified files, including metadata changes without an event", async () => {
		const h = occurrenceVault({ "a.md": "[!a]", "b.md": "[!b]" });
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		h.put("a.md", "[!a] [!a]");
		index.invalidate("a.md");
		assert.equal(index.status, "stale");
		assert.equal(index.query(["a"]).totalCount, 0, "invalidated positions cannot remain clickable");
		await index.ensureFresh();
		h.put("b.md", "[!b] [!b]");
		await index.ensureFresh();
		assert.deepEqual(h.reads, ["a.md", "b.md", "a.md", "b.md"]);
		assert.equal(index.query().totalCount, 4);
	});

	it("rejects content invalidated while reading and retries only on another request", async () => {
		const h = occurrenceVault({ "a.md": "[!old]" });
		const gate = deferred<string>();
		h.held.set("a.md", gate.promise);
		const index = getCalloutOccurrenceIndex(h.app);
		const running = index.ensureFresh();
		await Promise.resolve();
		h.put("a.md", "[!new]");
		index.invalidate("a.md");
		gate.resolve("[!old]");
		await running;
		assert.equal(index.status, "stale");
		assert.equal(index.query().totalCount, 0);
		assert.deepEqual(h.reads, ["a.md"]);
		h.held.delete("a.md");
		await index.ensureFresh();
		assert.equal(index.query(["new"]).totalCount, 1);
	});

	it("rechecks earlier files after later reads and detects newly added files", async () => {
		const h = occurrenceVault({ "a.md": "[!old]", "b.md": "[!b]" });
		const gate = deferred<string>();
		h.held.set("b.md", gate.promise);
		const index = getCalloutOccurrenceIndex(h.app);
		const running = index.ensureFresh();
		while (!h.reads.includes("b.md")) await Promise.resolve();
		h.put("a.md", "[!changed]");
		h.put("new.md", "[!new]");
		gate.resolve("[!b]");
		await running;
		assert.equal(index.status, "stale");
		assert.equal(index.query(["old"]).totalCount, 0);
		assert.equal(index.query(["b"]).totalCount, 1);
		assert.equal(index.markdownFileCount, 3);
		h.held.clear();
		await index.ensureFresh();
		assert.equal(index.status, "ready");
		assert.equal(index.query().totalCount, 3);
	});

	it("does not publish a deleted or renamed file that was being read", async () => {
		for (const rename of [false, true]) {
			const h = occurrenceVault({ "a.md": "[!a]" });
			const gate = deferred<string>();
			h.held.set("a.md", gate.promise);
			const index = getCalloutOccurrenceIndex(h.app);
			const running = index.ensureFresh();
			await Promise.resolve();
			if (rename) h.rename("a.md", "moved.md");
			else h.remove("a.md");
			gate.resolve("[!a]");
			await running;
			assert.equal(index.status, "stale");
			assert.equal(index.query().totalCount, 0);
			h.held.clear();
			await index.ensureFresh();
			assert.equal(index.status, "ready");
			assert.equal(index.query().totalCount, rename ? 1 : 0);
		}
	});

	it("recognizes replacement file handles and explicit full invalidations", async () => {
		const h = occurrenceVault({ "a.md": "[!old]", "b.md": "[!b]" });
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		h.remove("a.md");
		h.put("a.md", "[!new]");
		await index.ensureFresh();
		assert.equal(index.query(["old"]).totalCount, 0);
		assert.equal(index.query(["new"]).totalCount, 1);
		index.invalidate("folder");
		assert.equal(index.query().totalCount, 0);
		await index.ensureFresh();
		assert.equal(h.reads.length, 5, "one replacement read, then both files after full invalidation");
	});

	it("records enumeration failures and isolates a broken view subscriber", async (context) => {
		context.mock.method(console, "warn", () => undefined);
		const h = occurrenceVault({ "a.md": "[!a]" });
		const index = getCalloutOccurrenceIndex(h.app);
		index.subscribe(() => { throw new Error("View already closed"); });
		const list = h.app.vault.getMarkdownFiles.bind(h.app.vault);
		h.app.vault.getMarkdownFiles = () => { throw new Error("Vault unavailable"); };
		await index.ensureFresh();
		assert.equal(index.status, "partial");
		assert.deepEqual(index.failures, [{ path: "", message: "Vault unavailable" }]);
		h.app.vault.getMarkdownFiles = list;
		await index.ensureFresh();
		assert.equal(index.status, "ready");
		assert.equal(index.query().totalCount, 1);
		index.dispose();
		assert.equal(index.status, "disposed");
	});

	it("deletes and renames cached files without duplicating their occurrences", async () => {
		const h = occurrenceVault({ "a.md": "[!a]", "b.md": "[!b]" });
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		h.remove("a.md");
		index.invalidate("a.md");
		h.rename("b.md", "folder/moved.md");
		index.invalidate("b.md");
		index.invalidate("folder/moved.md");
		await index.ensureFresh();
		assert.equal(index.status, "ready");
		assert.deepEqual(index.query().occurrences.map((entry) => entry.path), ["folder/moved.md"]);
		assert.equal(index.markdownFileCount, 1);
	});

	it("distinguishes partial or failed scans from an authoritative zero and recovers explicitly", async () => {
		const h = occurrenceVault({ "a.md": "[!a]", "b.md": "[!b]" });
		h.failures.add("b.md");
		const index = getCalloutOccurrenceIndex(h.app);
		await index.ensureFresh();
		assert.equal(index.status, "partial");
		assert.deepEqual(index.failures, [{ path: "b.md", message: "Unreadable file" }]);
		assert.equal(index.query().totalCount, 1);
		assert.equal(index.scannedFileCount, 1);
		h.failures.add("a.md");
		index.invalidate();
		await index.ensureFresh();
		assert.equal(index.status, "partial");
		assert.equal(index.query().totalCount, 0);
		assert.equal(index.failures.length, 2);
		h.failures.clear();
		await index.ensureFresh();
		assert.equal(index.status, "ready");
		assert.equal(index.failures.length, 0);
		assert.equal(index.query().totalCount, 2);
	});

	it("disposal cancels publication, removes subscriptions, and allows a fresh owner", async () => {
		const h = occurrenceVault({ "a.md": "[!a]" });
		const gate = deferred<string>();
		h.held.set("a.md", gate.promise);
		const index = getCalloutOccurrenceIndex(h.app);
		let notifications = 0;
		const unsubscribe = index.subscribe(() => { notifications++; });
		index.invalidate("a.md");
		unsubscribe();
		const running = index.ensureFresh();
		await Promise.resolve();
		index.dispose();
		gate.resolve("[!a]");
		await running;
		assert.equal(index.status, "disposed");
		assert.equal(index.query().totalCount, 0);
		assert.equal(notifications, 1);
		await index.ensureFresh();
		assert.equal(h.reads.length, 1);
		assert.notEqual(getCalloutOccurrenceIndex(h.app), index);
	});
});

describe("occurrence parser integration", () => {
	it("shares exclusions and metadata identities without requiring registered settings", () => {
		const found = scanCalloutOccurrences("a.md", [
			"---", "value: '[!frontmatter]'", "---", "```", "> [!code]", "```",
			"%% [!comment]", "## [!still-comment] %%", "`[!inline-code]`",
			"> [!Unknown type|metadata] Title", "## [!heading] Title", "Text [!inline]{payload}",
		].join("\n"));
		assert.deepEqual(found.map((entry) => [entry.identity, entry.role, entry.line]), [
			["unknown-type", "regular", 9], ["heading", "heading", 10], ["inline", "inline", 11],
		]);
	});

	it("yields on long documents with no tokens and honors cancellation", async () => {
		let current = true;
		const scan = scanCalloutOccurrencesAsync("long.md", "ordinary prose\n".repeat(2000), () => current);
		window.setTimeout(() => { current = false; }, 0);
		assert.equal(await scan, null);
	});
});

describe("occurrence source snapshot fingerprints", () => {
	it("detects same-length edits and edits outside the matching source line", () => {
		const original = "%% alpha %%\n[!a]";
		assert.notEqual(fingerprintCalloutContent(original), fingerprintCalloutContent("%% bravo %%\n[!a]"));
		assert.notEqual(fingerprintCalloutContent(original), fingerprintCalloutContent(`${original}\n[!a]`));
		assert.equal(fingerprintCalloutContent(original), fingerprintCalloutContent(original));
	});

	it("matches CRLF disk text to LF editor text, including a chunk boundary", () => {
		const source = `${"x".repeat(32767)}\r\n[!a]\r\n[!b]`;
		const normalized = source.replace(/\r\n/g, "\n");
		assert.equal(fingerprintCalloutContent(source), fingerprintCalloutContent(normalized));
		assert.deepEqual(scanCalloutOccurrences("a.md", source), scanCalloutOccurrences("a.md", normalized));
	});

	it("shares one immutable fingerprint across occurrences and both scanning modes", async () => {
		const source = "> [!block]\n## [!heading]\n[!inline] [!alias]";
		const sync = scanCalloutOccurrences("a.md", source);
		const asyncResult = await scanCalloutOccurrencesAsync("a.md", source, () => true);
		assert.deepEqual(asyncResult, sync);
		assert.equal(new Set(sync.map((entry) => entry.contentFingerprint)).size, 1);
		assert.ok(sync.every((entry) => Object.isFrozen(entry)));
	});

	it("yields during fingerprinting before parsing a giant single line", async () => {
		const source = `${"x".repeat(200000)} [!a]`;
		assert.equal(iterateContentFingerprint(source).next().done, false);
		let current = true;
		const scan = scanCalloutOccurrencesAsync("large.md", source, () => current);
		window.setTimeout(() => { current = false; }, 0);
		assert.equal(await scan, null);
	});
});
