import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "../src/i18n";
import { portableConversionViewHarness as harness } from "./support/portableConversionViewHarness";
import { deferred } from "./support/portableVaultHarness";

describe("portable conversion sidebar freshness and confirmation", () => {
	it("invalidates immediately, coalesces saves, and rereads only changed notes", async () => {
		const h = harness({ "a.md": "[!note]\n[!tip]", "b.md": "[!warning]", "image.png": "[!image]" });
		try {
			await h.view.onOpen(); h.choose(1, false);
			h.edit("a.md", "Changed [!note]\n[!tip]");
			for (let i = 0; i < 4; i++) h.vaultEvents.emit("modify", h.handles.get("a.md"));
			assert.equal(h.button("convert").disabled, true);
			assert.ok(h.inputs().every(input => input.disabled));
			await h.settle();
			assert.deepEqual(h.reads, ["a.md", "b.md", "a.md"]);
			assert.deepEqual(h.inputs().map(input => input.checked), [false, false, true]);
			h.vaultEvents.emit("modify", h.handles.get("image.png"));
			await h.settle();
			assert.deepEqual(h.reads, ["a.md", "b.md", "a.md"]);
			assert.deepEqual(h.written, []);
		} finally { await h.destroy(); }
	});
	it("does not transfer exclusions or selections to renamed and newly added rows", async () => {
		const h = harness({ "a.md": "[!note]", "b.md": "[!tip]" });
		try {
			await h.view.onOpen(); h.choose(0, false);
			h.rename("a.md", "renamed.md"); h.vaultEvents.emit("rename", h.handles.get("renamed.md"), "a.md");
			h.add("new.md", "[!warning]"); h.vaultEvents.emit("create", h.handles.get("new.md"));
			await h.settle();
			assert.deepEqual(h.inputs().map(input => input.checked), [true, false, false]);
			assert.equal(h.root.querySelectorAll(".cs-portable-change").length, 3);
			h.remove("b.md"); h.vaultEvents.emit("delete", {}); await h.settle();
			assert.ok(h.inputs().every(input => !input.checked));
			assert.equal(h.button("convert").disabled, true);
		} finally { await h.destroy(); }
	});
	it("blocks unsaved editor changes and resumes automatically after the save event", async () => {
		const h = harness({ "a.md": "[!note]", "b.md": "[!tip]" });
		const editor = h.open("a.md");
		try {
			await h.view.onOpen();
			editor.text = "Changed [!note]";
			h.workspaceEvents.emit("editor-change", {}, { file: h.handles.get("a.md") });
			assert.equal(h.button("convert").disabled, true);
			await h.settle();
			assert.equal(h.status(), t("portable.errorEditor"));
			assert.equal(h.button("convert").disabled, true);
			h.edit("a.md", editor.text); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			await h.settle();
			assert.equal(h.status(), "");
			assert.equal(h.button("convert").disabled, false);
			assert.deepEqual(h.inputs().map(input => input.checked), [false, true]);
		} finally { await h.destroy(); }
	});
	it("cannot approve a stale confirmation after a newer automatic review has finished", async () => {
		const h = harness(), confirmation = deferred();
		h.hooks.confirm = async () => { await confirmation.promise; return true; };
		try {
			await h.view.onOpen();
			h.click("convert"); const converting = h.tasks[h.tasks.length - 1]!;
			h.edit("a.md", "# [!note] New heading\nA [!tip]{word}.");
			h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			confirmation.resolve(); await converting;
			assert.deepEqual(h.written, []);
			assert.equal(h.confirmations.length, 1);
			assert.equal(h.inputs()[0]!.checked, false);
		} finally { confirmation.resolve(); await h.destroy(); }
	});
	it("retains preflight byte checks even if a change produces no host event", async () => {
		const h = harness();
		h.hooks.confirm = async () => { h.edit("a.md", "An unannounced change", false); return true; };
		try {
			await h.view.onOpen(); h.click("convert"); await h.tasks[h.tasks.length - 1]; await h.settle();
			assert.deepEqual(h.written, []);
			assert.equal(h.button("convert").disabled, true);
			assert.equal(h.root.querySelectorAll(".cs-portable-change").length, 0);
		} finally { await h.destroy(); }
	});
	it("does not revive a pending approval when the same sidebar closes and reopens", async () => {
		const h = harness(), confirmation = deferred();
		h.hooks.confirm = async () => { await confirmation.promise; return true; };
		try {
			await h.view.onOpen(); h.click("convert"); const converting = h.tasks[h.tasks.length - 1]!;
			await h.view.onClose(); await h.view.onOpen();
			confirmation.resolve(); await converting;
			assert.deepEqual(h.written, []);
			assert.equal(h.button("convert").disabled, false);
			assert.equal(h.vaultEvents.count(), 4);
			assert.equal(h.workspaceEvents.count(), 3);
		} finally { confirmation.resolve(); await h.destroy(); }
	});
	it("aborts an obsolete read and starts one latest scan without accepting its late result", async () => {
		const h = harness(), read = deferred();
		let reads = 0;
		h.hooks.beforeRead = async () => { if (++reads === 1) await read.promise; };
		try {
			const opening = h.view.onOpen();
			h.edit("a.md", "Fresh [!note]{Latest}"); h.vaultEvents.emit("modify", h.handles.get("a.md"));
			read.resolve(); await opening; await h.settle();
			assert.equal(h.root.querySelector("code")?.textContent, "[!note]{Latest}");
			assert.equal(h.inputs().length, 1);
			assert.equal(reads, 2);
		} finally { read.resolve(); await h.destroy(); }
	});
	it("unsubscribes, cancels queued refreshes, and refuses a late read after close", async () => {
		const h = harness(), read = deferred();
		h.hooks.beforeRead = () => read.promise;
		try {
			const opening = h.view.onOpen();
			h.vaultEvents.emit("modify", h.handles.get("a.md"));
			await h.view.onClose(); read.resolve(); await opening; await h.settle();
			assert.equal(h.vaultEvents.count(), 0);
			assert.equal(h.workspaceEvents.count(), 0);
			assert.equal(h.root.children.length, 0);
			h.vaultEvents.emit("modify", h.handles.get("a.md")); await h.settle();
			assert.equal(h.reads.length, 1);
			assert.deepEqual(h.written, []);
		} finally { read.resolve(); await h.destroy(); }
	});
	it("offers retry only after a failed scan and handles a fully protected vault", async () => {
		const h = harness({ "a.md": "`[!note]`" });
		h.hooks.beforeRead = () => { throw new Error("Unreadable"); };
		try {
			await h.view.onOpen(); assert.equal(h.button("retry").hidden, false);
			assert.equal(h.button("convert").disabled, true);
			delete h.hooks.beforeRead; h.click("retry"); await h.settle();
			assert.equal(h.button("retry").hidden, true);
			assert.equal(h.status(), t("portable.empty"));
			assert.equal(h.button("convert").disabled, true);
		} finally { await h.destroy(); }
	});
	it("keeps pending heading-link repairs visible after a partial failure and retries the same plan", async () => {
		const h = harness({ "a.md": "# Report [!note]", "b.md": "[[a#Report note]]" });
		h.hooks.confirm = async () => true;
		h.hooks.beforeProcess = path => { if (path === "b.md") throw new Error("Temporary write failure"); };
		try {
			await h.view.onOpen(); h.click("convert"); await h.tasks[h.tasks.length - 1];
			assert.equal(h.contents.get("a.md"), "# Report");
			assert.equal(h.contents.get("b.md"), "[[a#Report note]]");
			assert.equal(h.button("convert").textContent, t("portable.finishConversion"));
			assert.equal(h.button("convert").disabled, false, "link-only remainder can be approved");
			assert.equal(h.root.querySelectorAll(".cs-portable-link-change").length, 1);
			assert.ok(h.inputs().every(input => input.disabled));
			await h.view.onClose(); await h.view.onOpen();
			assert.equal(h.button("convert").disabled, false, "reopening keeps the pending link repair actionable");
			const readCount = h.reads.length;
			h.vaultEvents.emit("modify", h.handles.get("b.md")); await h.settle();
			assert.equal(h.reads.length, readCount, "recovery must not become a new ordinary scan");
			assert.equal(h.status(), t("portable.recoveryChanged"));
			delete h.hooks.beforeProcess;
			h.click("convert"); await h.tasks[h.tasks.length - 1]; await h.settle();
			assert.equal(h.contents.get("b.md"), "[[a#Report]]");
			assert.equal(h.button("convert").disabled, true);
		} finally { await h.destroy(); }
	});
});
