import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { ReloadQueue } from "../src/manager/reloadQueue";
import type { ReloadQueueHost } from "../src/manager/reloadQueue";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { SettingsWriter } from "../src/manager/SettingsWriter";

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
	for (let i = 0; i < 20; i++) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

describe("adopting one file at a time", () => {
	it("joins the run already going instead of starting a second", async () => {
		const disk = { content: null as string | null };
		const { host: h, state } = host(disk);
		const q = new ReloadQueue(h);

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
		const q = new ReloadQueue(h);

		await q.run();
		await q.run();

		assert.strictEqual(state.reads, 2);
	});

	it("does not wedge itself when a run fails", async () => {
		const disk = { content: null as string | null };
		const { host: h, state } = host(disk);
		const q = new ReloadQueue(h);
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
		const q = new ReloadQueue(h);

		await q.run();

		assert.strictEqual(q.isPending, true);
	});

	it("runs when the editor closes", async () => {
		const { host: h, state } = host(withFile());
		state.settingsEditOpen = true;
		const q = new ReloadQueue(h);
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
		const q = new ReloadQueue(h);
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
		const q = new ReloadQueue(h);
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
		const q = new ReloadQueue(h);

		for (let i = 0; i < 50; i++) q.release();
		await settle();

		assert.strictEqual(state.reads, 0);
	});
});

describe("reload recovery and unload", () => {
	it("contains adoption failures and retains a retry", async () => {
		const { host: h } = host({ content: JSON.stringify({ callouts: [] }) });
		h.refreshThemeAppearance = () => { throw new Error("theme changed during refresh"); };
		const q = new ReloadQueue(h);
		await assert.doesNotReject(() => q.run());
		assert.strictEqual(q.isPending, true);
	});
	it("does not adopt an in-flight read or start new reads after unload", async () => {
		const { host: h, state } = host({ content: JSON.stringify({ settings: { welcomeSeen: true } }) });
		state.gate = () => undefined;
		const q = new ReloadQueue(h);
		const pending = q.run(); await settle();
		q.destroy(); h.settingsWriter.destroy();
		state.gate?.(); state.gate = null;
		await pending;
		assert.strictEqual(h.registry.settings.welcomeSeen, false);
		await q.run();
		assert.strictEqual(state.reads, 1);
	});
});
