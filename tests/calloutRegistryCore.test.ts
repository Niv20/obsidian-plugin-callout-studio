/**
 * tests/calloutRegistryCore.test.ts — seeding, persistence and CRUD.
 *
 * The registry is the single source of truth every other subsystem reads, so
 * the things pinned here are the ones whose failure is silent rather than loud:
 *
 * - **`load()` always seeds all 13 built-ins**, whatever `data.json` says. The
 *   README states this as an invariant ("`getAll()` always returns every
 *   built-in"), and CSSInjector, AutoComplete and the public API all assume it.
 * - **`toSaveData()` persists a built-in only when it was modified.** Getting
 *   that gate wrong in one direction bloats `data.json` with 13 untouched rows
 *   forever; in the other it drops a real edit on the next reload.
 * - **A refused mutation must not fire `onChange`.** Every listener on that
 *   event is expensive — regenerate the stylesheet, repaint every icon, write
 *   `data.json` — so a no-op that notifies is a real cost, and a mutation that
 *   *doesn't* notify leaves the screen showing stale state.
 * - **`batch()` coalesces to exactly one round**, which is the whole reason a
 *   rename (a `remove` + an `add`) can be announced as one consistent event.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DEFAULT_CALLOUTS, DEFAULT_SETTINGS } from "../src/constants";
import type { CalloutDefinition, PluginData } from "../src/types";

// Seeded BEFORE the first registry load: `load()` runs the `lucide-` repair
// migration, whose whole question is whether an id is in the prefixed half of
// `getIconIds()` — and `icons/lucideId.ts` memoizes that set on first use. An
// empty list would make every prefixed value look like v2.7.0 damage and get
// un-prefixed, which is the opposite of what the real app does.
(globalThis as { __CS_ICON_IDS__?: string[] }).__CS_ICON_IDS__ = [
	"lucide-pencil",
	"lucide-star",
	"lucide-info",
	// The bare half of the list: Obsidian's internal set and other plugins'
	// `addIcon()` ids. Never prefixed, and that is what the repair pass fixes.
	"dice",
	"remix-QuestionnaireFill",
];

const BUILT_IN_IDS = DEFAULT_CALLOUTS.map((d) => d.id).sort();

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

/** A `data.json` shaped payload. Settings are merged, so a partial is fine. */
function saved(
	callouts: CalloutDefinition[],
	settings?: Record<string, unknown>,
): Partial<PluginData> {
	return { callouts, ...(settings ? { settings } : {}) } as Partial<PluginData>;
}

/** A registry with a change counter already attached. */
function loaded(data: Partial<PluginData> | null = null): {
	registry: CalloutRegistry;
	events: () => number;
} {
	const registry = new CalloutRegistry();
	registry.load(data);
	let n = 0;
	registry.onChange(() => n++);
	return { registry, events: () => n };
}

const ids = (defs: CalloutDefinition[]): string[] => defs.map((d) => d.id);

describe("load() — seeding the built-ins", () => {
	it("seeds all 13 on a first run, with no data at all", () => {
		const { registry } = loaded(null);
		assert.deepStrictEqual(ids(registry.getAll()).sort(), BUILT_IN_IDS);
		assert.strictEqual(registry.getBuiltIn().length, 13);
	});

	it("seeds all 13 from an empty payload too", () => {
		const { registry } = loaded({});
		assert.deepStrictEqual(ids(registry.getAll()).sort(), BUILT_IN_IDS);
	});

	it("seeds all 13 even when data.json stores none of them", () => {
		// This is the normal case, not an edge one: toSaveData writes only the
		// built-ins the user changed, so a typical data.json holds zero. If
		// seeding depended on the file, a fresh vault would have no callouts.
		const { registry } = loaded(saved([def({ id: "mine" })]));
		assert.deepStrictEqual(
			ids(registry.getAll()).sort(),
			[...BUILT_IN_IDS, "mine"].sort(),
		);
	});

	it("orders them by display name, which is the order the map preserves", () => {
		const { registry } = loaded(null);
		assert.deepStrictEqual(ids(registry.getAll()), [
			"abstract",
			"bug",
			"danger",
			"example",
			"failure",
			"info",
			"note",
			"question",
			"quote",
			"success",
			"tip",
			"todo",
			"warning",
		]);
	});

	it("hands out clones, so editing a built-in cannot rewrite the shipped default", () => {
		const { registry } = loaded(null);
		registry.update("note", { displayName: "Rewritten", colorLight: "#000000" });

		const shipped = registry.getBuiltInDefault("note");
		assert.strictEqual(shipped?.displayName, "Note");
		assert.strictEqual(shipped?.colorLight, "#086ddd");
		// And the module-level constant the defaults were cloned FROM.
		assert.strictEqual(
			DEFAULT_CALLOUTS.find((d) => d.id === "note")?.displayName,
			"Note",
		);
	});

	it("clears everything from the previous load rather than merging onto it", () => {
		const registry = new CalloutRegistry();
		registry.load(saved([def({ id: "first" })]));
		assert.ok(registry.has("first"));

		registry.load(saved([def({ id: "second" })]));
		assert.strictEqual(registry.has("first"), false);
		assert.ok(registry.has("second"));
	});

	it("merges a saved built-in override onto the shipped default", () => {
		// data.json stores only the fields the user changed for a built-in, so
		// everything else has to come from the default underneath it.
		const { registry } = loaded(
			saved([{ id: "note", colorLight: "#ff0000", builtIn: true } as CalloutDefinition]),
		);
		const note = registry.get("note");

		assert.strictEqual(note?.colorLight, "#ff0000");
		assert.strictEqual(note?.colorDark, "#027aff", "kept from the default");
		assert.strictEqual(note?.displayName, "Note", "kept from the default");
		assert.deepStrictEqual(note?.icon, { type: "lucide", value: "pencil" });
		assert.strictEqual(note?.builtIn, true, "re-stamped, never trusted");
		assert.strictEqual(note?.source, "builtin", "re-stamped, never trusted");
	});

	it("demotes a saved builtIn:true row whose id is not one of the 13", () => {
		// It can't be merged onto a default that doesn't exist, and it must not
		// keep the flag either — a forged built-in would gain the built-in's
		// theme deference and be compared against a shipped row that is not
		// there. Kept as the user row it really is, rather than dropped: the
		// alternative silently deletes a callout the vault's notes still use.
		const { registry } = loaded(
			saved([def({ id: "ghost", builtIn: true, source: "builtin" })]),
		);
		const ghost = registry.get("ghost");

		assert.strictEqual(ghost?.builtIn, false);
		assert.strictEqual(ghost?.source, "user");
		assert.strictEqual(registry.getAll().length, 14);
		assert.strictEqual(registry.getBuiltIn().length, 13);
	});

	it("reclaims a built-in id a saved user row had taken over", () => {
		// Such a row overwrote the seed outright and left `getAll()` holding 12
		// built-ins — against the invariant CSSInjector, AutoComplete and the
		// public API all read. There is only one callout per id, so the row is
		// the built-in's customization with its flag lost: merge it onto the
		// default, keeping the edit and restoring the seed.
		const { registry } = loaded(
			saved([def({ id: "note", displayName: "Mine", builtIn: false, source: "user" })]),
		);
		assert.strictEqual(registry.get("note")?.displayName, "Mine", "the edit is kept");
		assert.strictEqual(registry.get("note")?.builtIn, true);
		assert.strictEqual(registry.get("note")?.source, "builtin");
		assert.strictEqual(registry.getBuiltIn().length, 13);
		assert.strictEqual(registry.getAll().length, 13, "no duplicate row beside it");
	});

	it("keeps the rest of the built-in's fields underneath that row", () => {
		const { registry } = loaded(
			saved([def({ id: "note", displayName: "Mine", builtIn: false, source: "user" })]),
		);
		// `def()` states colours of its own, so the ones it does NOT state have
		// to come from the shipped default, exactly as for a `builtIn: true` row.
		assert.strictEqual(registry.get("note")?.foldable, true);
		assert.strictEqual(registry.get("note")?.colorLight, "#336699", "the row's own");
	});

	it("flushes that repair so the file stops carrying the broken shape", () => {
		const registry = new CalloutRegistry();
		registry.load(
			saved([def({ id: "note", displayName: "Mine", builtIn: false, source: "user" })]),
		);
		assert.strictEqual(registry.needsSaveAfterLoad(), true);

		const rewritten = registry.toSaveData();
		assert.strictEqual(rewritten.callouts[0]?.builtIn, true, "saved as a built-in now");

		const second = new CalloutRegistry();
		second.load(rewritten);
		assert.strictEqual(second.needsSaveAfterLoad(), false, "nothing left to repair");
		assert.strictEqual(second.get("note")?.displayName, "Mine");
	});

	it("drops a reclaimed row that turned out to match the default", () => {
		// It carries no edit at all, so the built-in gate stops persisting it —
		// which is only durable because the repair flushes.
		const { registry } = loaded(
			saved([
				{
					...DEFAULT_CALLOUTS.find((d) => d.id === "note"),
					builtIn: false,
					source: "user",
				} as CalloutDefinition,
			]),
		);
		assert.strictEqual(registry.isBuiltInModified("note"), false);
		assert.deepStrictEqual(registry.toSaveData().callouts, []);
	});

	it("restores the icon of a callout still on the removed `svg` type", () => {
		const { registry } = loaded(
			saved([
				def({ id: "legacy", icon: { type: "svg", value: "<svg/>" } as never }),
			]),
		);
		assert.deepStrictEqual(registry.get("legacy")?.icon, {
			type: "lucide",
			value: "lucide-pencil",
		});
	});

	it("undoes v2.7.0's `lucide-` prefix on an id core Lucide does not own", () => {
		// Prefixed, `getIcon` looks in the core table and nowhere else — so on
		// another plugin's `addIcon()` id the prefix named nothing at all and
		// the callout lost its icon everywhere at once.
		const { registry } = loaded(
			saved([
				def({
					id: "borrowed",
					icon: { type: "lucide", value: "lucide-remix-QuestionnaireFill" },
				}),
				def({ id: "internal", icon: { type: "lucide", value: "lucide-dice" } }),
			]),
		);

		assert.strictEqual(
			registry.get("borrowed")?.icon.value,
			"remix-QuestionnaireFill",
		);
		assert.strictEqual(registry.get("internal")?.icon.value, "dice");
	});

	it("leaves a real core Lucide id prefixed, because that spelling draws", () => {
		const { registry } = loaded(
			saved([def({ id: "real", icon: { type: "lucide", value: "lucide-star" } })]),
		);
		assert.strictEqual(registry.get("real")?.icon.value, "lucide-star");
	});

	it("keeps the settings defaults when the payload carries none", () => {
		const { registry } = loaded(saved([]));
		assert.strictEqual(
			registry.settings.fallbackCalloutId,
			DEFAULT_SETTINGS.fallbackCalloutId,
		);
	});
});

describe("toSaveData() — what reaches data.json", () => {
	it("writes no callouts at all for an untouched vault", () => {
		const { registry } = loaded(null);
		assert.deepStrictEqual(registry.toSaveData().callouts, []);
	});

	it("stamps the current data version", () => {
		const { registry } = loaded(null);
		assert.strictEqual(registry.toSaveData().version, 4);
	});

	it("always writes settings, even with nothing else to write", () => {
		const { registry } = loaded(null);
		assert.strictEqual(registry.toSaveData().settings, registry.settings);
	});

	it("persists a built-in once it differs from its shipped default", () => {
		const { registry } = loaded(null);
		registry.update("note", { colorLight: "#ff0000" });

		assert.deepStrictEqual(ids(registry.toSaveData().callouts), ["note"]);
	});

	it("stops persisting it again the moment it is reset", () => {
		const { registry } = loaded(null);
		registry.update("note", { colorLight: "#ff0000" });
		registry.resetBuiltIn("note");

		assert.deepStrictEqual(registry.toSaveData().callouts, []);
	});

	it("persists every user callout unconditionally", () => {
		const { registry } = loaded(null);
		registry.add(def({ id: "mine" }));
		registry.add(def({ id: "discovered", source: "fallback" }));

		assert.deepStrictEqual(
			ids(registry.toSaveData().callouts).sort(),
			["discovered", "mine"],
		);
	});

	it("omits an empty icon cache rather than writing an empty array", () => {
		const { registry } = loaded(null);
		assert.strictEqual(registry.toSaveData().iconSvgCache, undefined);

		registry.addIconSvg({ pack: "lucide", name: "star", variant: "", svg: "<svg/>" });
		assert.strictEqual(registry.toSaveData().iconSvgCache?.length, 1);
	});

	it("never writes back the pre-2.4 materialSvgCache it migrated from", () => {
		const registry = new CalloutRegistry();
		registry.load({
			materialSvgCache: [
				{ name: "home", style: "outlined", weight: 400, svg: "<svg/>" },
			],
		} as Partial<PluginData>);

		const out = registry.toSaveData() as PluginData & {
			materialSvgCache?: unknown;
		};
		assert.strictEqual(out.materialSvgCache, undefined);
		assert.strictEqual(out.iconSvgCache?.length, 1, "folded into the generic cache");
		assert.strictEqual(out.iconSvgCache?.[0]?.pack, "material");
	});
});

describe("add()", () => {
	it("stores the definition and announces it", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.add(def({ id: "fresh" })), true);
		assert.ok(registry.has("fresh"));
		assert.strictEqual(events(), 1);
	});

	it("refuses a duplicate id, silently and without notifying", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.add(def({ id: "note" })), false);
		assert.strictEqual(registry.get("note")?.displayName, "Note", "untouched");
		assert.strictEqual(events(), 0);
	});

	it("refuses an id that is already someone else's alias", () => {
		// `summary` is an alias of the built-in `abstract`. Allowing it would
		// give one raw id in the vault two definitions to resolve through.
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.add(def({ id: "summary" })), false);
		assert.strictEqual(events(), 0);
	});

	it("refuses when one of its own aliases collides with an existing id", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.add(def({ id: "fresh", aliases: ["note"] })), false);
		assert.strictEqual(registry.has("fresh"), false, "rejected whole, not partially");
		assert.strictEqual(events(), 0);
	});

	it("refuses when one of its own aliases collides with an existing alias", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.add(def({ id: "fresh", aliases: ["tldr"] })), false);
		assert.strictEqual(events(), 0);
	});
});

describe("update()", () => {
	it("merges the partial over the stored definition", () => {
		const { registry } = loaded(null);
		registry.update("note", { colorLight: "#ff0000" });

		assert.strictEqual(registry.get("note")?.colorLight, "#ff0000");
		assert.strictEqual(registry.get("note")?.colorDark, "#027aff", "untouched");
	});

	it("returns false and notifies nothing for an id that does not exist", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.update("nope", { displayName: "z" }), false);
		assert.strictEqual(events(), 0);
	});

	it("moves the entry when the partial carries a new id", () => {
		const { registry } = loaded(null);
		registry.add(def({ id: "old", displayName: "Old" }));

		assert.strictEqual(registry.update("old", { id: "new" }), true);
		assert.strictEqual(registry.has("old"), false);
		assert.strictEqual(registry.get("new")?.displayName, "Old");
	});

	it("refuses a rename onto an id that is taken, leaving both rows intact", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.update("note", { id: "info" }), false);
		assert.ok(registry.has("note"), "the source row must survive a refusal");
		assert.strictEqual(registry.get("info")?.displayName, "Info");
		assert.strictEqual(events(), 0);
	});

	it("checks aliases on a rename, exactly as add() does", () => {
		// `summary` is the built-in `abstract`'s alias. A rename that landed on
		// it left one raw id resolving through two definitions — `[!summary]`
		// reaching the renamed row here and `abstract` through its alias.
		const { registry, events } = loaded(null);
		registry.add(def({ id: "mine" }));
		const before = events();

		assert.strictEqual(registry.update("mine", { id: "summary" }), false);
		assert.ok(registry.has("mine"), "the source row must survive a refusal");
		assert.strictEqual(registry.has("summary"), false);
		assert.strictEqual(registry.findByAlias("summary")?.id, "abstract");
		assert.strictEqual(events(), before, "a refusal announces nothing");
	});

	it("still lets a callout be renamed onto one of its OWN aliases", () => {
		// The row cannot conflict with itself, and `add()` accepts the same
		// shape — a fresh definition whose id is also one of its aliases.
		const { registry } = loaded(null);
		registry.add(def({ id: "mine", aliases: ["mine-alt"] }));

		assert.strictEqual(registry.update("mine", { id: "mine-alt" }), true);
		assert.ok(registry.has("mine-alt"));
	});
});

describe("remove()", () => {
	it("deletes a user callout and announces it", () => {
		const { registry, events } = loaded(null);
		registry.add(def({ id: "mine" }));

		assert.strictEqual(registry.remove("mine"), true);
		assert.strictEqual(registry.has("mine"), false);
		assert.strictEqual(events(), 2, "one for the add, one for the remove");
	});

	it("refuses to delete a built-in", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.remove("note"), false);
		assert.ok(registry.has("note"));
		assert.strictEqual(events(), 0);
	});

	it("returns false for an id that is not there", () => {
		const { registry, events } = loaded(null);
		assert.strictEqual(registry.remove("nope"), false);
		assert.strictEqual(events(), 0);
	});
});

describe("batch() — coalescing the change event", () => {
	it("announces a rename's remove + add exactly once", () => {
		// The whole reason the rename flow is batched: un-batched, the remove's
		// event reaches CustomCommandManager.syncAll() while the commands still
		// point at an id that has just stopped existing, and it prunes them.
		const { registry, events } = loaded(saved([def({ id: "old" })]));

		const ok = registry.batch(() => {
			registry.remove("old");
			return registry.add(def({ id: "new" }));
		});

		assert.strictEqual(ok, true, "returns the body's value");
		assert.strictEqual(events(), 1);
		assert.strictEqual(registry.has("old"), false);
		assert.ok(registry.has("new"));
	});

	it("fires that one event only after the body has finished", () => {
		const registry = new CalloutRegistry();
		registry.load(saved([def({ id: "old" })]));
		let seen: string[] = [];
		registry.onChange(() => {
			seen = ids(registry.getAll()).filter((id) => id === "old" || id === "new");
		});

		registry.batch(() => {
			registry.remove("old");
			registry.add(def({ id: "new" }));
		});

		assert.deepStrictEqual(seen, ["new"], "listeners never see the half-done state");
	});

	it("stays at one event through nesting", () => {
		const { registry, events } = loaded(null);

		registry.batch(() => {
			registry.batch(() => {
				registry.add(def({ id: "a" }));
			});
			assert.strictEqual(events(), 0, "the inner batch must not flush");
			registry.add(def({ id: "b" }));
		});

		assert.strictEqual(events(), 1);
	});

	it("fires nothing at all when the body mutated nothing", () => {
		const { registry, events } = loaded(null);
		registry.batch(() => {
			registry.add(def({ id: "note" })); // refused — already exists
		});
		assert.strictEqual(events(), 0);
	});

	it("fires nothing for a body that only read", () => {
		const { registry, events } = loaded(null);
		const count = registry.batch(() => registry.getAll().length);
		assert.strictEqual(count, 13);
		assert.strictEqual(events(), 0);
	});

	it("still flushes — and unwinds its depth — when the body throws", () => {
		const { registry, events } = loaded(null);

		assert.throws(() => {
			registry.batch(() => {
				registry.add(def({ id: "partial" }));
				throw new Error("boom");
			});
		}, /boom/);

		assert.strictEqual(events(), 1, "the mutation that did land is announced");
		assert.ok(registry.has("partial"));

		// Depth is restored in a `finally`, so the next batch is not stuck open.
		registry.batch(() => {
			registry.add(def({ id: "after" }));
		});
		assert.strictEqual(events(), 2);
	});
});
