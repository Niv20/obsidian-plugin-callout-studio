import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TFile, type App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { CalloutEditor } from "../src/settings/CalloutEditor";
import { EditorSaveSession } from "../src/settings/editor/EditorSaveSession";
import { stageRenameAliases } from "../src/settings/editor/calloutVaultSavePlan";
import { performCalloutEditorSave, type CalloutEditorSaveState } from "../src/settings/editor/CalloutEditorSave";
import type { CalloutEditorPlugin } from "../src/settings/editor/types";
import type { PluginData } from "../src/types";
import { normalizeFoldMarkersInVault } from "../src/utils/vaultCalloutScanner";
import { definition } from "./support/discoveryHarness";
import { DEFAULT_TEXT_COLOR_DARK, DEFAULT_TEXT_COLOR_LIGHT } from "../src/utils/colorUtils";

function gate() {
	let release!: () => void;
	const promise = new Promise<void>((done) => { release = done; });
	return { promise, release };
}

function recoveryHarness(notes = { "a.md": "> [!old] Old", "b.md": "> [!old] Old" }) {
	const registry = new CalloutRegistry(); registry.load({ callouts: [definition({ id: "old", displayName: "Old" })] });
	const state = {
		disk: structuredClone(registry.toSaveData()), failSettings: false, failRead: false,
		failSettingsWhen: null as ((data: PluginData) => boolean) | null,
		processes: 0, reads: 0, applied: 0,
		failProcess: null as ((path: string, next: string) => boolean) | null,
		beforeRead: null as (() => Promise<void>) | null,
	};
	const contents = new Map(Object.entries(notes));
	const files = [...contents.keys()].map((path) => Object.assign(new TFile(), { path }));
	const app = { vault: {
		getMarkdownFiles: () => files,
		getAbstractFileByPath: (path: string) => files.find((file) => file.path === path),
		cachedRead: async (file: TFile) => {
			state.reads++;
			await state.beforeRead?.();
			if (state.failRead) throw new Error("Note read failed");
			return contents.get(file.path)!;
		},
		process: async (file: TFile, transform: (content: string) => string) => {
			const next = transform(contents.get(file.path)!);
			if (state.failProcess?.(file.path, next)) throw new Error("Note write failed");
			contents.set(file.path, next); state.processes++;
		},
	} } as unknown as App;
	const writer = new SettingsWriter({
		build: () => registry.toSaveData(), readCurrent: () => Promise.resolve(JSON.stringify(state.disk)),
		write: (data) => {
			if (state.failSettings || state.failSettingsWhen?.(data as PluginData)) return Promise.reject(new Error("Settings write failed"));
			state.disk = structuredClone(data) as typeof state.disk; return Promise.resolve();
		},
	});
	writer.adopt(JSON.stringify(state.disk));
	const plugin = { app, registry, get settings() { return registry.settings; }, settingsWriter: writer,
		settingsEditOpen: true, saveSettings: () => writer.save(), ensureIconArtwork: () => Promise.resolve(),
		customCommands: { migrateCalloutId: () => undefined },
	} as unknown as CalloutEditorPlugin;
	registry.onChange(() => { void writer.save().catch(() => undefined); });
	const session = new EditorSaveSession();
	let existingId = "old";
	const save = (over: Partial<CalloutEditorSaveState> = {}) => session.run(plugin, () => {
		state.applied++;
		return performCalloutEditorSave({
			app, plugin, existingId, isBuiltIn: false, baselineDef: registry.get(existingId),
			state: { displayName: "New", calloutId: "new", icon: { type: "lucide", value: "star" },
				hideIcon: false, colorLight: "#336699", colorDark: "#88bbee", bgColorLight: "", bgColorDark: "",
				transparentBg: false, textColorLight: DEFAULT_TEXT_COLOR_LIGHT, textColorDark: DEFAULT_TEXT_COLOR_DARK,
				foldable: true, defaultFolded: false, iconOffsetX: 0, iconOffsetY: 0, iconSize: 1, aliases: [], ...over },
			hasStyleChanges: true, saveAsFallback: false, overwriteAutoFallback: false,
			canUseCalloutId: () => true, getFallbackBase: () => registry.get("note"),
			onDefinitionApplied: (def) => { existingId = def.id; },
			onVaultChangesReady: (plan) => session.applyVaultChanges(plugin, plan),
		});
	}, () => undefined);
	return { app, registry, writer, plugin, session, state, save, contents };
}

describe("editor rename work survives failed saves and partial note rewrites", () => {
	it("preserves independently cloned metadata when renaming", async () => {
		const h = recoveryHarness(); const metadata = { owner: "Personal", purpose: "Planning" };
		h.registry.update("old", { metadata });
		await h.writer.save();
		assert.ok(await h.save());
		assert.deepEqual(h.registry.get("new")?.metadata, metadata);
		assert.deepEqual(h.state.disk.callouts.find((row) => row.id === "new")?.metadata, metadata);
		assert.notEqual(h.registry.get("new")?.metadata, metadata);
	});
	it("renaming the chosen fallback keeps its selection and discovered-row appearance", async () => {
		const h = recoveryHarness();
		h.registry.settings.fallbackCalloutId = "old";
		const fallback = h.registry.get("old")!;
		h.registry.add({ ...fallback, id: "discovered", displayName: "Discovered", source: "fallback" });
		await h.writer.save();
		assert.ok(await h.save());
		assert.equal(h.registry.settings.fallbackCalloutId, "new");
		assert.equal(h.state.disk.settings.fallbackCalloutId, "new");
		assert.equal(h.registry.get("discovered")?.colorLight, fallback.colorLight);
		assert.deepEqual(h.registry.get("discovered")?.icon, h.registry.get("new")?.icon);
	});
	it("alias cleanup changes the committed row while preserving newer form preview colors", () => {
		const registry = new CalloutRegistry(); registry.load(null);
		const def = definition({ id: "new", colorLight: "#123456" });
		const rename = stageRenameAliases(def, ["old"]);
		registry.add(rename.definition);
		registry.settings.fallbackCalloutId = "new";
		registry.add({ ...def, id: "discovered", source: "fallback" });
		registry.setPreviewDefinition({ ...def, colorLight: "#abcdef" });
		rename.release(registry);
		assert.equal(registry.getPreviewDefinition()?.colorLight, "#abcdef");
		assert.equal(registry.getReal("new")?.aliases, undefined);
		const saved = registry.toSaveData().callouts.find((row) => row.id === "new")!;
		assert.equal(saved.colorLight, "#123456");
		assert.equal(saved.aliases, undefined);
		assert.equal(registry.get("discovered")?.colorLight, "#123456");
	});
	it("does not rewrite any notes before the new definition is durably saved", async () => {
		const h = recoveryHarness(); h.state.failSettings = true;
		assert.equal(await h.save(), null);
		assert.equal(h.state.reads, 0); assert.equal(h.state.processes, 0);
		assert.ok(h.state.disk.callouts.some((row) => row.id === "old"));
		assert.deepEqual([...h.contents.values()], ["> [!old] Old", "> [!old] Old"]);
		h.state.failSettings = false;
		assert.ok(await h.save());
		assert.deepEqual([...h.contents.values()], ["> [!new] New", "> [!new] New"]);
		assert.ok(h.state.disk.callouts.some((row) => row.id === "new"));
	});
	it("resumes a failed note read after the in-memory id already changed", async () => {
		const h = recoveryHarness(); h.state.failRead = true;
		assert.equal(await h.save(), null); assert.ok(h.registry.get("new"));
		h.state.failRead = false;
		assert.ok(await h.save());
		assert.deepEqual([...h.contents.values()], ["> [!new] New", "> [!new] New"]);
	});
	it("finishes partial A→B before applying a later B→C edit", async () => {
		const h = recoveryHarness(); h.state.failProcess = (path) => path === "b.md";
		assert.equal(await h.save(), null);
		assert.equal(h.contents.get("a.md"), "> [!new] Old");
		assert.equal(h.contents.get("b.md"), "> [!old] Old");
		const restart = new CalloutRegistry(); restart.load(h.state.disk);
		assert.equal(restart.findByAlias("old")?.id, "new", "old references still resolve after a crash/restart");
		const applied = h.state.applied;
		assert.equal(await h.save({ calloutId: "final", displayName: "Final" }), null);
		assert.equal(h.state.applied, applied, "the new form cannot leap over unfinished work");
		h.state.failProcess = null;
		assert.ok(await h.save({ calloutId: "final", displayName: "Final" }));
		assert.deepEqual([...h.contents.values()], ["> [!final] Final", "> [!final] Final"]);
		assert.deepEqual(h.state.disk.callouts.map((row) => row.id), ["final"]);
		assert.equal(h.state.disk.callouts[0]?.aliases, undefined);
	});
	it("a failed final cleanup save leaves safe aliases on disk and can retry", async () => {
		const h = recoveryHarness();
		h.state.failSettingsWhen = (data) => data.callouts.some((row) => row.id === "new" && !row.aliases?.includes("old"));
		assert.equal(await h.save(), null);
		assert.deepEqual([...h.contents.values()], ["> [!new] New", "> [!new] New"]);
		assert.deepEqual(h.state.disk.callouts.find((row) => row.id === "new")?.aliases, ["old"]);
		h.state.failSettingsWhen = null;
		assert.ok(await h.save());
		assert.equal(h.state.disk.callouts.find((row) => row.id === "new")?.aliases, undefined);
		assert.deepEqual([...h.contents.values()], ["> [!new] New", "> [!new] New"]);
	});
	it("retries an unfinished title phase after the id phase succeeded", async () => {
		const h = recoveryHarness(); h.state.failProcess = (path, next) => path === "b.md" && next.endsWith("New");
		assert.equal(await h.save(), null);
		assert.equal(h.contents.get("a.md"), "> [!new] New");
		assert.equal(h.contents.get("b.md"), "> [!new] Old");
		h.state.failProcess = null;
		assert.ok(await h.save());
		assert.deepEqual([...h.contents.values()], ["> [!new] New", "> [!new] New"]);
	});
	it("leaves code examples and frontmatter intact when changing folding", async () => {
		const note = '---\nexample: |\n  > [!old]+ Example\n---\n```markdown\n> [!old]+ Example\n```\n> [!old]+ Real\n## [!old]+ Heading';
		const h = recoveryHarness({ "a.md": note, "b.md": "" });
		assert.equal(await normalizeFoldMarkersInVault(h.app, ["old"], "-", true), 1);
		assert.equal(h.contents.get("a.md"), note.replace("> [!old]+ Real", "> [!old]- Real"));
	});
	it("closing the actual editor keeps external reloads held until its save completes", async () => {
		const h = recoveryHarness(); const started = gate(); const finish = gate();
		h.state.beforeRead = () => { started.release(); return finish.promise; };
		const editor = new CalloutEditor(h.plugin, h.registry.get("old"));
		const shell = { findAll: () => [], removeClasses: () => undefined, removeClass: () => undefined };
		Object.assign(editor, { app: h.app, editorOpen: true, calloutId: "new", displayName: "New",
			saveSession: h.session, contentEl: { empty: () => undefined }, modalEl: shell, containerEl: shell });
		const saving = (editor as unknown as { save(): Promise<void> }).save();
		await started.promise;
		editor.onClose();
		assert.equal(h.plugin.settingsEditOpen, true);
		assert.equal(h.session.busy, true);
		finish.release(); await saving;
		assert.equal(h.plugin.settingsEditOpen, false);
		assert.equal(h.session.busy, false);
		assert.deepEqual([...h.contents.values()], ["> [!new] New", "> [!new] New"]);
	});
});
