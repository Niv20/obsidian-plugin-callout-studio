/**
 * This device's settings history: the states it accepted, kept in IndexedDB
 * where neither a sync service nor uninstalling the plugin can reach them.
 *
 * Three things are pinned. What is kept (recent states, one per day, one per
 * week, within a size budget). That recording never fails or delays a save.
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
	it("keeps the twenty newest states of one busy hour", () => {
		const keep = historyToKeep(entries(Array.from({ length: 25 }, (_, i) => START + i * MINUTE)));
		assert.deepEqual([...keep].sort(), Array.from({ length: 20 }, (_, i) => `h${i + 5}`).sort());
	});

	it("keeps the newest state of each of the last fourteen days and eight weeks", () => {
		// Three states a day for ninety days.
		const times = Array.from({ length: 270 }, (_, i) => START + Math.floor(i / 3) * DAY + (i % 3) * MINUTE);
		const all = entries(times);
		const keep = historyToKeep(all);
		const newestOfDay = (day: number) => `h${day * 3 + 2}`;
		for (let day = 89; day > 89 - 14; day--) assert.ok(keep.has(newestOfDay(day)), `day ${day}`);
		// START is a Monday, so days 7w..7w+6 are one week; its newest is the Sunday.
		for (let week = 12; week > 12 - 8; week--) {
			const newestDay = Math.min(week * 7 + 6, 89);
			assert.ok(keep.has(newestOfDay(newestDay)), `week ${week}`);
		}
		assert.ok(!keep.has(newestOfDay(10)), "a state eleven weeks old outlived the weeks kept");
		assert.ok(keep.size <= 20 + 14 + 8);
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
			assert.deepEqual(kept, Array.from({ length: 20 }, (_, i) => 24 - i));
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
});

describe("what the writer records", () => {
	function recorder(): SettingsHistoryStore & { states: unknown[] } {
		const states: unknown[] = [];
		return { states, record: data => { states.push(structuredClone(data)); return Promise.resolve(); }, list: () => Promise.resolve([]) };
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

	it("does not wait for the history to finish before a save resolves", async () => {
		let state = { n: 1 };
		const writer = new SettingsWriter({ build: () => state, write: () => Promise.resolve(),
			history: { record: () => new Promise<void>(() => {}), list: () => Promise.resolve([]) } });
		writer.adopt(JSON.stringify(state));
		state = { n: 2 };
		await writer.save();
		assert.equal(writer.matchesLastWrite(JSON.stringify(state)), true);
		writer.destroy();
	});
});
