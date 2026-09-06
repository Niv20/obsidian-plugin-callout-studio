import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { readSettingsFile, type SettingsFileHost } from "../src/manager/settingsFile";
import { readSettledSettingsFile } from "../src/manager/settingsSettledRead";

function source(samples: unknown[], present = true) {
	let reads = 0;
	const host: SettingsFileHost = {
		app: { vault: { configDir: ".obsidian", adapter: {
			exists: () => Promise.resolve(present),
		} } } as unknown as App,
		manifest: { id: "callout-studio" } as PluginManifest,
		loadData: () => Promise.resolve(samples[Math.min(reads++, samples.length - 1)]),
	};
	return { host, reads: () => reads };
}

const wait = () => Promise.resolve();

describe("settings content settling", () => {
	it("waits for two matching reads after an incomplete but valid snapshot", async () => {
		const complete = { settings: { fallbackCalloutId: "warning" }, callouts: [] };
		const s = source([{}, complete, complete]);
		const result = await readSettledSettingsFile(s.host, { wait });
		assert.equal(result.kind, "loaded");
		assert.deepEqual(result.kind === "loaded" && result.data, complete);
		assert.equal(s.reads(), 3);
	});

	it("recovers from a transient parse failure without adopting it", async () => {
		const complete = { callouts: [] };
		const s = source([undefined, complete, complete]);
		const result = await readSettledSettingsFile(s.host, { wait });
		assert.equal(result.kind, "loaded");
		assert.equal(s.reads(), 3);
	});

	it("does not accept a file that keeps changing within the bounded window", async () => {
		const s = source([1, 2, 3, 4].map(revision => ({ futureRevision: revision })));
		assert.equal((await readSettledSettingsFile(s.host, { wait })).kind, "unreadable");
		assert.equal(s.reads(), 4);
	});

	it("never treats repeated unreadable content as a stable baseline", async () => {
		const s = source([undefined]);
		assert.equal((await readSettledSettingsFile(s.host, { wait })).kind, "unreadable");
		assert.equal(s.reads(), 4);
	});

	it("compares content, including unknown keys, without depending on metadata", async () => {
		const s = source([
			JSON.parse('{"__proto__":{"revision":1},"callouts":[]}') as unknown,
			JSON.parse('{"__proto__":{"revision":2},"callouts":[]}') as unknown,
			JSON.parse('{"callouts":[],"__proto__":{"revision":2}}') as unknown,
		]);
		assert.equal((await readSettledSettingsFile(s.host, { wait })).kind, "loaded");
		assert.equal(s.reads(), 3, "key reordering agrees, changed key values do not");
	});

	it("confirms absence without treating a later arrival as a fresh install", async () => {
		const missing = source([null], false);
		assert.equal((await readSettledSettingsFile(missing.host, { wait })).kind, "absent");
		assert.equal(missing.reads(), 2);
		const arriving = source([null, {}, {}], false);
		assert.equal((await readSettledSettingsFile(arriving.host, { wait })).kind, "loaded");
		assert.equal(arriving.reads(), 3);
	});

	it("reuses the initial observation and stops before another read after unload", async () => {
		const s = source([{}]);
		let cancelled = false;
		const result = await readSettledSettingsFile(s.host, {
			initial: { kind: "loaded", data: {}, json: "{}" },
			isCancelled: () => cancelled,
			wait: () => { cancelled = true; return Promise.resolve(); },
		});
		assert.equal(result.kind, "unreadable");
		assert.equal(s.reads(), 0);
	});

	for (const initial of [{}, undefined]) {
		it(`retains evidence of ${initial === undefined ? "unreadable" : "loaded"} data when sync removes the file`, async () => {
			const s = source([null], false);
			const first = initial === undefined
				? { kind: "unreadable" as const }
				: { kind: "loaded" as const, data: initial, json: "{}" };
			assert.equal((await readSettledSettingsFile(s.host, { initial: first, wait })).kind, "unreadable");
			assert.equal(s.reads(), 3);
		});
	}

	for (const raw of [[], 3, "invalid", false]) {
		it(`keeps observed invalid JSON protected if the file then disappears: ${JSON.stringify(raw)}`, async () => {
			const s = source([raw], false);
			assert.equal((await readSettingsFile(s.host)).kind, "unreadable");
		});
	}
});
