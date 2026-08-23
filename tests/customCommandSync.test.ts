/**
 * tests/customCommandSync.test.ts — `CustomCommandManager.syncAll()`.
 *
 * The whole feature is this one sweep. It is subscribed to `registry.onChange`,
 * an event that carries no payload — a listener cannot tell a delete from an
 * update from an add, and a callout id "rename" is really a remove followed by
 * an add — so per-event handlers are not merely inconvenient here, they are
 * impossible. Re-deriving the desired set from the registry converges from any
 * starting state instead, which is what makes deletion, auto-pruning, editing,
 * importing, startup and re-enabling one code path.
 *
 * Three properties follow, and each is load-bearing:
 *
 * - **Idempotence.** Running it twice must leave Obsidian's command list — and
 *   the manager's own bookkeeping — exactly where the first run did. A sweep
 *   that re-registered on every change would fire on every colour tweak.
 * - **Only a changed rendered *name* re-registers.** `addCommand` mutates its
 *   argument and appends an unload callback that only unwinds on unload, so a
 *   needless call leaks both; and the id must stay the same across a real
 *   re-registration, because that is what keeps the user's hotkey.
 * - **A command is a claim on a callout.** When the callout goes, the command
 *   goes with it — loudly once the plugin is running, quietly at startup, where
 *   dropping entries is expected housekeeping rather than news.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { Command } from "obsidian";
import { CustomCommandManager } from "../src/editor/CustomCommandManager";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	describeCommand,
	obsidianCommandId,
} from "../src/utils/customCommands";
import type { CalloutDefinition, CustomCommand } from "../src/types";
import { asEditor, editor } from "./support/fakeEditor";
import {
	blankLiterals,
	pluginSourceFiles,
	readRepoFile,
	report,
} from "./support/sourceScan";

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

type Host = ConstructorParameters<typeof CustomCommandManager>[0];

interface Harness {
	registry: CalloutRegistry;
	manager: CustomCommandManager;
	/** Every `addCommand` payload, in call order. */
	added: Command[];
	/** Every id handed to `removeCommand`, in call order. */
	removed: string[];
	/** How many times settings were written. */
	saves: number;
	commands: CustomCommand[];
	/** Forget what has been recorded so far, without resetting the manager. */
	clear(): void;
}

/**
 * Notices raised by anything under test, newest last. The stub `Notice` records
 * into whatever array is parked on this global (see tests/support/obsidianStub.ts),
 * so installing it once at module scope is enough; suites that assert on it
 * clear it themselves at the point they start caring.
 */
const notices: string[] = [];
(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;

function harness(): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const added: Command[] = [];
	const removed: string[] = [];
	const state = { saves: 0 };

	const plugin = {
		registry,
		settings: registry.settings,
		saveSettings: () => {
			state.saves++;
			return Promise.resolve();
		},
		addCommand: (command: Command) => {
			added.push(command);
			return command;
		},
		removeCommand: (id: string) => void removed.push(id),
	};

	return {
		registry,
		manager: new CustomCommandManager(plugin as unknown as Host),
		added,
		removed,
		get saves() {
			return state.saves;
		},
		commands: registry.settings.customCommands,
		clear() {
			added.length = 0;
			removed.length = 0;
		},
	};
}

function addCallout(
	registry: CalloutRegistry,
	over: Partial<CalloutDefinition> = {},
): void {
	registry.add({
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	});
}

/** Push a command straight into settings, bypassing `add()`'s own sweep. */
function seed(h: Harness, over: Partial<CustomCommand> = {}): CustomCommand {
	const command: CustomCommand = {
		id: "cc-1",
		calloutId: "quiet",
		role: "regular",
		action: "insert",
		...over,
	};
	h.registry.settings.customCommands.push(command);
	return command;
}

const idsOf = (commands: Command[]): string[] => commands.map((c) => c.id);

/* -------------------------------------------------------------------------- */
/* Idempotence                                                                */
/* -------------------------------------------------------------------------- */

describe("syncAll — the idempotent sweep", () => {
	it("registers each stored command once", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();

		assert.deepStrictEqual(idsOf(h.added), [obsidianCommandId("cc-1")]);
		assert.deepStrictEqual(h.removed, []);
	});

	it("does nothing on a second run", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		h.clear();

		h.manager.syncAll();
		h.manager.syncAll();

		assert.deepStrictEqual(h.added, []);
		assert.deepStrictEqual(h.removed, []);
	});

	it("converges to the same command list however it got there", () => {
		// Registered → stored list emptied → registered again: the sweep has to
		// remove and then re-add, from state alone, with no event to tell it so.
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		h.clear();

		h.registry.settings.customCommands.length = 0;
		h.manager.syncAll();
		assert.deepStrictEqual(h.removed, [obsidianCommandId("cc-1")]);

		h.clear();
		seed(h);
		h.manager.syncAll();
		assert.deepStrictEqual(idsOf(h.added), [obsidianCommandId("cc-1")]);
	});

	it("mints Obsidian ids with no second colon", () => {
		// Obsidian prefixes `callout-studio:`; a nested colon in our half would
		// make the full id ambiguous to anything that splits on it.
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();

		assert.ok(!h.added[0]?.id.includes(":"));
	});

	it("registers an editorCallback, never a bare callback", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();

		assert.strictEqual(typeof h.added[0]?.editorCallback, "function");
		assert.strictEqual(h.added[0]?.callback, undefined);
	});
});

/* -------------------------------------------------------------------------- */
/* What does and does not cause churn                                          */
/* -------------------------------------------------------------------------- */

describe("syncAll — churn", () => {
	it("re-registers when the callout's display name changes", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		h.clear();

		h.registry.update("quiet", { displayName: "Library Voice" });
		h.manager.syncAll();

		assert.deepStrictEqual(h.removed, [obsidianCommandId("cc-1")]);
		assert.deepStrictEqual(idsOf(h.added), [obsidianCommandId("cc-1")]);
		assert.ok(h.added[0]?.name.includes("Library Voice"));
	});

	it("keeps the same id across that re-registration", () => {
		// Obsidian keys the user's hotkey by command id, and `removeCommand`
		// clears only the *default* keys — so re-adding here is what saves it.
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		const before = h.added[0]?.id;
		h.clear();

		h.registry.update("quiet", { displayName: "Library Voice" });
		h.manager.syncAll();

		assert.strictEqual(h.added[0]?.id, before);
		assert.strictEqual(h.removed[0], before);
	});

	it("does NOT re-register for an icon edit", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		h.clear();

		h.registry.update("quiet", { icon: { type: "lucide", value: "star" } });
		h.manager.syncAll();

		assert.deepStrictEqual(h.added, []);
		assert.deepStrictEqual(h.removed, []);
	});

	it("does NOT re-register for a colour edit", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		h.clear();

		h.registry.update("quiet", { colorLight: "#ff0000", colorDark: "#00ff00" });
		h.manager.syncAll();

		assert.deepStrictEqual(h.added, []);
		assert.deepStrictEqual(h.removed, []);
	});

	it("does NOT re-register for an alias or fold-default edit", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		h.clear();

		h.registry.update("quiet", { aliases: ["hush"], foldable: true });
		h.manager.syncAll();

		assert.deepStrictEqual(h.added, []);
		assert.deepStrictEqual(h.removed, []);
	});

	it("hands addCommand a fresh object each time", () => {
		// It mutates what it is given, prefixing the id and name in place.
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		const first = h.added[0];
		h.clear();

		h.registry.update("quiet", { displayName: "Renamed" });
		h.manager.syncAll();

		assert.notStrictEqual(h.added[0], first);
	});

	it("re-derives the name rather than storing it, so a rename reaches the palette", () => {
		const h = harness();
		addCallout(h.registry);
		const command = seed(h);
		h.manager.syncAll();
		h.clear();

		h.registry.update("quiet", { displayName: "Renamed" });
		h.manager.syncAll();

		const def = h.registry.get("quiet");
		assert.ok(def);
		assert.strictEqual(h.added[0]?.name, describeCommand(command, def));
	});
});

/* -------------------------------------------------------------------------- */
/* Dropping what cannot survive                                                */
/* -------------------------------------------------------------------------- */

describe("syncAll — dropping commands", () => {
	it("drops a command whose callout is gone, and says so once running", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll(); // the startup sweep
		h.clear();
		notices.length = 0;

		h.registry.remove("quiet");
		h.manager.syncAll();

		assert.deepStrictEqual(h.removed, [obsidianCommandId("cc-1")]);
		assert.deepStrictEqual(h.registry.settings.customCommands, []);
		assert.strictEqual(notices.length, 1, "the user gets told");
	});

	it("stays quiet about it at startup", () => {
		// A command with no callout is housekeeping on the first sweep, not news.
		notices.length = 0;
		const h = harness();
		seed(h); // its callout was never added
		h.manager.syncAll();

		assert.deepStrictEqual(h.added, []);
		assert.deepStrictEqual(h.registry.settings.customCommands, []);
		assert.deepStrictEqual(notices, []);
	});

	it("drops only the broken entries, never the whole list", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h, { id: "cc-1" });
		h.registry.settings.customCommands.push({
			id: "cc-bad",
			calloutId: "quiet",
			role: "banana",
		} as unknown as CustomCommand);
		seed(h, { id: "cc-2", role: "inline" });

		h.manager.syncAll();

		assert.deepStrictEqual(idsOf(h.added), [
			obsidianCommandId("cc-1"),
			obsidianCommandId("cc-2"),
		]);
		assert.deepStrictEqual(
			h.registry.settings.customCommands.map((c) => c.id),
			["cc-1", "cc-2"],
		);
	});

	it("never raises a notice for a malformed entry — that is a log line", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		notices.length = 0;

		h.registry.settings.customCommands.push(null as unknown as CustomCommand);
		h.manager.syncAll();

		assert.deepStrictEqual(notices, []);
	});

	it("persists the pruned list", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		const before = h.saves;

		h.registry.remove("quiet");
		h.manager.syncAll();

		assert.ok(h.saves > before, "a pruned list has to reach data.json");
	});

	it("saves nothing when there was nothing to drop", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		const before = h.saves;

		h.manager.syncAll();
		assert.strictEqual(h.saves, before);
	});
});

/* -------------------------------------------------------------------------- */
/* Rename                                                                      */
/* -------------------------------------------------------------------------- */

describe("migrateCalloutId", () => {
	it("is what keeps a command alive across an id rename", () => {
		// The sweep alone would see a command pointing at an id that no longer
		// exists and correctly — but very unhelpfully — delete it.
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		h.clear();

		h.registry.remove("quiet");
		addCallout(h.registry, { id: "hushed", displayName: "Quiet" });
		h.manager.migrateCalloutId("quiet", "hushed");
		h.manager.syncAll();

		assert.deepStrictEqual(h.registry.settings.customCommands, [
			{ id: "cc-1", calloutId: "hushed", role: "regular", action: "insert" },
		]);
		// The rendered name did not move, so nothing was re-registered either.
		assert.deepStrictEqual(h.added, []);
		assert.deepStrictEqual(h.removed, []);
	});

	it("does nothing when the id did not actually change", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.migrateCalloutId("quiet", "quiet");

		assert.strictEqual(h.registry.settings.customCommands[0]?.calloutId, "quiet");
	});

	it("moves every command pointing at the old id", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h, { id: "cc-1" });
		seed(h, { id: "cc-2", role: "inline" });
		seed(h, { id: "cc-3", calloutId: "note", role: "inline" });

		h.manager.migrateCalloutId("quiet", "hushed");

		assert.deepStrictEqual(
			h.registry.settings.customCommands.map((c) => c.calloutId),
			["hushed", "hushed", "note"],
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The list API                                                                */
/* -------------------------------------------------------------------------- */

describe("add / update / remove", () => {
	it("mints an id on add and registers it", async () => {
		const h = harness();
		addCallout(h.registry);

		const command = await h.manager.add({ calloutId: "quiet", role: "inline" });

		assert.ok(command.id.length > 0);
		assert.deepStrictEqual(idsOf(h.added), [obsidianCommandId(command.id)]);
		assert.strictEqual(h.manager.list().length, 1);
	});

	it("keeps the id — and therefore the hotkey — across an update", () => {
		const h = harness();
		addCallout(h.registry);

		return h.manager
			.add({ calloutId: "quiet", role: "inline" })
			.then(async (command) => {
				h.clear();
				const ok = await h.manager.update(command.id, {
					calloutId: "quiet",
					role: "heading",
					headingLevel: 3,
				});

				assert.strictEqual(ok, true);
				assert.strictEqual(h.manager.list()[0]?.id, command.id);
				// The rendered name changed (H3 heading vs. inline), so exactly
				// one remove + one add, both at the same id.
				assert.deepStrictEqual(h.removed, [obsidianCommandId(command.id)]);
				assert.deepStrictEqual(idsOf(h.added), [
					obsidianCommandId(command.id),
				]);
			});
	});

	it("reports a miss rather than inventing a command", async () => {
		const h = harness();
		assert.strictEqual(
			await h.manager.update("nope", { calloutId: "quiet", role: "inline" }),
			false,
		);
		assert.strictEqual(await h.manager.remove("nope"), false);
	});

	it("unregisters on remove", async () => {
		const h = harness();
		addCallout(h.registry);
		const command = await h.manager.add({ calloutId: "quiet", role: "inline" });
		h.clear();

		assert.strictEqual(await h.manager.remove(command.id), true);
		assert.deepStrictEqual(h.removed, [obsidianCommandId(command.id)]);
		assert.deepStrictEqual(h.manager.list(), []);
	});

	it("answers whether any command claims a callout", () => {
		const h = harness();
		addCallout(h.registry);
		assert.strictEqual(h.manager.hasCommandFor("quiet"), false);

		seed(h);
		assert.strictEqual(h.manager.hasCommandFor("quiet"), true);
		assert.strictEqual(h.manager.hasCommandFor("note"), false);
	});
});

/* -------------------------------------------------------------------------- */
/* Running one                                                                 */
/* -------------------------------------------------------------------------- */

describe("the registered editorCallback", () => {
	function run(h: Harness, buffer: string, which?: Command): string {
		const command = which ?? h.added.at(-1);
		assert.ok(command?.editorCallback);
		const ed = editor(buffer);
		command.editorCallback(asEditor(ed), {} as never);
		return ed.getValue();
	}

	it("looks the command up at run time, so an edit takes effect immediately", async () => {
		// The registration is deliberately not closed over the configuration:
		// an edited command behaves as it is configured *now*, even when the
		// registration itself was left in place because the name did not move.
		const h = harness();
		addCallout(h.registry);
		const command = await h.manager.add({
			calloutId: "quiet",
			role: "regular",
			action: "insert",
		});
		assert.strictEqual(run(h, ""), "> [!quiet] Quiet\n> ");

		// Same rendered name is impossible across insert/wrap, so edit to another
		// callout with the same name instead — no re-registration happens.
		h.clear();
		addCallout(h.registry, { id: "hushed", displayName: "Quiet" });
		await h.manager.update(command.id, {
			calloutId: "hushed",
			role: "regular",
			action: "insert",
		});
		assert.deepStrictEqual(h.added, [], "nothing re-registered");

		const stale = h.registry.settings.customCommands[0];
		assert.strictEqual(stale?.calloutId, "hushed");
	});

	it("writes what each role writes", async () => {
		const h = harness();
		addCallout(h.registry);

		// An `insert` command opens the callout the way a user continues one:
		// the header, then an empty quoted line to type into. `wrap` has real
		// content to put there instead, so it writes no such line.
		await h.manager.add({ calloutId: "quiet", role: "regular", action: "insert" });
		assert.strictEqual(run(h, ""), "> [!quiet] Quiet\n> ");

		await h.manager.add({ calloutId: "quiet", role: "regular", action: "wrap" });
		assert.strictEqual(run(h, "hello"), "> [!quiet] Quiet\n> hello");

		await h.manager.add({ calloutId: "quiet", role: "heading", headingLevel: 3 });
		assert.strictEqual(run(h, ""), "### [!quiet]");

		await h.manager.add({ calloutId: "quiet", role: "inline" });
		assert.ok(run(h, "").startsWith("[!quiet]"));
	});

	it("tells the user and converges when the callout vanished silently", () => {
		const h = harness();
		addCallout(h.registry);
		seed(h);
		h.manager.syncAll();
		const registered = h.added.at(-1);
		assert.ok(registered);
		h.clear();
		notices.length = 0;

		// Removed straight out of the map, with no sweep in between.
		(h.registry as unknown as { callouts: Map<string, unknown> }).callouts.delete(
			"quiet",
		);
		run(h, "", registered);

		// Two notices, and both earn their place: the first explains why
		// pressing the hotkey did nothing, the second reports the command the
		// converging sweep then took away.
		assert.strictEqual(notices.length, 2);
		assert.deepStrictEqual(h.removed, [obsidianCommandId("cc-1")]);
		assert.deepStrictEqual(h.registry.settings.customCommands, []);
	});
});

/* -------------------------------------------------------------------------- */
/* A callout is not a command                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The invariant the whole feature rests on, stated as a negative.
 *
 * Existing *callouts* imply nothing about registered *commands*: the stored
 * list in `settings.customCommands` is the only source. This has always been
 * true, but it was never pinned, and it is exactly the property a well-meaning
 * "just register them all so the picker can invoke one" change would quietly
 * break — which is why the quick-insert window calls `wrapSelectionInCallout`
 * directly instead of firing a command.
 *
 * Thirteen built-ins plus a user callout plus a discovered row is a vault where
 * the wrong design would register fifteen palette entries.
 */
describe("the existence of a callout implies no command", () => {
	function populated(): Harness {
		const h = harness();
		addCallout(h.registry);
		addCallout(h.registry, { id: "louder", displayName: "Louder" });
		addCallout(h.registry, {
			id: "seen-in-a-note",
			displayName: "Seen in a note",
			source: "fallback",
		});
		return h;
	}

	it("registers nothing at all when the user configured nothing", () => {
		const h = populated();
		assert.ok(h.registry.getAll().length >= 16, "vault should be populated");
		h.manager.syncAll();
		assert.deepEqual(h.added, []);
		assert.deepEqual(h.removed, []);
	});

	it("registers nothing more when a callout is created later", () => {
		const h = populated();
		h.manager.syncAll();
		h.clear();
		addCallout(h.registry, { id: "brand-new", displayName: "Brand new" });
		h.manager.syncAll();
		assert.deepEqual(h.added, []);
	});

	it("registers exactly the configured commands, and only those", () => {
		const h = populated();
		seed(h, { id: "cc-1", calloutId: "quiet" });
		seed(h, { id: "cc-2", calloutId: "louder", role: "inline" });
		h.manager.syncAll();
		assert.deepEqual(idsOf(h.added), [
			obsidianCommandId("cc-1"),
			obsidianCommandId("cc-2"),
		]);
	});

	it("never registers the role × callout product", () => {
		const h = populated();
		seed(h, { id: "cc-1", calloutId: "quiet", role: "heading" });
		h.manager.syncAll();
		assert.equal(h.added.length, 1);
		// One row in the builder is one palette entry, whatever the role.
		assert.ok(!idsOf(h.added).some((id) => id.includes("inline")));
	});
});

describe("no code path registers a command per callout", () => {
	/** Every module that is allowed to call `addCommand` at all. */
	const CALLERS = ["src/editor/commands.ts", "src/editor/CustomCommandManager.ts"];

	it("keeps addCommand to the two modules that own it", () => {
		const offenders = pluginSourceFiles()
			.filter((f) => !CALLERS.includes(f.path))
			.filter((f) => /\.addCommand\s*\(/.test(blankLiterals(f.text)))
			.map((f) => f.path);
		assert.deepEqual(
			offenders,
			[],
			report(
				"addCommand belongs to commands.ts (the fixed set) and CustomCommandManager.ts (the user's list). A third caller is how a callout starts implying a command:",
				offenders,
			),
		);
	});

	it("never reaches the registry's callout list from a registration site", () => {
		const offenders: string[] = [];
		for (const path of CALLERS) {
			const text = blankLiterals(readRepoFile(path));
			// `getAll()` is legitimate for *naming* (isKnownDisplayName); iterating
			// it to register is not, and a `for` over it is what that looks like.
			if (/for\s*\([^)]*of\s+[^)]*registry[\s\S]{0,40}\.(getAll|getBuiltIn|getUserDefined)\(/.test(text)) {
				offenders.push(path);
			}
		}
		assert.deepEqual(
			offenders,
			[],
			report(
				"A registration sweep must iterate settings.customCommands, never the registry:",
				offenders,
			),
		);
	});
});
