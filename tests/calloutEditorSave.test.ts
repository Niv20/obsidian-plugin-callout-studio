/**
 * tests/calloutEditorSave.test.ts — what pressing Save actually does.
 *
 * Two things are worth pinning here, and they fail in opposite directions.
 *
 * **The rename.** Changing a callout's ID is a `remove()` plus an `add()`, and
 * `registry.onChange` carries no payload — so no listener downstream can tell
 * that pair from a delete. `CustomCommandManager.syncAll()` re-derives the
 * user's commands from the registry on every event; run between the two halves
 * it would find commands pointing at an id that had just stopped existing and
 * prune them as broken, and the user would lose a hotkey for renaming a
 * callout. `registry.batch()` is what stops that: the pair announces itself
 * once, `migrateCalloutId` runs *inside* the batch, and the single event that
 * follows sees a world where the new id exists and the commands already point
 * at it.
 *
 * **What reaches `data.json`.** The form holds a concrete value for every style
 * field whether or not the user chose it (see ./authoredStyle). Writing those
 * invented defaults onto the definition is not harmless: an opaque background
 * is exactly what stops nested callouts from stepping, and the extra fields
 * flip `isUnmodifiedBuiltIn`, so a built-in the user merely opened stops
 * deferring to the theme's `--callout-*` variables. Each style group is
 * therefore gated on its own predicate, and the assertions below are about
 * fields being **absent**.
 *
 * The vault rewrites that follow a save (ids, titles, fold marks) are the same
 * three writers `vaultCalloutScanner.test.ts` covers in detail; what is checked
 * here is only that the save asks for them, with the right arguments, in the
 * cases that call for it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { performCalloutEditorSave } from "../src/settings/editor/CalloutEditorSave";
import type {
	CalloutEditorSaveInput,
	CalloutEditorSaveState,
} from "../src/settings/editor/CalloutEditorSave";
import type { CalloutEditorPlugin } from "../src/settings/editor/types";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	DEFAULT_TEXT_COLOR_DARK,
	DEFAULT_TEXT_COLOR_LIGHT,
	bgTintFor,
} from "../src/utils/colorUtils";
import { DEFAULT_ICON_ADJUST } from "../src/utils/iconAdjust";
import type { App } from "obsidian";
import type { CalloutDefinition, PluginData } from "../src/types";

const ACCENT = "#448aff";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: ACCENT,
		colorDark: ACCENT,
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/**
 * The form as the modal fills it: every field concrete, nothing authored. A
 * test that means to author something overrides exactly that field, so an
 * assertion about an absent key is never an accident of the fixture.
 */
function formState(
	over: Partial<CalloutEditorSaveState> = {},
): CalloutEditorSaveState {
	return {
		displayName: "X",
		calloutId: "x",
		icon: { type: "lucide", value: "star" },
		hideIcon: false,
		colorLight: ACCENT,
		colorDark: ACCENT,
		bgColorLight: bgTintFor(ACCENT, false),
		bgColorDark: bgTintFor(ACCENT, true),
		transparentBg: false,
		textColorLight: DEFAULT_TEXT_COLOR_LIGHT,
		textColorDark: DEFAULT_TEXT_COLOR_DARK,
		foldable: true,
		defaultFolded: false,
		iconOffsetX: DEFAULT_ICON_ADJUST.offsetX,
		iconOffsetY: DEFAULT_ICON_ADJUST.offsetY,
		iconSize: DEFAULT_ICON_ADJUST.size,
		aliases: [],
		...over,
	};
}

type Harness = {
	registry: CalloutRegistry;
	/** One entry per `onChange` fire, holding what the world looked like then. */
	events: Array<{ has: (id: string) => boolean; migrations: number }>;
	migrations: Array<[string, string]>;
	fetched: CalloutDefinition["icon"][];
	notices: string[];
	file: (path: string) => string;
	save: (
		over: Partial<CalloutEditorSaveInput>,
	) => Promise<CalloutDefinition | null>;
};

function harness(
	stored: CalloutDefinition[] = [],
	files: Record<string, string> = {},
): Harness {
	const registry = new CalloutRegistry();
	registry.load({ callouts: stored } as Partial<PluginData>);

	const migrations: Array<[string, string]> = [];
	const fetched: CalloutDefinition["icon"][] = [];
	const events: Harness["events"] = [];
	registry.onChange(() => {
		events.push({
			has: (id) => registry.get(id) !== undefined,
			migrations: migrations.length,
		});
	});

	const store = new Map(Object.entries(files));
	const handles = Array.from(store.keys()).map((path) => ({ path }));
	const read = (f: { path: string }): Promise<string> =>
		Promise.resolve(store.get(f.path) ?? "");
	const app = {
		vault: {
			getMarkdownFiles: () => handles,
			read,
			cachedRead: read,
			getAbstractFileByPath: (path: string) =>
				handles.find((h) => h.path === path) ?? null,
			// The vault rewriters go through `process`, which owns the pair.
			process: (f: { path: string }, fn: (data: string) => string) => {
				const next = fn(store.get(f.path) ?? "");
				store.set(f.path, next);
				return Promise.resolve(next);
			},
			modify: (f: { path: string }, data: string) => {
				store.set(f.path, data);
				return Promise.resolve();
			},
		},
	} as unknown as App;

	const plugin = {
		app,
		registry,
		settings: registry.settings,
		pruneSuspended: false,
		saveSettings: () => Promise.resolve(),
		schedulePruneUnusedFallbacks: () => {},
		ensureIconArtwork: (icon: CalloutDefinition["icon"]) => {
			fetched.push(icon);
			return Promise.resolve();
		},
		hasIconFetchFailed: () => false,
		customCommands: {
			migrateCalloutId: (oldId: string, newId: string) => {
				migrations.push([oldId, newId]);
			},
		},
	} as unknown as CalloutEditorPlugin;

	// `new Notice(...)` records into this array; see tests/support/obsidianStub.ts.
	const notices: string[] = [];
	(globalThis as unknown as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ =
		notices;

	return {
		registry,
		events,
		migrations,
		fetched,
		notices,
		file: (path) => store.get(path) ?? "",
		save: (over) =>
			performCalloutEditorSave({
				app,
				plugin,
				existingId: null,
				isBuiltIn: false,
				state: formState(),
				baselineDef: undefined,
				hasStyleChanges: false,
				saveAsFallback: false,
				overwriteAutoFallback: false,
				canUseCalloutId: () => true,
				getFallbackBase: () => undefined,
				...over,
			}),
	};
}

/* -------------------------------------------------------------------------- */
/* 125 — the rename                                                           */
/* -------------------------------------------------------------------------- */

describe("performCalloutEditorSave — renaming a callout's ID", () => {
	const renaming = (h: Harness): Promise<CalloutDefinition | null> =>
		h.save({
			existingId: "old",
			state: formState({ calloutId: "new", displayName: "X" }),
			baselineDef: h.registry.get("old"),
		});

	it("moves the definition to the new ID and frees the old one", async () => {
		const h = harness([def({ id: "old" })]);
		const saved = await renaming(h);
		assert.strictEqual(saved?.id, "new");
		assert.ok(h.registry.get("new"));
		assert.strictEqual(h.registry.get("old"), undefined);
	});

	it("announces the remove and the add exactly ONCE, together", async () => {
		// Un-batched this is two events, and the first of them describes a world
		// in which the callout simply vanished.
		const h = harness([def({ id: "old" })]);
		await renaming(h);
		assert.strictEqual(h.events.length, 1);
	});

	it("has already migrated the commands by the time that event fires", async () => {
		const h = harness([def({ id: "old" })]);
		await renaming(h);
		assert.strictEqual(h.events[0]?.migrations, 1);
		assert.deepStrictEqual(h.migrations, [["old", "new"]]);
	});

	it("shows the single listener a consistent world", async () => {
		// The whole point of the batch: nothing downstream ever observes the
		// moment between the remove and the add.
		const h = harness([def({ id: "old" })]);
		await renaming(h);
		assert.strictEqual(h.events[0]?.has("new"), true);
		assert.strictEqual(h.events[0]?.has("old"), false);
	});

	it("does not migrate commands when the add is refused", async () => {
		// `add()` returns false on a clash. The remove already happened inside
		// the batch, so this is the one case where pointing commands at the new
		// id would aim them at nothing.
		const h = harness([def({ id: "old" }), def({ id: "taken" })]);
		const saved = await h.save({
			existingId: "old",
			state: formState({ calloutId: "taken" }),
			baselineDef: h.registry.get("old"),
		});
		assert.strictEqual(saved, null);
		assert.deepStrictEqual(h.migrations, []);
		assert.ok(h.notices.length > 0, "the user was not told the save failed");
	});

	it("does not migrate commands for an edit that keeps the ID", async () => {
		// An ordinary update is not a rename, and re-pointing commands that
		// already point correctly is churn `syncAll` would have to undo.
		const h = harness([def({ id: "same" })]);
		await h.save({
			existingId: "same",
			state: formState({ calloutId: "same", displayName: "Renamed label" }),
			baselineDef: h.registry.get("same"),
		});
		assert.deepStrictEqual(h.migrations, []);
	});

	it("rewrites the old ID everywhere it is written in the vault", async () => {
		const h = harness([def({ id: "old", displayName: "X" })], {
			"note.md": "> [!old] X\n> body",
		});
		await renaming(h);
		assert.strictEqual(h.file("note.md"), "> [!new] X\n> body");
	});

	it("carries the dasherized spelling of the old ID along with it", async () => {
		// `vaultIdFormsFor`: both spellings belong to this one callout, so a
		// hand-written `[!my-note]` is not orphaned when `my note` is renamed.
		const h = harness([def({ id: "my note", displayName: "X" })], {
			"a.md": "> [!my note] X",
			"b.md": "> [!my-note] X",
		});
		await h.save({
			existingId: "my note",
			state: formState({ calloutId: "renamed", displayName: "X" }),
			baselineDef: h.registry.get("my note"),
		});
		assert.strictEqual(h.file("a.md"), "> [!renamed] X");
		assert.strictEqual(h.file("b.md"), "> [!renamed] X");
	});

	it("keeps an alias the rename did not drop", async () => {
		// Only the id forms that are gone from the new set get rewritten.
		const h = harness([def({ id: "old", aliases: ["keep"], displayName: "X" })], {
			"note.md": "> [!keep] X",
		});
		await h.save({
			existingId: "old",
			state: formState({
				calloutId: "new",
				displayName: "X",
				aliases: ["keep"],
			}),
			baselineDef: h.registry.get("old"),
		});
		assert.strictEqual(h.file("note.md"), "> [!keep] X");
	});
});

describe("performCalloutEditorSave — the other vault rewrites", () => {
	it("renames the default title in notes that still carry the old one", async () => {
		const h = harness([def({ id: "tip", displayName: "Old Name" })], {
			"note.md": "> [!tip] Old Name",
		});
		await h.save({
			existingId: "tip",
			state: formState({ calloutId: "tip", displayName: "New Name" }),
			baselineDef: h.registry.get("tip"),
		});
		assert.strictEqual(h.file("note.md"), "> [!tip] New Name");
	});

	it("normalizes fold marks when foldability changes", async () => {
		const h = harness([
			def({ id: "tip", displayName: "X", foldable: false }),
		], { "note.md": "> [!tip] X" });
		await h.save({
			existingId: "tip",
			state: formState({
				calloutId: "tip",
				foldable: true,
				defaultFolded: true,
			}),
			baselineDef: h.registry.get("tip"),
		});
		assert.strictEqual(h.file("note.md"), "> [!tip]- X");
	});

	it("leaves the vault alone when nothing that lives in it changed", async () => {
		const h = harness([def({ id: "tip", displayName: "X" })], {
			"note.md": "> [!tip] X",
		});
		await h.save({
			existingId: "tip",
			state: formState({ calloutId: "tip", colorLight: "#ff0000" }),
			baselineDef: h.registry.get("tip"),
		});
		assert.strictEqual(h.file("note.md"), "> [!tip] X");
	});
});

describe("performCalloutEditorSave — the refusals", () => {
	it("saves nothing when the ID is empty", async () => {
		const h = harness();
		assert.strictEqual(await h.save({ state: formState({ calloutId: "" }) }), null);
		assert.strictEqual(h.events.length, 0);
	});

	it("saves nothing when the new ID is refused by the caller's check", async () => {
		const h = harness();
		assert.strictEqual(await h.save({ canUseCalloutId: () => false }), null);
		assert.strictEqual(h.events.length, 0);
	});

	it("saves nothing when an alias is refused", async () => {
		const h = harness();
		const saved = await h.save({
			state: formState({ aliases: ["bad"] }),
			canUseCalloutId: (_id, role) => role !== "alias",
		});
		assert.strictEqual(saved, null);
		assert.strictEqual(h.events.length, 0);
	});

	it("does NOT re-ask the check for an unchanged ID on an ordinary edit", async () => {
		// The id is already this callout's; asking again would refuse it for
		// being taken by itself.
		const h = harness([def({ id: "tip" })]);
		const asked: string[] = [];
		const saved = await h.save({
			existingId: "tip",
			state: formState({ calloutId: "tip" }),
			baselineDef: h.registry.get("tip"),
			canUseCalloutId: (id) => {
				asked.push(id);
				return false;
			},
		});
		assert.ok(saved, "an unchanged id was put through the availability check");
		assert.deepStrictEqual(asked, []);
	});
});

/* -------------------------------------------------------------------------- */
/* 126 — what reaches data.json                                               */
/* -------------------------------------------------------------------------- */

describe("performCalloutEditorSave — style the user never authored", () => {
	it("writes no background when the form only holds the derived tint", async () => {
		// Absent, not the hex the swatch was showing: Obsidian's own translucent
		// fill is what lets nested callouts step, and an opaque fill hides it.
		const h = harness();
		const saved = await h.save({});
		assert.strictEqual(saved?.bgColorLight, undefined);
		assert.strictEqual(saved?.bgColorDark, undefined);
	});

	it("writes no text colours when the form only holds the defaults", async () => {
		const saved = await harness().save({});
		assert.strictEqual(saved?.textColorLight, undefined);
		assert.strictEqual(saved?.textColorDark, undefined);
	});

	it("writes no icon adjustment when every slider is where it started", async () => {
		const saved = await harness().save({});
		assert.strictEqual(saved?.iconOffsetX, undefined);
		assert.strictEqual(saved?.iconOffsetY, undefined);
		assert.strictEqual(saved?.iconSize, undefined);
	});

	it("keeps a built-in reading as unmodified after a save that changed nothing", async () => {
		// This is the bug the gates exist for: opening a built-in and pressing
		// Save used to pin its accent to a hex forever, so the theme's own
		// `--callout-*` variables stopped deciding how it looked. The form below
		// is the built-in's own values, which is what the modal shows on open —
		// the only invented ones are the three groups under test.
		const h = harness();
		const shipped = h.registry.get("note");
		assert.ok(shipped, "the built-in `note` should always be in the map");
		await h.save({
			isBuiltIn: true,
			existingId: "note",
			baselineDef: shipped,
			state: formState({
				calloutId: shipped.id,
				displayName: shipped.displayName,
				icon: shipped.icon,
				colorLight: shipped.colorLight,
				colorDark: shipped.colorDark,
				bgColorLight: bgTintFor(shipped.colorLight, false),
				bgColorDark: bgTintFor(shipped.colorDark, true),
				foldable: shipped.foldable,
				defaultFolded: shipped.defaultFolded,
			}),
		});
		assert.strictEqual(h.registry.isBuiltInModified("note"), false);
		// The narrower question, and the one CSSInjector actually asks before it
		// decides whether to emit a hex or defer to core's `--callout-*`.
		const after = h.registry.get("note");
		assert.ok(after);
		assert.strictEqual(h.registry.isUnmodifiedBuiltIn(after), true);
	});
});

describe("performCalloutEditorSave — style the user did author", () => {
	it("writes a background the user picked", async () => {
		const saved = await harness().save({
			state: formState({ bgColorLight: "#ffeeaa" }),
		});
		assert.strictEqual(saved?.bgColorLight, "#ffeeaa");
		// Both halves travel together — the gate is per group, not per field.
		assert.ok(saved?.bgColorDark);
	});

	it("writes text colours the user picked", async () => {
		const saved = await harness().save({
			state: formState({ textColorLight: "#402000" }),
		});
		assert.strictEqual(saved?.textColorLight, "#402000");
		assert.strictEqual(saved?.textColorDark, DEFAULT_TEXT_COLOR_DARK);
	});

	it("writes an icon adjustment the user made", async () => {
		const saved = await harness().save({
			state: formState({ iconOffsetY: 2 }),
		});
		assert.strictEqual(saved?.iconOffsetY, 2);
		assert.strictEqual(saved?.iconOffsetX, DEFAULT_ICON_ADJUST.offsetX);
	});

	it("keeps a stored text colour on a later save that did not touch it", async () => {
		// The baseline having carried one is itself the authorship — a user is
		// entitled to pick the default deliberately.
		const stored = def({ id: "tip", textColorLight: DEFAULT_TEXT_COLOR_LIGHT });
		const h = harness([stored]);
		const saved = await h.save({
			existingId: "tip",
			state: formState({ calloutId: "tip" }),
			baselineDef: stored,
		});
		assert.strictEqual(saved?.textColorLight, DEFAULT_TEXT_COLOR_LIGHT);
	});
});

describe("performCalloutEditorSave — the flags that are `true` or absent", () => {
	it("writes no `hideIcon` when the icon is shown", async () => {
		// An explicit `false` would leave a built-in nobody edited reading as
		// customized forever — `isModified` compares `value ?? null`.
		const saved = await harness().save({});
		assert.strictEqual(saved?.hideIcon, undefined);
	});

	it("writes `hideIcon: true` when it is hidden, keeping the icon itself", async () => {
		const saved = await harness().save({
			state: formState({ hideIcon: true }),
		});
		assert.strictEqual(saved?.hideIcon, true);
		// The last drawing is still there, so turning the icon back on is
		// instant and offline.
		assert.deepStrictEqual(saved?.icon, { type: "lucide", value: "star" });
	});

	it("spells `transparentBg` out on every save, so switching back is possible", async () => {
		// Omitting it made transparency a one-way door: `update()` merges, and a
		// key that is not there clears nothing, so a callout switched to "None"
		// once kept the flag through every later save.
		const stored = def({ id: "tip", transparentBg: true });
		const h = harness([stored]);
		const saved = await h.save({
			existingId: "tip",
			state: formState({ calloutId: "tip", transparentBg: false }),
			baselineDef: stored,
		});
		assert.strictEqual(saved?.transparentBg, undefined);
		assert.ok("transparentBg" in (saved as object));
		assert.strictEqual(h.registry.get("tip")?.transparentBg, undefined);
	});

	it("drops the background hexes and any gradient under transparency", async () => {
		// The flag IS the background; leaving the hexes beside it would be a
		// second, contradicting source of truth, and an older build reading the
		// export would degrade to a stale opaque colour instead of to no
		// background at all.
		const saved = await harness().save({
			state: formState({
				transparentBg: true,
				bgColorLight: "#ffeeaa",
				bgGradient: {
					angleDeg: 90,
					toColorLight: "#ffd9d9",
					toColorDark: "#3a1c1c",
				},
			}),
		});
		assert.strictEqual(saved?.transparentBg, true);
		assert.strictEqual(saved?.bgColorLight, undefined);
		assert.strictEqual(saved?.bgGradient, undefined);
	});

	it("writes no empty alias array", async () => {
		const saved = await harness().save({});
		assert.strictEqual(saved?.aliases, undefined);
	});

	it("copies the alias array rather than sharing the form's", async () => {
		const state = formState({ aliases: ["one"] });
		const saved = await harness().save({ state });
		assert.deepStrictEqual(saved?.aliases, ["one"]);
		assert.notStrictEqual(saved?.aliases, state.aliases);
	});
});

/* -------------------------------------------------------------------------- */
/* source / customized, and the icon fetch                                    */
/* -------------------------------------------------------------------------- */

describe("performCalloutEditorSave — which row this becomes", () => {
	it("makes an ordinary new callout the user's own", async () => {
		const saved = await harness().save({});
		assert.strictEqual(saved?.source, "user");
		assert.strictEqual(saved?.customized, true);
	});

	it("makes an unstyled autocomplete callout a discovery placeholder", async () => {
		const saved = await harness().save({ saveAsFallback: true });
		assert.strictEqual(saved?.source, "fallback");
		assert.strictEqual(saved?.customized, undefined);
	});

	// A discovery row is only ever created for an id the registry does NOT
	// know, so these use one — a stored `fallback` row on a built-in id is the
	// damaged shape `load()` reclaims as the built-in it names.
	it("promotes an untouched fallback row the moment it is styled", async () => {
		const stored = def({ id: "found", source: "fallback" });
		const h = harness([stored]);
		const saved = await h.save({
			existingId: "found",
			state: formState({ calloutId: "found", colorLight: "#ff0000" }),
			baselineDef: stored,
			hasStyleChanges: true,
		});
		assert.strictEqual(saved?.source, "user");
		assert.strictEqual(saved?.customized, true);
	});

	it("leaves an unstyled fallback row a fallback row", async () => {
		const stored = def({ id: "found", source: "fallback" });
		const h = harness([stored]);
		const saved = await h.save({
			existingId: "found",
			state: formState({ calloutId: "found" }),
			baselineDef: stored,
			hasStyleChanges: false,
		});
		assert.strictEqual(saved?.source, "fallback");
	});

	it("never demotes a row the user already adopted", async () => {
		const stored = def({ id: "found", source: "fallback", customized: true });
		const h = harness([stored]);
		const saved = await h.save({
			existingId: "found",
			state: formState({ calloutId: "found" }),
			baselineDef: stored,
			hasStyleChanges: false,
		});
		assert.strictEqual(saved?.source, "user");
		assert.strictEqual(saved?.customized, true);
	});

	it("leaves a built-in a built-in, and gives it no `customized` flag", async () => {
		const h = harness();
		const saved = await h.save({
			isBuiltIn: true,
			existingId: "note",
			state: formState({ calloutId: "note", displayName: "Note" }),
			baselineDef: h.registry.get("note"),
		});
		assert.strictEqual(saved?.source, "builtin");
		assert.strictEqual(saved?.builtIn, true);
		assert.strictEqual(saved?.customized, undefined);
	});
});

describe("performCalloutEditorSave — fetching the artwork", () => {
	it("fetches a per-icon remote drawing before the definition is rendered", async () => {
		const h = harness();
		await h.save({
			state: formState({ icon: { type: "material", value: "home" } }),
		});
		assert.deepStrictEqual(h.fetched, [{ type: "material", value: "home" }]);
	});

	it("fetches nothing for a pack that ships or downloads its data whole", async () => {
		const h = harness();
		await h.save({});
		assert.deepStrictEqual(h.fetched, []);
	});

	it("fetches nothing for an icon that is not going to be drawn", async () => {
		const h = harness();
		await h.save({
			state: formState({
				hideIcon: true,
				icon: { type: "material", value: "home" },
			}),
		});
		assert.deepStrictEqual(h.fetched, []);
	});

	it("still saves when the fetch fails", async () => {
		// Offline is a normal state, and losing the edit over it would be the
		// worse failure.
		const h = harness();
		const saved = await performCalloutEditorSave({
			app: {} as App,
			plugin: {
				app: {} as App,
				registry: h.registry,
				settings: h.registry.settings,
				ensureIconArtwork: () => Promise.reject(new Error("offline")),
				customCommands: { migrateCalloutId: () => {} },
			} as unknown as CalloutEditorPlugin,
			existingId: null,
			isBuiltIn: false,
			state: formState({ icon: { type: "material", value: "home" } }),
			baselineDef: undefined,
			hasStyleChanges: false,
			saveAsFallback: false,
			overwriteAutoFallback: false,
			canUseCalloutId: () => true,
			getFallbackBase: () => undefined,
		});
		assert.ok(saved);
		assert.ok(h.registry.get("x"));
	});
});
