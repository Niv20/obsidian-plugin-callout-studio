/** Manual discovery harness with an inspectable settings file and mutable notes. */
import { TFile, type App } from "obsidian";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import { ManualCalloutDiscovery } from "../../src/manager/ManualCalloutDiscovery";
import { SettingsWriter } from "../../src/manager/SettingsWriter";
import type { CalloutDefinition, PluginData } from "../../src/types";

export function definition(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return { id: "quiet", displayName: "Quiet", icon: { type: "lucide", value: "lucide-pencil" },
		colorLight: "#336699", colorDark: "#88bbee", foldable: true, defaultFolded: false,
		builtIn: false, source: "user", ...over };
}
export function discovered(id: string, over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return definition({ id, displayName: id, source: "fallback", ...over });
}

export function discoveryHarness(notes: Record<string, string> = {}) {
	const registry = new CalloutRegistry();
	registry.load(null);
	const contents = new Map<string, string>();
	const files = new Map<string, TFile>();
	const vault = {
		write(path: string, text: string): void {
			contents.set(path, text);
			const file = files.get(path);
			if (file) { file.stat.mtime++; file.stat.size = text.length; }
			else files.set(path, Object.assign(new TFile(), { path, extension: "md", stat: { mtime: 1, size: text.length } }));
		},
		file: (path: string): TFile => files.get(path)!,
		remove: (path: string): void => { files.delete(path); contents.delete(path); },
	};
	for (const [path, text] of Object.entries(notes)) vault.write(path, text);
	const state = {
		disk: structuredClone(registry.toSaveData()) as PluginData | null,
		writes: 0, reads: 0, editable: true, failRead: false, failWrite: false, failSettingsRead: false,
		themes: new Set<string>(),
		duringRead: null as (() => Promise<void> | void) | null,
		duringSettingsRead: null as (() => Promise<void> | void) | null,
		duringWrite: null as (() => Promise<void> | void) | null,
	};
	const app = { vault: {
		getMarkdownFiles: () => [...files.values()],
		getAbstractFileByPath: (path: string) => files.get(path),
		read: async (file: TFile) => {
			state.reads++;
			await state.duringRead?.();
			if (state.failRead) throw new Error("Note read failed");
			return contents.get(file.path)!;
		},
	} } as unknown as App;
	const writer = new SettingsWriter({
		build: () => registry.toSaveData(),
		readCurrent: async () => {
			await state.duringSettingsRead?.();
			if (state.failSettingsRead) throw new Error("Settings read failed");
			return state.disk === null ? null : JSON.stringify(state.disk);
		},
		write: async (data) => {
			await state.duringWrite?.();
			if (state.failWrite) throw new Error("Write failed");
			state.writes++;
			state.disk = structuredClone(data) as PluginData;
		},
	});
	writer.adopt(JSON.stringify(state.disk));
	const discovery = new ManualCalloutDiscovery({ app, registry, settingsWriter: writer,
		themeIds: () => state.themes, canApply: () => state.editable, onSettled: () => undefined });
	return { app, vault, registry, writer, discovery, state,
		syncBaseline(): void { state.disk = structuredClone(registry.toSaveData()); writer.adopt(JSON.stringify(state.disk)); },
	};
}
