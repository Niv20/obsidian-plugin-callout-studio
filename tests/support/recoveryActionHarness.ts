import type { App, PluginManifest } from "obsidian";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import { DeviceLocalStore } from "../../src/manager/DeviceLocalStore";
import { createSettingsWriter } from "../../src/manager/settingsWriterHost";
import { loadSettingsInto } from "../../src/manager/settingsBoot";
import { confirmFreshInstall } from "../../src/manager/settingsLateArrival";
import { retrySettingsRecovery, startFreshSettings } from "../../src/manager/settingsRecoveryActions";
import { tryAdoptExternalSettings, type ExternalReloadHost, type SettingsAdoptionOptions } from "../../src/manager/settingsAdopt";
import type { CalloutEditorPlugin } from "../../src/settings/editor/types";
import { installFakeDom } from "./fakeDom";

const dom = installFakeDom();
const local = new Map<string, string>();
Object.defineProperty(dom.window, "localStorage", { value: {
	getItem: (key: string) => local.get(key) ?? null,
	setItem: (key: string, value: string) => { local.set(key, value); },
} });
let sequence = 0;

export function recoveryActionHarness(options: { missing?: boolean; legacy?: boolean } = {}) {
	const id = `saving-recovery-${sequence++}`;
	if (options.legacy) local.set(`${id}-callout-studio-local`, JSON.stringify({ v: 1 }));
	const registry = new CalloutRegistry(); registry.load(null);
	const state = {
		disk: options.missing ? null : JSON.stringify(registry.toSaveData()), writes: 0,
		checkpoint: null as unknown, failRead: false, failCheckpoint: false, failWrite: false, failBackup: false,
		beforeCheckpoint: null as (() => void) | null,
	};
	const files = new Map<string, string>();
	const app = { appId: id, vault: { configDir: ".obsidian", getName: () => id, adapter: {
		exists: async (path: string) => path.endsWith("/data.json") ? state.disk !== null : files.has(path),
		mkdir: async () => {}, list: async () => ({ files: [...files.keys()], folders: [] }),
		read: async (path: string) => files.get(path) ?? "",
		write: async (path: string, data: string) => { if (state.failBackup) throw new Error("Backup disk full"); files.set(path, data); },
		remove: async (path: string) => { files.delete(path); },
	} } } as unknown as App;
	const host = {
		app, manifest: { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" } as PluginManifest,
		registry, localState: new DeviceLocalStore(app), settingsEditOpen: false,
		loadData: async () => state.disk === null ? null : JSON.parse(state.disk) as unknown,
		saveData: async (data: unknown) => { if (state.failWrite) throw new Error("Primary disk full"); state.writes++; state.disk = JSON.stringify(data); },
		refreshCallouts: () => {}, refreshThemeAppearance: () => {}, customCommands: { syncAll: () => {} },
	} as ExternalReloadHost & { saveData(data: unknown): Promise<void> };
	host.onExternalSettingsChange = async () => { await tryAdoptExternalSettings(host); };
	host.settingsWriter = createSettingsWriter({ ...host, onExternalSettingsChange: () => host.onExternalSettingsChange!() }, {
		read: async () => { if (state.failRead) throw new Error("Recovery store blocked"); return structuredClone(state.checkpoint); },
		write: async data => {
			state.beforeCheckpoint?.();
			if (state.failCheckpoint) throw new Error("Recovery quota exceeded"); state.checkpoint = structuredClone(data);
		},
	});
	host.saveSettings = () => host.settingsWriter.save();
	const editor = Object.assign(host, {
		retrySettingsRecovery: (options?: SettingsAdoptionOptions) => retrySettingsRecovery(host, options),
		startFreshSettings: () => startFreshSettings(host),
	}) as unknown as CalloutEditorPlugin;
	return { host, editor, state, files, dom,
		boot: async () => {
			await host.localState.archiveLegacyDiscovery(host.manifest);
			const result = await loadSettingsInto(host);
			if (result.isFreshInstall) await confirmFreshInstall(host);
			return result;
		},
	};
}
