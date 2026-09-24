import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyPortableCalloutConversion as apply, preparePortableCalloutConversion as prepare,
	reviewPortableCalloutSelection as select,
} from "../src/utils/portableCalloutVault";
import { portableVault } from "./support/portableVaultHarness";

const notes = { "a.md": "# [!tip] Heading", "b.md": "[[a#tip Heading]]" };

describe("portable conversion keeps exact pending repairs after partial failure", () => {
	it("does not retain a recovery when the first write never happened", async () => {
		const h = portableVault(notes);
		h.hooks.beforeProcess = () => { throw new Error("Write never started"); };
		const result = await apply(h.app, await prepare(h.app));
		assert.equal(result.remainingPlan, undefined);
		assert.equal((await prepare(h.app)).recovery, false);
	});

	it("retains link-only repairs after their target heading was already converted", async () => {
		const h = portableVault(notes);
		const plan = await prepare(h.app);
		h.hooks.beforeProcess = path => { if (path === "b.md") throw new Error("Disk unavailable"); };
		const partial = await apply(h.app, plan);
		assert.equal(partial.files, 1);
		assert.equal(partial.count, 1);
		assert.equal(partial.linkCount, 0);
		assert.equal(h.contents.get("a.md"), "# Heading");
		const pending = partial.remainingPlan!;
		assert.ok(pending.recovery);
		assert.equal(pending.count, 0);
		assert.equal(pending.files, 1);
		assert.equal(pending.linkCount, 1);
		assert.equal(pending.linkChanges[0]!.before, "[[a#tip Heading]]");
		assert.equal(await prepare(h.app), pending);
		delete h.hooks.beforeProcess;
		const completed = await apply(h.app, pending);
		assert.equal(completed.status, "complete");
		assert.equal(completed.count, 0);
		assert.equal(completed.linkCount, 1);
		assert.equal(h.contents.get("b.md"), "[[a#Heading]]");
		assert.equal((await prepare(h.app)).recovery, false);
		assert.equal((await prepare(h.app)).files, 0);
	});

	it("keeps mappings across failed retries and blocks writes while any expected source differs", async () => {
		const h = portableVault(notes);
		h.hooks.beforeProcess = path => { if (path === "b.md") throw new Error("Disk unavailable"); };
		const initial = (await apply(h.app, await prepare(h.app))).remainingPlan!;
		delete h.hooks.beforeProcess;
		h.edit("b.md", "User's new paragraph");
		const failed = await apply(h.app, initial);
		assert.equal(failed.error?.code, "changed");
		assert.equal(failed.files, 0);
		assert.equal(h.contents.get("b.md"), "User's new paragraph");
		assert.ok(failed.remainingPlan?.recovery);
		assert.equal(await prepare(h.app), failed.remainingPlan);
		// Restoring exact expected bytes is safe even though mtime has advanced.
		h.edit("b.md", notes["b.md"]);
		assert.equal((await apply(h.app, failed.remainingPlan)).status, "complete");
		assert.equal(h.contents.get("b.md"), "[[a#Heading]]");
	});

	it("checks already converted notes before resuming any pending link repair", async () => {
		const h = portableVault(notes);
		h.hooks.beforeProcess = path => { if (path === "b.md") throw new Error("Disk unavailable"); };
		const pending = (await apply(h.app, await prepare(h.app))).remainingPlan!;
		delete h.hooks.beforeProcess;
		h.edit("a.md", "# Another heading");
		assert.equal((await apply(h.app, pending)).error?.code, "changed");
		assert.equal(h.contents.get("b.md"), notes["b.md"]);
	});

	it("requires the same file identities and vault membership during recovery", async () => {
		const h = portableVault(notes);
		h.hooks.beforeProcess = path => { if (path === "b.md") throw new Error("Disk unavailable"); };
		const pending = (await apply(h.app, await prepare(h.app))).remainingPlan!;
		delete h.hooks.beforeProcess;
		h.add("new.md", "Unrelated");
		assert.equal((await apply(h.app, pending)).error?.code, "changed");
		assert.equal(h.contents.get("b.md"), notes["b.md"]);
	});

	it("stops dependent link writes if another writer changes a just-converted heading", async () => {
		const h = portableVault(notes);
		h.hooks.afterProcess = path => { if (path === "a.md") h.edit(path, "# Another heading"); };
		const result = await apply(h.app, await prepare(h.app));
		assert.equal(result.files, 1);
		assert.equal(result.error?.code, "changed");
		assert.equal(h.contents.get("b.md"), notes["b.md"]);
		assert.ok(result.remainingPlan?.recovery);
	});

	it("preserves pending conversion choices and rejects reselection during recovery", async () => {
		const h = portableVault({ ...notes, "b.md": "[!note] [[a#tip Heading]]" });
		h.hooks.beforeProcess = path => { if (path === "b.md") throw new Error("Disk unavailable"); };
		const pending = (await apply(h.app, await prepare(h.app))).remainingPlan!;
		assert.equal(pending.changes.length, 1);
		assert.equal(pending.count, 1);
		assert.equal(select(h.app, pending, new Set(pending.selectedIds)), pending);
		assert.throws(() => select(h.app, pending, new Set()), { code: "invalid-plan" });
	});

	it("recognizes an adapter that persisted approved bytes before rejecting", async () => {
		const h = portableVault(notes);
		h.hooks.afterProcess = path => { if (path === "a.md") throw new Error("Adapter rejected after persistence"); };
		const partial = await apply(h.app, await prepare(h.app));
		assert.equal(partial.files, 0);
		assert.equal(h.contents.get("a.md"), "# Heading");
		assert.ok(partial.remainingPlan);
		delete h.hooks.afterProcess;
		const result = await apply(h.app, partial.remainingPlan);
		assert.equal(result.status, "complete");
		assert.equal(result.linkCount, 1);
		assert.equal(h.contents.get("b.md"), "[[a#Heading]]");
		assert.deepEqual(h.written, ["a.md", "b.md"]);
	});
});
