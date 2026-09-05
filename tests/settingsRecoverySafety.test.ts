import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { createSettingsWriter } from "../src/manager/settingsWriterHost";
import { DeviceLocalStore } from "../src/manager/DeviceLocalStore";
import { ReloadQueue } from "../src/manager/reloadQueue";
import { loadSettingsInto } from "../src/manager/settingsBoot";
import { confirmFreshInstall } from "../src/manager/settingsLateArrival";
import type { ExternalReloadHost } from "../src/manager/settingsAdopt";
import { applySettingsRead } from "../src/manager/settingsAdopt";
import { definition } from "./support/discoveryHarness";
import { installFakeDom } from "./support/fakeDom";

const dom = installFakeDom();
const localStorage = new Map<string, string>();
Object.defineProperty(dom.window, "localStorage", { value: {
	getItem: (key: string) => localStorage.get(key) ?? null,
	setItem: (key: string, value: string) => { localStorage.set(key, value); },
} });
let deviceNumber = 0;

function device() {
	const disk = { json: null as string | null, writes: 0, failWrite: false };
	const backups = new Map<string, string>();
	let foreground = () => {};
	const app = { appId: `recovery-${deviceNumber++}`, vault: { configDir: ".obsidian", getName: () => "recovery",
		adapter: {
			exists: (path: string) => Promise.resolve(path.endsWith("data.json") ? disk.json !== null : true),
			mkdir: () => Promise.resolve(),
			write: (path: string, json: string) => { backups.set(path, json); return Promise.resolve(); },
			list: () => Promise.resolve({ files: [...backups.keys()], folders: [] }),
			remove: (path: string) => { backups.delete(path); return Promise.resolve(); },
		} } } as unknown as App;
	const registry = new CalloutRegistry();
	const localState = new DeviceLocalStore(app);
	const host = {
		app, manifest: { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" } as PluginManifest,
		registry, localState, settingsEditOpen: false,
		loadData: () => Promise.resolve(disk.json === null ? null : JSON.parse(disk.json) as unknown),
		saveData: async (data: unknown) => {
			if (disk.failWrite) throw new Error("disk full");
			disk.writes++; disk.json = JSON.stringify(data);
		},
		refreshThemeAppearance: () => {}, customCommands: { syncAll: () => {} }, refreshCallouts: () => {},
		registerDomEvent: (_doc: Document, _type: "visibilitychange", callback: () => void) => { foreground = callback; },
	} as ExternalReloadHost & { saveData(data: unknown): Promise<void> };
	host.settingsWriter = createSettingsWriter({ ...host, onExternalSettingsChange: () => queue.run() });
	host.saveSettings = () => host.settingsWriter.save().finally(() => queue.release());
	const queue = new ReloadQueue(host);
	host.onExternalSettingsChange = () => queue.run();
	return { host, disk, registry, localState, queue, backups,
		foreground: async () => { foreground(); for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); },
	};
}

describe("settings recovery uses the production freshness and reload path", () => {
	it("marks an installation only after its first settings write really succeeds", async () => {
		const d = device();
		assert.equal((await loadSettingsInto(d.host)).isFreshInstall, true);
		await confirmFreshInstall(d.host);
		assert.equal(d.localState.hasInitialized, false);
		d.registry.add(definition({ id: "first-authored" }));
		d.disk.failWrite = true;
		await assert.rejects(() => d.host.saveSettings());
		assert.equal(d.localState.hasInitialized, false);
		d.disk.failWrite = false;
		await d.host.saveSettings();
		assert.equal(d.localState.hasInitialized, true);
	});

	it("does not overwrite very late synced settings at the first actual user edit (#53)", async () => {
		const d = device();
		await loadSettingsInto(d.host);
		assert.equal(await confirmFreshInstall(d.host), true);
		d.registry.settings.welcomeSeen = true; // greeting stays only in memory
		const remote = new CalloutRegistry(); remote.load(null);
		remote.add(definition({ id: "desktop-authored", icon: { type: "lucide", value: "star" }, colorLight: "#123456" }));
		d.disk.json = JSON.stringify(remote.toSaveData());
		const before = d.disk.json;
		d.registry.add(definition({ id: "phone-draft" }));
		await d.host.saveSettings();
		assert.equal(d.disk.writes, 0);
		assert.equal(d.disk.json, before);
		await d.queue.run();
		assert.equal(d.registry.get("desktop-authored")?.icon.value, "star");
		assert.equal(d.backups.size, 1, "the phone draft remains in the recovery copy");
	});

	it("remembers mobile foreground changes while an editor is open and applies them on close (#53)", async () => {
		const d = device();
		d.registry.load(null); d.disk.json = JSON.stringify(d.registry.toSaveData());
		await loadSettingsInto(d.host);
		d.host.settingsEditOpen = true;
		const incoming = d.registry.toSaveData(); incoming.callouts.push(definition({ id: "from-desktop", icon: { type: "lucide", value: "star" } }));
		d.disk.json = JSON.stringify(incoming);
		await d.foreground();
		assert.equal(d.queue.isPending, true);
		assert.equal(d.registry.get("from-desktop"), undefined);
		d.host.settingsEditOpen = false; d.queue.release();
		for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
		assert.ok(d.registry.get("from-desktop"));
		assert.equal(d.disk.writes, 0);
	});

	it("keeps unreadable inner row data intact and recovers when a complete file arrives (#41)", async () => {
		const d = device(); d.disk.json = JSON.stringify({ callouts: [{ id: "damaged", icon: null }] });
		const before = d.disk.json;
		await assert.doesNotReject(() => loadSettingsInto(d.host));
		assert.equal(d.host.settingsWriter.isFrozen, true);
		await d.host.saveSettings();
		assert.equal(d.disk.json, before);
		const remote = new CalloutRegistry(); remote.load(null); remote.add(definition({ id: "recovered" }));
		d.disk.json = JSON.stringify(remote.toSaveData());
		await d.foreground();
		assert.ok(d.registry.get("recovered"));
		assert.equal(d.host.settingsWriter.isFrozen, false);
	});

	it("a failed late-adoption operation cannot thaw a fresh launch", async () => {
		const d = device(); await loadSettingsInto(d.host);
		d.disk.json = "{}";
		d.registry.toSaveData = () => { throw new Error("snapshot failed"); };
		assert.equal(await confirmFreshInstall(d.host), false);
		assert.equal(d.host.settingsWriter.isFrozen, true);
		assert.equal(d.disk.writes, 0);
	});

	it("a malformed gradient beside a saved palette cannot crash startup", async () => {
		const d = device();
		const colors = { colorLight: "#336699", colorDark: "#88bbee", bgColorLight: "#dddddd", bgColorDark: "#222222", textColorLight: "#000000", textColorDark: "#ffffff" };
		d.disk.json = JSON.stringify({ callouts: [{ ...definition({ id: "gradient" }),
			bgGradient: { angleDeg: 45, toColorLight: 7, toColorDark: "#000000" } }],
		settings: { customPalettes: [{ id: "cp-gradient", name: "Gradient", ...colors,
			bgGradient: { angleDeg: 45, toColorLight: "#ffffff", toColorDark: "#000000" } }] } });
		const before = d.disk.json;
		await assert.doesNotReject(() => loadSettingsInto(d.host));
		assert.equal(d.host.settingsWriter.isFrozen, true);
		assert.equal(d.disk.json, before);
		assert.equal(d.disk.writes, 0);
	});

	it("unload cancels a pending stale-file notification", async () => {
		const d = device(); await loadSettingsInto(d.host); await confirmFreshInstall(d.host);
		d.disk.json = JSON.stringify({ settings: { welcomeSeen: true } });
		await d.host.saveSettings();
		d.host.settingsWriter.destroy(); d.queue.destroy();
		dom.window.flushTimers();
		assert.equal(d.disk.writes, 0);
	});

	for (const kind of ["loaded", "absent", "unreadable"] as const) {
		it(`a ${kind} boot read resolving after unload cannot rebuild or register listeners`, async () => {
			const d = device(); d.registry.load(null);
			d.registry.add(definition({ id: "before-unload" }));
			const before = JSON.stringify(d.registry.toSaveData());
			let listeners = 0;
			d.host.registerDomEvent = () => { listeners++; };
			let release!: (value: unknown) => void;
			d.host.loadData = () => new Promise(resolve => { release = resolve; });
			if (kind === "unreadable") d.disk.json = "";
			const pending = loadSettingsInto(d.host);
			d.host.settingsWriter.destroy();
			release(kind === "loaded" ? { callouts: [] } : null);
			await pending;
			assert.equal(JSON.stringify(d.registry.toSaveData()), before);
			assert.equal(listeners, 0);
			assert.equal(d.disk.writes, 0);
			assert.equal(d.localState.hasInitialized, false);
		});
	}

	it("direct settings application on an unloaded writer is inert", async () => {
		const d = device(); d.registry.load(null);
		d.registry.add(definition({ id: "before-unload" }));
		const before = JSON.stringify(d.registry.toSaveData());
		d.host.settingsWriter.destroy();
		await applySettingsRead(d.host, { kind: "loaded", data: { callouts: [] }, json: '{"callouts":[]}' });
		assert.equal(JSON.stringify(d.registry.toSaveData()), before);
		assert.equal(d.disk.writes, 0);
		assert.equal(d.localState.hasInitialized, false);
	});
});
