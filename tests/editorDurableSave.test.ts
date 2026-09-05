/** Issues #60/#53: a successful editor Save must survive a real file round trip. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsWriter } from "../src/manager/SettingsWriter";
import { saveSettingsWithFeedback } from "../src/manager/settingsSaveFeedback";
import { EditorSaveSession } from "../src/settings/editor/EditorSaveSession";
import { performCalloutEditorSave } from "../src/settings/editor/CalloutEditorSave";
import type { CalloutEditorSaveState } from "../src/settings/editor/CalloutEditorSave";
import type { CalloutEditorPlugin } from "../src/settings/editor/types";
import type { CalloutDefinition, PluginData } from "../src/types";
import { DEFAULT_TEXT_COLOR_DARK, DEFAULT_TEXT_COLOR_LIGHT } from "../src/utils/colorUtils";

(globalThis as { __CS_ICON_IDS__?: string[] }).__CS_ICON_IDS__ = [
	"lucide-pencil", "lucide-star", "lucide-heart", "lucide-info",
];

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => { resolve = done; });
	return { promise, resolve };
}

const form = (over: Partial<CalloutEditorSaveState> = {}): CalloutEditorSaveState => ({
	displayName: "Personal plan", calloutId: "personal-plan",
	icon: { type: "lucide", value: "lucide-heart" }, hideIcon: false,
	colorLight: "#aa2255", colorDark: "#ffbbcc", bgColorLight: "", bgColorDark: "",
	transparentBg: false, textColorLight: DEFAULT_TEXT_COLOR_LIGHT,
	textColorDark: DEFAULT_TEXT_COLOR_DARK, foldable: true, defaultFolded: false,
	iconOffsetX: 0, iconOffsetY: 0, iconSize: 1, aliases: ["my-plan"], ...over,
});

async function harness(run: (h: {
	registry: CalloutRegistry; writer: SettingsWriter; session: EditorSaveSession;
	state: { fail: boolean; writes: number; applied: number; beforeWrite: (() => Promise<void>) | null };
	save: (over?: Partial<CalloutEditorSaveState>) => Promise<CalloutDefinition | null>;
	disk: () => Promise<string>; replaceDisk: (json: string) => Promise<void>;
}) => Promise<void>) {
	const dir = await mkdtemp(join(tmpdir(), "callout-editor-save-"));
	const path = join(dir, "data.json");
	const registry = new CalloutRegistry();
	registry.load(null);
	await writeFile(path, JSON.stringify(registry.toSaveData()));
	const state = { fail: false, writes: 0, applied: 0, beforeWrite: null as (() => Promise<void>) | null };
	const writer = new SettingsWriter({
		build: () => registry.toSaveData(), readCurrent: () => readFile(path, "utf8"),
		write: async (data) => {
			await state.beforeWrite?.();
			if (state.fail) throw new Error("Disk full");
			await writeFile(path, JSON.stringify(data, undefined, 2));
			state.writes++;
		},
	});
	writer.adopt(await readFile(path, "utf8"));
	const owner = { settingsWriter: writer };
	const plugin = {
		registry, settingsWriter: writer,
		saveSettings: () => saveSettingsWithFeedback(owner, () => undefined),
		ensureIconArtwork: () => Promise.resolve(),
		customCommands: { migrateCalloutId: () => undefined },
	} as unknown as CalloutEditorPlugin;
	const app = { vault: { getMarkdownFiles: () => [] } } as unknown as App;
	registry.onChange(() => { void plugin.saveSettings(); });
	const session = new EditorSaveSession();
	let existingId: string | null = null;
	const save = (over: Partial<CalloutEditorSaveState> = {}) => session.run(plugin, () => {
		state.applied++;
		return performCalloutEditorSave({
			app, plugin, existingId, isBuiltIn: false,
			state: form(over), baselineDef: existingId ? registry.get(existingId) : undefined,
			hasStyleChanges: true, saveAsFallback: false, overwriteAutoFallback: false,
			canUseCalloutId: () => true, getFallbackBase: () => registry.get("note"),
			onDefinitionApplied: (def) => { existingId = def.id; },
		});
	}, () => undefined);
	try {
		await run({ registry, writer, session, state, save,
			disk: () => readFile(path, "utf8"), replaceDisk: (json) => writeFile(path, json) });
	} finally {
		writer.destroy();
		await rm(dir, { recursive: true, force: true });
	}
}

describe("editor durable Save — issue #60", () => {
	it("creates a settings file containing chosen colors/icon and restores them after restart", async () => {
		await harness(async (h) => {
			const saved = await h.save();
			assert.ok(saved);
			const restart = new CalloutRegistry();
			restart.load(JSON.parse(await h.disk()) as PluginData);
			const row = restart.get("personal-plan")!;
			assert.equal(row.colorLight, "#aa2255");
			assert.equal(row.colorDark, "#ffbbcc");
			assert.equal(row.icon.value, "lucide-heart");
			assert.deepEqual(row.aliases, ["my-plan"]);
			assert.equal(row.source, "user");
		});
	});
	it("waits for the file write before reporting success", async () => {
		await harness(async (h) => {
			const started = deferred(); const finish = deferred();
			h.state.beforeWrite = async () => { started.resolve(); await finish.promise; };
			let resolved = false;
			const saving = h.save().then((result) => { resolved = true; return result; });
			await started.promise;
			assert.equal(resolved, false);
			assert.equal(h.session.busy, true);
			assert.equal((JSON.parse(await h.disk()) as PluginData).callouts.length, 0);
			finish.resolve();
			assert.ok(await saving);
		});
	});
	it("does not report success after a disk failure and can retry the same newly created id", async () => {
		await harness(async (h) => {
			const original = await h.disk();
			h.state.fail = true;
			assert.equal(await h.save(), null);
			assert.equal(await h.disk(), original);
			assert.equal(h.session.busy, false);
			h.state.fail = false;
			assert.ok(await h.save({ colorLight: "#228866" }));
			const restart = new CalloutRegistry();
			restart.load(JSON.parse(await h.disk()) as PluginData);
			assert.equal(restart.get("personal-plan")?.colorLight, "#228866");
			assert.equal(restart.toSaveData().callouts.length, 1);
		});
	});
	it("rejects a frozen session before mutating the registry", async () => {
		await harness(async (h) => {
			h.writer.freeze();
			assert.equal(await h.save(), null);
			assert.equal(h.state.applied, 0);
			assert.equal(h.state.writes, 0);
			assert.equal(h.registry.get("personal-plan"), undefined);
		});
	});
	it("recognizes a stale save that resolves without writing as unsuccessful", async () => {
		await harness(async (h) => {
			const remote = JSON.parse(await h.disk()) as PluginData;
			remote.settings.fallbackCalloutId = "warning";
			await h.replaceDisk(JSON.stringify(remote));
			const incoming = await h.disk();
			assert.equal(await h.save(), null);
			assert.equal(h.state.writes, 0);
			assert.equal(await h.disk(), incoming);
		});
	});
	it("does not mutate through an old editor after the plugin has unloaded", async () => {
		await harness(async (h) => {
			h.writer.destroy();
			assert.equal(await h.save(), null);
			assert.equal(h.state.applied, 0);
			assert.equal(h.state.writes, 0);
		});
	});
	it("rapid repeated Save does not perform a second mutation or vault rewrite", async () => {
		await harness(async (h) => {
			const started = deferred(); const finish = deferred();
			h.state.beforeWrite = async () => { started.resolve(); await finish.promise; };
			const first = h.save();
			await started.promise;
			assert.equal(await h.save(), null);
			assert.equal(h.state.applied, 1);
			finish.resolve();
			assert.ok(await first);
		});
	});
});
