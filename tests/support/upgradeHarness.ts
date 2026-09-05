import type { App, EventRef, PluginManifest } from "obsidian";
import { DeviceLocalStore } from "../../src/manager/DeviceLocalStore";
import { StartupStyleCache } from "../../src/manager/StartupStyleCache";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import { SettingsWriter } from "../../src/manager/SettingsWriter";
import { loadSettingsInto } from "../../src/manager/settingsBoot";
import { adoptExternalSettings, type ExternalReloadHost } from "../../src/manager/settingsAdopt";

export const LOCAL_KEY = "upgrade-vault-callout-studio-local";
export const CSS_KEY = "upgrade-vault-callout-studio-css";
export const DATA_PATH = ".obsidian/plugins/callout-studio/data.json";
export const ORIGINAL_CSS = '.callout[data-callout="local-only"] { --callout-color: 197, 32, 79; --callout-icon: lucide-heart; }';

export function upgradeHarness(legacyRaw: string, saved?: unknown) {
	const local = new Map([[LOCAL_KEY, legacyRaw], [CSS_KEY, ORIGINAL_CSS]]);
	const disk = new Map<string, string>();
	if (saved !== undefined) disk.set(DATA_PATH, JSON.stringify(saved));
	const state = {
		failArchiveWrite: false, failArchiveRead: false, corruptArchive: false,
		failLocalWrite: false, archiveWrites: 0, settingsWrites: 0, noteReads: 0,
		duringArchiveWrite: null as (() => void) | null,
	};
	(window as unknown as { localStorage: unknown }).localStorage = {
		getItem: (key: string) => local.get(key) ?? null,
		setItem: (key: string, value: string) => {
			if (state.failLocalWrite) throw new Error("Local storage full");
			local.set(key, value);
		},
	};
	const app = {
		appId: "upgrade-vault",
		vault: {
			getName: () => "upgrade-vault", configDir: ".obsidian",
			getMarkdownFiles: () => { state.noteReads++; throw new Error("No automatic discovery during upgrade"); },
			on: () => ({}) as EventRef,
			adapter: {
				exists: async (path: string) => disk.has(path),
				mkdir: async (path: string) => { disk.set(path, "directory"); },
				read: async (path: string) => {
					if (state.failArchiveRead && path.includes("legacy-discovery")) throw new Error("Unreadable archive");
					return disk.get(path) ?? "";
				},
				write: async (path: string, text: string) => {
					if (state.failArchiveWrite) throw new Error("Backup disk full");
					state.archiveWrites++;
					state.duringArchiveWrite?.();
					disk.set(path, state.corruptArchive ? "partial" : text);
				},
				list: async () => ({ files: [...disk.keys()], folders: [] }),
				remove: async (path: string) => { disk.delete(path); },
			},
		},
		metadataCache: { on: () => ({}) as EventRef },
		workspace: { activeEditor: null },
	} as unknown as App;
	const manifest = { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" } as PluginManifest;
	const registry = new CalloutRegistry();
	const localState = new DeviceLocalStore(app);
	const writer = new SettingsWriter({
		build: () => registry.toSaveData(),
		readCurrent: async () => disk.get(DATA_PATH) ?? null,
		write: async data => { state.settingsWrites++; disk.set(DATA_PATH, JSON.stringify(data)); },
	});
	const host: ExternalReloadHost = {
		app, manifest, registry, localState, settingsWriter: writer,
		loadData: async () => disk.has(DATA_PATH) ? JSON.parse(disk.get(DATA_PATH)!) as unknown : null,
		saveSettings: () => writer.save(), settingsEditOpen: false,
		refreshThemeAppearance: () => {}, customCommands: { syncAll: () => {} },
		refreshCallouts: () => {}, registerDomEvent: () => {},
	};
	return {
		local, disk, state, registry, localState, writer, app, manifest,
		css: new StartupStyleCache(app),
		archive: () => localState.archiveLegacyDiscovery(manifest),
		boot: () => loadSettingsInto(host),
		adopt: () => adoptExternalSettings(host),
	};
}
