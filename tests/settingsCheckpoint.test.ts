import { SettingsWriter } from "../src/manager/SettingsWriter";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { SettingsCheckpoint } from "../src/manager/settingsCheckpoint";

function fixture() {
	const previous = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
	const request = {} as IDBOpenDBRequest, operation = {} as IDBRequest;
	const transaction = {} as IDBTransaction;
	let closed = 0;
	const db = { close: () => { closed++; }, transaction: (_store: string, _mode: IDBTransactionMode, options: IDBTransactionOptions) => {
		assert.equal(options.durability, "strict");
		return Object.assign(transaction, { objectStore: () => ({ get: () => operation, put: () => operation }) });
	} } as unknown as IDBDatabase;
	Object.defineProperty(request, "result", { value: db, configurable: true });
	Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open: () => request } });
	const app = { appId: "checkpoint-test", vault: { configDir: ".obsidian", getName: () => "test" } } as unknown as App;
	return { store: new SettingsCheckpoint(app, { id: "callout-studio" } as PluginManifest), request, operation, transaction,
		get closed() { return closed; },
		open: async () => { request.onsuccess?.call(request, new Event("success")); await Promise.resolve(); },
		restore: () => { if (previous) Object.defineProperty(globalThis, "indexedDB", previous); else Reflect.deleteProperty(globalThis, "indexedDB"); },
	};
}

describe("durable recovery transaction boundaries", () => {
	it("does not report a request success as a committed checkpoint", async () => {
		const f = fixture();
		try {
			let completed = false; const write = f.store.write({}).then(() => { completed = true; });
			await f.open(); f.operation.onsuccess?.call(f.operation, new Event("success")); await Promise.resolve();
			assert.equal(completed, false);
			f.transaction.oncomplete?.call(f.transaction, new Event("complete")); await write;
			assert.equal(completed, true); assert.equal(f.closed, 1);
		} finally { f.restore(); }
	});
	it("rejects a transaction abort after a successful put request", async () => {
		const f = fixture();
		try {
			const write = f.store.write({}); const rejected = assert.rejects(write, /quota/i);
			await f.open(); f.operation.onsuccess?.call(f.operation, new Event("success"));
			Object.defineProperty(f.transaction, "error", { value: new Error("Quota exceeded") });
			f.transaction.onabort?.call(f.transaction, new Event("abort")); await rejected;
			assert.equal(f.closed, 1);
		} finally { f.restore(); }
	});
	it("closes a database that opens after the request was blocked", async () => {
		const f = fixture();
		try {
			const read = f.store.read(); const rejected = assert.rejects(read, /blocked/);
			f.request.onblocked?.call(f.request, new Event("blocked") as IDBVersionChangeEvent); await rejected;
			await f.open(); assert.equal(f.closed, 1);
		} finally { f.restore(); }
	});
	it("rejects an invalid stored snapshot instead of returning repaired data", async () => {
		const f = fixture();
		try {
			const read = f.store.read(); const rejected = assert.rejects(read, /invalid/);
			await f.open(); Object.defineProperty(f.operation, "result", { value: { callouts: [{ id: "broken" }] } });
			f.operation.onsuccess?.call(f.operation, new Event("success"));
			f.transaction.oncomplete?.call(f.transaction, new Event("complete")); await rejected;
		} finally { f.restore(); }
	});
	it("reports unavailable recovery storage explicitly", async () => {
		const f = fixture();
		try { Reflect.deleteProperty(globalThis, "indexedDB"); await assert.rejects(f.store.read(), /unavailable/); }
		finally { f.restore(); }
	});
	it("does not turn a cancelled isolated commit into a recoverable accepted edit", async () => {
		let release!: () => void, current = true, saved: unknown = { n: 1 }, writes = 0;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const writer = new SettingsWriter({ mergeConcurrent: true, build: () => ({ n: 1 }),
			checkpoint: { read: async () => saved, write: async data => { saved = data; await gate; } },
			write: async () => { writes++; },
		});
		writer.adopt('{"n":1}');
		const commit = writer.commit({ n: 2 }, () => current, () => { throw new Error("Cancelled commit published"); });
		current = false; release(); assert.equal(await commit, false); assert.equal(writes, 0);
		assert.equal((saved as { n: number }).n, 1);
	});
	it("keeps a published isolated commit consistent with the file if its final checkpoint fails", async () => {
		let checkpoints = 0, state = { n: 1 }, disk = state, published = false;
		const writer = new SettingsWriter({ mergeConcurrent: true, build: () => state,
			checkpoint: { read: async () => null, write: async () => { if (++checkpoints === 2) throw new Error("Checkpoint failed after commit"); } },
			write: async data => { disk = data as { n: number }; },
		});
		writer.adopt(JSON.stringify(state));
		await assert.rejects(writer.commit({ n: 2 }, () => true, () => { state = { n: 2 }; published = true; }), /after commit/);
		assert.equal(published, true); assert.equal(disk.n, 2);
		assert.equal(writer.matchesLastWrite(JSON.stringify(state), true), true);
	});

});
