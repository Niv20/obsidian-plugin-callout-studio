/**
 * This device's settings history: the states it accepted, kept in IndexedDB
 * where neither a sync service nor uninstalling the plugin can reach them.
 *
 * Three things are pinned. What is kept (at most ten recent states within a
 * size budget). That recording never fails or delays a save.
 * And that every accepted state is recorded: each file adopted from disk and
 * each verified write, but never a write that did not land.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { SettingsHistory, historyToKeep, type SettingsHistoryStore } from "../src/manager/settingsHistory";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { installFakeDom } from "./support/fakeDom";
import { installFakeIndexedDb } from "./support/fakeIndexedDb";

installFakeDom();

const MINUTE = 60_000, DAY = 86_400_000;
const START = Date.UTC(2026, 0, 5, 12); // a Monday

function entries(times: number[], bytes = 100) {
	return times.map((savedAt, i) => ({ hash: `h${i}`, savedAt, bytes }));
}

describe("which states the history keeps", () => {
	it("keeps the ten newest states of one busy hour", () => {
		const keep = historyToKeep(entries(Array.from({ length: 25 }, (_, i) => START + i * MINUTE)));
		assert.deepEqual([...keep].sort(), Array.from({ length: 10 }, (_, i) => `h${i + 15}`).sort());
	});

	it("keeps the same ten-state cap across days and weeks without expiring sparse history", () => {
		const all = entries(Array.from({ length: 30 }, (_, i) => START + i * 7 * DAY));
		assert.deepEqual([...historyToKeep(all)].sort(), Array.from({ length: 10 }, (_, i) => `h${i + 20}`).sort());
		assert.deepEqual([...historyToKeep(all.slice(0, 3))], ["h2", "h1", "h0"]);
	});

	it("drops older states beyond the size budget, but always keeps the newest", () => {
		const big = 5 * 1024 * 1024;
		const keep = historyToKeep(entries(Array.from({ length: 10 }, (_, i) => START + i * MINUTE), big));
		assert.deepEqual([...keep].sort(), ["h6", "h7", "h8", "h9"]);
		const huge = historyToKeep([{ hash: "only", savedAt: START, bytes: 64 * 1024 * 1024 }]);
		assert.deepEqual([...huge], ["only"]);
	});
});

function history(appId = "vault-a", now = () => Date.now()) {
	const app = { appId, vault: { configDir: ".obsidian", getName: () => appId } } as unknown as App;
	return new SettingsHistory(app, { id: "callout-studio" } as PluginManifest, 10_000, now);
}

describe("the history store", () => {
	it("records each distinct state once, newest first, and refreshes a state that returns", async () => {
		const db = installFakeIndexedDb();
		try {
			let clock = START;
			const h = history("vault-a", () => clock);
			await h.record({ callouts: [], n: 1 });
			clock += MINUTE; await h.record({ callouts: [], n: 2 });
			clock += MINUTE; await h.record({ n: 1, callouts: [] });
			const list = await h.list();
			assert.deepEqual(list.map(entry => entry.data.n), [1, 2]);
			assert.equal(list[0]!.savedAt, START + 2 * MINUTE);
		} finally { db.restore(); }
	});

	it("keeps content only, as it was when recorded", async () => {
		const db = installFakeIndexedDb();
		try {
			const h = history();
			const data = { callouts: [{ id: "kept" }], calloutStudioSync: { version: 2, stamps: {}, fingerprint: "0" } };
			const recording = h.record(data);
			data.callouts[0]!.id = "changed after the call";
			await recording;
			assert.deepEqual((await h.list())[0]!.data, { callouts: [{ id: "kept" }] });
		} finally { db.restore(); }
	});

	it("applies retention as it records", async () => {
		const db = installFakeIndexedDb();
		try {
			let clock = START;
			const h = history("vault-a", () => clock);
			for (let n = 0; n < 25; n++) { clock += MINUTE; await h.record({ n }); }
			const kept = (await h.list()).map(entry => entry.data.n);
			assert.deepEqual(kept, Array.from({ length: 10 }, (_, i) => 24 - i));
		} finally { db.restore(); }
	});

	it("keeps each vault's history apart", async () => {
		const db = installFakeIndexedDb();
		try {
			await history("vault-a").record({ from: "a" });
			await history("vault-b").record({ from: "b" });
			assert.deepEqual((await history("vault-a").list()).map(entry => entry.data.from), ["a"]);
		} finally { db.restore(); }
	});

	it("uses a database of its own, never the recovery checkpoint's", async () => {
		const db = installFakeIndexedDb();
		try {
			await history().record({ n: 1 });
			assert.deepEqual([...db.databases.keys()], ["CalloutStudioHistory"]);
		} finally { db.restore(); }
	});

	it("never rejects when storage refuses it", async t => {
		t.mock.method(console, "debug", () => undefined);
		const db = installFakeIndexedDb();
		try {
			db.fail.open = true;
			await assert.doesNotReject(history().record({ n: 1 }));
		} finally { db.restore(); }
	});

	it("forgets one kept state by its hash, leaving the rest", async () => {
		const db = installFakeIndexedDb();
		try {
			let clock = START;
			const h = history("vault-a", () => clock);
			await h.record({ callouts: [], n: 1 });
			clock += MINUTE; await h.record({ callouts: [], n: 2 });
			const gone = (await h.list()).find(entry => (entry.data as { n: number }).n === 1)!;
			await h.delete(gone.hash);
			assert.deepEqual((await h.list()).map(entry => entry.data.n), [2]);
		} finally { db.restore(); }
	});

	it("reports a failed delete instead of swallowing it, and does not poison later writes", async () => {
		const db = installFakeIndexedDb();
		try {
			const h = history();
			await h.record({ callouts: [], n: 1 });
			db.fail.open = true;
			await assert.rejects(h.delete("whatever"));
			db.fail.open = false;
			await h.record({ callouts: [], n: 2 });
			assert.deepEqual((await h.list()).map(entry => entry.data.n).sort(), [1, 2]);
		} finally { db.restore(); }
	});
});

describe("pruning history from an earlier release", () => {
	/** Seed old entries directly: recording through today's store already applies its limits. */
	async function oldHistory(db: ReturnType<typeof installFakeIndexedDb>, appId: string, count = 35, bytes = 100) {
		const h = history(appId, () => START + count * 7 * DAY);
		await h.list(); // Create the database without recording a current state.
		const rows = db.databases.get("CalloutStudioHistory")!.stores.get("snapshots")!;
		const scope = JSON.stringify([appId, ".obsidian", "callout-studio"]);
		for (let n = 0; n < count; n++) {
			rows.set(`${scope}\u0001old-${n}`, {
				scope, hash: `old-${n}`, savedAt: START + n * 7 * DAY, bytes, data: { n }, reason: "edit",
			});
		}
		return { h, rows, scope };
	}

	it("removes excess existing entries without adding or refreshing a state, and leaves other vaults alone", async () => {
		const db = installFakeIndexedDb();
		try {
			const { h, rows } = await oldHistory(db, "vault-a");
			const { h: other } = await oldHistory(db, "vault-b");
			const original = await h.list(), otherOriginal = await other.list();
			await h.prune();
			assert.deepEqual(await h.list(), original.slice(0, 10));
			assert.deepEqual(await other.list(), otherOriginal);
			assert.equal(rows.size, 45, "older entries are deleted from storage, not merely hidden");
			const afterFirst = structuredClone(rows);
			await h.prune();
			assert.deepEqual(rows, afterFirst, "repeated startup cleanup is idempotent");
		} finally { db.restore(); }
	});

	it("also applies the byte budget to existing entries while always retaining the newest", async () => {
		const db = installFakeIndexedDb();
		try {
			const { h, rows, scope } = await oldHistory(db, "vault-a", 12, 5 * 1024 * 1024);
			await h.prune();
			assert.deepEqual((await h.list()).map(entry => entry.data.n), [11, 10, 9, 8]);
			const newest = rows.get(`${scope}\u0001old-11`) as { bytes: number };
			newest.bytes = 64 * 1024 * 1024;
			await h.prune();
			assert.deepEqual((await h.list()).map(entry => entry.data.n), [11]);
		} finally { db.restore(); }
	});

	it("does not reject or poison later recording when startup storage is unavailable", async t => {
		t.mock.method(console, "debug", () => undefined);
		const db = installFakeIndexedDb();
		try {
			const { h } = await oldHistory(db, "vault-a");
			db.fail.open = true;
			await assert.doesNotReject(h.prune());
			db.fail.open = false;
			await h.record({ n: "saved after cleanup failed" });
			const kept = await h.list();
			assert.equal(kept.length, 10);
			assert.ok(kept.some(entry => entry.data.n === "saved after cleanup failed"));
		} finally { db.restore(); }
	});
});

describe("why a state was recorded", () => {
	it("records why, and a reread of a state it already had keeps the reason that state has", async () => {
		const db = installFakeIndexedDb();
		try {
			let clock = START;
			const h = history("vault-a", () => clock);
			await h.record({ n: 1 }, "edit");
			clock += MINUTE; await h.record({ n: 2 }, "load");
			// Every startup reads the file again; that is not how the state came about.
			clock += MINUTE; await h.record({ n: 1 }, "load");
			let list = await h.list();
			assert.deepEqual(list.map(entry => [entry.data.n, entry.reason]), [[1, "edit"], [2, "load"]]);
			assert.equal(list[0]!.savedAt, START + 2 * MINUTE, "its date still moves");
			clock += MINUTE; await h.record({ n: 2 }, "restore");
			list = await h.list();
			assert.deepEqual(list.map(entry => [entry.data.n, entry.reason]), [[2, "restore"], [1, "edit"]], "a restore is news");
		} finally { db.restore(); }
	});
});

describe("what the writer records", () => {
	function recorder(): SettingsHistoryStore & { states: unknown[] } {
		const states: unknown[] = [];
		return { states, record: data => { states.push(structuredClone(data)); return Promise.resolve(); }, list: () => Promise.resolve([]),
			delete: () => Promise.resolve() };
	}

	it("records the adopted file and each write that landed, never an unchanged or failed one", async () => {
		let state = { n: 1 }, fail = false;
		const history = recorder();
		const writer = new SettingsWriter({ build: () => state, history,
			write: () => fail ? Promise.reject(new Error("disk full")) : Promise.resolve() });
		writer.adopt(JSON.stringify(state));
		assert.deepEqual(history.states, [{ n: 1 }]);
		state = { n: 2 }; await writer.save();
		await writer.save();
		fail = true; state = { n: 3 }; await assert.rejects(writer.save());
		assert.deepEqual(history.states, [{ n: 1 }, { n: 2 }]);
		writer.destroy();
	});

	it("tells the history why: a file read, an edit, a restore", async () => {
		let state: { n: number } = { n: 1 };
		const reasons: (string | undefined)[] = [];
		const writer = new SettingsWriter({ build: () => state, write: () => Promise.resolve(),
			history: { record: (_data, reason) => { reasons.push(reason); return Promise.resolve(); }, list: () => Promise.resolve([]),
				delete: () => Promise.resolve() } });
		writer.adopt(JSON.stringify(state));
		state = { n: 2 }; await writer.save();
		assert.equal(await writer.commit({ n: 3 }, () => true, () => { state = { n: 3 }; }, "restore"), true);
		assert.deepEqual(reasons, ["load", "edit", "restore"]);
		writer.destroy();
	});

	it("does not wait for the history to finish before a save resolves", async () => {
		let state = { n: 1 };
		const writer = new SettingsWriter({ build: () => state, write: () => Promise.resolve(),
			history: { record: () => new Promise<void>(() => {}), list: () => Promise.resolve([]), delete: () => Promise.resolve() } });
		writer.adopt(JSON.stringify(state));
		state = { n: 2 };
		await writer.save();
		assert.equal(writer.matchesLastWrite(JSON.stringify(state)), true);
		writer.destroy();
	});
});

describe("a settings visit is one version", () => {
	it("lets each edit of a visit replace the last, and keeps the state from before it", async () => {
		const db = installFakeIndexedDb();
		try {
			let clock = START;
			const h = history("vault-a", () => clock);
			await h.record({ n: 1 }, "load");
			for (const n of [2, 3, 4]) { clock += MINUTE; await h.record({ n }, "edit", "visit-1"); }
			assert.deepEqual((await h.list()).map(entry => entry.data.n), [4, 1]);
			assert.equal((await h.list())[0]!.savedAt, START + 3 * MINUTE, "dated by its last edit");
		} finally { db.restore(); }
	});

	it("leaves no version of a visit that returns to where it started, and never takes that state over", async () => {
		const db = installFakeIndexedDb();
		try {
			let clock = START;
			const h = history("vault-a", () => clock);
			await h.record({ n: 1 }, "load");
			clock += MINUTE; await h.record({ n: 2 }, "edit", "visit-1");
			clock += MINUTE; await h.record({ n: 1 }, "edit", "visit-1");
			assert.deepEqual((await h.list()).map(entry => entry.data.n), [1]);
			clock += MINUTE; await h.record({ n: 3 }, "edit", "visit-1");
			assert.deepEqual((await h.list()).map(entry => entry.data.n), [3, 1], "the state from before the visit is not the visit's");
		} finally { db.restore(); }
	});

	it("never replaces another visit's version, one saved outside a visit, or one that is not an edit", async () => {
		const db = installFakeIndexedDb();
		try {
			let clock = START;
			const h = history("vault-a", () => clock);
			await h.record({ n: 1 }, "edit");
			clock += MINUTE; await h.record({ n: 2 }, "edit", "visit-1");
			clock += MINUTE; await h.record({ n: 3 }, "edit", "visit-2");
			clock += MINUTE; await h.record({ n: 4 }, "restore", "visit-2");
			clock += MINUTE; await h.record({ n: 5 }, "edit", "visit-2");
			assert.deepEqual((await h.list()).map(entry => entry.data.n), [5, 4, 2, 1]);
		} finally { db.restore(); }
	});
});

describe("when the writer starts a new version", () => {
	function visitWriter() {
		let clock = START, state: Record<string, unknown> = { n: 1 }, written = "";
		const h = history("vault-a", () => clock);
		const writer = new SettingsWriter({
			build: () => state, history: h, mergeConcurrent: true, now: () => clock,
			write: data => { written = JSON.stringify(data); return Promise.resolve(); },
		});
		return {
			writer,
			/** Save `n`, a minute after the last step. */
			async save(n: number) { clock += MINUTE; state = { n }; await writer.save(); },
			wait(ms: number) { clock += ms; },
			get written() { return written; },
			/** Waits for every recording queued so far, then lists them. */
			async kept() { await h.prune(); return (await h.list()).map(entry => entry.data.n); },
		};
	}

	it("keeps a visit's saves as one version until it ends, then starts another", async () => {
		const db = installFakeIndexedDb();
		try {
			const t = visitWriter();
			t.writer.adopt(JSON.stringify({ n: 1 }));
			const end = t.writer.openVisit();
			await t.save(2); await t.save(3); await t.save(4);
			assert.deepEqual(await t.kept(), [4, 1]);
			end();
			await t.save(5); await t.save(6);
			assert.deepEqual(await t.kept(), [6, 5, 4, 1], "outside a visit, each save is a version");
			t.writer.destroy();
		} finally { db.restore(); }
	});

	it("ends a visit's version at a restore and at settings from elsewhere, not at its own file read back", async () => {
		const db = installFakeIndexedDb();
		try {
			const t = visitWriter();
			t.writer.adopt(JSON.stringify({ n: 1 }));
			t.writer.openVisit();
			await t.save(2);
			assert.equal(await t.writer.commit({ n: 3 }, () => true, () => {}, "restore"), true);
			await t.save(4); await t.save(5);
			assert.deepEqual(await t.kept(), [5, 3, 2, 1]);
			t.writer.adopt(JSON.stringify({ n: 6 }));
			await t.save(7);
			assert.deepEqual(await t.kept(), [7, 6, 5, 3, 2, 1]);
			t.writer.adopt(t.written);
			await t.save(8);
			assert.deepEqual(await t.kept(), [8, 6, 5, 3, 2, 1]);
			t.writer.destroy();
		} finally { db.restore(); }
	});

	it("starts a new version after a quarter of an hour without a change", async () => {
		const db = installFakeIndexedDb();
		try {
			const t = visitWriter();
			t.writer.adopt(JSON.stringify({ n: 1 }));
			t.writer.openVisit();
			await t.save(2);
			t.wait(15 * MINUTE);
			await t.save(3); await t.save(4);
			assert.deepEqual(await t.kept(), [4, 2, 1]);
			t.writer.destroy();
		} finally { db.restore(); }
	});

	it("ends a visit only when every holder has, however often one ends its own", async () => {
		const db = installFakeIndexedDb();
		try {
			const t = visitWriter();
			t.writer.adopt(JSON.stringify({ n: 1 }));
			const first = t.writer.openVisit();
			const second = t.writer.openVisit();
			first(); first();
			await t.save(2); await t.save(3);
			assert.deepEqual(await t.kept(), [3, 1]);
			second();
			await t.save(4);
			assert.deepEqual(await t.kept(), [4, 3, 1]);
			t.writer.destroy();
		} finally { db.restore(); }
	});
});
