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
	/** What this device's active theme declares — machine-local by definition. */
	let themeIds: ReadonlySet<string> = new Set<string>();
	let checkpointHook: (() => Promise<void>) | null = null;
	const app = { appId: dir, vault: { configDir: ".obsidian", getName: () => dir,
		adapter: {
			read: async (path: string) => readFile(path, "utf8"),
			exists: async (path: string) => { try { await access(path); return true; } catch { return false; } },
			mkdir: async (path: string) => { await mkdir(path, { recursive: true }); },
			write: async (path: string, json: string) => { if (backupFails) throw new Error("backup unavailable"); await writeFile(path, json); },
			list: async (path: string) => ({ files: (await readdir(path)).map(name => join(path, name)), folders: [] }),
			remove: async (path: string) => { await rm(path); },
		} } } as unknown as App;
	const registry = new CalloutRegistry();
	const host = { app, manifest: { id: "callout-studio", dir } as PluginManifest, registry,
		localState: new DeviceLocalStore(app), settingsEditOpen: false,
		loadData: async () => {
			try { return JSON.parse(await readFile(file, "utf8")) as unknown; }
			catch (error) { if ((error as { code: string }).code === "ENOENT") return null; throw error; }
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
	host.saveSettings = () => host.settingsWriter.save().finally(() => queue.release());
	await loadSettingsInto(host);
	return { dir, host, registry, queue,
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
		backups: async () => { try { return await Promise.all((await readdir(join(dir, "backups"))).map(async name => JSON.parse(await readFile(join(dir, "backups", name), "utf8")) as unknown)); } catch { return []; } },
		close: () => { queue.destroy(); host.settingsWriter.destroy(); },
	};
}

export async function pair(run: (a: Awaited<ReturnType<typeof device>>, b: Awaited<ReturnType<typeof device>>) => Promise<void>) {
	const dir = await mkdtemp(join(tmpdir(), "callout-sync-"));
	const initial = new CalloutRegistry(); initial.load(null); initial.add(definition({ id: "shared" }));
	const a = await device(join(dir, "a"), initial.toSaveData());
	const b = await device(join(dir, "b"), initial.toSaveData());
	try { await run(a, b); } finally { a.close(); b.close(); await rm(dir, { recursive: true, force: true }); }
}
