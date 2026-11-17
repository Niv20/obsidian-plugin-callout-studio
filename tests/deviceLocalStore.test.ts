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

describe("device UI state without a discovery cache", () => {
	it("does not write or discover anything on a new installation", () => {
		const store = fresh();
		const before = storage.writes();
		assert.strictEqual(store.hasInitialized, false);
		assert.strictEqual(store.hasSeenWelcome, false);
		assert.strictEqual(store.hasOfferedOccurrencesTab, false);
		assert.strictEqual(storage.writes(), before);
	});
	it("preserves legacy evidence until the verified archive", () => {
		const store = fresh({
			v: 1,
			discovered: ["old"],
			firstRunCompleted: true,
			retiredThemeIds: ["retired"],
			listsExpanded: { user: false },
		});
		assert.strictEqual(store.hasInitialized, true);
		const saved = JSON.parse(storage.map.get(KEY)!) as Record<string, unknown>;
		assert.deepStrictEqual(saved.discovered, ["old"]);
		assert.strictEqual(saved.v, 1);
		store.markInitialized();
		store.setQuickInsertSource("theme");
		assert.strictEqual((JSON.parse(storage.map.get(KEY)!) as { v: number }).v, 1);
	});
	it("persists only the installation marker and UI preferences", () => {
		const store = fresh();
		store.markInitialized();
		store.setQuickInsertSource("theme");
		const restored = new DeviceLocalStore(app);
		assert.strictEqual(restored.hasInitialized, true);
		assert.strictEqual(restored.quickInsertSource, "theme");
	});
	// Where the Publish to the web page was left is a fact about this device,
	// like the icon picker's last category.
	it("remembers where the Publish to the web page was left, and only what it understands", () => {
		const store = fresh();
		assert.deepStrictEqual(store.webExport, {});
		store.setWebExport({ service: "quartz", quartzVersion: 5, quartzInVault: true });
		assert.deepStrictEqual(new DeviceLocalStore(app).webExport, {
			service: "quartz",
			quartzVersion: 5,
			quartzInVault: true,
		});

		// `auto` was a switch per target until every target was kept current.
		const odd = fresh({
			v: 3,
			initialized: true,
			welcomeSeen: true,
			webExport: { service: 7, auto: ["publish", 3, null], quartzVersion: 6, quartzInVault: "yes", extra: 1 },
		});
		assert.deepStrictEqual(odd.webExport, {});

		// Which services the settings page stopped offering to set up.
		store.setWebExport({ offered: ["quartz", "publish"] });
		assert.deepStrictEqual(new DeviceLocalStore(app).webExport, { offered: ["quartz", "publish"] });
		const oddOffer = fresh({ v: 3, initialized: true, welcomeSeen: true, webExport: { offered: ["garden", 4] } });
		assert.deepStrictEqual(oddOffer.webExport, { offered: ["garden"] });
		assert.deepStrictEqual(fresh({ v: 3, initialized: true, welcomeSeen: true, webExport: [] }).webExport, {});
	});
	// Which website files this device answers for decides what it may replace
	// by itself (`manager/web/fileMemory.ts`), so losing it — or having the
	// page's own memory written over it — would leave a site's files behind.
	it("remembers the website files it answers for, apart from the page's memory", () => {
		const hash = (digit: string): string => digit.repeat(64);
		const store = fresh();
		assert.strictEqual(store.webFile("publish.js"), undefined);
		store.setWebFile("publish.js", hash("a"));
		store.setWebFile("garden", hash("b"));
		// The page writes its memory whole, from a copy it took when it opened.
		store.setWebExport({ service: "quartz" });
		const restored = new DeviceLocalStore(app);
		assert.strictEqual(restored.webFile("publish.js"), hash("a"));
		assert.strictEqual(restored.webFile("garden"), hash("b"));
		assert.deepStrictEqual(restored.webExport, { service: "quartz" });

		// The same answer is not a write.
		const before = storage.writes();
		restored.setWebFile("publish.js", hash("a"));
		assert.strictEqual(storage.writes(), before);

		// Only names and SHA-256 hashes are read back, and no inherited name answers.
		const odd = fresh({
			v: 3,
			initialized: true,
			welcomeSeen: true,
			webFiles: { "publish.js": hash("c"), short: "abc", number: 7, [`${"n".repeat(65)}`]: hash("d") },
		});
		assert.strictEqual(odd.webFile("publish.js"), hash("c"));
		assert.strictEqual(odd.webFile("short"), undefined);
		assert.strictEqual(odd.webFile("number"), undefined);
		assert.strictEqual(odd.webFile("toString"), undefined);
		assert.strictEqual(
			fresh({ v: 3, initialized: true, welcomeSeen: true, webFiles: [] }).webFile("publish.js"),
			undefined,
		);

		// A list that cannot grow without end: the oldest name goes first.
		const many = fresh();
		for (let i = 0; i < 30; i++) many.setWebFile(`file-${i}`, hash("e"));
		assert.strictEqual(many.webFile("file-0"), undefined);
		assert.strictEqual(many.webFile("file-29"), hash("e"));
		assert.strictEqual(
			Object.keys((JSON.parse(storage.map.get(KEY)!) as { webFiles: object }).webFiles).length,
			24,
		);
	});
	it("keeps the website files it answers for through the session where storage refuses the write", () => {
		const store = fresh();
		storage.failWrites(true);
		try {
			store.setWebFile("publish.js", "f".repeat(64));
			assert.strictEqual(store.webFile("publish.js"), "f".repeat(64));
		} finally {
			storage.failWrites(false);
		}
	});
	// The old settings page remembered which of its sections were folded; the
	// page is gone, and so is the memory, from the stored blob too.
	it("drops the old settings page's folded sections when it loads", () => {
		fresh({ v: 3, initialized: true, welcomeSeen: true, listsExpanded: { user: false } });
		const saved = JSON.parse(storage.map.get(KEY)!) as Record<string, unknown>;
		assert.strictEqual("listsExpanded" in saved, false);
		assert.strictEqual(saved.initialized, true);
	});
	it("remembers the welcome separately without marking the installation initialized", () => {
		const store = fresh();
		store.markWelcomeSeen();
		assert.strictEqual(store.hasSeenWelcome, true);
		assert.strictEqual(store.hasInitialized, false);
		const restored = new DeviceLocalStore(app);
		assert.strictEqual(restored.hasSeenWelcome, true);
		assert.strictEqual(restored.hasInitialized, false);
	});
	it("does not mistake older local-state blobs for a completed welcome", () => {
		const store = fresh({ v: 2, initialized: true, listsExpanded: { user: false } });
		assert.strictEqual(store.hasSeenWelcome, false);
		assert.strictEqual(store.hasInitialized, true);
	});
	it("tolerates corrupt and unavailable storage", () => {
		assert.doesNotThrow(() => fresh("broken"));
		storage.failReads(true);
		assert.doesNotThrow(() => new DeviceLocalStore(app));
		storage.failReads(false);
	});
	it("retries refused writes", () => {
		const store = fresh();
		storage.failWrites(true);
		store.markInitialized();
		assert.strictEqual(storage.map.has(KEY), false);
		storage.failWrites(false);
		store.markInitialized();
		assert.ok(storage.map.has(KEY));
	});
	it("does not rewrite identical state", () => {
		const store = fresh();
		store.markInitialized();
		const before = storage.writes();
		store.markInitialized();
		assert.strictEqual(storage.writes(), before);
	});
});

describe("Find callouts onboarding marker", () => {
	it("survives a new store without marking settings initialized or the welcome seen", () => {
		const store = fresh();
		assert.strictEqual(store.markOccurrencesTabOffered(), true);
		assert.strictEqual(store.hasOfferedOccurrencesTab, true);
		const restored = new DeviceLocalStore(app);
		assert.strictEqual(restored.hasOfferedOccurrencesTab, true);
		assert.strictEqual(restored.hasInitialized, false);
		assert.strictEqual(restored.hasSeenWelcome, false);
	});
	it("accepts only a literal true marker from storage", () => {
		for (const value of [undefined, false, 1, "true", {}, []]) {
			const store = fresh({ v: 3, occurrencesTabOffered: value });
			assert.strictEqual(store.hasOfferedOccurrencesTab, false);
			assert.strictEqual(
				(JSON.parse(storage.map.get(KEY)!) as Record<string, unknown>).occurrencesTabOffered,
				undefined,
			);
		}
		assert.strictEqual(fresh({ v: 3, occurrencesTabOffered: true }).hasOfferedOccurrencesTab, true);
	});
	it("keeps the marker within the app id's device-local vault storage", () => {
		fresh();
		const firstApp = { appId: "first-vault-id", vault: { getName: () => "same-name" } } as unknown as App;
		const secondApp = { appId: "second-vault-id", vault: { getName: () => "same-name" } } as unknown as App;
		assert.strictEqual(new DeviceLocalStore(firstApp).markOccurrencesTabOffered(), true);
		assert.strictEqual(new DeviceLocalStore(firstApp).hasOfferedOccurrencesTab, true);
		assert.strictEqual(new DeviceLocalStore(secondApp).hasOfferedOccurrencesTab, false);
		assert.strictEqual(new DeviceLocalStore(app).hasOfferedOccurrencesTab, false);
		assert.strictEqual(storage.map.has("first-vault-id-callout-studio-local"), true);
		// Another device has its own local storage even for the same app id.
		storage.map.clear();
		assert.strictEqual(new DeviceLocalStore(firstApp).hasOfferedOccurrencesTab, false);
	});
	it("reports refused writes and can retry the same in-memory marker", () => {
		const store = fresh();
		storage.failWrites(true);
		assert.strictEqual(store.markOccurrencesTabOffered(), false);
		assert.strictEqual(store.hasOfferedOccurrencesTab, true);
		assert.strictEqual(new DeviceLocalStore(app).hasOfferedOccurrencesTab, false);
		storage.failWrites(false);
		assert.strictEqual(store.markOccurrencesTabOffered(), true);
		assert.strictEqual(new DeviceLocalStore(app).hasOfferedOccurrencesTab, true);
		const before = storage.writes();
		storage.failWrites(true);
		assert.strictEqual(store.markOccurrencesTabOffered(), true);
		assert.strictEqual(storage.writes(), before);
		storage.failWrites(false);
	});
	it("does not report a durable marker when local storage must be preserved", () => {
		for (const seed of ["broken", { v: 99 }, { v: 1, discovered: ["old"] }]) {
			const store = fresh(seed);
			const original = storage.map.get(KEY);
			assert.strictEqual(store.markOccurrencesTabOffered(), false);
			assert.strictEqual(store.hasOfferedOccurrencesTab, true);
			assert.strictEqual(storage.map.get(KEY), original);
		}
		fresh();
		storage.failReads(true);
		const unreadable = new DeviceLocalStore(app);
		assert.strictEqual(unreadable.markOccurrencesTabOffered(), false);
		storage.failReads(false);
		assert.strictEqual(storage.map.has(KEY), false);
	});
});
