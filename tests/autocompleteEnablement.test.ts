import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { applySettingsRead } from "../src/manager/settingsAdopt";
import { trackAutocompleteEnablement } from "../src/manager/autocompleteEnablementNotice";
import { hasAutocompleteEnablement } from "../src/manager/autocompleteEnablementMigration";
import type { PluginData } from "../src/types";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();
const storage = new Map<string, string>();
Object.defineProperty(dom.window, "localStorage", {
	value: {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => {
			storage.set(key, value);
		},
	},
});
const notices: string[] = [];
Object.assign(globalThis, {
	__CS_NOTICES__: notices,
	__CS_ICON_IDS__: ["lucide-pencil", "pencil"],
});
let nextDevice = 0;

/** A current envelope carrying the legacy user-configurable value. */
function saved(enabled: unknown, include = true): PluginData {
	const base = new CalloutRegistry();
	base.load(null);
	const data = base.toSaveData() as unknown as {
		settings: Record<string, unknown>;
	};
	if (include) data.settings.autocomplete = { enabled };
	else delete data.settings.autocomplete;
	return data as unknown as PluginData;
}

function device(
	data: PluginData,
	appId = `autocomplete-enable-${nextDevice++}`,
) {
	notices.length = 0;
	const app = {
		appId,
		vault: { getName: () => appId },
	} as unknown as App;
	const registry = new CalloutRegistry();
	const localState = new DeviceLocalStore(app);
	const disk = {
		json: JSON.stringify(data),
		writes: 0,
		fail: false,
		wait: async () => {},
	};
	const writer = new SettingsWriter({
		mergeConcurrent: true,
		build: () => registry.toSaveData(),
		readCurrent: async () => disk.json,
		write: async (value) => {
			await disk.wait();
			if (disk.fail) throw new Error("write failed");
			disk.json = JSON.stringify(value);
			disk.writes++;
		},
	});
	const cleanups: Array<() => void> = [];
	const host = {
		app,
		manifest: { id: "callout-studio" } as PluginManifest,
		registry,
		localState,
		settingsWriter: writer,
		loadData: async () => JSON.parse(disk.json) as unknown,
		saveSettings: () => writer.save(),
		register: (cleanup: () => void) => {
			cleanups.push(cleanup);
		},
	};
	const ready = trackAutocompleteEnablement(host);
	return {
		registry,
		localState,
		writer,
		disk,
		ready,
		appId,
		load: (raw: PluginData = data) =>
			applySettingsRead(host, {
				kind: "loaded",
				data: raw,
				json: JSON.stringify(raw),
			}),
		destroy: () => {
			writer.destroy();
			for (const cleanup of cleanups) cleanup();
		},
	};
}

describe("the permanently enabled autocomplete migration", () => {
	it("forces an explicit saved false on and requests one migration save", () => {
		const raw = saved(false);
		const before = structuredClone(raw);
		const registry = new CalloutRegistry();
		registry.load(raw);

		assert.deepEqual(raw, before, "the read snapshot is not mutated");
		assert.equal(registry.settings.autocomplete.enabled, true);
		assert.equal(hasAutocompleteEnablement(registry), true);
		assert.equal(registry.needsSaveAfterLoad(), true);
		assert.equal(registry.needsSaveAfterLoad(), false, "the request is consumed");
		assert.equal(registry.toSaveData().settings.autocomplete.enabled, true);

		const settled = new CalloutRegistry();
		settled.load(registry.toSaveData());
		assert.equal(hasAutocompleteEnablement(settled), false);
		assert.equal(settled.needsSaveAfterLoad(), false);
	});

	it("only treats literal false as an affected-user opt-out", () => {
		for (const [value, include] of [
			[true, true],
			[null, true],
			["false", true],
			[undefined, false],
		] as const) {
			const registry = new CalloutRegistry();
			registry.load(saved(value, include));
			assert.equal(registry.settings.autocomplete.enabled, true);
			assert.equal(hasAutocompleteEnablement(registry), false);
			assert.equal(registry.needsSaveAfterLoad(), false);
		}
	});
});

describe("the affected-user autocomplete notice", () => {
	it("waits for both the migration write and UI readiness", async () => {
		const d = device(saved(false));
		let release!: () => void;
		let started!: () => void;
		const writing = new Promise<void>((resolve) => {
			started = resolve;
		});
		d.disk.wait = () => {
			started();
			return new Promise<void>((resolve) => {
				release = resolve;
			});
		};

		const loading = d.load();
		await writing;
		assert.equal(d.localState.hasPendingAutocompleteNotice, true);
		d.ready();
		assert.deepEqual(notices, [], "the old false is not durable yet");

		release();
		await loading;
		assert.deepEqual(notices, [
			"Autocomplete is now a core feature and is always enabled.",
		]);
		assert.equal(d.disk.writes, 1);
		assert.equal(
			(JSON.parse(d.disk.json) as PluginData).settings.autocomplete.enabled,
			true,
		);
		assert.equal(d.localState.hasPendingAutocompleteNotice, false);
		d.ready();
		assert.equal(notices.length, 1, "ready is idempotent");
		d.destroy();
	});

	it("is silent for absent, enabled and malformed legacy values", async () => {
		for (const [value, include] of [
			[true, true],
			[null, true],
			["false", true],
			[undefined, false],
		] as const) {
			const d = device(saved(value, include));
			d.ready();
			await d.load();
			assert.deepEqual(notices, []);
			assert.equal(d.localState.hasPendingAutocompleteNotice, false);
			const local = storage.get(`${d.appId}-callout-studio-local`);
			assert.ok(!local?.includes("autocompleteAlwaysEnabled"));
			d.destroy();
		}
	});

	it("repairs a legacy false arriving later without a mid-session notice", async () => {
		const d = device(saved(true));
		await d.load();
		d.ready();

		const late = saved(false);
		d.disk.json = JSON.stringify(late);
		await d.load(late);
		assert.deepEqual(notices, []);
		assert.equal(d.localState.hasPendingAutocompleteNotice, false);
		assert.equal(
			(JSON.parse(d.disk.json) as PluginData).settings.autocomplete.enabled,
			true,
		);
		d.destroy();
	});

	it("does not announce a failed save, then announces one successful retry", async () => {
		const d = device(saved(false));
		d.disk.fail = true;
		await assert.rejects(d.load());
		assert.deepEqual(notices, []);
		assert.equal(d.localState.hasPendingAutocompleteNotice, true);
		d.ready();

		d.disk.fail = false;
		await d.writer.save();
		await d.writer.save();
		assert.equal(notices.length, 1);
		d.destroy();
	});

	it("survives a close before readiness and never repeats", async () => {
		const first = device(saved(false));
		await first.load();
		assert.deepEqual(notices, []);
		first.destroy();

		const clean = JSON.parse(first.disk.json) as PluginData;
		const next = device(clean, first.appId);
		await next.load();
		next.ready();
		assert.equal(notices.length, 1);
		next.destroy();

		// Even an old synced snapshot cannot re-notify this device.
		const again = device(saved(false), first.appId);
		await again.load();
		again.ready();
		assert.deepEqual(notices, []);
		assert.equal(again.disk.writes, 1, "the reintroduced false is still repaired");
		again.destroy();
	});

	it("does not notify from a frozen settings session", async () => {
		const d = device(saved(false));
		d.writer.freeze();
		await d.load();
		d.ready();
		assert.deepEqual(notices, []);
		assert.equal(d.disk.writes, 0);
		d.destroy();
	});
});
