import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyPortableCalloutConversion as apply,
	preparePortableCalloutConversion as prepare,
	PortableCalloutVaultError,
} from "../src/utils/portableCalloutVault";
import { deferred, portableVault } from "./support/portableVaultHarness";

const two = { "a.md": "A [!note] pill", "b.md": "## [!tip] Heading" };

describe("portable conversion approval plans", () => {
	it("previews saved Markdown without writing, preserving untouched files and exact examples", async () => {
		const h = portableVault({ ...two, "plain.md": "Plain text", "theme.css": "[!note]" });
		const progress: number[] = [];
		const plan = await prepare(h.app, { onProgress: (done) => progress.push(done) });
		assert.equal(plan.files, 2);
		assert.equal(plan.scannedFiles, 3);
		assert.equal(plan.count, 2);
		assert.equal(plan.headings, 1);
		assert.equal(plan.inline, 1);
		assert.deepEqual(plan.examples, [
			{ path: "a.md", line: 1, before: "[!note]", after: "note" },
			{ path: "b.md", line: 1, before: "## [!tip] Heading", after: "## Heading" },
		]);
		assert.deepEqual(h.processes, []);
		assert.deepEqual(h.written, []);
		assert.deepEqual(progress, [1, 2, 3]);
		assert.equal(Object.isFrozen(plan), true);
		assert.equal(Object.isFrozen(plan.examples), true);
	});

	it("limits real examples to six lines and keeps one-based line locations", async () => {
		const h = portableVault({ "a.md": "Intro\n" + Array(10).fill("A [!note] pill").join("\n") });
		const plan = await prepare(h.app);
		assert.equal(plan.count, 10);
		assert.equal(plan.examples.length, 6);
		assert.equal(plan.examples[0]!.line, 2);
		assert.equal(plan.examples[5]!.line, 7);
	});

	it("rejects an unreadable note rather than offering an incomplete plan, and releases its lock", async () => {
		const h = portableVault(two);
		h.hooks.beforeRead = (path) => { if (path === "b.md") throw new Error("EACCES"); };
		await assert.rejects(prepare(h.app), { code: "read-failed", path: "b.md" });
		assert.deepEqual(h.written, []);
		delete h.hooks.beforeRead;
		assert.equal((await prepare(h.app)).files, 2);
	});

	for (const duringRead of [false, true]) {
		it(`cancels ${duringRead ? "an in-progress" : "an unopened"} preview without writing`, async () => {
			const h = portableVault(two);
			const abort = new AbortController();
			if (duringRead) h.hooks.afterRead = () => abort.abort();
			else abort.abort();
			await assert.rejects(prepare(h.app, { signal: abort.signal }), { code: "aborted" });
			assert.deepEqual(h.written, []);
		});
	}

	it("rejects changes to an earlier note while reading a later note", async () => {
		const h = portableVault(two);
		h.hooks.afterRead = (path) => { if (path === "b.md") h.edit("a.md", "New paragraph"); };
		await assert.rejects(prepare(h.app), { code: "changed", path: "a.md" });
		assert.deepEqual(h.written, []);
	});

	it("rejects a note added during preview", async () => {
		const h = portableVault(two);
		h.hooks.afterRead = () => h.add("new.md", "New [!note]");
		await assert.rejects(prepare(h.app), { code: "changed" });
	});

	it("rejects a note edited while its read is pending", async () => {
		const h = portableVault(two);
		h.hooks.afterRead = (path) => h.edit(path, "Different source");
		await assert.rejects(prepare(h.app), { code: "changed", path: "a.md" });
	});

	it("yields during a larger scan and honors cancellation before publishing a plan", async () => {
		const h = portableVault(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`${i}.md`, "A [!note]"])));
		const abort = new AbortController();
		const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
		let yields = 0;
		Object.defineProperty(globalThis, "window", { configurable: true, value: {
			setTimeout: (resolve: () => void) => { yields++; abort.abort(); resolve(); return 1; },
		} });
		try {
			await assert.rejects(prepare(h.app, { signal: abort.signal }), { code: "aborted" });
			assert.equal(yields, 1);
			assert.equal(h.reads.length, 25);
			assert.deepEqual(h.written, []);
		} finally {
			if (previous) Object.defineProperty(globalThis, "window", previous);
			else Reflect.deleteProperty(globalThis, "window");
		}
	});
});

describe("portable conversion preflight", () => {
	it("writes only approved changed Markdown, once per file, with committed occurrence counts", async () => {
		const h = portableVault({ ...two, "plain.md": "Unchanged\r\n", "photo.png": "[!note]" });
		const plan = await prepare(h.app);
		const result = await apply(h.app, plan);
		assert.deepEqual(result, { status: "complete", files: 2, count: 2, headings: 1, inline: 1, skipped: plan.skipped, linkCount: 0 });
		assert.deepEqual(h.written, ["a.md", "b.md"]);
		assert.equal(h.contents.get("a.md"), "A note pill");
		assert.equal(h.contents.get("b.md"), "## Heading");
		assert.equal(h.contents.get("plain.md"), "Unchanged\r\n");
		assert.equal(h.contents.get("photo.png"), "[!note]");
		assert.deepEqual((await apply(h.app, plan)).error, { code: "invalid-plan" });
	});

	it("completes a zero-change plan without any write", async () => {
		const h = portableVault({ "a.md": "```\n[!note]\n```" });
		assert.equal((await apply(h.app, await prepare(h.app))).status, "complete");
		assert.deepEqual(h.processes, []);
	});

	const mutations: { name: string; mutate: (h: ReturnType<typeof portableVault>) => void }[] = [
		{ name: "changed source", mutate: (h) => h.edit("b.md", "New text") },
		{ name: "same-metadata byte change", mutate: (h) => h.edit("b.md", "New text", false) },
		{ name: "deletion", mutate: (h) => h.remove("b.md") },
		{ name: "rename", mutate: (h) => h.rename("b.md", "renamed.md") },
		{ name: "replacement at the same path", mutate: (h) => h.add("b.md", two["b.md"]) },
		{ name: "new note", mutate: (h) => h.add("new.md", "[!tip]") },
	];
	for (const mutation of mutations) {
		it(`blocks ${mutation.name} since approval before the first write`, async () => {
			const h = portableVault(two);
			const plan = await prepare(h.app);
			mutation.mutate(h);
			const result = await apply(h.app, plan);
			assert.equal(result.status, "stopped");
			assert.equal(result.error?.code, "changed");
			assert.equal(result.files, 0);
			assert.deepEqual(h.processes, []);
		});
	}

	it("rechecks unconverted notes too, so new syntax cannot escape an approved vault snapshot", async () => {
		const h = portableVault({ ...two, "plain.md": "Plain" });
		const plan = await prepare(h.app);
		h.edit("plain.md", "A [!note]", false);
		assert.equal((await apply(h.app, plan)).error?.code, "changed");
		assert.deepEqual(h.processes, []);
	});

	it("blocks a failed preflight read before writing any earlier file", async () => {
		const h = portableVault(two);
		const plan = await prepare(h.app);
		h.hooks.beforeRead = (path) => { if (path === "b.md") throw new Error("Unavailable"); };
		assert.equal((await apply(h.app, plan)).error?.code, "read-failed");
		assert.deepEqual(h.processes, []);
	});

	it("rechecks previously read files after the complete preflight", async () => {
		const h = portableVault(two);
		const plan = await prepare(h.app);
		h.hooks.afterRead = (path) => { if (path === "b.md") h.edit("a.md", "Changed during preflight"); };
		assert.equal((await apply(h.app, plan)).error?.code, "changed");
		assert.deepEqual(h.processes, []);
	});

	it("requires an original plan from the same app", async () => {
		const h = portableVault(two);
		const other = portableVault(two);
		const plan = await prepare(h.app);
		assert.equal((await apply(other.app, plan)).error?.code, "invalid-plan");
		assert.equal((await apply(h.app, { ...plan })).error?.code, "invalid-plan");
		assert.deepEqual(h.processes, []);
		assert.equal((await apply(h.app, plan)).status, "complete");
	});
});

describe("portable conversion open editors", () => {
	it("blocks unsaved text, including a disagreeing duplicate tab", async () => {
		const h = portableVault(two);
		h.open("a.md");
		h.open("a.md", "Unsaved changes");
		await assert.rejects(prepare(h.app), { code: "editor-changed", path: "a.md" });
		assert.deepEqual(h.written, []);
	});

	it("accepts clean CRLF notes with an LF editor buffer and preserves saved newlines", async () => {
		const h = portableVault({ "a.md": "A [!note]\r\n\r\nText\r\n" });
		h.open("a.md", "A [!note]\n\nText\n");
		assert.equal((await apply(h.app, await prepare(h.app))).status, "complete");
		assert.equal(h.contents.get("a.md"), "A note\r\n\r\nText\r\n");
	});

	for (const atCommit of [false, true]) {
		it(`protects edits made ${atCommit ? "inside the atomic write window" : "after preview"}`, async () => {
			const h = portableVault(two);
			const editor = h.open("a.md");
			const plan = await prepare(h.app);
			if (atCommit) h.hooks.beforeProcess = () => { editor.text = "Unsaved paragraph"; };
			else editor.text = "Unsaved paragraph";
			const result = await apply(h.app, plan);
			assert.equal(result.error?.code, "editor-changed");
			assert.equal(result.files, 0);
			assert.deepEqual(h.written, []);
			assert.equal(editor.text, "Unsaved paragraph");
		});
	}
});

describe("portable conversion concurrent changes and failures", () => {
	it("checks exact bytes again in process, even when file metadata did not change", async () => {
		const h = portableVault(two);
		const plan = await prepare(h.app);
		h.hooks.beforeProcess = (path) => h.edit(path, "A new paragraph", false);
		const result = await apply(h.app, plan);
		assert.equal(result.error?.code, "changed");
		assert.equal(result.files, 0);
		assert.deepEqual(h.written, []);
		assert.equal(h.contents.get("a.md"), "A new paragraph");
	});

	it("stops after the first write failure and reports only completed files, without rollback", async () => {
		const h = portableVault({ ...two, "c.md": "Another [!note]" });
		const plan = await prepare(h.app);
		h.hooks.beforeProcess = (path) => { if (path === "b.md") throw new Error("Disk full"); };
		const result = await apply(h.app, plan);
		assert.deepEqual({ ...result, remainingPlan: undefined }, { status: "stopped", files: 1, count: 1, headings: 0, inline: 1, linkCount: 0, remainingPlan: undefined,
			skipped: plan.skipped, error: { code: "write-failed", path: "b.md" } });
		assert.deepEqual(h.written, ["a.md"]);
		assert.equal(h.contents.get("a.md"), "A note pill");
		assert.equal(h.contents.get("c.md"), "Another [!note]");
	});

	it("detects a new Markdown note after a successful write and stops remaining writes", async () => {
		const h = portableVault(two);
		const plan = await prepare(h.app);
		h.hooks.afterProcess = () => h.add("new.md", "[!note]");
		const result = await apply(h.app, plan);
		assert.equal(result.files, 1);
		assert.equal(result.error?.code, "changed");
		assert.deepEqual(h.written, ["a.md"]);
	});

	it("stops if a successfully converted file is renamed before the next write", async () => {
		const h = portableVault(two);
		const plan = await prepare(h.app);
		h.hooks.afterProcess = (path) => h.rename(path, "renamed.md");
		const result = await apply(h.app, plan);
		assert.equal(result.files, 1);
		assert.equal(result.error?.code, "changed");
		assert.equal(h.contents.get("renamed.md"), "A note pill");
		assert.equal(h.contents.get("b.md"), two["b.md"]);
	});

	it("does not fall back to a non-atomic write when process becomes unavailable", async () => {
		const h = portableVault(two);
		const plan = await prepare(h.app);
		Reflect.deleteProperty(h.app.vault, "process");
		assert.equal((await apply(h.app, plan)).error?.code, "unavailable");
		assert.deepEqual(h.written, []);
	});

	it("rejects another preview or apply while an operation is running, then unlocks", async () => {
		const h = portableVault(two);
		const plan = await prepare(h.app);
		const gate = deferred();
		h.hooks.beforeRead = () => gate.promise;
		const first = apply(h.app, plan);
		assert.equal((await apply(h.app, plan)).error?.code, "busy");
		await assert.rejects(prepare(h.app), (error: unknown) => error instanceof PortableCalloutVaultError && error.code === "busy");
		gate.resolve();
		assert.equal((await first).status, "complete");
		assert.equal((await prepare(h.app)).files, 0);
	});
});
