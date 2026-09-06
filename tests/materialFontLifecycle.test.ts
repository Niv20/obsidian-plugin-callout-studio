import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { installFakeDom, FakeDocument } from "./support/fakeDom";
import { clearMaterialFontStore, materialFontStore, setMaterialFontStore } from "../src/icons/materialFontStore";
import { ensureMaterialFontLoaded, isMaterialFontReady, resetMaterialFontLoader, startMaterialFontLoader, stopMaterialFontLoader } from "../src/icons/packs/materialFont";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const bytes = new Uint8Array([0x77, 0x4f, 0x46, 0x32]).buffer;
const family = "Material Symbols Outlined";
const globals = globalThis as { FontFace?: unknown; __CS_REQUEST_URL__?: (url: string) => Promise<{ text: string; arrayBuffer: ArrayBuffer }> };
const originalFontFace = globals.FontFace;
let dom: ReturnType<typeof installFakeDom>;
let loadFace: () => Promise<void>;
let constructed: TestFontFace[];
let fonts: Set<TestFontFace> & { load: () => Promise<TestFontFace[]> };
let store: NonNullable<ReturnType<typeof materialFontStore>>;
let writes: ArrayBuffer[];

class TestFontFace {
	status = "unloaded";
	constructor(readonly family: string) { constructed.push(this); }
	async load(): Promise<this> { await loadFace(); this.status = "loaded"; return this; }
}
function setFonts(doc: FakeDocument) {
	const set = Object.assign(new Set<TestFontFace>(), { load: mock.fn(async (): Promise<TestFontFace[]> => []) });
	Object.defineProperty(doc, "fonts", { value: set, configurable: true });
	return set;
}
function links(): HTMLLinkElement[] { return dom.document.head.querySelectorAll("link") as unknown as HTMLLinkElement[]; }
function loadLink(link: HTMLLinkElement): void { link.onload?.call(link, new Event("load")); }
async function loadFromNetwork() {
	const pending = ensureMaterialFontLoaded("outlined");
	await tick();
	const link = links()[0];
	assert.ok(link);
	const face = new TestFontFace(family);
	face.status = "loaded";
	fonts.add(face);
	loadLink(link);
	assert.equal(await pending, "ready");
	await tick();
	return link;
}

beforeEach(() => {
	dom = installFakeDom();
	loadFace = async () => {};
	constructed = [];
	writes = [];
	globals.FontFace = TestFontFace;
	delete globals.__CS_REQUEST_URL__;
	fonts = setFonts(dom.document);
	setMaterialFontStore({ vault: { adapter: {}, configDir: ".obsidian" } } as unknown as App, { id: "callout-studio" } as PluginManifest);
	store = materialFontStore()!;
	mock.method(store, "read", async () => null);
	mock.method(store, "has", async () => false);
	mock.method(store, "write", async (_family: string, data: ArrayBuffer) => { writes.push(data); });
	startMaterialFontLoader();
});
afterEach(() => {
	stopMaterialFontLoader();
	clearMaterialFontStore();
	mock.restoreAll();
	delete globals.__CS_REQUEST_URL__;
	globals.FontFace = originalFontFace;
	dom.restore();
});

describe("Material font loader lifetime", () => {
	it("stops a pending cache read without creating a face or starting a link", async () => {
		const read = deferred<ArrayBuffer | null>();
		mock.method(store, "read", () => read.promise);
		const pending = ensureMaterialFontLoaded("outlined");
		stopMaterialFontLoader();
		assert.equal(await pending, "failed");
		read.resolve(bytes);
		await tick();
		assert.equal(constructed.length, 0);
		assert.equal(links().length, 0);
		assert.equal(await ensureMaterialFontLoaded("outlined"), "failed");
	});

	it("does not register a FontFace whose load finishes after disable", async () => {
		const face = deferred<void>();
		loadFace = () => face.promise;
		mock.method(store, "read", async () => bytes);
		const pending = ensureMaterialFontLoaded("outlined");
		await tick();
		assert.equal(constructed.length, 1);
		stopMaterialFontLoader();
		assert.equal(await pending, "failed");
		face.resolve();
		await tick();
		assert.equal(fonts.size, 0);
		assert.equal(links().length, 0);
	});

	it("removes owned cached faces from every document and preserves unrelated ones", async () => {
		mock.method(store, "read", async () => bytes);
		const other = new TestFontFace("Another Plugin Font");
		other.status = "loaded";
		fonts.add(other);
		const popout = new FakeDocument();
		const popoutFonts = setFonts(popout);
		assert.equal(await ensureMaterialFontLoaded("outlined"), "ready");
		assert.equal(await ensureMaterialFontLoaded("rounded", { doc: popout as unknown as Document }), "ready");
		stopMaterialFontLoader();
		assert.deepEqual([...fonts], [other]);
		assert.equal(popoutFonts.size, 0);
		assert.equal(isMaterialFontReady("outlined"), false);
	});

	it("clears pending link timers and ignores a queued old onload callback", async () => {
		const verify = mock.fn(async (): Promise<TestFontFace[]> => []);
		fonts.load = verify;
		const pending = ensureMaterialFontLoaded("outlined");
		await tick();
		const link = links()[0]!;
		const delayed = link.onload!;
		assert.equal(dom.window.pendingTimers(), 1);
		stopMaterialFontLoader();
		assert.equal(await pending, "failed");
		assert.equal(link.onload, null);
		assert.equal(link.onerror, null);
		assert.equal(links().length, 0);
		assert.equal(dom.window.pendingTimers(), 0);
		delayed.call(link, new Event("load"));
		assert.equal(verify.mock.callCount(), 0);
	});

	it("ignores font verification that completes after disable", async () => {
		const verification = deferred<TestFontFace[]>();
		fonts.load = () => verification.promise;
		const pending = ensureMaterialFontLoaded("outlined");
		await tick();
		loadLink(links()[0]!);
		stopMaterialFontLoader();
		assert.equal(await pending, "failed");
		verification.resolve([]);
		await tick();
		assert.equal(links().length, 0);
		assert.equal(writes.length, 0);
	});

	it("removes a loaded stylesheet and cancels the CORS cache reader", async () => {
		await loadFromNetwork();
		const reader = links().find(link => link.media === "not all")!;
		assert.ok(reader);
		const delayed = reader.onload!;
		let requests = 0;
		globals.__CS_REQUEST_URL__ = async () => { requests++; return { text: "", arrayBuffer: bytes }; };
		stopMaterialFontLoader();
		delayed.call(reader, new Event("load"));
		await tick();
		assert.equal(links().length, 0);
		assert.equal(dom.window.pendingTimers(), 0);
		assert.equal(requests, 0);
	});

	it("does not persist a cache request that resolves after disable", async () => {
		const response = deferred<{ text: string; arrayBuffer: ArrayBuffer }>();
		const requested: string[] = [];
		globals.__CS_REQUEST_URL__ = url => { requested.push(url); return response.promise; };
		await loadFromNetwork();
		const reader = links().find(link => link.media === "not all")!;
		Object.defineProperty(reader, "sheet", { value: { cssRules: [{ cssText: "src:url(https://fonts.gstatic.com/font.woff2)" }] } });
		loadLink(reader);
		await tick();
		assert.deepEqual(requested, ["https://fonts.gstatic.com/font.woff2"]);
		stopMaterialFontLoader();
		response.resolve({ text: "", arrayBuffer: bytes });
		await tick();
		assert.equal(writes.length, 0);
	});

	it("does not create a cache-reader link after a delayed cache check finishes", async () => {
		const cached = deferred<boolean>();
		mock.method(store, "has", () => cached.promise);
		await loadFromNetwork();
		assert.equal(links().length, 1);
		stopMaterialFontLoader();
		cached.resolve(false);
		await tick();
		assert.equal(links().length, 0);
		assert.equal(dom.window.pendingTimers(), 0);
	});

	it("starts again without an old pending memo or failure cooldown", async () => {
		const old = ensureMaterialFontLoaded("outlined");
		await tick();
		stopMaterialFontLoader();
		assert.equal(await old, "failed");
		startMaterialFontLoader();
		const retry = ensureMaterialFontLoaded("outlined");
		await tick();
		assert.equal(links().length, 1);
		links()[0]!.onerror?.call(links()[0]!, new Event("error"));
		assert.equal(await retry, "failed");
		resetMaterialFontLoader();
		mock.method(store, "read", async () => bytes);
		assert.equal(await ensureMaterialFontLoaded("outlined"), "ready");
	});

	it("refuses bytes from a replaced store before registering a FontFace", async () => {
		const read = deferred<ArrayBuffer | null>();
		mock.method(store, "read", () => read.promise);
		const pending = ensureMaterialFontLoaded("outlined");
		clearMaterialFontStore();
		read.resolve(bytes);
		await tick();
		assert.equal(constructed.length, 0);
		stopMaterialFontLoader();
		assert.equal(await pending, "failed");
	});
});
