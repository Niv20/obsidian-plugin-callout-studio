/** Two independent files, production writer/registry/reload, delayed transport. */
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import { createSettingsWriter } from "../../src/manager/settingsWriterHost";
import { DeviceLocalStore } from "../../src/manager/DeviceLocalStore";
import { ReloadQueue } from "../../src/manager/reloadQueue";
import { loadSettingsInto } from "../../src/manager/settingsBoot";
import { confirmFreshInstall } from "../../src/manager/settingsLateArrival";
import type { ExternalReloadHost } from "../../src/manager/settingsAdopt";
import { definition } from "./discoveryHarness";
import { syncThemeOverlayRows } from "../../src/manager/theme/themeOverlayRows";
import { installFakeDom } from "./fakeDom";

import { hasSafeSettingsFileShape } from "../../src/manager/settingsFileShape";
const dom = installFakeDom();
const storage = new Map<string, string>();
Object.defineProperty(dom.window, "localStorage", { value: {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => { storage.set(key, value); },
} });

export async function device(dir: string, seed?: unknown) {
	await mkdir(dir, { recursive: true });
	const file = join(dir, "data.json");
	if (seed !== undefined) await writeFile(file, JSON.stringify(seed));
	const checkpointFile = join(dir, "device-checkpoint.json");
	let writes = 0, backupFails = false, writeFails = false, checkpointFails = false;
	/** A file the provider lists but cannot hand over: a placeholder or an offline read. */
	let unavailable = false;
	/** The foreground listeners this device registered, kept apart from other devices. */
	const foreground: (() => void)[] = [];
	/** What this device's active theme declares — machine-local by definition. */
	let themeIds: ReadonlySet<string> = new Set<string>();
	let checkpointHook: (() => Promise<void>) | null = null;
	const app = { appId: dir, vault: { configDir: ".obsidian", getName: () => dir,
		adapter: {
			read: async (path: string) => {
				if (unavailable && path === file) throw Object.assign(new Error("Resource temporarily unavailable"), { code: "EIO" });
				return readFile(path, "utf8");
			},
			exists: async (path: string) => { try { await access(path); return true; } catch { return false; } },
			mkdir: async (path: string) => { await mkdir(path, { recursive: true }); },
			write: async (path: string, json: string) => { if (backupFails) throw new Error("backup unavailable"); await writeFile(path, json); },
			list: async (path: string) => ({ files: (await readdir(path)).map(name => join(path, name)), folders: [] }),
			remove: async (path: string) => { await rm(path); },
		} } } as unknown as App;
	const registry = new CalloutRegistry();
	const host = { app, manifest: { id: "callout-studio", dir } as PluginManifest, registry,
		localState: new DeviceLocalStore(app), settingsEditOpen: false,
		waitForSettingsSettle: () => Promise.resolve(),
		// Obsidian's `readJson`: `null` for a missing file, `undefined` for any
		// other read or parse failure. It never throws for either.
		loadData: async () => {
			if (unavailable) return undefined;
			let text: string;
			try { text = await readFile(file, "utf8"); }
			catch (error) { return (error as { code?: string }).code === "ENOENT" ? null : undefined; }
			try { return JSON.parse(text) as unknown; } catch { return undefined; }
		},
		registerDomEvent: (_el: Document, type: string, callback: () => void) => {
			if (type === "visibilitychange") foreground.push(callback);
		},
		saveData: async (data: unknown) => { if (writeFails) throw new Error("write unavailable"); writes++; await writeFile(file, JSON.stringify(data)); },
		// The real hook re-runs the theme sweep, which is why `settingsAdopt`
		// calls it straight after `registry.load()` clears the map: the theme
		// overlay is derived, so adoption drops it and this puts it back. A
		// device with no theme declares nothing and the sweep is a no-op.
		refreshThemeAppearance: () => { syncThemeOverlayRows(registry, themeIds); },
		customCommands: { syncAll: () => {} }, refreshCallouts: () => {},
	} as ExternalReloadHost & { saveData(data: unknown): Promise<void> };
	host.settingsWriter = createSettingsWriter({ ...host, onExternalSettingsChange: () => queue.run() }, {
		read: async () => {
			let text: string;
			try { text = await readFile(checkpointFile, "utf8"); } catch (error) {
				if ((error as { code: string }).code === "ENOENT") return null; throw error;
			}
			const data = JSON.parse(text) as Record<string, unknown>;
			if (!hasSafeSettingsFileShape(data)) throw new Error("Invalid checkpoint");
			return data;
		},
		write: async data => { if (checkpointFails) throw new Error("Checkpoint quota exceeded"); await writeFile(checkpointFile, JSON.stringify(data)); const hook = checkpointHook; checkpointHook = null; await hook?.(); },
	});
	const queue = new ReloadQueue(host);
	// As in main.ts: config-file events and foreground checks share the queue.
	host.onExternalSettingsChange = () => queue.run();
	host.saveSettings = () => host.settingsWriter.save().finally(() => queue.release());
	const boot = await loadSettingsInto(host);
	return { dir, host, registry, queue, boot,
		/** Layout-ready on a launch that looked fresh, as `runLaunchSequence` does. */
		launch: () => boot.isFreshInstall ? confirmFreshInstall(host) : Promise.resolve(false),
		/** Return to the app: the mobile substitute for Obsidian's config watcher. */
		foreground: async () => { for (const listener of foreground) listener(); await queue.run(); },
		/** Fire the queued retry timers of every device, once. */
		flushTimers: () => { dom.window.flushTimers(); },
		unavailable: (on: boolean) => { unavailable = on; },
		rawText: async () => readFile(file, "utf8"),
		/** Switch this device's theme and sweep, as `css-change` would. */
		setTheme: (...ids: string[]) => {
			themeIds = new Set(ids);
			syncThemeOverlayRows(registry, themeIds);
		},
		removeDisk: async () => { await rm(file); },
		conflict: async (name: string, data: unknown) => { await writeFile(join(dir, name), JSON.stringify(data)); },
		replaceDisk: async (data: unknown) => { await writeFile(file, JSON.stringify(data)); },
		replaceRaw: async (text: string) => { await writeFile(file, text); },
		duringCheckpoint: (hook: () => Promise<void>) => { checkpointHook = hook; },
		checkpointFailure: (failed: boolean) => { checkpointFails = failed; },
		checkpointRaw: async (text: string) => { await writeFile(checkpointFile, text); }, get writes() { return writes; },
		read: async () => JSON.parse(await readFile(file, "utf8")) as unknown,
		deliver: async (data: unknown) => { await writeFile(file, JSON.stringify(data)); await queue.run(); },
		backupFailure: () => { backupFails = true; }, writeFailure: (failed: boolean) => { writeFails = failed; },
		// Backups only: their labels file lives in the same folder.
		backups: async () => { try { return await Promise.all((await readdir(join(dir, "backups"))).filter(name => name.startsWith("data-")).map(async name => JSON.parse(await readFile(join(dir, "backups", name), "utf8")) as unknown)); } catch { return []; } },
		close: () => { queue.destroy(); host.settingsWriter.destroy(); },
	};
}

export async function pair(run: (a: Awaited<ReturnType<typeof device>>, b: Awaited<ReturnType<typeof device>>) => Promise<void>) {
	const dir = await mkdtemp(join(tmpdir(), "callout-sync-"));
	const initial = new CalloutRegistry(); initial.load(null); initial.add(definition({ id: "shared", icon: { type: "lucide", value: "pencil" } }));
	const a = await device(join(dir, "a"), initial.toSaveData());
	const b = await device(join(dir, "b"), initial.toSaveData());
	try { await run(a, b); } finally { a.close(); b.close(); await rm(dir, { recursive: true, force: true }); }
}
