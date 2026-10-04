import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSettingsInto } from "../src/manager/settingsBoot";
import { createSettingsWriter } from "../src/manager/settingsWriterHost";
import { recoveryActionHarness } from "./support/recoveryActionHarness";

const DIR = ".obsidian/plugins/callout-studio/backups";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

function retainedSetup() {
	const h = recoveryActionHarness({ missing: true });
	h.host.localState.markInitialized();
	const state = { checkpointWrites: 0, historyPrunes: 0, primaryReads: 0 };
	const load = h.host.loadData.bind(h.host);
	h.host.loadData = () => { state.primaryReads++; return load(); };
	h.host.settingsWriter.destroy();
	h.host.settingsWriter = createSettingsWriter({
		...h.host, onExternalSettingsChange: () => h.host.onExternalSettingsChange!(),
	}, {
		read: async () => null,
		write: async () => { state.checkpointWrites++; },
	}, {
		record: async () => {}, list: async () => [], delete: async () => {},
		prune: async () => { state.historyPrunes++; },
	});
	return { ...h, retention: state };
}

function seed(h: ReturnType<typeof retainedSetup>, owner: string | null, count: number): string[] {
	return Array.from({ length: count }, (_, index) => {
		const time = new Date(Date.UTC(2026, 0, index + 1)).toISOString().replace(/[:.]/g, "-");
		const suffix = owner === null ? "" : `-${owner}-${index.toString(16).padStart(16, "0")}`;
		const path = `${DIR}/data-${time}${suffix}.json`;
		h.files.set(path, JSON.stringify({ version: index }));
		return path;
	});
}

describe("backup retention when an existing installation starts", () => {
	for (const primary of ["missing", "unreadable"] as const) {
		it(`cleans old vault and legacy copies even with ${primary} settings and no new save`, async context => {
			context.mock.method(console, "error", () => {});
			const h = retainedSetup();
			if (primary === "unreadable") h.state.disk = "{ interrupted settings";
			const originalDisk = h.state.disk;
			const own = seed(h, h.host.localState.deviceId, 16);
			const legacy = seed(h, null, 15);
			const other = seed(h, "phone001", 17);
			h.files.set(`${DIR}/my-export.json`, "personal export");
			try {
				await loadSettingsInto(h.host);
				assert.deepEqual(own.filter(path => h.files.has(path)), own.slice(-10));
				assert.deepEqual(legacy.filter(path => h.files.has(path)), legacy.slice(-10));
				assert.ok(other.every(path => h.files.has(path)), "the other active device owns its retention");
				assert.equal(h.files.get(`${DIR}/my-export.json`), "personal export");
				assert.equal([...h.files.keys()].filter(path => path.includes("/data-")).length, 37);
				assert.equal(h.retention.historyPrunes, 1);
				assert.equal(h.state.writes, 0);
				assert.equal(h.retention.checkpointWrites, 0);
				assert.equal(h.state.disk, originalDisk);
				assert.equal(h.host.settingsWriter.status.frozenReason, primary);
			} finally { h.host.settingsWriter.destroy(); h.dom.window.clearTimers(); }
		});
	}

	it("finishes device history cleanup before reading or adopting settings", async context => {
		context.mock.method(console, "error", () => {});
		const h = retainedSetup();
		const entered = deferred<void>(), finish = deferred<void>();
		h.host.settingsWriter.pruneHistory = () => { entered.resolve(); return finish.promise; };
		try {
			const boot = loadSettingsInto(h.host);
			await entered.promise;
			assert.equal(h.retention.primaryReads, 0);
			finish.resolve();
			await boot;
			assert.ok(h.retention.primaryReads > 0);
			assert.equal(h.state.writes, 0);
			assert.equal(h.retention.checkpointWrites, 0);
		} finally { h.host.settingsWriter.destroy(); h.dom.window.clearTimers(); }
	});

	it("stops later removals when the plugin unloads during cleanup", async () => {
		const h = retainedSetup();
		const own = seed(h, h.host.localState.deviceId, 14);
		const entered = deferred<void>(), finish = deferred<void>();
		const removed: string[] = [];
		h.host.app.vault.adapter.remove = async path => {
			removed.push(path); entered.resolve();
			await finish.promise;
			h.files.delete(path);
		};
		try {
			const boot = loadSettingsInto(h.host);
			await entered.promise;
			h.host.settingsWriter.destroy();
			finish.resolve();
			await boot;
			assert.equal(removed.length, 1, "an already-started removal can finish, but no later one starts");
			assert.equal(own.filter(path => h.files.has(path)).length, 13);
			assert.equal(h.retention.primaryReads, 0);
			assert.equal(h.state.writes, 0);
		} finally { h.host.settingsWriter.destroy(); h.dom.window.clearTimers(); }
	});

	it("continues boot after a hung cleanup and never resumes its late deletions", async context => {
		context.mock.method(console, "error", () => {});
		context.mock.method(console, "debug", () => {});
		const h = retainedSetup();
		const own = seed(h, h.host.localState.deviceId, 14);
		const entered = deferred<void>(), listing = deferred<{ files: string[]; folders: string[] }>();
		h.host.app.vault.adapter.list = () => { entered.resolve(); return listing.promise; };
		try {
			const boot = loadSettingsInto(h.host);
			await entered.promise;
			assert.equal(h.retention.primaryReads, 0);
			h.dom.window.flushTimers();
			await boot;
			assert.ok(h.retention.primaryReads > 0, "a stalled backups folder must not block settings startup");
			listing.resolve({ files: [...h.files.keys()], folders: [] });
			for (let turn = 0; turn < 10; turn++) await Promise.resolve();
			assert.ok(own.every(path => h.files.has(path)), "late cleanup cannot race the running plugin");
			assert.equal(h.state.writes, 0);
			assert.equal(h.retention.checkpointWrites, 0);
		} finally { h.host.settingsWriter.destroy(); h.dom.window.clearTimers(); }
	});
});
