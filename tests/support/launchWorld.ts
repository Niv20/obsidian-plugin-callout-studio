/**
 * A device that can be restarted: its plugin folder, its recovery copy and its
 * device marker outlive a launch, as they do on a real one.
 *
 * The other settings harnesses stand up one launch. What launch decides from
 * depends on what the last session left behind, so the tests of that decision
 * (`settingsBootRest.test.ts`) need the session before it to be a real one: the
 * production writer saving a stamped file, and its recovery copy with it.
 *
 * Time is a counter. A settling pause moves it on 150 ms and a queue retry by
 * its own delay, and `script` says what the file holds from a given moment, so
 * a test can put a sync client's write between two of launch's reads.
 */
import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../../src/manager/DeviceLocalStore";
import { createSettingsWriter } from "../../src/manager/settingsWriterHost";
import { ReloadQueue } from "../../src/manager/reloadQueue";
import { loadSettingsInto, type SettingsBootResult } from "../../src/manager/settingsBoot";
import { confirmFreshInstall, confirmLaunchRead } from "../../src/manager/settingsLateArrival";
import { settleWait } from "../../src/manager/settingsSettledRead";
import type { ExternalReloadHost } from "../../src/manager/settingsAdopt";
import { hasSafeSettingsFileShape } from "../../src/manager/settingsFileShape";
import { isNewerSettingsFormat } from "../../src/manager/foreignFields";
import { definition } from "./discoveryHarness";
import { installFakeDom } from "./fakeDom";

const dom = installFakeDom();
const storage = new Map<string, string>();
Object.defineProperty(dom.window, "localStorage", {
	value: {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => {
			storage.set(key, value);
		},
	},
});

export const PLUGIN_DIR = ".obsidian/plugins/callout-studio";
const DATA = `${PLUGIN_DIR}/data.json`;

export interface World {
	/** The vault's app id: the key of the device marker. */
	id: string;
	/** `data.json` as text, or `null` for no file. */
	disk: string | null;
	/** The device's recovery copy; `undefined` for none. */
	checkpoint: unknown;
	checkpointFails: boolean;
	/** Writes of anything but `data.json` are refused: a full disk under `backups/`. */
	backupFails: boolean;
	/** Everything else in the plugin folder: backups and conflict copies. */
	files: Map<string, string>;
	/** Counters a test resets and reads around the step it is about. */
	writes: number;
	reads: number;
	waits: number;
	rebuilds: number;
	clock: number;
	/** What the file holds from `at` on, in order. */
	script: { at: number; disk: string | null }[];
}

let worlds = 0;

export function newWorld(): World {
	return {
		id: `launch-world-${worlds++}`,
		disk: null,
		checkpoint: undefined,
		checkpointFails: false,
		backupFails: false,
		files: new Map(),
		writes: 0,
		reads: 0,
		waits: 0,
		rebuilds: 0,
		clock: 0,
		script: [],
	};
}

/** The device marker is gone: a reinstalled app, or cleared site data. */
export function forgetDevice(world: World): void {
	storage.delete(`${world.id}-callout-studio-local`);
}

export function resetCounters(world: World): void {
	world.writes = world.reads = world.waits = world.rebuilds = world.clock = 0;
}

function applyScript(world: World): void {
	while (world.script.length > 0 && world.script[0]!.at <= world.clock) world.disk = world.script.shift()!.disk;
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/** One launch of the plugin over `world`. Nothing is read until `boot()`. */
export function launchDevice(world: World) {
	const foreground: (() => void)[] = [];
	const retries: { callback: () => void; delayMs: number }[] = [];
	const app = {
		appId: world.id,
		vault: {
			configDir: ".obsidian",
			getName: () => world.id,
			adapter: {
				exists: async (path: string) => {
					applyScript(world);
					if (path === DATA) return world.disk !== null;
					return world.files.has(path) || [...world.files.keys()].some((file) => file.startsWith(`${path}/`));
				},
				mkdir: async () => {},
				list: async (path: string) => ({
					files: [...world.files.keys()].filter((file) => file.startsWith(`${path}/`)),
					folders: [],
				}),
				read: async (path: string) => {
					if (path !== DATA) return world.files.get(path) ?? "";
					applyScript(world);
					if (world.disk === null) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
					return world.disk;
				},
				write: async (path: string, data: string) => {
					if (world.backupFails) throw new Error("Backup disk full");
					world.files.set(path, data);
				},
				remove: async (path: string) => {
					world.files.delete(path);
				},
			},
		},
	} as unknown as App;
	const registry = new CalloutRegistry();
	const host = {
		app,
		manifest: { id: "callout-studio", dir: PLUGIN_DIR } as PluginManifest,
		registry,
		localState: new DeviceLocalStore(app),
		settingsEditOpen: false,
		waitForSettingsSettle: async () => {
			world.waits++;
			world.clock += 150;
			applyScript(world);
		},
		// Obsidian's `readJson`: `null` for no file, `undefined` for one it could not parse.
		loadData: async () => {
			world.reads++;
			applyScript(world);
			if (world.disk === null) return null;
			try {
				return JSON.parse(world.disk) as unknown;
			} catch {
				return undefined;
			}
		},
		saveData: async (data: unknown) => {
			world.writes++;
			world.disk = JSON.stringify(data, undefined, 2);
		},
		refreshCallouts: () => {
			world.rebuilds++;
		},
		refreshThemeAppearance: () => {},
		customCommands: { syncAll: () => {} },
		registerDomEvent: (_el: Document, _type: "visibilitychange", callback: () => void) => {
			foreground.push(callback);
		},
	} as unknown as ExternalReloadHost & { saveData(data: unknown): Promise<void> };
	host.settingsWriter = createSettingsWriter(
		{ ...host, onExternalSettingsChange: () => queue.run() },
		{
			// As `SettingsCheckpoint.read` answers: nothing, valid settings, a later build's, or a throw.
			read: async () => {
				if (world.checkpointFails) throw new Error("Recovery store blocked");
				const saved = world.checkpoint;
				if (saved === undefined) return null;
				if (
					!saved ||
					typeof saved !== "object" ||
					Array.isArray(saved) ||
					(!hasSafeSettingsFileShape(saved as Record<string, unknown>) && !isNewerSettingsFormat(saved))
				)
					throw new Error("Settings recovery copy is invalid");
				return structuredClone(saved);
			},
			readRaw: async () => {
				if (world.checkpointFails) throw new Error("Recovery store blocked");
				return world.checkpoint === undefined ? null : structuredClone(world.checkpoint);
			},
			write: async (data) => {
				if (world.checkpointFails) throw new Error("Recovery quota exceeded");
				world.checkpoint = structuredClone(data);
			},
		},
		{ record: async () => {}, list: async () => [], delete: async () => {}, prune: async () => {} },
	);
	// As in main.ts: config-file events, foreground checks and the owed read share the queue.
	const queue = new ReloadQueue(host, (callback, delayMs) => {
		const entry = { callback, delayMs };
		retries.push(entry);
		return () => {
			const at = retries.indexOf(entry);
			if (at >= 0) retries.splice(at, 1);
		};
	});
	host.onExternalSettingsChange = () => queue.run();
	host.saveSettings = () => host.settingsWriter.save().finally(() => queue.release());

	/** Let the queue's retries and the writer's stale-write reports run out. */
	async function settle(): Promise<void> {
		for (let round = 0; round < 12; round++) {
			for (let turn = 0; turn < 6; turn++) await tick();
			dom.window.flushTimers();
			for (let turn = 0; turn < 6; turn++) await tick();
			const next = retries.shift();
			if (next) {
				world.clock += next.delayMs;
				applyScript(world);
				next.callback();
			} else if (round > 2) break;
		}
		for (let turn = 0; turn < 6; turn++) await tick();
	}

	return {
		host,
		registry,
		queue,
		boot: () => loadSettingsInto(host),
		/** Layout-ready, as `runLaunchSequence` runs it. Answers whether this is a fresh install. */
		layoutReady: async (boot: SettingsBootResult): Promise<boolean> => {
			let owed = Promise.resolve();
			if (boot.confirmLater && boot.isFreshInstall) await settleWait(host)();
			else if (boot.confirmLater) owed = confirmLaunchRead(host);
			const fresh = boot.isFreshInstall ? await confirmFreshInstall(host) : false;
			await owed;
			await settle();
			return fresh;
		},
		/** The user switches back to Obsidian: the mobile stand-in for the config watcher. */
		returnToApp: async (): Promise<void> => {
			for (const listener of foreground) listener();
			await queue.run();
			await settle();
		},
		settle,
		close: () => {
			queue.destroy();
			host.settingsWriter.destroy();
		},
	};
}

export type LaunchedDevice = ReturnType<typeof launchDevice>;

/**
 * A device that has used the plugin and been closed: a stamped file holding
 * `ids`, a recovery copy equal to it, the device marker, and nothing left for
 * the next launch to flush.
 */
export async function usedWorld(...ids: string[]): Promise<World> {
	const world = newWorld();
	const first = launchDevice(world);
	await first.layoutReady(await first.boot());
	for (const id of ids.length > 0 ? ids : ["mine"]) first.registry.add(definition({ id }));
	await first.host.saveSettings();
	first.close();
	// Once more, so that whatever a load normalizes is on disk before the test starts.
	const second = launchDevice(world);
	await second.layoutReady(await second.boot());
	second.close();
	resetCounters(world);
	return world;
}

/** What another device, starting from the same file, leaves in the folder. */
export async function fileFromAnotherDevice(world: World, edit: (registry: CalloutRegistry) => void): Promise<string> {
	const other: World = { ...newWorld(), disk: world.disk };
	const device = launchDevice(other);
	await device.layoutReady(await device.boot());
	edit(device.registry);
	await device.host.saveSettings();
	device.close();
	if (other.disk === null) throw new Error("the other device wrote nothing");
	return other.disk;
}
