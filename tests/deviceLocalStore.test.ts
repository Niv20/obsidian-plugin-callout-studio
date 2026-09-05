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
  const store = fresh(); const before = storage.writes();
  assert.strictEqual(store.hasInitialized, false);
  assert.strictEqual(storage.writes(), before);
 });
 it("preserves legacy evidence until the verified archive and keeps section preferences", () => {
  const store = fresh({ v: 1, discovered: ["old"], firstRunCompleted: true,
   retiredThemeIds: ["retired"], listsExpanded: { user: false } });
  assert.strictEqual(store.hasInitialized, true);
  assert.strictEqual(store.isExpanded("user"), false);
  const saved = JSON.parse(storage.map.get(KEY)!) as Record<string, unknown>;
  assert.deepStrictEqual(saved.discovered, ["old"]);
  assert.strictEqual(saved.v, 1);
  store.markInitialized(); store.setExpanded("theme", false);
  assert.strictEqual((JSON.parse(storage.map.get(KEY)!) as { v: number }).v, 1);
 });
 it("persists only the installation marker and UI preferences", () => {
  const store = fresh(); store.markInitialized(); store.setExpanded("theme", false);
  const restored = new DeviceLocalStore(app);
  assert.strictEqual(restored.hasInitialized, true);
  assert.strictEqual(restored.isExpanded("theme"), false);
 });
 it("tolerates corrupt and unavailable storage", () => {
  assert.doesNotThrow(() => fresh("broken"));
  storage.failReads(true); assert.doesNotThrow(() => new DeviceLocalStore(app));
  storage.failReads(false);
 });
 it("retries refused writes", () => {
  const store = fresh(); storage.failWrites(true); store.markInitialized();
  assert.strictEqual(storage.map.has(KEY), false);
  storage.failWrites(false); store.markInitialized();
  assert.ok(storage.map.has(KEY));
 });
 it("does not rewrite identical state", () => {
  const store = fresh(); store.markInitialized(); const before = storage.writes();
  store.markInitialized(); store.setExpanded("theme", true);
  assert.strictEqual(storage.writes(), before);
 });
});
