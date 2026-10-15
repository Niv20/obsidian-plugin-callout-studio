/**
 * Move here: an id typed into one callout's editor that another callout has.
 *
 * The other callout gives it up on Save and this one takes it, without a note
 * changing — `[!test]` simply starts drawing as this callout. What may move,
 * what may not, and that a refused save leaves both callouts as they were.
 * And the other way round: an id removed in the editor, which the user chose
 * to move to another callout ("Update your notes?").
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { performCalloutEditorSave, type CalloutEditorSaveState } from "../src/settings/editor/CalloutEditorSave";
import { idOwnership, takeMovedIds, type IdMove } from "../src/settings/editor/idMoves";
import { LEAVE_NOTES } from "../src/settings/editor/noteChanges";
import type { GivenId } from "../src/settings/editor/noteChangeQuestion";
import type { CalloutEditorPlugin } from "../src/settings/editor/types";
import type { CalloutDefinition, PluginData } from "../src/types";
import { DEFAULT_TEXT_COLOR_DARK, DEFAULT_TEXT_COLOR_LIGHT } from "../src/utils/colorUtils";
import { t } from "../src/i18n";

const notices: string[] = [];
Object.assign(globalThis, { __CS_NOTICES__: notices });

function def(over: Partial<CalloutDefinition> & { id: string }): CalloutDefinition {
	return {
		displayName: over.id, icon: { type: "lucide", value: "star" }, colorLight: "#448aff", colorDark: "#448aff",
		foldable: true, defaultFolded: false, builtIn: false, source: "user", ...over,
	};
}

function registryWith(...callouts: CalloutDefinition[]): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load({ callouts } as Partial<PluginData>);
	return registry;
}

describe("who has an id, and whether it can move here", () => {
	it("an extra id of another callout can move", () => {
		const registry = registryWith(def({ id: "abstract2", aliases: ["test"] }));
		const owner = idOwnership(registry, "test", null);
		assert.equal(owner.kind, "movable");
		assert.equal(owner.kind === "movable" && owner.removeRow, false);
	});

	it("matches every spelling Obsidian treats as one", () => {
		const registry = registryWith(def({ id: "x", aliases: ["a b"] }));
		assert.equal(idOwnership(registry, "a-b", null).kind, "movable");
	});

	it("a user-added extra id of a built-in can move; one Obsidian ships cannot", () => {
		const registry = registryWith();
		registry.update("abstract", { aliases: [...(registry.get("abstract")!.aliases ?? []), "test"] });
		assert.equal(idOwnership(registry, "test", null).kind, "movable");
		assert.equal(idOwnership(registry, "summary", null).kind, "stock");
		assert.equal(idOwnership(registry, "abstract", null).kind, "stock");
	});

	it("another callout's main id cannot move", () => {
		const registry = registryWith(def({ id: "idea", aliases: ["idee"] }));
		assert.equal(idOwnership(registry, "idea", null).kind, "main");
	});

	it("an unstyled discovered row gives up its only id, and goes", () => {
		const registry = registryWith(def({ id: "found", source: "fallback" }));
		const owner = idOwnership(registry, "found", null);
		assert.equal(owner.kind, "movable");
		assert.equal(owner.kind === "movable" && owner.removeRow, true);
	});

	it("a discovered row the user styled, or chose as the fallback, keeps it", () => {
		const styled = registryWith(def({ id: "found", source: "fallback", customized: true }));
		assert.equal(idOwnership(styled, "found", null).kind, "main");
		const fallback = registryWith(def({ id: "found", source: "fallback" }));
		fallback.settings.fallbackCalloutId = "found";
		assert.equal(idOwnership(fallback, "found", null).kind, "main");
	});

	it("an id the theme draws cannot move", () => {
		// Minted at runtime by the theme sweep, never loaded from a file.
		const registry = registryWith();
		assert.ok(registry.add(def({ id: "kanban", source: "theme" })));
		assert.equal(idOwnership(registry, "kanban", null).kind, "theme");
	});

	it("the callout being edited never owns its own ids against itself", () => {
		const registry = registryWith(def({ id: "me", aliases: ["mine"] }));
		assert.equal(idOwnership(registry, "mine", "me").kind, "free");
		assert.equal(idOwnership(registry, "nobody", null).kind, "free");
	});
});

describe("taking the ids", () => {
	it("takes an extra id and puts it back", () => {
		const registry = registryWith(def({ id: "a", aliases: ["test", "other"] }));
		const restore = takeMovedIds(registry, [{ id: "test", from: "a", removeRow: false }], "b");
		assert.ok(restore);
		assert.deepEqual(registry.get("a")?.aliases, ["other"]);
		restore();
		assert.deepEqual(registry.get("a")?.aliases, ["test", "other"]);
	});

	it("removes a placeholder row and puts it back", () => {
		const registry = registryWith(def({ id: "found", source: "fallback" }));
		const restore = takeMovedIds(registry, [{ id: "found", from: "found", removeRow: true }], null);
		assert.ok(restore);
		assert.equal(registry.get("found"), undefined);
		restore();
		assert.equal(registry.get("found")?.source, "fallback");
	});

	it("refuses, changing nothing, when an id has another owner than the one chosen", () => {
		const registry = registryWith(def({ id: "a", aliases: ["test"] }), def({ id: "c", aliases: ["mine"] }));
		const restore = takeMovedIds(registry, [
			{ id: "mine", from: "c", removeRow: false },
			{ id: "test", from: "elsewhere", removeRow: false },
		], null);
		assert.equal(restore, null);
		assert.deepEqual(registry.get("a")?.aliases, ["test"]);
		assert.deepEqual(registry.get("c")?.aliases, ["mine"]);
	});
});

describe("Save with a moved id", () => {
	function harness(callouts: CalloutDefinition[], notes: Record<string, string> = {}) {
		const registry = registryWith(...callouts);
		const migrations: Array<[string, string]> = [];
		let events = 0;
		registry.onChange(() => { events++; });
		const files = new Map(Object.entries(notes));
		const handles = [...files.keys()].map((path) => ({ path }));
		const app = { vault: {
			getMarkdownFiles: () => handles,
			getAbstractFileByPath: (path: string) => handles.find((file) => file.path === path) ?? null,
			cachedRead: (file: { path: string }) => Promise.resolve(files.get(file.path)!),
			process: (file: { path: string }, fn: (text: string) => string) => {
				files.set(file.path, fn(files.get(file.path)!));
				return Promise.resolve();
			},
		} } as unknown as App;
		const plugin = {
			app, registry, settings: registry.settings, saveSettings: () => Promise.resolve(),
			refreshCallouts: () => undefined, ensureIconArtwork: () => Promise.resolve(),
			customCommands: { migrateCalloutId: (from: string, to: string) => { migrations.push([from, to]); } },
		} as unknown as CalloutEditorPlugin;
		const form = (over: Partial<CalloutEditorSaveState>): CalloutEditorSaveState => ({
			displayName: "Tip", calloutId: "tip", icon: { type: "lucide", value: "star" }, hideIcon: false,
			colorLight: "#448aff", colorDark: "#448aff", bgColorLight: "", bgColorDark: "", transparentBg: false,
			textColorLight: DEFAULT_TEXT_COLOR_LIGHT, textColorDark: DEFAULT_TEXT_COLOR_DARK,
			foldable: true, defaultFolded: false, iconOffsetX: 0, iconOffsetY: 0, iconSize: 1, aliases: [], ...over,
		});
		const save = (
			existingId: string | null,
			state: CalloutEditorSaveState,
			moves: IdMove[],
			noteChoices = LEAVE_NOTES,
			gives: GivenId[] = [],
		) =>
			performCalloutEditorSave({
				app, plugin, existingId, isBuiltIn: false, state,
				baselineDef: existingId ? registry.get(existingId) : undefined,
				hasStyleChanges: true, saveAsFallback: false, overwriteAutoFallback: false,
				canUseCalloutId: () => true, getFallbackBase: () => undefined,
				noteChoices, moves, gives, announceNoteRewrite: () => undefined,
			});
		return { registry, migrations, events: () => events, files, form, save };
	}

	it("moves an extra id from one callout to another without touching a note", async () => {
		const h = harness([def({ id: "abstract2", aliases: ["test", "keep"] }), def({ id: "tip", displayName: "Tip" })],
			{ "a.md": "> [!test] Test" });
		const before = h.events();
		const saved = await h.save("tip", h.form({ aliases: ["test"] }), [{ id: "test", from: "abstract2", removeRow: false }]);
		assert.ok(saved);
		assert.deepEqual(h.registry.get("tip")?.aliases, ["test"]);
		assert.deepEqual(h.registry.get("abstract2")?.aliases, ["keep"]);
		assert.equal(h.registry.findAttrIdConflict("test", null)?.id, "tip");
		assert.equal(h.files.get("a.md"), "> [!test] Test");
		assert.equal(h.events() - before, 1, "both callouts change in one event");
	});

	it("takes a placeholder row's id as a new callout's own id", async () => {
		const h = harness([def({ id: "test", source: "fallback" })]);
		const saved = await h.save(null, h.form({ calloutId: "test", displayName: "Test" }),
			[{ id: "test", from: "test", removeRow: true }]);
		assert.ok(saved);
		assert.equal(h.registry.get("test")?.source, "user");
		assert.deepEqual(h.migrations, [], "its commands already name this id");
	});

	it("takes a placeholder row's id as an extra id, and its commands come along", async () => {
		const h = harness([def({ id: "found", source: "fallback" }), def({ id: "tip", displayName: "Tip" })]);
		const saved = await h.save("tip", h.form({ aliases: ["found"] }), [{ id: "found", from: "found", removeRow: true }]);
		assert.ok(saved);
		assert.equal(h.registry.get("found"), undefined);
		assert.deepEqual(h.registry.get("tip")?.aliases, ["found"]);
		assert.deepEqual(h.migrations, [["found", "tip"]]);
	});

	it("puts the other callout back when this save is refused", async () => {
		// The add is refused — `taken` is someone else's main id — after the move
		// already took `test`. A batch undoes nothing, so the save must.
		const h = harness([def({ id: "abstract2", aliases: ["test"] }), def({ id: "taken" })]);
		const saved = await h.save(null, h.form({ calloutId: "taken", aliases: ["test"] }),
			[{ id: "test", from: "abstract2", removeRow: false }]);
		assert.equal(saved, null);
		assert.deepEqual(h.registry.get("abstract2")?.aliases, ["test"]);
		assert.equal(h.registry.findAttrIdConflict("test", null)?.id, "abstract2");
	});

	it("renamed onto a moved-in id: the rename's titles and fold reach the notes rewritten into it, and only those", async () => {
		// Two reviewers caught this one: after the rewrite, `[!idea]` notes read
		// `[!insight]` — the moved id — so passes that skip moved ids skipped them
		// too. The passes now run first, over the ids the notes carry before it.
		const h = harness(
			[def({ id: "idea", displayName: "Idea" }), def({ id: "other", displayName: "Other", aliases: ["insight"] })],
			{ "a.md": "> [!idea]+ Idea\n> body", "b.md": "> [!insight]+ Idea" },
		);
		const saved = await h.save("idea",
			h.form({ displayName: "Insight", calloutId: "insight", foldable: true, defaultFolded: true }),
			[{ id: "insight", from: "other", removeRow: false }],
			{ rewrite: new Map([["idea", { kind: "self" }]]), titles: true, fold: true });
		assert.ok(saved);
		assert.equal(h.files.get("a.md"), "> [!insight]- Insight\n> body");
		assert.equal(h.files.get("b.md"), "> [!insight]+ Idea", "the moved id's own notes were Other's: untouched");
	});

	it("gives this callout's own notes the new fold mark, never the moved id's", async () => {
		// Those notes belonged to another callout until this Save, and nobody was
		// asked about them.
		const h = harness([def({ id: "abstract2", aliases: ["test"] }), def({ id: "tip", foldable: false })],
			{ "a.md": "> [!test] Test", "b.md": "> [!tip] Tip" });
		const saved = await h.save("tip", h.form({ aliases: ["test"], foldable: true, defaultFolded: true }),
			[{ id: "test", from: "abstract2", removeRow: false }], { ...LEAVE_NOTES, fold: true });
		assert.ok(saved);
		assert.equal(h.files.get("a.md"), "> [!test] Test");
		assert.equal(h.files.get("b.md"), "> [!tip]- Tip");
	});

	it("moves a removed id to the callout picked, without touching a note", async () => {
		const h = harness([def({ id: "abstract2", displayName: "Abstract2", aliases: ["test", "keep"] }), def({ id: "idea", displayName: "Idea" })],
			{ "a.md": "> [!test] Test" });
		const before = h.events();
		const saved = await h.save("abstract2", h.form({ displayName: "Abstract2", calloutId: "abstract2", aliases: ["keep"] }), [],
			LEAVE_NOTES, [{ id: "test", to: "idea" }]);
		assert.ok(saved);
		assert.deepEqual(h.registry.get("abstract2")?.aliases, ["keep"]);
		assert.deepEqual(h.registry.get("idea")?.aliases, ["test"]);
		assert.equal(h.registry.findAttrIdConflict("test", null)?.id, "idea");
		assert.equal(h.files.get("a.md"), "> [!test] Test");
		assert.equal(h.events() - before, 1, "both callouts change in one event");
	});

	it("leaves the id with nobody, and says so, when the callout picked filled up meanwhile", async () => {
		const full = Array.from({ length: 9 }, (_, i) => `idea${i}`);
		const h = harness([def({ id: "abstract2", displayName: "Abstract2", aliases: ["test"] }), def({ id: "idea", displayName: "Idea", aliases: full })]);
		notices.length = 0;
		const saved = await h.save("abstract2", h.form({ displayName: "Abstract2", calloutId: "abstract2", aliases: [] }), [],
			LEAVE_NOTES, [{ id: "test", to: "idea" }]);
		assert.ok(saved, "the callout itself still saves");
		assert.deepEqual(h.registry.get("idea")?.aliases, full);
		assert.equal(h.registry.findAttrIdConflict("test", null), undefined);
		assert.deepEqual(notices, [t("editor.idGiveFailed", { id: "test", name: "Idea" })]);
	});
});
