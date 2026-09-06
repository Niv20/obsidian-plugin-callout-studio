import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { clearMaterialFontStore, materialFontStore, setMaterialFontStore } from "../src/icons/materialFontStore";

const family = "Material Symbols Outlined";
const validFont = Uint8Array.from([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]).buffer;

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(yes => { resolve = yes; });
	return { promise, resolve };
}

function harness() {
	const calls: string[] = [];
	const files = new Map<string, ArrayBuffer>();
	const adapter = {
		exists: (path: string) => { calls.push("exists"); return Promise.resolve(files.has(path)); },
		readBinary: (path: string) => { calls.push("read"); return Promise.resolve(files.get(path)!); },
		writeBinary: (path: string, bytes: ArrayBuffer) => { calls.push("write"); files.set(path, bytes); return Promise.resolve(); },
		mkdir: (_path: string) => { calls.push("mkdir"); return Promise.resolve(); },
		remove: (path: string) => { calls.push("remove"); files.delete(path); return Promise.resolve(); },
	};
	const app = { vault: { adapter, configDir: ".obsidian" } } as unknown as App;
	const manifest = { id: "callout-studio" } as PluginManifest;
	setMaterialFontStore(app, manifest);
	const store = materialFontStore()!;
	return { store, app, manifest, adapter, files, calls };
}

describe("MaterialFontStore lifecycle", () => {
	it("round-trips valid font bytes while active", async () => {
		const h = harness();
		assert.equal(await h.store.has(family), false);
		await h.store.write(family, validFont);
		assert.equal(await h.store.has(family), true);
		assert.deepEqual(await h.store.read(family), validFont);
		assert.equal(h.files.size, 1);
		clearMaterialFontStore();
	});

	it("still discards corrupt disk bytes and rejects invalid writes while active", async () => {
		const h = harness();
		await h.store.write(family, new ArrayBuffer(4));
		assert.deepEqual(h.calls, []);
		await h.store.write(family, validFont);
		const path = [...h.files.keys()][0]!;
		h.files.set(path, new ArrayBuffer(4));
		assert.equal(await h.store.read(family), null);
		assert.equal(h.files.size, 0);
		assert.equal(h.calls.at(-1), "remove");
		clearMaterialFontStore();
	});

	it("clearing invalidates a captured reference and stops the read following exists", async () => {
		const h = harness(), exists = deferred<boolean>();
		h.adapter.exists = () => { h.calls.push("exists"); return exists.promise; };
		const pending = h.store.read(family), pendingHas = h.store.has(family);
		clearMaterialFontStore();
		exists.resolve(true);
		assert.equal(await pending, null);
		assert.equal(await pendingHas, false);
		assert.equal(await h.store.read(family), null);
		assert.equal(await h.store.has(family), false);
		await h.store.write(family, validFont);
		assert.equal(materialFontStore(), null);
		assert.deepEqual(h.calls, ["exists", "exists"]);
	});

	it("does not remove a corrupt read completed after replacement", async () => {
		const h = harness(), read = deferred<ArrayBuffer>(), entered = deferred<void>();
		h.adapter.exists = () => Promise.resolve(true);
		h.adapter.readBinary = () => { h.calls.push("read"); entered.resolve(); return read.promise; };
		const pending = h.store.read(family);
		await entered.promise;
		setMaterialFontStore(h.app, h.manifest);
		read.resolve(new ArrayBuffer(4));
		assert.equal(await pending, null);
		assert.deepEqual(h.calls, ["read"]);
		await h.store.write(family, validFont);
		assert.deepEqual(h.calls, ["read"]);
		await materialFontStore()!.write(family, validFont);
		assert.deepEqual(h.calls, ["read", "write"]);
		clearMaterialFontStore();
	});

	for (const stage of ["exists", "mkdir"] as const) {
		it(`does not write after clear during ${stage}`, async () => {
			const h = harness(), entered = deferred<void>(), gate = deferred<void>();
			h.adapter.exists = async () => {
				h.calls.push("exists");
				if (stage === "exists") { entered.resolve(); await gate.promise; }
				return false;
			};
			h.adapter.mkdir = async () => { h.calls.push("mkdir"); entered.resolve(); await gate.promise; };
			const pending = h.store.write(family, validFont);
			await entered.promise;
			clearMaterialFontStore();
			gate.resolve();
			await pending;
			assert.equal(h.calls.includes("write"), false);
			assert.equal(h.calls.includes("mkdir"), stage === "mkdir");
		});
	}
});
