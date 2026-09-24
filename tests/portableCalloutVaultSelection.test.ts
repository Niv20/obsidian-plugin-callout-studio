import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyPortableCalloutConversion as apply, preparePortableCalloutConversion as prepare,
	reviewPortableCalloutSelection as select, PortableCalloutPreviewCache,
} from "../src/utils/portableCalloutVault";
import { portableVault } from "./support/portableVaultHarness";

describe("portable conversion complete selectable review", () => {
	it("exposes full inline tokens and groups context-dependent heading tokens together", async () => {
		const long = "x".repeat(1000);
		const h = portableVault({ "a.md": Array(10).fill(`${long} [!note]`).join("\n") + "\n# [!a] [!b]{Title}" });
		const plan = await prepare(h.app);
		assert.equal(plan.changes.length, 11);
		assert.equal(plan.changes[0]!.before, "[!note]");
		assert.equal(plan.changes[0]!.sourceLine, `${long} [!note]`);
		assert.equal(plan.changes[10]!.count, 2);
		assert.equal(plan.changes[10]!.after, "# Title");
		assert.equal(plan.selectedIds.length, 11);
		assert.ok(Object.isFrozen(plan.changes));
		assert.ok(Object.isFrozen(plan.changes[0]));
		assert.ok(Object.isFrozen(plan.selectedIds));
	});

	it("writes only chosen lines, preserving CRLF and excluded source byte-for-byte", async () => {
		const h = portableVault({ "a.md": "A [!note]\r\nB [!tip]\r\nC [!info]{text}\r\n" });
		const plan = await prepare(h.app);
		const chosen = select(h.app, plan, new Set([plan.changes[1]!.id]));
		assert.equal(chosen.changes.length, 3);
		assert.equal(chosen.count, 1);
		assert.equal((await apply(h.app, chosen)).count, 1);
		assert.equal(h.contents.get("a.md"), "A [!note]\r\nB tip\r\nC [!info]{text}\r\n");
		assert.equal((await apply(h.app, plan)).error?.code, "changed");
	});

	it("all deselected produces zero writes and cannot mutate earlier selection snapshots", async () => {
		const h = portableVault({ "a.md": "[!note]\n[!tip]" });
		const original = await prepare(h.app);
		const none = select(h.app, original, new Set());
		assert.equal(none.count, 0);
		assert.equal(none.files, 0);
		assert.equal((await apply(h.app, none)).status, "complete");
		assert.deepEqual(h.written, []);
		assert.equal((await apply(h.app, original)).count, 2);
	});

	it("row identity changes only when path, line, original bytes or conversion change", async () => {
		const h = portableVault({ "a.md": "A [!note]\nB [!tip]" });
		const first = await prepare(h.app);
		h.edit("a.md", "A [!note]\nChanged [!tip]");
		const next = await prepare(h.app);
		assert.equal(next.changes[0]!.id, first.changes[0]!.id);
		assert.notEqual(next.changes[1]!.id, first.changes[1]!.id);
	});

	it("selection plans remain bound to their app and cannot be reconstructed", async () => {
		const h = portableVault({ "a.md": "[!note]" });
		const plan = await prepare(h.app);
		assert.throws(() => select(portableVault({}).app, plan, new Set()), { code: "invalid-plan" });
		assert.throws(() => select(h.app, { ...plan }, new Set()), { code: "invalid-plan" });
	});
});

describe("portable heading links in selected vault conversion", () => {
	const notes = { "a.md": "# [!tip] Heading", "b.md": "[[a#tip Heading|Read]]" };

	it("includes dependent wiki and Markdown repairs in link-only notes", async () => {
		const h = portableVault({ ...notes, "c.md": "[Read](a.md#tip%20Heading)" });
		const plan = await prepare(h.app);
		assert.equal(plan.files, 3);
		assert.equal(plan.count, 1);
		assert.equal(plan.linkCount, 2);
		assert.equal(plan.linkChanges.length, 2);
		assert.equal((await apply(h.app, plan)).linkCount, 2);
		assert.equal(h.contents.get("b.md"), "[[a#Heading|Read]]");
		assert.equal(h.contents.get("c.md"), "[Read](a.md#Heading)");
	});

	it("deselecting a heading also removes its dependent link repairs", async () => {
		const h = portableVault(notes);
		const plan = select(h.app, await prepare(h.app), new Set());
		assert.equal(plan.linkCount, 0);
		assert.equal(plan.linkChanges.length, 0);
		assert.equal(plan.files, 0);
		await apply(h.app, plan);
		assert.deepEqual(h.written, []);
	});

	it("shows token output separately from dependent same-line link repairs", async () => {
		const h = portableVault({ ...notes, "b.md": "[!note] [[a#tip Heading]]" });
		const all = await prepare(h.app);
		const inline = all.changes.find(change => change.path === "b.md")!;
		assert.equal(inline.after, "note");
		assert.equal(all.linkChanges[0]!.before, "[!note] [[a#tip Heading]]");
		assert.equal(all.linkChanges[0]!.after, "note [[a#Heading]]");
		const justInline = select(h.app, all, new Set([inline.id]));
		assert.equal(justInline.changes.find(change => change.path === "b.md")!.id, inline.id);
		assert.equal(justInline.changes.find(change => change.path === "b.md")!.after, "note");
		await apply(h.app, all);
		assert.equal(h.contents.get("b.md"), "note [[a#Heading]]");
	});

	it("skips ambiguous headings visibly while retaining independent selected conversions", async () => {
		const h = portableVault({ ...notes, "a.md": "# [!tip] Heading\n# Heading\n[!note]" });
		const plan = await prepare(h.app);
		assert.equal(plan.changes.length, 2);
		assert.equal(plan.blockedChanges.length, 1);
		assert.equal(plan.blockedChanges[0]!.reason, "ambiguous-target");
		assert.equal(plan.selectedIds.includes(plan.blockedChanges[0]!.id), false);
		assert.equal(plan.count, 1);
		await apply(h.app, plan);
		assert.equal(h.contents.get("a.md"), "# [!tip] Heading\n# Heading\nnote");
		assert.equal(h.contents.get("b.md"), notes["b.md"]);
	});

	it("allows a formerly colliding choice when the other heading is excluded", async () => {
		const h = portableVault({ "a.md": "# [!a] Same\n# [!b] Same", "b.md": "[[a#a Same]] [[a#b Same]]" });
		const all = await prepare(h.app);
		assert.equal(all.count, 0);
		assert.equal(all.blockedChanges.length, 2);
		const first = select(h.app, all, new Set([all.changes[0]!.id]));
		assert.equal(first.count, 1);
		assert.equal(first.linkCount, 1);
		assert.equal(first.selectedIds[0], all.changes[0]!.id);
		await apply(h.app, first);
		assert.equal(h.contents.get("a.md"), "# Same\n# [!b] Same");
		assert.equal(h.contents.get("b.md"), "[[a#Same]] [[a#b Same]]");
	});
});

describe("portable review session caching", () => {
	it("uses current exact heading/link contents across cached rescans and clearing the session", async () => {
		const h = portableVault({ "a.md": "# [!tip] Heading", "b.md": "[[a#tip Heading]]" });
		const cache = new PortableCalloutPreviewCache();
		const original = await prepare(h.app, { cache });
		assert.equal(original.linkChanges[0]!.after, "[[a#Heading]]");
		h.edit("a.md", "# [!tip] Different");
		h.edit("b.md", "[[a#tip Different]]");
		const changed = await prepare(h.app, { cache });
		assert.equal(changed.linkChanges[0]!.after, "[[a#Different]]");
		const none = select(h.app, changed, new Set());
		assert.equal(none.linkChanges.length, 0);
		const again = select(h.app, none, new Set(changed.selectedIds));
		assert.deepEqual(again.linkChanges, changed.linkChanges);
		cache.invalidate();
		assert.deepEqual((await prepare(h.app, { cache })).linkChanges, changed.linkChanges);
	});

	it("rereads only changed or invalidated notes during preview, but all notes at approval", async () => {
		const h = portableVault({ "a.md": "[!note]", "b.md": "[!tip]" });
		const cache = new PortableCalloutPreviewCache();
		await prepare(h.app, { cache });
		h.reads.length = 0;
		await prepare(h.app, { cache });
		assert.deepEqual(h.reads, []);
		h.edit("b.md", "B [!tip]");
		await prepare(h.app, { cache });
		assert.deepEqual(h.reads, ["b.md"]);
		h.reads.length = 0;
		cache.invalidate("a.md");
		const plan = await prepare(h.app, { cache });
		assert.deepEqual(h.reads, ["a.md"]);
		h.reads.length = 0;
		await apply(h.app, plan);
		assert.deepEqual(h.reads, ["a.md", "b.md", "a.md", "b.md"]);
	});

	it("cached preview cannot approve a hidden same-metadata byte change", async () => {
		const h = portableVault({ "a.md": "[!note]" });
		const cache = new PortableCalloutPreviewCache();
		await prepare(h.app, { cache });
		h.edit("a.md", "changed", false);
		assert.equal((await apply(h.app, await prepare(h.app, { cache }))).error?.code, "changed");
		assert.deepEqual(h.written, []);
	});
});
