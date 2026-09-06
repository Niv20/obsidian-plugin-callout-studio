import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { LocaleStore } from "../src/i18n/LocaleStore";
import { registerLocaleFile, setLocale, t } from "../src/i18n";
import type { StubResponse } from "./support/obsidianStub";

const globals = globalThis as {
	window?: unknown;
	__CS_REQUEST_URL__?: (url: string) => Promise<StubResponse>;
	__CS_NOTICES__?: string[];
};
globals.window = globalThis;

function deferred<T>() {
	let resolve!: (value: T) => void, reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function harness() {
	const calls: string[] = [];
	const text = readFileSync("locales/fr.json", "utf8");
	const adapter = {
		exists: (_path: string) => { calls.push("exists"); return Promise.resolve(true); },
		read: (_path: string) => { calls.push("read"); return Promise.resolve(text); },
		mkdir: (_path: string) => { calls.push("mkdir"); return Promise.resolve(); },
		write: (_path: string, _text: string) => { calls.push("write"); return Promise.resolve(); },
	};
	globals.__CS_NOTICES__ = [];
	globals.__CS_REQUEST_URL__ = () => { calls.push("request"); return Promise.resolve({ text }); };
	const app = { vault: { adapter, configDir: ".obsidian" } } as unknown as App;
	const store = new LocaleStore(app, { id: "callout-studio", version: "2.13.1" } as PluginManifest);
	let notifications = 0;
	store.onChange(() => { notifications++; });
	return { store, adapter, calls, text, notifications: () => notifications };
}

describe("LocaleStore terminal lifecycle", () => {
	it("stops between exists and read, and refuses every new entry point after destruction", async () => {
		const h = harness(), exists = deferred<boolean>();
		h.adapter.exists = () => { h.calls.push("exists"); return exists.promise; };
		const pending = h.store.ensure("fr");
		h.store.destroy();
		h.store.destroy();
		exists.resolve(true);
		assert.equal(await pending, false);
		h.store.onChange(() => { throw new Error("listener retained after destroy"); });
		assert.equal(await h.store.ensure("en"), false);
		assert.equal(await h.store.download("fr"), false);
		assert.equal(await h.store.prepare("fr"), null);
		assert.equal(await h.store.loadFromDisk("fr"), "missing");
		assert.equal(h.store.isReady("en"), false);
		assert.equal(h.store.state("fr"), "absent");
		assert.deepEqual(h.calls, ["exists"]);
		assert.equal(h.notifications(), 0);
	});

	it("does not register a disk read that completes after destruction", async () => {
		const h = harness(), read = deferred<string>(), entered = deferred<void>();
		registerLocaleFile("fr", { audit: "before" });
		setLocale("fr");
		h.adapter.read = () => { entered.resolve(); return read.promise; };
		const pending = h.store.prepare("fr");
		await entered.promise;
		h.store.destroy();
		read.resolve(JSON.stringify({ format: 1, locale: "fr", strings: { audit: "after" } }));
		assert.equal(await pending, null);
		assert.equal(t("audit"), "before");
		assert.equal(h.notifications(), 0);
	});

	it("settles an unabortable request on destroy without accepting its late response or trying fallback", async () => {
		const h = harness(), response = deferred<StubResponse>();
		registerLocaleFile("fr", { audit: "before" });
		setLocale("fr");
		globals.__CS_REQUEST_URL__ = () => { h.calls.push("request"); return response.promise; };
		const pending = h.store.download("fr");
		assert.equal(h.store.state("fr"), "loading");
		h.store.destroy();
		assert.equal(await pending, false);
		response.resolve({ text: h.text });
		await response.promise;
		assert.equal(t("audit"), "before");
		assert.equal(h.store.state("fr"), "absent");
		assert.equal(h.notifications(), 1);
		assert.deepEqual(h.calls, ["request"]);
	});

	it("does not publish a locale when checksum verification completes after destroy", async () => {
		const h = harness(), entered = deferred<void>(), resume = deferred<void>();
		registerLocaleFile("fr", { audit: "before" });
		setLocale("fr");
		const descriptor = Object.getOwnPropertyDescriptor(crypto.subtle, "digest");
		const digest = crypto.subtle.digest.bind(crypto.subtle);
		Object.defineProperty(crypto.subtle, "digest", {
			configurable: true,
			value: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
				const result = await digest(algorithm, data);
				entered.resolve(); await resume.promise;
				return result;
			},
		});
		try {
			const pending = h.store.prepare("fr");
			await entered.promise;
			h.store.destroy();
			resume.resolve();
			assert.equal(await pending, null);
			assert.equal(t("audit"), "before");
			assert.equal(h.store.state("fr"), "absent");
			assert.equal(h.notifications(), 0);
		} finally {
			if (descriptor) Object.defineProperty(crypto.subtle, "digest", descriptor);
			else Reflect.deleteProperty(crypto.subtle, "digest");
		}
	});

	it("stops synchronously when a loading listener destroys the store", async () => {
		const h = harness();
		h.store.onChange(() => h.store.destroy());
		h.store.onChange(() => { throw new Error("late listener"); });
		assert.equal(await h.store.download("fr"), false);
		assert.deepEqual(h.calls, []);
		assert.equal(h.store.state("fr"), "absent");
	});

	for (const stage of ["exists", "mkdir"] as const) {
		it(`does not write after destruction during cache ${stage}`, async () => {
			const h = harness(), entered = deferred<void>(), gate = deferred<void>();
			h.adapter.exists = async () => {
				h.calls.push("exists");
				if (stage === "exists") { entered.resolve(); await gate.promise; }
				return false;
			};
			h.adapter.mkdir = async () => {
				h.calls.push("mkdir"); entered.resolve(); await gate.promise;
			};
			const pending = h.store.download("fr");
			await entered.promise;
			h.store.destroy();
			gate.resolve();
			assert.equal(await pending, false);
			assert.equal(h.calls.includes("write"), false);
			assert.equal(h.calls.includes("mkdir"), stage === "mkdir");
			assert.equal(h.notifications(), 1);
			assert.deepEqual(globals.__CS_NOTICES__, []);
		});
	}

	it("suppresses a delayed cache failure notice after destruction", async () => {
		const h = harness(), entered = deferred<void>(), write = deferred<void>();
		h.adapter.write = () => { entered.resolve(); return write.promise; };
		const pending = h.store.download("fr");
		await entered.promise;
		h.store.destroy();
		write.reject(new Error("late disk failure"));
		assert.equal(await pending, false);
		assert.deepEqual(globals.__CS_NOTICES__, []);
		assert.equal(h.notifications(), 1);
	});
});
