import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { App, PluginManifest } from "obsidian";
import { ReloadQueue } from "../src/manager/reloadQueue";
import type { ReloadQueueHost } from "../src/manager/reloadQueue";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { definition } from "./support/discoveryHarness";
import { watchForLateSettings } from "../src/manager/settingsLateArrival";

/** One `localStorage` for the process, which `DeviceLocalStore` needs. */
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
	localStorage: {
		getItem: (k: string) => storage.get(k) ?? null,
		setItem: (k: string, v: string) => storage.set(k, v),
	},
	setTimeout: (fn: () => void) => {
		fn();
		return 0;
	},
};

let devices = 0;
let nextTimer = 0;
const timers = new Map<number, { callback: () => void; delay: number }>();
afterEach(() => timers.clear());

function queue(h: ReloadQueueHost): ReloadQueue {
	return new ReloadQueue(h, (callback, delay) => {
		const id = nextTimer++;
		timers.set(id, { callback, delay });
		return () => { timers.delete(id); };
	});
}
function fireRetry(): void {
	const entry = [...timers.entries()][0];
	assert.ok(entry, "a retry was scheduled");
	const [id, timer] = entry;
	timers.delete(id);
	timer.callback();
}

/**
 * A plugin, as far as the queue can tell.
 *
 * The registry, the device store and the writer are the real ones —
 * `adoptExternalSettings` rebuilds through all three, and a fake deep enough to
 * survive that is a fake big enough to be wrong. Only the vault is invented,
 * and only far enough to hold one `data.json`.
 */
function host(disk: { content: string | null }) {
	devices++;
	const state = {
		settingsEditOpen: false,
		hasPreview: false,
		reads: 0,
		/** Set to hold the read in flight open, so a test can overlap two runs. */
		gate: null as null | (() => void),
	};

	const app = {
		appId: `device-${devices}`,
		vault: {
			getName: () => "shared-vault",
			configDir: ".obsidian",
			adapter: {
				exists: () => Promise.resolve(disk.content !== null),
				mkdir: () => Promise.resolve(),
				write: () => Promise.resolve(),
				list: () => Promise.resolve({ files: [], folders: [] }),
				remove: () => Promise.resolve(),
			},
		},
	} as unknown as App;

	const registry = new CalloutRegistry();
	const localState = new DeviceLocalStore(app);
	const writer = new SettingsWriter({
		build: () => registry.toSaveData(),
		write: (data) => {
			disk.content = JSON.stringify(data);
			return Promise.resolve();
		},
	});

	const h = {
		app,
		manifest: {
			id: "callout-studio",
			dir: ".obsidian/plugins/callout-studio",
		} as PluginManifest,
		loadData: async () => {
			state.reads++;
			if (state.gate) {
				await new Promise<void>((resolve) => {
					state.gate = resolve;
				});
			}
			if (disk.content === null) return null;
			try {
				return JSON.parse(disk.content) as unknown;
			} catch {
				return undefined;
			}
		},
		get settingsEditOpen() {
			return state.settingsEditOpen;
		},
		registry,
		localState,
		settingsWriter: writer,
		saveSettings: () => writer.save(),
		refreshThemeAppearance: () => undefined,
		customCommands: { syncAll: () => undefined },
		refreshCallouts: () => undefined,
	} as unknown as ReloadQueueHost;

	// The preview flag is the registry's own answer, so it is overridden here
	// rather than faked alongside it.
	(registry as unknown as { hasPreviewDefinition: () => boolean })
		.hasPreviewDefinition = () => state.hasPreview;

	return { host: h, state, registry };
}

/**
 * Let the work a fire-and-forget `release()` started run to completion.
 *
 * `release()` returns void on purpose — its callers are a property setter and a
 * registry hook, neither of which can await — so a test has to give the chain
 * it starts room to finish. Several turns, because one adoption is a read, an
 * `exists()` and a full rebuild.
 */
async function settle(): Promise<void> {
	// A loaded external file now has to match across a real settling interval.
	await delay(200);
	for (let i = 0; i < 20; i++) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

describe("adopting one file at a time", () => {
	it("joins the run already going instead of starting a second", async () => {
		const disk = { content: null as string | null };
		const { host: h, state } = host(disk);
		const q = queue(h);

		// Hold the first read open.
		state.gate = () => undefined;
		const first = q.run();
		await settle();
		assert.strictEqual(state.reads, 1);

		const second = q.run();
		await settle();
		assert.strictEqual(state.reads, 1, "no second read while one is in flight");

		state.gate?.();
		state.gate = null;
		await Promise.all([first, second]);
	});

	it("lets a later run start once the first has finished", async () => {
		const disk = { content: null as string | null };
		const { host: h, state } = host(disk);
		const q = queue(h);

		await q.run();
		await q.run();

		assert.strictEqual(state.reads, 2);
	});

	it("does not wedge itself when a run fails", async () => {
		const disk = { content: null as string | null };
		const { host: h, state } = host(disk);
		const q = queue(h);
		const original = h.loadData.bind(h);
		let firstCall = true;
		(h as { loadData: () => Promise<unknown> }).loadData = () => {
			if (firstCall) {
				firstCall = false;
				return Promise.reject(new Error("adapter gone"));
			}
			return original();
		};

		await q.run();
		assert.strictEqual(q.isPending, true);
		// The next caller must get a real run, not a rejected promise held over
		// from the last one.
		await q.run();
		assert.strictEqual(state.reads, 1, "the retry read for itself");
	});
});

describe("a reload deferred by an open modal", () => {
	/** A file that is genuinely there, so an adoption has something to defer. */
	const withFile = () => ({ content: JSON.stringify({ version: 4, callouts: [] }) });

	it("is remembered rather than dropped", async () => {
		const { host: h, state } = host(withFile());
		state.settingsEditOpen = true;
		const q = queue(h);

		await q.run();

		assert.strictEqual(q.isPending, true);
	});

	it("runs when the editor closes", async () => {
		const { host: h, state } = host(withFile());
		state.settingsEditOpen = true;
		const q = queue(h);
		await q.run();
		const before = state.reads;

		state.settingsEditOpen = false;
		q.release();
		await settle();

		assert.ok(state.reads > before, "the deferred reload actually ran");
	});

	it("runs when only the preview slot clears", async () => {
		// The half that used to strand it. `registryIsOwned` asks about two
		// flags and only one of them re-ran the reload, so a release that came
		// through the other left the latch set for the rest of the session.
		const { host: h, state } = host(withFile());
		state.hasPreview = true;
		const q = queue(h);
		await q.run();
		const before = state.reads;

		state.hasPreview = false;
		q.release();
		await settle();

		assert.ok(state.reads > before);
	});

	it("stays put while anything still owns the registry", async () => {
		// Both flags are asked again at release time, so a caller that lowered
		// one of them while the other is still up cannot force a rebuild under
		// the modal that is up.
		const { host: h, state } = host(withFile());
		state.settingsEditOpen = true;
		state.hasPreview = true;
		const q = queue(h);
		await q.run();
		const before = state.reads;

		state.settingsEditOpen = false;
		q.release();
		await settle();

		assert.strictEqual(state.reads, before);
		assert.strictEqual(q.isPending, true);
	});
});

describe("a release with nothing waiting", () => {
	it("costs nothing at all", async () => {
		// It is wired to the preview hook, which fires on every keystroke in
		// the callout editor.
		const { host: h, state } = host({ content: null });
		const q = queue(h);

		for (let i = 0; i < 50; i++) q.release();
		await settle();

		assert.strictEqual(state.reads, 0);
	});
});

describe("reload recovery and unload", () => {
	it("contains adoption failures and retains a retry", async () => {
		const { host: h } = host({ content: JSON.stringify({ callouts: [] }) });
		h.refreshThemeAppearance = () => { throw new Error("theme changed during refresh"); };
		const q = queue(h);
		await assert.doesNotReject(() => q.run());
		assert.strictEqual(q.isPending, true);
	});
	it("does not adopt an in-flight read or start new reads after unload", async () => {
		const { host: h, state } = host({ content: JSON.stringify({ settings: { welcomeSeen: true } }) });
		state.gate = () => undefined;
		const q = queue(h);
		const pending = q.run(); await settle();
		q.destroy(); h.settingsWriter.destroy();
		state.gate?.(); state.gate = null;
		await pending;
		assert.strictEqual(h.registry.settings.welcomeSeen, false);
		assert.strictEqual(q.isPending, false);
		await q.run();
		assert.strictEqual(state.reads, 1);
	});
});

describe("transient settings transfers recover without another file event", () => {
	it("retries a malformed transfer and adopts its completed replacement", async () => {
		const disk = { content: "{ truncated" };
		const { host: h, registry } = host(disk);
		registry.load(null);
		const q = queue(h);
		await q.run();
		assert.strictEqual(q.isPending, true);
		assert.strictEqual(timers.size, 1);
		const incoming = registry.toSaveData();
		incoming.callouts.push(definition({ id: "after-transfer" }));
		disk.content = JSON.stringify(incoming);
		fireRetry();
		await settle();
		assert.ok(registry.get("after-transfer"));
		assert.strictEqual(q.isPending, false);
		assert.strictEqual(timers.size, 0);
	});

	it("stops retrying a persistently unreadable file and restarts on a new event", async () => {
		const { host: h, state } = host({ content: "{ truncated" });
		const q = queue(h);
		await q.run();
		const delays: number[] = [];
		for (let attempt = 0; attempt < 3; attempt++) {
			delays.push([...timers.values()][0]!.delay);
			fireRetry();
			await settle();
		}
		assert.deepStrictEqual(delays, [250, 750, 2000]);
		assert.strictEqual(state.reads, 4);
		assert.strictEqual(timers.size, 0);
		assert.strictEqual(q.isPending, true);
		await q.run();
		assert.strictEqual(timers.size, 1, "a new event opens a new bounded recovery window");
		q.destroy();
		assert.strictEqual(timers.size, 0);
	});

	it("cancels the old retry when a later event already adopted the file", async () => {
		const disk = { content: null as string | null };
		const { host: h, registry } = host(disk);
		registry.load(null);
		const q = queue(h);
		await q.run();
		assert.strictEqual(timers.size, 1);
		disk.content = JSON.stringify(registry.toSaveData());
		await q.run();
		assert.strictEqual(q.isPending, false);
		assert.strictEqual(timers.size, 0);
	});

	it("waits for ownership release instead of polling underneath an editor", async () => {
		const disk = { content: "{ truncated" };
		const { host: h, state, registry } = host(disk);
		registry.load(null);
		const q = queue(h);
		await q.run();
		state.settingsEditOpen = true;
		fireRetry();
		await settle();
		assert.strictEqual(state.reads, 1);
		assert.strictEqual(timers.size, 0);
		disk.content = JSON.stringify(registry.toSaveData());
		state.settingsEditOpen = false;
		q.release();
		await settle();
		assert.strictEqual(q.isPending, false);
	});

	it("does not repeat a failed conflict backup or its notice on a timer", async () => {
		const { host: h, registry } = host({ content: JSON.stringify({ callouts: [] }) });
		registry.load(null);
		registry.add(definition({ id: "local" }));
		let backupAttempts = 0;
		h.app.vault.adapter.write = () => {
			backupAttempts++;
			return Promise.reject(new Error("backup folder unavailable"));
		};
		const q = queue(h);
		await q.run();
		assert.strictEqual(q.isPending, true);
		assert.strictEqual(backupAttempts, 1);
		assert.strictEqual(timers.size, 0);
		assert.ok(registry.get("local"));
	});

	it("queues a malformed foreground read so its repair is not stranded until the next foreground", async () => {
		(globalThis as unknown as { document: unknown }).document = { visibilityState: "visible" };
		const disk = { content: "{ truncated" };
		const { host: h, registry } = host(disk);
		registry.load(null);
		const q = queue(h);
		h.onExternalSettingsChange = () => q.run();
		let foreground = () => {};
		h.registerDomEvent = (_doc, _type, callback) => { foreground = callback; };
		watchForLateSettings(h);
		foreground();
		await settle();
		assert.strictEqual(timers.size, 1);
		const incoming = registry.toSaveData();
		incoming.callouts.push(definition({ id: "foreground-recovered" }));
		disk.content = JSON.stringify(incoming);
		fireRetry();
		await settle();
		assert.ok(registry.get("foreground-recovered"));
		assert.strictEqual(q.isPending, false);
	});

	it("keeps a newer foreground event while an older baseline read is still in flight", async () => {
		(globalThis as unknown as { document: unknown }).document = { visibilityState: "visible" };
		const disk = { content: "{}" };
		const { host: h, registry } = host(disk);
		registry.load(null);
		disk.content = JSON.stringify(registry.toSaveData());
		h.settingsWriter.adopt(disk.content);
		let finishRead: (() => void) | null = null;
		const original = h.loadData.bind(h);
		h.loadData = () => {
			const snapshot = original();
			h.loadData = original;
			return new Promise<void>(resolve => { finishRead = resolve; }).then(() => snapshot);
		};
		const q = queue(h);
		h.onExternalSettingsChange = () => q.run();
		let foreground = () => {};
		h.registerDomEvent = (_doc, _type, callback) => { foreground = callback; };
		watchForLateSettings(h);
		foreground();
		const incoming = registry.toSaveData();
		incoming.callouts.push(definition({ id: "newer-foreground" }));
		disk.content = JSON.stringify(incoming);
		foreground();
		(finishRead as (() => void) | null)?.();
		await settle();
		assert.ok(registry.get("newer-foreground"));
		assert.strictEqual(q.isPending, false);
	});
});

describe("reload releases arriving during adoption", () => {
	it("remembers a completed edit while the conflict backup is still in flight", async () => {
		const { host: h, registry } = host({ content: JSON.stringify({ callouts: [definition({ id: "remote" })] }) });
		registry.load(null);
		registry.add(definition({ id: "local" }));
		let finishBackup: (() => void) | null = null;
		const backups: string[] = [];
		h.app.vault.adapter.write = (_path, json) => {
			backups.push(json);
			return backups.length === 1
				? new Promise<void>(resolve => { finishBackup = resolve; })
				: Promise.resolve();
		};
		const q = queue(h);
		const first = q.run();
		await settle();
		assert.strictEqual(backups.length, 1);
		registry.add(definition({ id: "edited-during-backup" }));
		// saveSettings() hands ownership back here. The first adoption has not
		// returned its deferred verdict, so q.isPending is still false.
		q.release();
		assert.strictEqual(q.isPending, false);
		(finishBackup as (() => void) | null)?.();
		await first;
		assert.strictEqual(q.isPending, false, "the release must trigger a second adoption");
		assert.ok(registry.get("remote"));
		assert.ok(backups.some(json => json.includes("edited-during-backup")), "the newest local edit was preserved before adoption");
	});

	it("coalesces a burst of own-write echoes without rebuilding or scheduling retries", async () => {
		const { host: h, state, registry } = host({ content: JSON.stringify({ callouts: [] }) });
		h.settingsWriter.adopt(JSON.stringify({ callouts: [] }));
		let rebuilds = 0;
		registry.load = () => { rebuilds++; };
		const q = queue(h);
		await Promise.all(Array.from({ length: 50 }, () => q.run()));
		assert.ok(state.reads <= 2);
		assert.strictEqual(rebuilds, 0);
		assert.strictEqual(timers.size, 0);
	});
});
