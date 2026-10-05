import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { isUntouchedSettings, withoutIncidental } from "../src/manager/settingsGenesis";
import { setupDetails } from "../src/manager/setupDetails";
import type { PluginData } from "../src/types";
import { mergeSavedSettings } from "../src/utils/settingsMerge";
import { sanitizeImportedSettings } from "../src/utils/settingsValidator";

const KEY = "tutorial-vault-callout-studio-local";
const app = { vault: { getName: () => "tutorial-vault" } } as unknown as App;

function localStorage(seed?: unknown) {
	const values = new Map<string, string>();
	if (seed !== undefined) values.set(KEY, typeof seed === "string" ? seed : JSON.stringify(seed));
	let refused = false;
	let writes = 0;
	(globalThis as unknown as { window: unknown }).window = {
		localStorage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				if (refused) throw new Error("Storage unavailable");
				writes++;
				values.set(key, value);
			},
		},
	};
	return {
		values,
		failWrites: (value: boolean) => { refused = value; },
		writes: () => writes,
	};
}

describe("tutorial welcome device marker", () => {
	it("does not confuse the legacy welcome with the tutorial welcome", () => {
		localStorage({ v: 3, initialized: true, welcomeSeen: true });
		const store = new DeviceLocalStore(app);
		assert.equal(store.hasSeenWelcome, true);
		assert.equal(store.hasSeenTutorialWelcome, false);
		assert.equal(mergeSavedSettings({ welcomeSeen: true }).tutorialWelcomeSeen, false);
	});

	it("persists without creating prior-settings evidence or changing the local schema", () => {
		const storage = localStorage();
		const store = new DeviceLocalStore(app);
		assert.equal(store.hasSeenTutorialWelcome, false);
		assert.equal(storage.writes(), 0);
		assert.equal(store.markTutorialWelcomeSeen(), true);
		const restored = new DeviceLocalStore(app);
		assert.equal(restored.hasSeenTutorialWelcome, true);
		assert.equal(restored.hasInitialized, false);
		assert.equal(restored.hasSeenWelcome, false);
		const saved = JSON.parse(storage.values.get(KEY)!) as Record<string, unknown>;
		assert.equal(saved.v, 3);
		assert.equal(saved.tutorialWelcomeSeen, true);
		assert.equal(saved.initialized, false);
	});

	it("accepts only literal true in the current local schema", () => {
		for (const value of [undefined, null, false, 0, 1, "true", {}, []]) {
			const storage = localStorage({ v: 3, tutorialWelcomeSeen: value });
			assert.equal(new DeviceLocalStore(app).hasSeenTutorialWelcome, false);
			assert.equal((JSON.parse(storage.values.get(KEY)!) as Record<string, unknown>).tutorialWelcomeSeen, undefined);
		}
		for (const version of [1, 2]) {
			localStorage({ v: version, tutorialWelcomeSeen: true });
			assert.equal(new DeviceLocalStore(app).hasSeenTutorialWelcome, false);
		}
		localStorage({ v: 3, tutorialWelcomeSeen: true });
		assert.equal(new DeviceLocalStore(app).hasSeenTutorialWelcome, true);
	});

	it("reports refused writes and retries instead of claiming durability", () => {
		const storage = localStorage();
		const store = new DeviceLocalStore(app);
		storage.failWrites(true);
		assert.equal(store.markTutorialWelcomeSeen(), false);
		assert.equal(store.hasSeenTutorialWelcome, false);
		assert.equal(new DeviceLocalStore(app).hasSeenTutorialWelcome, false);
		storage.failWrites(false);
		store.setExpanded("theme", false);
		assert.equal(new DeviceLocalStore(app).hasSeenTutorialWelcome, false,
			"an unrelated successful write must not remember the skipped greeting");
		assert.equal(store.markTutorialWelcomeSeen(), true);
		assert.equal(new DeviceLocalStore(app).hasSeenTutorialWelcome, true);
		const before = storage.writes();
		assert.equal(store.markTutorialWelcomeSeen(), true);
		assert.equal(storage.writes(), before);
	});

	it("preserves an already seen greeting when a later write fails", () => {
		const storage = localStorage();
		const store = new DeviceLocalStore(app);
		assert.equal(store.markTutorialWelcomeSeen(), true);
		storage.failWrites(true);
		store.setExpanded("theme", false);
		assert.equal(store.markTutorialWelcomeSeen(), false);
		assert.equal(store.hasSeenTutorialWelcome, true);
		assert.equal(new DeviceLocalStore(app).hasSeenTutorialWelcome, true);
	});

	it("preserves unknown or unarchived storage instead of overwriting it", () => {
		for (const seed of ["broken", { v: 99 }, { v: 1, discovered: ["old"] }]) {
			const storage = localStorage(seed);
			const original = storage.values.get(KEY);
			assert.equal(new DeviceLocalStore(app).markTutorialWelcomeSeen(), false);
			assert.equal(storage.values.get(KEY), original);
		}
	});
});

describe("tutorial welcome synced marker", () => {
	it("defaults to unseen and accepts only booleans from saved or imported settings", () => {
		assert.equal(DEFAULT_SETTINGS.tutorialWelcomeSeen, false);
		for (const value of [undefined, null, false, 0, 1, "true", {}, []]) {
			assert.equal(sanitizeImportedSettings({ tutorialWelcomeSeen: value }).settings?.tutorialWelcomeSeen, false);
		}
		assert.equal(mergeSavedSettings({ tutorialWelcomeSeen: true }).tutorialWelcomeSeen, true);
		assert.equal(sanitizeImportedSettings({ tutorialWelcomeSeen: true }).settings?.tutorialWelcomeSeen, true);
	});

	it("survives the registry save and reload without deriving it from the legacy marker", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.settings.tutorialWelcomeSeen = true;
		const saved = registry.toSaveData();
		const restored = new CalloutRegistry();
		restored.load(JSON.parse(JSON.stringify(saved)) as PluginData);
		assert.equal(restored.settings.tutorialWelcomeSeen, true);
		assert.equal(restored.settings.welcomeSeen, false);
	});

	it("cannot make untouched defaults into authored settings", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const before = registry.toSaveData();
		registry.settings.tutorialWelcomeSeen = true;
		const after = registry.toSaveData();
		assert.equal(isUntouchedSettings(after), true);
		assert.deepEqual(withoutIncidental(after), withoutIncidental(before));
		assert.deepEqual(setupDetails({
			kind: "history", time: 123, path: null, historyHash: null, origin: "this-device", data: after,
		}, before).changes, []);
		registry.settings.fallbackCalloutId = "warning";
		assert.equal(isUntouchedSettings(registry.toSaveData()), false);
	});
});
