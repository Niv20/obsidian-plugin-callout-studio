import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { setTimeout as startTimer, clearTimeout as stopTimer } from "node:timers";
import type { App, PluginManifest } from "obsidian";
import { PackDataStore } from "../src/icons/PackDataStore";
import { IconService } from "../src/icons/IconService";
import { IconFetchManager } from "../src/icons/IconFetchManager";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { CSSInjector } from "../src/manager/CSSInjector";
import { isPackLoaded } from "../src/icons/packData";
import type { IconPackId } from "../src/types";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

const artwork = (id: IconPackId) => readFileSync(`packs/${id}.json`, "utf8");
const manifest = { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" } as PluginManifest;

function harness() {
	const calls = { reads: 0, writes: 0, mkdirs: 0, injects: 0, saves: 0, notifications: 0 };
	const adapter = {
		exists: (_path: string): Promise<boolean> => Promise.resolve(false),
		read: (_path: string): Promise<string> => { calls.reads++; return Promise.resolve(""); },
		write: (_path: string, _text: string): Promise<void> => { calls.writes++; return Promise.resolve(); },
		mkdir: (_path: string): Promise<void> => { calls.mkdirs++; return Promise.resolve(); },
	};
	const app = { vault: { adapter, configDir: ".obsidian" } } as unknown as App;
	const registry = new CalloutRegistry();
	registry.load(null);
	const host = {
		app, manifest, registry,
		cssInjector: { inject: () => { calls.injects++; } } as unknown as CSSInjector,
		saveSettings: async () => { calls.saves++; },
	};
	return { app, adapter, calls, registry, host };
}

async function globals(body: (notices: string[], timers: Map<ReturnType<typeof startTimer>, number>) => Promise<void>) {
	const g = globalThis as unknown as Record<string, unknown>;
	const previous = { window: g.window, request: g.__CS_REQUEST_URL__, notices: g.__CS_NOTICES__ };
	const timers = new Map<ReturnType<typeof startTimer>, number>();
	const notices: string[] = [];
	g.window = {
		setTimeout: (callback: () => void, ms: number) => {
			const id = startTimer(callback, ms); timers.set(id, ms); return id;
		},
		clearTimeout: (id: ReturnType<typeof startTimer>) => { timers.delete(id); stopTimer(id); },
	};
	g.__CS_NOTICES__ = notices;
	try { await body(notices, timers); }
	finally {
		for (const id of timers.keys()) stopTimer(id);
		g.window = previous.window; g.__CS_REQUEST_URL__ = previous.request; g.__CS_NOTICES__ = previous.notices;
	}
}

function serve(request: () => Promise<{ text: string }>): void {
	(globalThis as unknown as Record<string, unknown>).__CS_REQUEST_URL__ = request;
}

describe("icon work has a terminal lifecycle", () => {
	it("does not continue a disk existence check after destruction", async () => {
		const h = harness(); const gate = deferred<boolean>();
		h.adapter.exists = () => gate.promise;
		const store = new PackDataStore(h.app, manifest);
		const pending = store.loadFromDisk("octicons");
		store.destroy(); gate.resolve(true);
		assert.equal(await pending, "missing");
		assert.equal(h.calls.reads, 0);
		assert.equal(isPackLoaded("octicons"), false);
		assert.equal(await store.download("octicons"), false);
	});

	it("does not publish a delayed verified file into the shared pack store", async () => {
		const h = harness(); const read = deferred<string>(); const started = deferred<void>();
		h.adapter.exists = async () => true;
		h.adapter.read = () => { started.resolve(); return read.promise; };
		const store = new PackDataStore(h.app, manifest);
		const pending = store.loadFromDisk("fa-brands");
		await started.promise; store.destroy(); read.resolve(artwork("fa-brands"));
		assert.equal(await pending, "missing");
		assert.equal(isPackLoaded("fa-brands"), false);
	});

	it("cancels a pending pack request and its deadline without late effects", async () => globals(async (notices, timers) => {
		const h = harness(); const response = deferred<{ text: string }>(); let requests = 0;
		serve(() => { requests++; return response.promise; });
		const store = new PackDataStore(h.app, manifest);
		store.onChange(() => { h.calls.notifications++; });
		const pending = store.download("fa-regular");
		const before = h.calls.notifications;
		store.destroy();
		assert.equal(await pending, false);
		assert.equal(timers.size, 0);
		response.resolve({ text: artwork("fa-regular") });
		await Promise.resolve();
		assert.equal(isPackLoaded("fa-regular"), false);
		assert.equal(h.calls.writes, 0); assert.equal(h.calls.notifications, before);
		assert.equal(requests, 1); assert.deepEqual(notices, []);
	}));

	it("does not start a cache write after a delayed directory check", async () => globals(async (notices) => {
		const h = harness(); const gate = deferred<boolean>(); const started = deferred<void>();
		serve(async () => ({ text: artwork("rpg-awesome") }));
		h.adapter.exists = () => { started.resolve(); return gate.promise; };
		const store = new PackDataStore(h.app, manifest);
		const pending = store.download("rpg-awesome");
		await started.promise; store.destroy(); gate.resolve(false);
		assert.equal(await pending, false);
		assert.equal(h.calls.mkdirs, 0); assert.equal(h.calls.writes, 0);
		assert.equal(store.state("rpg-awesome"), "unavailable");
		assert.deepEqual(notices, []);
	}));

	it("still verifies and persists a live download normally", async () => globals(async () => {
		const h = harness();
		serve(async () => ({ text: artwork("tabler-filled") }));
		const store = new PackDataStore(h.app, manifest);
		assert.equal(await store.download("tabler-filled"), true);
		assert.equal(h.calls.writes, 1); assert.equal(h.calls.mkdirs, 1);
		assert.equal(store.state("tabler-filled"), "ready");
	}));

	it("does not reinject or start repair after startup is destroyed during disk work", async () => {
		const h = harness(); const gate = deferred<boolean>();
		h.adapter.exists = () => gate.promise;
		h.registry.add({ ...h.registry.get("note")!, id: "audit", builtIn: false, source: "user", icon: { type: "octicons", value: "alert" } });
		const service = new IconService(h.host);
		const pending = service.initialize();
		service.destroy(); gate.resolve(true); await pending;
		await service.ensureArtwork({ type: "material", value: "home" });
		await service.ensureArtworkFor([{ type: "octicons", value: "alert" }]);
		assert.equal(h.calls.injects, 0); assert.equal(h.calls.saves, 0); assert.equal(h.calls.reads, 0);
		assert.equal(service.resolveSvg({ type: "octicons", value: "alert" }, "regular"), null);
	});

	it("does not notify or announce after an already-started save finishes", async () => {
		const h = harness(); const save = deferred<void>(); const started = deferred<void>();
		h.host.saveSettings = () => { h.calls.saves++; started.resolve(); return save.promise; };
		const service = new IconService(h.host);
		service.onChange(() => { h.calls.notifications++; });
		const pending = service.ensureArtwork({ type: "tabler-filled", value: "circle" });
		await started.promise; service.destroy(); save.resolve(); await pending;
		assert.equal(h.calls.saves, 1); assert.equal(h.calls.injects, 1); assert.equal(h.calls.notifications, 0);
	});

	it("abandons a Material sweep without retries, failure state or a second request", async () => globals(async (notices, timers) => {
		const h = harness(); const response = deferred<{ text: string }>(); let requests = 0;
		serve(() => { requests++; return response.promise; });
		for (const name of ["home", "star"]) h.registry.add({ ...h.registry.get("note")!, id: `audit-${name}`, builtIn: false, source: "user", icon: { type: "material", value: name } });
		const fetch = new IconFetchManager(h.host);
		fetch.onChange(() => { h.calls.notifications++; });
		const pending = fetch.ensureAll(); fetch.destroy(); await pending;
		assert.equal(timers.size, 0, "Cancelled Material request retained its deadline");
		response.reject(new Error("Late connection failure")); await Promise.resolve();
		await fetch.cacheOne({ type: "material", value: "star" });
		assert.equal(requests, 1); assert.equal(fetch.hasFailed({ type: "material", value: "home" }), false);
		assert.equal(h.calls.injects, 0); assert.equal(h.calls.saves, 0); assert.equal(h.calls.notifications, 0);
		assert.deepEqual(notices, []);
	}));

	it("clears the Material retry delay on destroy", async () => globals(async (notices, timers) => {
		const h = harness(); const requested = deferred<void>(); let requests = 0;
		serve(() => { requests++; requested.resolve(); return Promise.reject(new Error("Offline")); });
		const fetch = new IconFetchManager(h.host);
		const pending = fetch.cacheOne({ type: "material", value: "home" });
		await requested.promise;
		await new Promise<void>(resolve => setImmediate(resolve));
		assert.deepEqual([...timers.values()], [2000], "Retry was not awaiting its delay");
		fetch.destroy(); await pending;
		assert.equal(timers.size, 0); assert.equal(requests, 1); assert.deepEqual(notices, []);
	}));
});
