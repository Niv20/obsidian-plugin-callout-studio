/**
 * A session that is not saving must be visible, must keep looking for its
 * file, and must never stop the plugin from loading.
 *
 * - The indicator: a status bar item on desktop, a notice that stays on
 *   mobile, never for a new install's provisional pause.
 * - The recheck: once a minute, only while the app is on screen, only for a
 *   missing or unreadable file.
 * - Safe startup: an error loading settings pauses saving and shows the
 *   built-ins, where it used to fail `onload` on every launch.
 * - Timeouts: a read or write that never answers is unavailable storage, not a
 *   writer that is busy forever.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { Notice } from "./support/obsidianStub";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { registerPausedIndicator, RESUME_NOTICE_AFTER_MS } from "../src/settings/pausedIndicator";
import { PAUSED_RECHECK_MS, recheckIfPaused, registerPausedRecheck } from "../src/manager/pausedRecheck";
import { loadSettingsSafely } from "../src/manager/settingsBoot";
import { PRIMARY_IO_TIMEOUT_MS, readSettingsFile } from "../src/manager/settingsFile";
import { createSettingsWriter } from "../src/manager/settingsWriterHost";
import { en } from "../src/i18n/en";
import { installFakeDom } from "./support/fakeDom";
import { recoveryActionHarness } from "./support/recoveryActionHarness";

const dom = installFakeDom();

function writer(): SettingsWriter {
	return new SettingsWriter({ build: () => ({}), write: () => Promise.resolve() });
}

function indicatorHost(settingsWriter: SettingsWriter) {
	const items: HTMLElement[] = [];
	const disposers: (() => void)[] = [];
	return {
		items, dispose: () => { for (const dispose of disposers) dispose(); },
		host: {
			app: {} as App, manifest: { id: "callout-studio" } as PluginManifest, settingsWriter,
			addStatusBarItem: () => { const item = dom.document.body.createDiv() as unknown as HTMLElement; items.push(item); return item; },
			register: (dispose: () => void) => { disposers.push(dispose); },
		},
	};
}

describe("showing that saving is paused", () => {
	it("keeps a status bar item up on desktop while paused, and only then", () => {
		const w = writer();
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, false);
			assert.equal(h.items.length, 0);
			w.freeze("unreadable");
			assert.equal(h.items.length, 1);
			assert.equal(h.items[0]!.style.getPropertyValue("display"), "");
			assert.ok((h.items[0]!.textContent ?? "").includes(en["statusBar.paused"]!));
			w.thaw();
			assert.equal(h.items[0]!.style.getPropertyValue("display"), "none");
		} finally { h.dispose(); w.destroy(); }
	});

	it("says nothing about a new install's provisional pause", () => {
		const w = writer();
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, false);
			w.freeze("missing", false);
			assert.equal(h.items.length, 0);
		} finally { h.dispose(); w.destroy(); }
	});

	it("puts up one notice that stays on mobile, and takes it down when saving resumes", () => {
		const w = writer();
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, true);
			w.freeze("unreadable");
			const notice = Notice.last as Notice & { hidden: boolean };
			assert.ok(notice && !notice.hidden);
			w.status.fail("unreadable");
			assert.equal(Notice.last, notice, "a second notice for the same pause");
			w.thaw();
			assert.equal(notice.hidden, true);
		} finally { h.dispose(); w.destroy(); }
	});

	it("adds no second notice on mobile for a missing file that launch already announced", () => {
		const w = writer();
		w.freeze("missing");
		const before = Notice.last;
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, true);
			assert.equal(Notice.last, before);
		} finally { h.dispose(); w.destroy(); }
	});
});

describe("saying that saving is back on", () => {
	// The banner used to just vanish after a restore or a file syncing back in,
	// leaving a worried reader to guess whether it had worked.
	const settle = () => new Promise((resolve) => setImmediate(resolve));
	const resumed = en["saveStatus.resumed"];

	it("says so when a pause someone could have seen ends", async (t) => {
		let now = 1_000_000;
		t.mock.method(Date, "now", () => now);
		const w = writer();
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, false);
			w.freeze("missing");
			now += RESUME_NOTICE_AFTER_MS;
			w.thaw();
			await settle();
			assert.equal(Notice.last?.message, resumed);
		} finally { h.dispose(); w.destroy(); }
	});

	it("stays quiet about a pause the automatic retries resolved", async (t) => {
		let now = 1_000_000;
		t.mock.method(Date, "now", () => now);
		const w = writer();
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, false);
			w.freeze("unreadable");
			const before = Notice.last;
			now += 1_000;
			w.thaw();
			await settle();
			assert.equal(Notice.last, before);
		} finally { h.dispose(); w.destroy(); }
	});

	it("does not take a thaw the same step undoes for a resume, and keeps the pause's start", async (t) => {
		let now = 1_000_000;
		t.mock.method(Date, "now", () => now);
		const w = writer();
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, false);
			w.freeze("missing");
			now += RESUME_NOTICE_AFTER_MS;
			const before = Notice.last;
			// An adoption that thaws, then fails its rebuild and freezes again.
			w.thaw(); w.freeze("unreadable");
			await settle();
			assert.equal(Notice.last, before);
			now += 10;
			w.thaw();
			await settle();
			assert.equal(Notice.last?.message, resumed, "the pause began at the first freeze");
		} finally { h.dispose(); w.destroy(); }
	});

	it("says nothing when the plugin unloads while paused, or about a new install's pause", async (t) => {
		let now = 1_000_000;
		t.mock.method(Date, "now", () => now);
		for (const quiet of [false, true]) {
			const w = writer();
			const h = indicatorHost(w);
			try {
				registerPausedIndicator(h.host, false);
				w.freeze("missing", !quiet);
				const before = Notice.last;
				now += RESUME_NOTICE_AFTER_MS;
				if (quiet) w.thaw(); else w.destroy();
				await settle();
				assert.equal(Notice.last, before, quiet ? "provisional pause" : "unload");
			} finally { h.dispose(); w.destroy(); }
		}
	});

	it("says so on a phone too, once the notice that stayed has gone", async (t) => {
		let now = 1_000_000;
		t.mock.method(Date, "now", () => now);
		const w = writer();
		const h = indicatorHost(w);
		try {
			registerPausedIndicator(h.host, true);
			w.freeze("unreadable");
			const paused = Notice.last as Notice & { hidden: boolean };
			now += RESUME_NOTICE_AFTER_MS;
			w.thaw();
			assert.equal(paused.hidden, true);
			await settle();
			assert.equal(Notice.last?.message, resumed);
		} finally { h.dispose(); w.destroy(); }
	});
});

describe("looking again while paused", () => {
	function recheck(visibility: "visible" | "hidden" = "visible") {
		const w = writer();
		let checks = 0;
		const host = {
			settingsWriter: w, registerInterval: (id: number) => id,
			onExternalSettingsChange: () => { checks++; return Promise.resolve(); },
		};
		return { w, tick: () => recheckIfPaused(host, { visibilityState: visibility }), get checks() { return checks; }, host };
	}

	it("runs once a minute, registered so unload stops it", () => {
		const r = recheck();
		const intervals: number[] = [];
		const registered: number[] = [];
		Object.defineProperty(dom.window, "setInterval", { configurable: true, value: (_fn: () => void, ms: number) => { intervals.push(ms); return 7; } });
		try {
			registerPausedRecheck({ ...r.host, registerInterval: (id: number) => { registered.push(id); return id; } });
		} finally { Reflect.deleteProperty(dom.window, "setInterval"); }
		assert.deepEqual(intervals, [PAUSED_RECHECK_MS]);
		assert.deepEqual(registered, [7]);
		r.w.destroy();
	});

	it("checks while the file is missing or unreadable and the app is on screen", () => {
		const r = recheck();
		r.tick(); assert.equal(r.checks, 0, "checked while saving works");
		r.w.freeze("missing"); r.tick(); assert.equal(r.checks, 1);
		r.w.freeze("unreadable"); r.tick(); assert.equal(r.checks, 2);
		r.w.freeze("newer-version"); r.tick(); assert.equal(r.checks, 2, "an update, not a file, ends this pause");
		r.w.destroy();
	});

	it("does not check in the background or during a new install's provisional pause", () => {
		const hidden = recheck("hidden");
		hidden.w.freeze("missing"); hidden.tick();
		assert.equal(hidden.checks, 0);
		const fresh = recheck();
		fresh.w.freeze("missing", false); fresh.tick();
		assert.equal(fresh.checks, 0);
		hidden.w.destroy(); fresh.w.destroy();
	});
});

describe("starting when settings cannot be loaded", () => {
	it("pauses saving and shows the built-in callouts instead of failing to load", async () => {
		const h = recoveryActionHarness();
		const load = h.host.registry.load.bind(h.host.registry);
		let first = true;
		h.host.registry.load = (data) => {
			if (first && data) { first = false; throw new TypeError("a migration met something unexpected"); }
			load(data);
		};
		const error = console.error; console.error = () => {};
		try {
			const result = await loadSettingsSafely(h.host);
			assert.deepEqual(result, { isFreshInstall: false });
			assert.equal(h.host.settingsWriter.status.frozenReason, "unreadable");
			assert.ok(h.host.registry.get("note"));
			assert.equal(h.state.writes, 0);
		} finally { console.error = error; h.host.settingsWriter.destroy(); }
	});
});

describe("storage that does not answer", () => {
	it("treats a read that never finishes as unreadable, not as no file", async () => {
		const app = { vault: { configDir: ".obsidian", adapter: { exists: () => Promise.resolve(false) } } } as unknown as App;
		const reading = readSettingsFile({ app, manifest: { id: "callout-studio" } as PluginManifest, loadData: () => new Promise(() => {}) });
		await Promise.resolve();
		dom.window.flushTimers();
		assert.deepEqual(await reading, { kind: "unreadable" });
		assert.equal(PRIMARY_IO_TIMEOUT_MS, 20_000);
	});

	it("fails a write that never finishes instead of waiting forever", async () => {
		const app = { vault: { configDir: ".obsidian", adapter: { exists: () => Promise.resolve(true) } } } as unknown as App;
		const onDisk = { callouts: [] };
		let writing!: () => void;
		const started = new Promise<void>(resolve => { writing = resolve; });
		const w = createSettingsWriter({
			app, manifest: { id: "callout-studio" } as PluginManifest,
			registry: { toSaveData: () => ({ callouts: [], settings: { language: "he" } }) },
			loadData: () => Promise.resolve(structuredClone(onDisk)),
			saveData: () => { writing(); return new Promise(() => {}); },
			onExternalSettingsChange: () => Promise.resolve(),
		}, { read: () => Promise.resolve(null), write: () => Promise.resolve() });
		w.adopt(JSON.stringify(onDisk));
		const error = console.error; console.error = () => {};
		try {
			const saving = w.save();
			await started;
			dom.window.flushTimers();
			await assert.rejects(saving);
			assert.equal(w.status.reason, "write");
		} finally { console.error = error; w.destroy(); }
	});
});
