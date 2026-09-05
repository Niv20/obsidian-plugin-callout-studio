/**
 * tests/calloutRename.test.ts — renaming a callout id, end to end.
 *
 * A rename is the one mutation the registry cannot express as an update: the id
 * is the map key, so `CalloutEditorSave` does it as `remove()` + `add()` inside
 * a `registry.batch()`. Everything else about the callout has to survive that
 * round trip, and the three that need help are covered here:
 *
 * - **Aliases and the palette link** ride along on the new definition. Nothing
 *   migrates them; they are simply carried, so what is pinned is that neither
 *   the remove nor the add quietly drops one.
 * - **Custom commands cannot be inferred.** `CustomCommandManager` is one
 *   idempotent sweep subscribed to `onChange`, and that event has no payload —
 *   so a sweep landing between the remove and the add sees commands pointing at
 *   an id that has stopped existing and correctly, but very unhelpfully,
 *   deletes them. The batch is what makes the single event that follows see a
 *   consistent world, and `migrateCalloutId()` is called from inside it.
 * - **The Obsidian command id must not change.** Obsidian keys the user's
 *   hotkey by it, and `removeCommand` clears only `defaultKeys`, so
 *   re-registering at the same id keeps the binding. A rename must therefore
 *   re-register at most the *name*, never the identity.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	CustomCommandManager,
	type CustomCommandHostPlugin,
} from "../src/editor/CustomCommandManager";
import type { CalloutDefinition, CustomCommand } from "../src/types";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/** What Obsidian's command registry was asked to do, in order. */
interface CommandLog {
	added: Array<{ id: string; name: string }>;
	removed: string[];
}

/**
 * A registry, a command manager and the log of every `addCommand` /
 * `removeCommand` the manager issued.
 *
 * The host is structural (see `CustomCommandHostPlugin`), so a plain object is
 * plugin enough — nothing here touches the Obsidian app.
 */
function harness(commands: CustomCommand[] = []): {
	registry: CalloutRegistry;
	manager: CustomCommandManager;
	log: CommandLog;
} {
	const registry = new CalloutRegistry();
	registry.load(null);
	const log: CommandLog = { added: [], removed: [] };

	const plugin = {
		registry,
		settings: registry.settings,
		saveSettings: async (): Promise<void> => {},
		addCommand: (command: { id: string; name: string }) => {
			log.added.push({ id: command.id, name: command.name });
			return command;
		},
		removeCommand: (id: string) => {
			log.removed.push(id);
		},
	} as unknown as CustomCommandHostPlugin;

	registry.settings.customCommands = commands;
	return { registry, manager: new CustomCommandManager(plugin), log };
}

const command = (over: Partial<CustomCommand> = {}): CustomCommand => ({
	id: "cc-1",
	calloutId: "old",
	role: "regular",
	action: "insert",
	...over,
});

/** The rename as `performCalloutEditorSave` performs it. */
function rename(
	registry: CalloutRegistry,
	manager: CustomCommandManager,
	fromId: string,
	next: CalloutDefinition,
): boolean {
	return registry.batch(() => {
		registry.remove(fromId);
		const added = registry.add(next);
		if (added) manager.migrateCalloutId(fromId, next.id);
		return added;
	});
}

describe("migrateCalloutId", () => {
	it("re-points every command that named the old id", () => {
		const { registry, manager } = harness([
			command({ id: "cc-1", calloutId: "old" }),
			command({ id: "cc-2", calloutId: "old", role: "heading", headingLevel: 3 }),
			command({ id: "cc-3", calloutId: "other" }),
		]);
		registry.add(def({ id: "old", displayName: "Old" }));
		registry.add(def({ id: "other", displayName: "Other" }));

		manager.migrateCalloutId("old", "new");

		assert.deepStrictEqual(
			registry.settings.customCommands.map((c) => c.calloutId),
			["new", "new", "other"],
		);
	});

	it("is a no-op when the id did not actually change", () => {
		const { registry, manager } = harness([command()]);
		registry.add(def({ id: "old" }));

		manager.migrateCalloutId("old", "old");
		assert.strictEqual(registry.settings.customCommands[0]?.calloutId, "old");
	});

	it("leaves the command's own identity — and so the user's hotkey — untouched", () => {
		const { registry, manager } = harness([command({ id: "cc-1" })]);
		registry.add(def({ id: "old" }));

		manager.migrateCalloutId("old", "new");
		assert.strictEqual(registry.settings.customCommands[0]?.id, "cc-1");
	});

	it("keeps everything else about the command", () => {
		const { registry, manager } = harness([
			command({ role: "heading", headingLevel: 4, action: "wrap" }),
		]);
		registry.add(def({ id: "old" }));

		manager.migrateCalloutId("old", "new");
		assert.deepStrictEqual(registry.settings.customCommands[0], {
			id: "cc-1",
			calloutId: "new",
			role: "heading",
			headingLevel: 4,
			action: "wrap",
		});
	});
});

describe("the rename as the editor performs it", () => {
	it("survives the sweep that follows, because the migration lands inside the batch", () => {
		const { registry, manager, log } = harness([command()]);
		registry.add(def({ id: "old", displayName: "Old" }));
		manager.syncAll();

		const registered = log.added.length;
		registry.onChange(() => manager.syncAll());

		assert.strictEqual(rename(registry, manager, "old", def({ id: "new", displayName: "Old" })), true);

		assert.strictEqual(registry.settings.customCommands.length, 1, "not pruned");
		assert.strictEqual(registry.settings.customCommands[0]?.calloutId, "new");
		assert.strictEqual(
			log.added.length,
			registered,
			"the rendered name did not change, so nothing was re-registered",
		);
		assert.deepStrictEqual(log.removed, []);
	});

	it("retains the command even if a rename temporarily removes its target", () => {
		// The failure this pins is the reason `CalloutEditorSave` wraps the pair:
		// un-batched, the remove's event reaches the sweep while the command
		// still points at an id that has just stopped existing.
		const { registry, manager } = harness([command()]);
		registry.add(def({ id: "old", displayName: "Old" }));
		manager.syncAll();
		registry.onChange(() => manager.syncAll());

		registry.remove("old");
		registry.add(def({ id: "new", displayName: "Old" }));
		manager.migrateCalloutId("old", "new");

		assert.strictEqual(registry.settings.customCommands[0]?.calloutId, "new");
	});

	it("carries the aliases across", () => {
		const { registry, manager } = harness();
		registry.add(def({ id: "old", aliases: ["oa", "ob"] }));

		rename(registry, manager, "old", def({ id: "new", aliases: ["oa", "ob"] }));

		assert.deepStrictEqual(registry.get("new")?.aliases, ["oa", "ob"]);
		assert.strictEqual(registry.findByAlias("oa")?.id, "new");
	});

	it("frees the old aliases first, so the add cannot collide with itself", () => {
		// `add()` refuses when an alias is already owned. The remove has to run
		// first — which is exactly what the batched pair does.
		const { registry, manager } = harness();
		registry.add(def({ id: "old", aliases: ["shared"] }));

		assert.strictEqual(
			rename(registry, manager, "old", def({ id: "new", aliases: ["shared"] })),
			true,
		);
	});

	it("carries the palette link, so the group survives the rename", () => {
		const { registry, manager } = harness();
		registry.add(def({ id: "old", paletteId: "cp-1" }));
		registry.add(def({ id: "sibling", paletteId: "cp-1" }));

		rename(registry, manager, "old", def({ id: "new", paletteId: "cp-1" }));

		assert.strictEqual(registry.countPaletteLinks("cp-1"), 2);
		assert.strictEqual(
			registry.applyPaletteColors("cp-1", {
				colorLight: "#010101",
				colorDark: "#020202",
				bgColorLight: undefined,
				bgColorDark: undefined,
				bgGradient: undefined,
				transparentBg: undefined,
				textColorLight: undefined,
				textColorDark: undefined,
			}),
			2,
			"a later palette edit still reaches the renamed callout",
		);
	});

	it("announces itself exactly once", () => {
		const { registry, manager } = harness();
		registry.add(def({ id: "old" }));
		let changes = 0;
		registry.onChange(() => changes++);

		rename(registry, manager, "old", def({ id: "new" }));
		assert.strictEqual(changes, 1);
	});

	it("rolls the rename back to a false result when the new id is taken", () => {
		// `add()` refuses, so the batch returns false — and the caller shows the
		// id-conflict notice. The old row is gone by then, which is why the
		// editor's validation blocks the id before it ever gets here.
		const { registry, manager } = harness();
		registry.add(def({ id: "old" }));
		registry.add(def({ id: "taken" }));

		assert.strictEqual(rename(registry, manager, "old", def({ id: "taken" })), false);
		assert.strictEqual(registry.settings.customCommands.length, 0);
	});

	it("moves the fallback target off a renamed row, to the default", () => {
		// `remove()` resets the setting; the rename does not put it back. Worth
		// pinning as found — renaming the Default fallback callout silently
		// re-points the fallback at `note`.
		const { registry, manager } = harness();
		registry.add(def({ id: "old" }));
		registry.settings.fallbackCalloutId = "old";

		rename(registry, manager, "old", def({ id: "new" }));
		assert.strictEqual(registry.settings.fallbackCalloutId, "note");
	});
});

describe("syncAll after a rename — the Obsidian command registration", () => {
	it("re-registers at the SAME id when the display name changed, keeping the hotkey", () => {
		const { registry, manager, log } = harness([command()]);
		registry.add(def({ id: "old", displayName: "Old" }));
		manager.syncAll();
		const commandId = log.added[0]?.id;
		assert.ok(commandId, "expected an initial registration");

		rename(registry, manager, "old", def({ id: "new", displayName: "Renamed" }));
		manager.syncAll();

		assert.deepStrictEqual(log.removed, [commandId], "removed only to re-add");
		assert.strictEqual(log.added.length, 2);
		assert.strictEqual(log.added[1]?.id, commandId, "identity is stable");
		assert.notStrictEqual(log.added[1]?.name, log.added[0]?.name, "label is accurate");
	});

	it("does not re-register for an edit the palette label cannot show", () => {
		const { registry, manager, log } = harness([command()]);
		registry.add(def({ id: "old", displayName: "Old" }));
		manager.syncAll();

		registry.update("old", { colorLight: "#ff0000", icon: { type: "emoji", value: "🌵" } });
		manager.syncAll();

		assert.strictEqual(log.added.length, 1, "addCommand appends an unload callback each time");
		assert.deepStrictEqual(log.removed, []);
	});

	it("pauses a command whose callout is gone", () => {
		const { registry, manager, log } = harness([command()]);
		registry.add(def({ id: "old", displayName: "Old" }));
		manager.syncAll();

		registry.remove("old");
		manager.syncAll();

		assert.strictEqual(registry.settings.customCommands.length, 1);
		assert.strictEqual(log.removed.length, 1);
	});

	it("converges from any state — a repeated sweep changes nothing", () => {
		const { registry, manager, log } = harness([command()]);
		registry.add(def({ id: "old", displayName: "Old" }));

		manager.syncAll();
		manager.syncAll();
		manager.syncAll();

		assert.strictEqual(log.added.length, 1);
		assert.deepStrictEqual(log.removed, []);
	});

	it("drops a malformed stored entry without taking the rest of the list down", () => {
		const { registry, manager } = harness([
			{ id: "", calloutId: "old", role: "regular" } as CustomCommand,
			command({ id: "cc-2", calloutId: "old" }),
		]);
		registry.add(def({ id: "old", displayName: "Old" }));

		manager.syncAll();
		assert.deepStrictEqual(
			registry.settings.customCommands.map((c) => c.id),
			["cc-2"],
		);
	});
});

describe("hasCommandFor — a command is a claim on a callout", () => {
	it("reports the callout a command names, and follows it through a rename", () => {
		// Discovery's prune pass skips ids a command references, the same way it
		// skips a customized row — so this answer has to move with the rename.
		const { registry, manager } = harness([command()]);
		registry.add(def({ id: "old" }));
		assert.strictEqual(manager.hasCommandFor("old"), true);

		rename(registry, manager, "old", def({ id: "new" }));

		assert.strictEqual(manager.hasCommandFor("old"), false);
		assert.strictEqual(manager.hasCommandFor("new"), true);
	});
});
