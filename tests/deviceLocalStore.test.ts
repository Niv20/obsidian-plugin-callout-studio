/**
 * tests/deviceLocalStore.test.ts — the store that must never sync.
 *
 * Its job is to remember what this machine observed, and the two ways it can
 * fail are opposite: forgetting (a cleared or corrupt blob silently emptying
 * the settings list) and over-remembering (an id kept after the row it stood
 * for was deliberately deleted, so the next launch resurrects it).
 *
 * The storage failure paths are the ones worth spelling out. `localStorage`
 * throws rather than returning null in a private window and when quota is
 * exhausted, and `StartupStyleCache` learned the hard way that a memo raised
 * before the write lands remembers a refused write as a successful one — after
 * which the same content is never offered to storage again.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";

/** A `window.localStorage` a test can inspect, break, and pre-fill. */
function installStorage(): {
	map: Map<string, string>;
	failWrites(on: boolean): void;
	failReads(on: boolean): void;
	writes(): number;
} {
	const map = new Map<string, string>();
	let breakWrites = false;
	let breakReads = false;
	let writes = 0;
	(globalThis as unknown as { window: unknown }).window = {
		localStorage: {
			getItem(key: string): string | null {
				if (breakReads) throw new Error("storage unavailable");
				return map.get(key) ?? null;
			},
			setItem(key: string, value: string): void {
				if (breakWrites) throw new Error("QuotaExceededError");
				writes++;
				map.set(key, value);
			},
		},
	};
	return {
		map,
		failWrites: (on) => {
			breakWrites = on;
		},
		failReads: (on) => {
			breakReads = on;
		},
		writes: () => writes,
	};
}

const storage = installStorage();
const KEY = "a-vault-callout-studio-local";
const app = { vault: { getName: () => "a-vault" } } as unknown as App;

function fresh(seed?: unknown): DeviceLocalStore {
	storage.map.clear();
	storage.failWrites(false);
	storage.failReads(false);
	if (seed !== undefined) {
		storage.map.set(KEY, typeof seed === "string" ? seed : JSON.stringify(seed));
	}
	return new DeviceLocalStore(app);
}

describe("DeviceLocalStore — the discovery index", () => {
	it("starts empty and un-indexed on a device that has never scanned", () => {
		const store = fresh();
		assert.deepStrictEqual([...store.discovered], []);
		assert.strictEqual(store.hasIndex, false);
	});

	it("reads back what an earlier session remembered", () => {
		const store = fresh({ v: 1, discovered: ["alpha", "beta"] });
		assert.deepStrictEqual([...store.discovered], ["alpha", "beta"]);
		assert.strictEqual(store.hasIndex, true);
	});

	it("remembers new ids and keeps the ones it had", () => {
		const store = fresh({ v: 1, discovered: ["alpha"] });
		store.remember(["beta"]);
		assert.deepStrictEqual([...store.discovered], ["alpha", "beta"]);
	});

	it("holds one entry per callout, not one per spelling", () => {
		// `a b` and `a-b` are one callout everywhere else; two entries here
		// would try, and fail, to build a second row for it on every launch.
		const store = fresh();
		store.remember(["a b", "a-b"]);
		assert.deepStrictEqual([...store.discovered], ["a b"]);
	});

	it("forgets through any spelling of the id", () => {
		const store = fresh({ v: 1, discovered: ["a b"] });
		store.forget(["a-b"]);
		assert.deepStrictEqual([...store.discovered], []);
	});

	it("replaces the set outright when a whole-vault scan says so", () => {
		const store = fresh({ v: 1, discovered: ["stale", "kept"] });
		store.replace(["kept", "new"]);
		assert.deepStrictEqual([...store.discovered], ["kept", "new"]);
	});

	it("counts as indexed once it has written, not only once it has read", () => {
		// The launch that migrates a vault over writes its first index. Without
		// this, that same launch would still read as "never indexed here" and
		// ask for a scan it does not need.
		const store = fresh();
		assert.strictEqual(store.hasIndex, false);
		store.replace([]);
		assert.strictEqual(store.hasIndex, true);
	});
});

describe("DeviceLocalStore — the first-run flag", () => {
	it("is false until this device completes a scan", () => {
		const store = fresh();
		assert.strictEqual(store.firstRunCompleted, false);
		store.completeFirstRun();
		assert.strictEqual(store.firstRunCompleted, true);
	});

	it("survives a reload", () => {
		fresh().completeFirstRun();
		assert.strictEqual(new DeviceLocalStore(app).firstRunCompleted, true);
	});

	it("adopts a pre-move data.json value once", () => {
		const store = fresh();
		store.adoptLegacyFirstRun(true);
		assert.strictEqual(store.firstRunCompleted, true);
	});

	it("only ever raises the flag", () => {
		// A settings file written before the flag moved must not un-scan a
		// device that has already scanned.
		const store = fresh();
		store.completeFirstRun();
		store.adoptLegacyFirstRun(undefined);
		store.adoptLegacyFirstRun(false);
		assert.strictEqual(store.firstRunCompleted, true);
	});
});

describe("DeviceLocalStore — storage that misbehaves", () => {
	it("reads a corrupt blob as absent, not as empty", () => {
		// "Absent" and "empty" mean different things: absent asks for a scan,
		// empty says this vault genuinely uses no discovered callouts. Treating
		// a blob this build cannot parse as empty would hide every row with no
		// way back but the settings button.
		const store = fresh("{not json");
		assert.strictEqual(store.hasIndex, false);
		assert.deepStrictEqual([...store.discovered], []);
	});

	it("reads a blob from a future version as absent", () => {
		const store = fresh({ v: 2, discovered: ["alpha"] });
		assert.strictEqual(store.hasIndex, false);
	});

	it("drops non-string entries rather than the whole blob", () => {
		const store = fresh({ v: 1, discovered: ["alpha", 7, null, "beta"] });
		assert.deepStrictEqual([...store.discovered], ["alpha", "beta"]);
	});

	it("survives storage that throws on read", () => {
		storage.map.clear();
		storage.failReads(true);
		const store = new DeviceLocalStore(app);
		assert.strictEqual(store.hasIndex, false);
		storage.failReads(false);
	});

	it("survives storage that throws on write", () => {
		const store = fresh();
		storage.failWrites(true);
		assert.doesNotThrow(() => store.remember(["alpha"]));
		// In memory for this session either way — only the next launch's fast
		// restore is lost.
		assert.deepStrictEqual([...store.discovered], ["alpha"]);
		storage.failWrites(false);
	});

	it("retries content whose write was refused", () => {
		// The StartupStyleCache rule: a memo raised before the write lands
		// remembers a refusal as a success, and the same content is then never
		// offered to storage again for the rest of the session.
		const store = fresh();
		storage.failWrites(true);
		store.replace(["alpha"]);
		storage.failWrites(false);
		store.replace(["alpha"]);
		assert.strictEqual(storage.map.get(KEY)?.includes("alpha"), true);
	});

	it("does not rewrite an unchanged index", () => {
		const store = fresh({ v: 1, discovered: ["alpha"] });
		const before = storage.writes();
		store.replace(["alpha"]);
		assert.strictEqual(storage.writes(), before);
	});
});
