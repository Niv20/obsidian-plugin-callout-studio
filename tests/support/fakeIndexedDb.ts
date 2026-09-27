/**
 * tests/support/fakeIndexedDb.ts — enough IndexedDB for the settings history.
 *
 * Node has none. This models what the history store relies on and nothing
 * else: `open` with an upgrade on first use, one object store with out-of-line
 * keys, `getAll` over a key range, `put`, `delete`, and a transaction that
 * commits once no request is pending after its callbacks have run. Values are
 * structured-cloned in and out, as a real database does. Requests complete on
 * a later macrotask, and a transaction commits on the macrotask after its last
 * request's callback, so writes issued from a success callback land in it.
 */
import { setImmediate } from "node:timers";

type Callback = ((this: unknown, event: Event) => void) | null;

class FakeRequest {
	result: unknown;
	error: Error | null = null;
	onsuccess: Callback = null;
	onerror: Callback = null;
	transaction: FakeTransaction | null = null;
}

class FakeTransaction {
	oncomplete: Callback = null;
	onerror: Callback = null;
	onabort: Callback = null;
	error: Error | null = null;
	private pending = 0;
	private done = false;

	constructor(private readonly db: FakeDatabase, readonly mode: IDBTransactionMode) {
		// A transaction nobody uses still completes.
		setImmediate(() => this.settle());
	}

	objectStore(name: string): FakeStore {
		const rows = this.db.stores.get(name);
		if (!rows) throw new Error(`No object store ${name}`);
		return new FakeStore(this, rows);
	}

	abort(): void {
		if (this.done) return;
		this.done = true;
		this.onabort?.call(this, new Event("abort"));
	}

	/** Run `work` as a request of this transaction. */
	request(work: () => unknown, writes: boolean): FakeRequest {
		if (this.done) throw new Error("TransactionInactiveError");
		if (writes && this.mode === "readonly") throw new Error("ReadOnlyError");
		const request = new FakeRequest();
		this.pending++;
		setImmediate(() => {
			if (this.done) return;
			try { request.result = work(); }
			catch (error) { request.error = error as Error; }
			this.pending--;
			if (request.error) request.onerror?.call(request, new Event("error"));
			else request.onsuccess?.call(request, new Event("success"));
			this.settle();
		});
		return request;
	}

	private settle(): void {
		setImmediate(() => {
			if (this.done || this.pending > 0) return;
			this.done = true;
			this.oncomplete?.call(this, new Event("complete"));
		});
	}
}

class FakeStore {
	constructor(private readonly transaction: FakeTransaction, private readonly rows: Map<string, unknown>) {}

	getAll(range: FakeKeyRange): FakeRequest {
		return this.transaction.request(() => [...this.rows.keys()].sort()
			.filter(key => range.includes(key)).map(key => structuredClone(this.rows.get(key))), false);
	}

	put(value: unknown, key: string): FakeRequest {
		const copy = structuredClone(value);
		return this.transaction.request(() => { this.rows.set(key, copy); return key; }, true);
	}

	delete(key: string): FakeRequest {
		return this.transaction.request(() => { this.rows.delete(key); }, true);
	}
}

class FakeDatabase {
	readonly stores = new Map<string, Map<string, unknown>>();
	version = 0;
	closed = 0;
	onversionchange: Callback = null;

	createObjectStore(name: string): void {
		this.stores.set(name, new Map());
	}

	transaction(name: string, mode: IDBTransactionMode = "readonly"): FakeTransaction {
		if (!this.stores.has(name)) throw new Error(`No object store ${name}`);
		return new FakeTransaction(this, mode);
	}

	close(): void { this.closed++; }
}

class FakeKeyRange {
	constructor(readonly lower: string, readonly upper: string, readonly lowerOpen: boolean, readonly upperOpen: boolean) {}
	static bound(lower: string, upper: string, lowerOpen = false, upperOpen = false): FakeKeyRange {
		return new FakeKeyRange(lower, upper, lowerOpen, upperOpen);
	}
	includes(key: string): boolean {
		const above = this.lowerOpen ? key > this.lower : key >= this.lower;
		const below = this.upperOpen ? key < this.upper : key <= this.upper;
		return above && below;
	}
}

/**
 * Install a fresh fake as `indexedDB` and `IDBKeyRange`. `fail` makes every
 * open report an error, as storage that is gone or refused does.
 */
export function installFakeIndexedDb(): { databases: Map<string, FakeDatabase>; fail: { open: boolean }; restore(): void } {
	const g = globalThis as Record<string, unknown>;
	const saved = { indexedDB: g.indexedDB, IDBKeyRange: g.IDBKeyRange };
	const databases = new Map<string, FakeDatabase>();
	const fail = { open: false };
	g.IDBKeyRange = FakeKeyRange;
	g.indexedDB = {
		open(name: string, version = 1) {
			const request = Object.assign(new FakeRequest(), {
				onupgradeneeded: null as Callback, onblocked: null as Callback,
			});
			setImmediate(() => {
				if (fail.open) {
					request.error = new Error("QuotaExceededError");
					request.onerror?.call(request, new Event("error"));
					return;
				}
				let db = databases.get(name);
				if (!db) { db = new FakeDatabase(); databases.set(name, db); }
				request.result = db;
				if (db.version < version) {
					db.version = version;
					request.onupgradeneeded?.call(request, new Event("upgradeneeded"));
				}
				request.onsuccess?.call(request, new Event("success"));
			});
			return request;
		},
	};
	return {
		databases, fail,
		restore: () => {
			if (saved.indexedDB === undefined) delete g.indexedDB; else g.indexedDB = saved.indexedDB;
			if (saved.IDBKeyRange === undefined) delete g.IDBKeyRange; else g.IDBKeyRange = saved.IDBKeyRange;
		},
	};
}
