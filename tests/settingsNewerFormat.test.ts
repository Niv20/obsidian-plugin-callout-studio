/**
 * A settings file from a later build of this plugin.
 *
 * A later build may add a data version, retype a field, or move to a new sync
 * envelope. This build's shape gate cannot read such a file, and it used to
 * call it damaged: "unreadable", with advice to repair or restore it, when the
 * only right answer is to update the plugin on this device. The same went for
 * the device recovery copy, which froze saving as unreadable storage.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { readSettingsFile } from "../src/manager/settingsFile";
import { tryAdoptExternalSettings } from "../src/manager/settingsAdopt";
import { SettingsCheckpoint } from "../src/manager/settingsCheckpoint";
import { SettingsRecoveryService } from "../src/manager/settingsRecoveryService";
import { recoveryActionHarness } from "./support/recoveryActionHarness";

const LATER = { version: 99, callouts: "stored differently now", settings: [] };
const ENVELOPE_V3 = { version: 5, callouts: [], calloutStudioSync: { version: 3, clocks: {} } };
const DAMAGED = { version: 5, callouts: "not a list" };

function host(data: unknown) {
	const app = { vault: { configDir: ".obsidian", adapter: { exists: () => Promise.resolve(true) } } } as unknown as App;
	return { app, manifest: { id: "callout-studio" } as PluginManifest, loadData: () => Promise.resolve(data) };
}

describe("reading a later build's settings file", () => {
	it("marks a newer data version or sync envelope as newer, not damaged", async () => {
		assert.deepEqual(await readSettingsFile(host(LATER)), { kind: "unreadable", newer: true });
		assert.deepEqual(await readSettingsFile(host(ENVELOPE_V3)), { kind: "unreadable", newer: true });
	});

	it("still calls a damaged file of this build's own format unreadable", async () => {
		assert.deepEqual(await readSettingsFile(host(DAMAGED)), { kind: "unreadable" });
	});

	it("pauses saving for an update at launch, and writes nothing", async () => {
		const h = recoveryActionHarness();
		h.state.disk = JSON.stringify(LATER);
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "newer-version");
		await h.host.saveSettings();
		assert.equal(h.state.disk, JSON.stringify(LATER));
		h.host.settingsWriter.destroy();
	});

	it("pauses a running device when a later build's file arrives", async () => {
		const h = recoveryActionHarness();
		await h.boot();
		h.state.disk = JSON.stringify(ENVELOPE_V3);
		assert.equal(await tryAdoptExternalSettings(h.host), "unavailable");
		assert.equal(h.host.settingsWriter.status.frozenReason, "newer-version");
		h.host.settingsWriter.destroy();
	});

	it("keeps a later build's recovery copy protected, and shows built-ins rather than failing", async () => {
		const h = recoveryActionHarness({ missing: true, legacy: true });
		h.state.checkpoint = LATER;
		await h.boot();
		assert.equal(h.host.settingsWriter.status.frozenReason, "newer-version");
		assert.ok(h.host.registry.get("note"), "the built-ins are displayed");
		h.host.settingsWriter.destroy();
	});

	for (const [name, checkpoint] of [["data format", LATER], ["sync envelope", ENVELOPE_V3]] as const) {
		it(`protects a newer recovery ${name} when the primary is damaged`, async () => {
			const h = recoveryActionHarness();
			h.state.disk = "{ broken";
			h.state.checkpoint = checkpoint;
			await h.boot();
			try {
				assert.equal(h.host.settingsWriter.status.frozenReason, "newer-version");
				assert.equal(await new SettingsRecoveryService(h.host).replaceUnreadable(), false);
				assert.deepEqual(h.state.checkpoint, checkpoint);
				assert.equal(h.state.disk, "{ broken");
				assert.equal(h.state.writes, 0);
			} finally { h.host.settingsWriter.destroy(); }
		});
	}
});

describe("the recovery copy store", () => {
	function store(saved: unknown) {
		const previous = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
		const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
		const db = { close: () => {}, transaction: () => {
			const transaction = {} as IDBTransaction;
			const request = {} as IDBRequest;
			Object.defineProperty(request, "result", { value: saved });
			return Object.assign(transaction, { objectStore: () => ({ get: () => {
				queueMicrotask(() => {
					request.onsuccess?.call(request, new Event("success"));
					transaction.oncomplete?.call(transaction, new Event("complete"));
				});
				return request;
			} }) });
		} } as unknown as IDBDatabase;
		const open = {} as IDBOpenDBRequest;
		Object.defineProperty(open, "result", { value: db });
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open: (): IDBOpenDBRequest => {
			queueMicrotask(() => { open.onsuccess?.call(open, new Event("success")); });
			return open;
		} } });
		Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout: () => {} } });
		const app = { appId: "newer", vault: { configDir: ".obsidian", getName: () => "newer" } } as unknown as App;
		return { checkpoint: new SettingsCheckpoint(app, { id: "callout-studio" } as PluginManifest), restore: () => {
			if (previous) Object.defineProperty(globalThis, "indexedDB", previous); else Reflect.deleteProperty(globalThis, "indexedDB");
			if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
		} };
	}

	it("returns a later build's copy for its callers to protect, instead of calling it invalid", async () => {
		const s = store(LATER);
		try { assert.deepEqual(await s.checkpoint.read(), LATER); } finally { s.restore(); }
	});

	it("still rejects a damaged copy of this build's own format", async () => {
		const s = store(DAMAGED);
		try { await assert.rejects(s.checkpoint.read(), /invalid/); } finally { s.restore(); }
	});
});
