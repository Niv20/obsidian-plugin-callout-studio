import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { applySettingsRead } from "../src/manager/settingsAdopt";
import { trackExternalCssRetirement } from "../src/manager/externalCssRetirementNotice";
import { validateImportPayload } from "../src/utils/importValidator";
import { CURRENT_DATA_VERSION } from "../src/constants";
import { t } from "../src/i18n";
import type { PluginData } from "../src/types";
import { definition } from "./support/discoveryHarness";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();
const storage = new Map<string, string>();
let storageFailure: "read" | "write" | null = null;
Object.defineProperty(dom.window, "localStorage", { value: {
	getItem: (key: string) => {
		if (storageFailure === "read") throw new Error("device storage unavailable");
		return storage.get(key) ?? null;
	},
	setItem: (key: string, value: string) => {
		if (storageFailure === "write") throw new Error("device storage full");
		storage.set(key, value);
	},
} });
const notices: string[] = [];
Object.assign(globalThis, { __CS_NOTICES__: notices, __CS_ICON_IDS__: ["lucide-pencil", "pencil"] });
let nextDevice = 0;

function saved(flag: unknown = true, include = true): PluginData {
	const base = new CalloutRegistry(); base.load(null);
	const row = { ...definition({ aliases: ["quiet-alias"] }), ...(include ? { externalStyle: flag } : {}) };
	return { ...base.toSaveData(), callouts: [row] };
}

function device(data: PluginData, appId = `external-css-${nextDevice++}`) {
	notices.length = 0;
	const app = { appId, vault: { getName: () => appId } } as unknown as App;
	const registry = new CalloutRegistry();
	const localState = new DeviceLocalStore(app);
	const disk = { json: JSON.stringify(data), writes: 0, fail: false, wait: async () => {} };
	const writer = new SettingsWriter({
		mergeConcurrent: true,
		build: () => registry.toSaveData(),
		readCurrent: async () => disk.json,
		write: async value => {
			await disk.wait();
			if (disk.fail) throw new Error("write failed");
			disk.json = JSON.stringify(value); disk.writes++;
		},
	});
	const cleanups: Array<() => void> = [];
	const host = {
		app, manifest: { id: "callout-studio" } as PluginManifest,
		registry, localState, settingsWriter: writer,
		loadData: async () => JSON.parse(disk.json) as unknown,
		saveSettings: () => writer.save(),
		register: (cleanup: () => void) => { cleanups.push(cleanup); },
	};
	const ready = trackExternalCssRetirement(host);
	return { registry, localState, writer, disk, ready, appId,
		load: (raw: PluginData = data) => applySettingsRead(host, { kind: "loaded", data: raw, json: JSON.stringify(raw) }),
		destroy: () => { writer.destroy(); for (const cleanup of cleanups) cleanup(); },
	};
}

describe("retiring the saved personal CSS handoff", () => {
	it("preserves appearances and identities, without mutating the original snapshot", () => {
		const raw = saved();
		const before = structuredClone(raw);
		Object.freeze(raw.callouts[0]);
		const registry = new CalloutRegistry(); registry.load(raw);
		assert.deepEqual(raw, before);
		assert.deepEqual(registry.get("quiet"), definition({ aliases: ["quiet-alias"] }));
		assert.equal(registry.hasExternalCssRetirement, true);
		assert.equal(registry.needsSaveAfterLoad(), true);
		assert.ok(!JSON.stringify(registry.toSaveData()).includes("externalStyle"));
		assert.ok(!registry.exportToJSONv2().includes("externalStyle"));
		registry.load(registry.toSaveData());
		assert.equal(registry.needsSaveAfterLoad(), false);
		assert.equal(registry.hasExternalCssRetirement, false);
	});

	it("restores a built-in's pristine status when the flag was its only edit", () => {
		const registry = new CalloutRegistry(); registry.load(null);
		const oldNote = { ...registry.get("note")!, externalStyle: true };
		registry.load({ ...registry.toSaveData(), callouts: [oldNote] });
		assert.equal(registry.isBuiltInModified("note"), false);
		assert.deepEqual(registry.toSaveData().callouts, []);
		assert.equal(registry.hasExternalCssRetirement, true);
	});

	it("also retires flags arriving through add and update without marking them as an upgrade", () => {
		const registry = new CalloutRegistry(); registry.load(null);
		const old = { ...definition(), externalStyle: true };
		registry.add(old);
		registry.update("quiet", { ...old, displayName: "Changed" });
		assert.ok(!("externalStyle" in registry.get("quiet")!));
		assert.equal(old.externalStyle, true);
		assert.equal(registry.hasExternalCssRetirement, false);
	});

	it("accepts older backup fields silently, regardless of their retired value", async () => {
		const registry = new CalloutRegistry(); registry.load(null);
		for (const value of [true, false, "old-malformed-value", null]) {
			const result = await validateImportPayload(saved(value).callouts, registry);
			assert.equal(result.fatal, false);
			assert.deepEqual(result.issues, []);
			assert.equal(result.validDefs.length, 1);
			assert.ok(!("externalStyle" in result.validDefs[0]!));
		}
	});
});

describe("the affected-user upgrade notice", () => {
	it("waits for the held migration write and for the ready UI", async () => {
		const d = device(saved());
		let release!: () => void;
		let started!: () => void;
		const writing = new Promise<void>(resolve => { started = resolve; });
		d.disk.wait = () => { started(); return new Promise<void>(resolve => { release = resolve; }); };
		const loading = d.load(); await writing;
		assert.equal(d.localState.hasPendingExternalCssNotice, true);
		assert.deepEqual(notices, []);
		release(); await loading;
		assert.equal(d.localState.hasPendingExternalCssNotice, true);
		assert.deepEqual(notices, []);
		d.ready(); d.ready();
		assert.equal(notices.length, 1);
		assert.equal(d.disk.writes, 1);
		assert.equal(d.localState.hasPendingExternalCssNotice, false);
		d.destroy();
	});

	it("is silent for new and unaffected users, including false and malformed flags", async () => {
		for (const [flag, include] of [[false, false], [false, true], [null, true], ["true", true]] as const) {
			const d = device(saved(flag, include));
			d.ready(); await d.load();
			assert.deepEqual(notices, []);
			assert.equal(d.localState.hasPendingExternalCssNotice, false);
			const local = storage.get(`${d.appId}-callout-studio-local`);
			assert.ok(!local?.includes("externalCssRetirement"));
			d.destroy();
		}
	});

	it("does not announce a failed save, but announces one successful retry", async () => {
		const d = device(saved()); d.ready(); d.disk.fail = true;
		await assert.rejects(d.load());
		assert.deepEqual(notices, []);
		assert.equal(d.localState.hasPendingExternalCssNotice, true);
		d.disk.fail = false; await d.writer.save(); await d.writer.save();
		assert.equal(notices.length, 1);
		d.destroy();
	});

	it("never calls an obsolete write successful after an external file change", async () => {
		const original = saved(); const d = device(original); d.ready();
		d.disk.json = JSON.stringify(saved(false, false));
		await d.load(original);
		assert.equal(d.disk.writes, 0);
		assert.deepEqual(notices, []);
		d.destroy();
	});

	it("does not announce frozen or newer-version data", async () => {
		const old = device(saved()); old.writer.freeze(); old.ready(); await old.load();
		assert.equal(notices.length, 0); assert.equal(old.disk.writes, 0); old.destroy();
		const future = device({ ...saved(), version: CURRENT_DATA_VERSION + 1 });
		future.ready(); await future.load();
		assert.ok(!notices.includes(t("notice.externalCssRetired")));
		assert.equal(future.disk.writes, 0); future.destroy();
	});

	it("keeps affected-user evidence when another device finishes a blocked migration", async () => {
		const d = device(saved()); d.ready(); d.disk.fail = true;
		await assert.rejects(d.load());
		const clean = d.registry.toSaveData();
		d.disk.fail = false; d.disk.json = JSON.stringify(clean);
		await d.load(clean);
		assert.equal(notices.length, 1);
		assert.equal(d.disk.writes, 0);
		d.destroy();
	});

	it("persists a pending notice over a close between migration and UI readiness", async () => {
		const first = device(saved()); await first.load(); first.destroy();
		const next = device(JSON.parse(first.disk.json) as PluginData, first.appId);
		await next.load(); next.ready();
		assert.equal(notices.length, 1); next.destroy();
		const again = device(JSON.parse(next.disk.json) as PluginData, first.appId);
		await again.load(); again.ready();
		assert.deepEqual(notices, []); again.destroy();
	});

	it("does not repeat for a legacy snapshot restored after the first notice", async () => {
		const d = device(saved()); d.ready(); await d.load();
		assert.equal(notices.length, 1);
		d.disk.json = JSON.stringify(saved()); await d.load();
		assert.equal(notices.length, 1); d.destroy();
	});

	it("tolerates unavailable device storage without repeating or notifying unaffected users", async () => {
		for (const failure of ["read", "write"] as const) {
			for (const affected of [false, true]) {
				storageFailure = failure;
				const d = device(saved(affected, affected));
				try {
					d.ready(); await d.load(); d.ready(); await d.writer.save();
					assert.equal(notices.length, affected ? 1 : 0);
					assert.equal(d.localState.hasPendingExternalCssNotice, false);
					const persisted = JSON.parse(d.disk.json) as PluginData;
					assert.ok(persisted.callouts.every(row => !("externalStyle" in row)));
				} finally {
					d.destroy(); storageFailure = null;
				}
			}
		}
	});

	it("cannot notify after unload, including a late successful write", async () => {
		const d = device(saved());
		let release!: () => void;
		let started!: () => void;
		const writing = new Promise<void>(resolve => { started = resolve; });
		d.disk.wait = () => { started(); return new Promise<void>(resolve => { release = resolve; }); };
		const pending = d.load(); await writing; d.destroy(); release(); await pending;
		d.ready(); assert.deepEqual(notices, []);
		const reopened = device(JSON.parse(d.disk.json) as PluginData, d.appId);
		await reopened.load(); reopened.ready();
		assert.equal(notices.length, 1); reopened.destroy();
	});
});
