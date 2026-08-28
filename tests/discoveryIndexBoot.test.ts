/**
 * tests/discoveryIndexBoot.test.ts — putting the discovered rows back, and the
 * one-way migration that gets a vault there.
 *
 * Two things have to be true on the launch that upgrades a vault into this
 * version, and they pull in opposite directions: the settings file must stop
 * carrying rows nobody claimed, and **nothing may disappear from the settings
 * list while that happens**. The difference between those two is the difference
 * between a migration and a data loss, so the ids are adopted into the index
 * before the write-back drops them from the file.
 *
 * Afterwards the pass is a fixed point: a second launch reads the index, finds
 * the same rows, and asks for no further write.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { bootDiscoveryIndex } from "../src/manager/discoveryIndexBoot";
import type { CalloutDefinition, PluginData } from "../src/types";

const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
	localStorage: {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => {
			storage.set(key, value);
		},
	},
};

const app = { vault: { getName: () => "v" } } as unknown as App;

const row = (over: Partial<CalloutDefinition>): CalloutDefinition => ({
	id: "x",
	displayName: "X",
	icon: { type: "lucide", value: "star" },
	colorLight: "#111111",
	colorDark: "#eeeeee",
	foldable: true,
	defaultFolded: false,
	builtIn: false,
	source: "fallback",
	...over,
});

/** One launch: a fresh registry over `saved`, against the store as it stands. */
function launch(saved: Partial<PluginData> | null) {
	const registry = new CalloutRegistry();
	const store = new DeviceLocalStore(app);
	registry.load(saved);
	const result = bootDiscoveryIndex(registry, store, saved);
	return { registry, store, result };
}

function freshDevice(): void {
	storage.clear();
}

describe("bootDiscoveryIndex — migrating a vault over", () => {
	it("keeps a row the settings file still lists", () => {
		freshDevice();
		const { registry } = launch({ callouts: [row({ id: "seen" })] });
		assert.ok(registry.get("seen"), "nothing disappears from the list");
	});

	it("adopts its id into the index before the file drops it", () => {
		freshDevice();
		const { store } = launch({ callouts: [row({ id: "seen" })] });
		assert.deepStrictEqual([...store.discovered], ["seen"]);
	});

	it("asks for exactly one write-back, then never again", () => {
		freshDevice();
		const first = launch({ callouts: [row({ id: "seen" })] });
		assert.strictEqual(first.result.converged, true);

		// What that write-back puts on disk, read back on the next launch.
		const second = launch(first.registry.toSaveData());
		assert.strictEqual(second.result.converged, false);
		assert.ok(second.registry.get("seen"), "still there, from the index");
	});

	it("does not ask for a write-back when the file was already clean", () => {
		freshDevice();
		const { result } = launch({ callouts: [] });
		assert.strictEqual(result.converged, false);
	});

	it("carries a pre-move firstRunCompleted over, once", () => {
		freshDevice();
		const { store } = launch({
			callouts: [],
			settings: { firstRunCompleted: true },
		} as unknown as Partial<PluginData>);
		assert.strictEqual(store.firstRunCompleted, true);
	});
});

describe("bootDiscoveryIndex — restoring from the index", () => {
	it("rebuilds a row for every remembered id", () => {
		freshDevice();
		new DeviceLocalStore(app).remember(["alpha", "beta"]);

		const { registry, result } = launch(null);
		assert.strictEqual(result.restored, 2);
		assert.ok(registry.get("alpha"));
		assert.ok(registry.get("beta"));
	});

	it("gives the rebuilt row the fallback's CURRENT look", () => {
		// Not the look the fallback had when the id was first seen — the index
		// stores identity, never a style. This is what lets the user change the
		// fallback on one device without re-syncing every placeholder.
		freshDevice();
		new DeviceLocalStore(app).remember(["alpha"]);

		const { registry } = launch({
			callouts: [
				row({ id: "custom", source: "user", customized: true, colorLight: "#abcdef" }),
			],
			settings: { fallbackCalloutId: "custom" },
		} as unknown as Partial<PluginData>);

		assert.strictEqual(registry.get("alpha")?.colorLight, "#abcdef");
	});

	it("yields to an explicit configuration that owns the name", () => {
		// The settings file is authoritative; the index is a cache. Arrival
		// order must not decide which one wins.
		freshDevice();
		new DeviceLocalStore(app).remember(["alpha"]);

		const { registry, result } = launch({
			callouts: [row({ id: "alpha", source: "user", customized: true })],
		});
		assert.strictEqual(result.restored, 0);
		assert.strictEqual(registry.get("alpha")?.customized, true);
	});

	it("does not rebuild a row the active theme retired", () => {
		freshDevice();
		new DeviceLocalStore(app).remember(["recite"]);

		const { registry } = launch({
			callouts: [],
			settings: { retiredThemeIds: ["recite"] },
		} as unknown as Partial<PluginData>);
		assert.strictEqual(registry.get("recite"), undefined);
	});

	it("drops an id it could not rebuild, so it stops trying", () => {
		freshDevice();
		new DeviceLocalStore(app).remember(["alpha"]);

		const { store } = launch({
			callouts: [row({ id: "alpha", source: "user", customized: true })],
		});
		assert.deepStrictEqual([...store.discovered], []);
	});

	it("marks the device indexed even when it discovered nothing", () => {
		// "No index" asks for a scan; "an empty index" says this vault genuinely
		// uses no discovered callouts. Without the write, every launch of such a
		// vault would ask again.
		freshDevice();
		const { store } = launch(null);
		assert.strictEqual(store.hasIndex, true);
		assert.strictEqual(new DeviceLocalStore(app).hasIndex, true);
	});
});
