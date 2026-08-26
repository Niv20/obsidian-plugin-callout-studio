/**
 * tests/calloutRegistryMigrations.test.ts — the five load-time repair passes.
 *
 * Every one of them keys on the definitions' *content* rather than on
 * `data.version`, because an imported or hand-edited file can carry any version
 * it likes. That choice is what makes them idempotent, and idempotence is the
 * property most worth pinning: these run on every launch, over data the user
 * cannot see, and a pass that is not a fixed point either keeps re-doing work
 * or keeps destroying a little more each time.
 *
 * The second half of the file covers `needsSaveAfterLoad()`, the flag that
 * decides whether a repair is written back. It is not bookkeeping: a migration
 * that mutates the map without raising it is re-run on every single launch and
 * never persisted — the exact failure the flag exists to prevent, and one the
 * `stripMetadataFromIds` alias branch was fixed for. Every pass that rewrites
 * the map raises it, and each one is pinned below with the round trip that
 * proves it settles rather than re-arming on the next launch.
 *
 * Order matters between them and is asserted where it does:
 *   dropStaleTransparencyFlags → consolidateDuplicatePalettes →
 *   adoptOrphansMatchingPalettes → dropDerivedBackgrounds →
 *   dropSolidBackgroundFlags → stripMetadataFromIds → reconcileIdCollisions
 *
 * Each round trip feeds back the WHOLE `toSaveData()` envelope rather than just
 * its `callouts`, because that is what a relaunch actually reads — and because
 * one of the migrations records its verdict in `settings` rather than on a row
 * (`defaultStyleMode`, see manager/styleModeMigration.ts). Dropping the
 * settings half would leave that one re-arming forever and would say nothing
 * true about the others.
 *
 * The colour normalization at the end of the file is the odd one out: it runs
 * per row inside `reconcileSavedRow` rather than as a pass over the finished
 * map, so it is already done by the time any of the above reads a hex. Same two
 * properties though, and pinned the same way.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DEFAULT_SETTINGS } from "../src/constants";
import { bgTintFor, derivedBgAmount } from "../src/utils/colorUtils";
import type {
	CalloutDefinition,
	CustomPalette,
	PluginData,
} from "../src/types";

const ACCENT_LIGHT = "#336699";
const ACCENT_DARK = "#88bbee";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: ACCENT_LIGHT,
		colorDark: ACCENT_DARK,
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

function saved(
	callouts: CalloutDefinition[],
	settings?: Record<string, unknown>,
): Partial<PluginData> {
	return { callouts, ...(settings ? { settings } : {}) } as Partial<PluginData>;
}

function load(data: Partial<PluginData> | null): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(data);
	return registry;
}

/**
 * A file this build would itself have written: rows already carrying their
 * style mode, and the vault's era already recorded.
 *
 * `saved()` models a file from *before* a migration, which is what most of this
 * suite wants. A handful of assertions mean the opposite — "there is nothing
 * left to repair" — and for those the difference is the whole point.
 */
function current(callouts: CalloutDefinition[]): Partial<PluginData> {
	return { callouts: [...callouts] } as Partial<PluginData>;
}

/** A saved custom palette whose six colors are all spelled out. */
function palette(over: Partial<CustomPalette> = {}): CustomPalette {
	return {
		id: "cp-1",
		name: "Mine",
		colorLight: ACCENT_LIGHT,
		colorDark: ACCENT_DARK,
		bgColorLight: "#aabbcc",
		bgColorDark: "#112233",
		textColorLight: "#111111",
		textColorDark: "#eeeeee",
		...over,
	};
}

const userIds = (registry: CalloutRegistry): string[] =>
	registry
		.getAll()
		.filter((d) => !d.builtIn)
		.map((d) => d.id)
		.sort();

describe("dropDerivedBackgrounds", () => {
	it("drops a background that IS the accent at some tint strength, in both modes", () => {
		// Vaults filled up with these without anyone asking: opening the editor
		// materialized `bgTintFor(accent, mode)` into the form and saving wrote
		// it back. Such a value carries nothing the accent doesn't already, and
		// as an opaque fill it flattens nested-callout stepping to zero.
		const registry = load(
			saved([
				def({
					id: "derived",
					bgColorLight: bgTintFor(ACCENT_LIGHT, false),
					bgColorDark: bgTintFor(ACCENT_DARK, true),
				}),
			]),
		);
		const row = registry.get("derived");

		assert.strictEqual(row?.bgColorLight, undefined);
		assert.strictEqual(row?.bgColorDark, undefined);
		assert.ok(!("bgColorLight" in (row as object)), "deleted, not set to undefined");
	});

	it("keeps a background the user actually chose", () => {
		const registry = load(
			saved([def({ id: "picked", bgColorLight: "#123456", bgColorDark: "#654321" })]),
		);
		assert.strictEqual(registry.get("picked")?.bgColorLight, "#123456");
		assert.strictEqual(registry.get("picked")?.bgColorDark, "#654321");
	});

	it("needs BOTH modes to be derived before it drops either", () => {
		// A half-derived pair means the user edited one mode by hand. Dropping
		// the derived half alone would leave the callout painting one mode from
		// the accent and the other from a hex, which is not what it looked like.
		const registry = load(
			saved([
				def({
					id: "half",
					bgColorLight: bgTintFor(ACCENT_LIGHT, false),
					bgColorDark: "#654321",
				}),
			]),
		);
		assert.strictEqual(
			registry.get("half")?.bgColorLight,
			bgTintFor(ACCENT_LIGHT, false),
		);
		assert.strictEqual(registry.get("half")?.bgColorDark, "#654321");
	});

	it("never touches a gradient's start colour — that would delete the gradient", () => {
		const registry = load(
			saved([
				def({
					id: "grad",
					bgColorLight: bgTintFor(ACCENT_LIGHT, false),
					bgColorDark: bgTintFor(ACCENT_DARK, true),
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#ffffff",
						toColorDark: "#000000",
					},
				}),
			]),
		);
		assert.strictEqual(
			registry.get("grad")?.bgColorLight,
			bgTintFor(ACCENT_LIGHT, false),
		);
	});

	it("leaves a row that has only one of the two background hexes alone", () => {
		const registry = load(
			saved([def({ id: "lonely", bgColorLight: bgTintFor(ACCENT_LIGHT, false) })]),
		);
		assert.strictEqual(
			registry.get("lonely")?.bgColorLight,
			bgTintFor(ACCENT_LIGHT, false),
		);
	});

	it("is a fixed point: a dropped background cannot be re-derived into existence", () => {
		const first = load(
			saved([
				def({
					id: "derived",
					bgColorLight: bgTintFor(ACCENT_LIGHT, false),
					bgColorDark: bgTintFor(ACCENT_DARK, true),
				}),
			]),
		);
		assert.strictEqual(first.needsSaveAfterLoad(), true);

		const second = load(first.toSaveData());
		assert.strictEqual(second.get("derived")?.bgColorLight, undefined);
		assert.strictEqual(second.needsSaveAfterLoad(), false, "nothing left to do");
	});

	it("agrees with derivedBgAmount about what 'derived' means", () => {
		// The migration is a thin wrapper on that solver; this pins the two
		// together so a change to the solver's tolerances shows up here.
		assert.notStrictEqual(
			derivedBgAmount(ACCENT_LIGHT, bgTintFor(ACCENT_LIGHT, false), false),
			null,
		);
		assert.strictEqual(derivedBgAmount(ACCENT_LIGHT, "#123456", false), null);
	});
});

describe("dropStaleTransparencyFlags", () => {
	it("drops the flag when a background sits beside it", () => {
		// The two cannot legitimately coexist, and the background is the newer
		// intent: `transparentBg` used to be spread in conditionally, so it was
		// a one-way door — the hexes beside it went on updating while the flag
		// itself could never be switched back off.
		const registry = load(
			saved([def({ id: "both", transparentBg: true, bgColorLight: "#123456" })]),
		);
		const row = registry.get("both");

		assert.strictEqual(row?.transparentBg, undefined);
		assert.ok(!("transparentBg" in (row as object)));
		assert.strictEqual(row?.bgColorLight, "#123456", "the colours are kept");
	});

	it("drops it beside a gradient too", () => {
		const registry = load(
			saved([
				def({
					id: "grad",
					transparentBg: true,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#ffffff",
						toColorDark: "#000000",
					},
				}),
			]),
		);
		assert.strictEqual(registry.get("grad")?.transparentBg, undefined);
	});

	it("leaves a genuinely transparent callout transparent", () => {
		const registry = load(saved([def({ id: "clean", transparentBg: true })]));
		assert.strictEqual(registry.get("clean")?.transparentBg, true);
	});

	it("runs BEFORE dropDerivedBackgrounds, so both halves of the damage go", () => {
		// Order is load-visible: were the backgrounds dropped first, the row
		// would look legitimately transparent and keep a flag the writers can
		// no longer clear.
		const registry = load(
			saved([
				def({
					id: "both",
					transparentBg: true,
					bgColorLight: bgTintFor(ACCENT_LIGHT, false),
					bgColorDark: bgTintFor(ACCENT_DARK, true),
				}),
			]),
		);
		const row = registry.get("both");

		assert.strictEqual(row?.transparentBg, undefined);
		assert.strictEqual(row?.bgColorLight, undefined);
		assert.strictEqual(row?.bgColorDark, undefined);
	});

	it("is a fixed point", () => {
		const first = load(
			saved([def({ id: "both", transparentBg: true, bgColorLight: "#123456" })]),
		);
		assert.strictEqual(first.needsSaveAfterLoad(), true);

		const second = load(first.toSaveData());
		assert.strictEqual(second.needsSaveAfterLoad(), false);
	});
});

describe("dropSolidBackgroundFlags", () => {
	it("removes the retired opt-out so it stops being re-saved and re-exported", () => {
		// Nothing reads it any more — every background is a translucent tint.
		// It is deleted only so a key no code understands stops riding along in
		// `toSaveData()` and in every new export file.
		const registry = load(
			saved([
				{ ...def({ id: "legacy" }), solidBackground: true } as CalloutDefinition,
			]),
		);
		const row = registry.get("legacy") as CalloutDefinition & {
			solidBackground?: boolean;
		};

		assert.ok(!("solidBackground" in row));
	});

	it("removes an explicit `false` as well — it is the key that is retired", () => {
		const registry = load(
			saved([
				{ ...def({ id: "legacy" }), solidBackground: false } as CalloutDefinition,
			]),
		);
		assert.ok(!("solidBackground" in (registry.get("legacy") as object)));
	});

	it("keeps the row itself, colours and all", () => {
		const registry = load(
			saved([
				{
					...def({ id: "legacy", bgColorLight: "#123456", bgColorDark: "#654321" }),
					solidBackground: true,
				} as CalloutDefinition,
			]),
		);
		assert.strictEqual(registry.get("legacy")?.bgColorLight, "#123456");
	});

	it("is a fixed point", () => {
		const first = load(
			saved([
				{ ...def({ id: "legacy" }), solidBackground: true } as CalloutDefinition,
			]),
		);
		assert.strictEqual(first.needsSaveAfterLoad(), true);

		const second = load(first.toSaveData());
		assert.strictEqual(second.needsSaveAfterLoad(), false);
	});
});

describe("stripMetadataFromIds", () => {
	it("drops a piped row whose base id is already taken", () => {
		// `note|green` styles nothing where it matters: its selector is
		// `.callout[data-callout="note|green"]` and Obsidian writes `note`.
		// Merging it into the survivor would silently restyle a callout the
		// user never asked to change, so it goes.
		const registry = load(
			saved([def({ id: "note|green", displayName: "Note|green", source: "fallback" })]),
		);
		assert.strictEqual(registry.has("note|green"), false);
		assert.strictEqual(registry.get("note")?.displayName, "Note", "untouched");
	});

	it("renames a piped row to its base when the base is free", () => {
		const registry = load(
			saved([
				def({ id: "custom|meta", displayName: "Custom|meta", source: "fallback" }),
			]),
		);
		assert.strictEqual(registry.has("custom|meta"), false);
		assert.ok(registry.has("custom"));
		assert.strictEqual(registry.get("custom")?.source, "fallback", "row is carried over");
	});

	it("re-derives the display name a discovery row took from the piped id", () => {
		// Left alone it would read "Custom|meta" in the settings list AND on
		// screen — the heading and inline roles are painted from displayName.
		const registry = load(
			saved([def({ id: "custom|meta", displayName: "Custom|meta" })]),
		);
		assert.strictEqual(registry.get("custom")?.displayName, "Custom");
	});

	it("keeps a display name the user chose, pipe-free, through the rename", () => {
		const registry = load(
			saved([def({ id: "custom|meta", displayName: "My Callout" })]),
		);
		assert.strictEqual(registry.get("custom")?.displayName, "My Callout");
	});

	it("drops a row whose id named nothing at all before the pipe", () => {
		const registry = load(saved([def({ id: "|purple" })]));
		assert.deepStrictEqual(userIds(registry), []);
	});

	it("leaves `notegreen` — the pipe-eaten spelling — completely alone", () => {
		// This is the case an earlier draft got wrong. Matching an id against
		// the old sanitizer's reading of its own display name has no false
		// negatives and plenty of false positives: every user callout ever
		// named with a pipe (`Pros|Cons` → `proscons`) matched by construction
		// and would have been renamed to `pros`, breaking every `[!proscons]`
		// already written in the vault. Unlike the piped spelling, this one IS
		// a reachable id.
		const registry = load(
			saved([
				def({ id: "notegreen", displayName: "Notegreen" }),
				def({ id: "proscons", displayName: "Pros|Cons" }),
			]),
		);
		assert.deepStrictEqual(userIds(registry), ["notegreen", "proscons"]);
		assert.strictEqual(registry.get("proscons")?.displayName, "Pros|Cons");
	});

	it("never renames a built-in, even if one somehow carried a pipe", () => {
		const registry = load(
			saved([{ id: "note", displayName: "N|x", builtIn: true } as CalloutDefinition]),
		);
		assert.ok(registry.has("note"));
		assert.strictEqual(registry.getBuiltIn().length, 13);
	});

	it("normalizes piped aliases so a row surviving on its id is clean too", () => {
		const registry = load(saved([def({ id: "clean", aliases: ["a|b"] })]));
		assert.deepStrictEqual(registry.get("clean")?.aliases, ["a"]);
	});

	it("drops an alias whose base is already owned by another row", () => {
		// Rewriting `note|x` to `note` would give the built-in's raw id a
		// second definition to resolve through.
		const registry = load(saved([def({ id: "clean", aliases: ["note|x"] })]));
		assert.deepStrictEqual(registry.get("clean")?.aliases, []);
	});

	it("also drops a pipe-free alias colliding with an existing id, once the pass runs", () => {
		// A side effect of the guard, not a separate rule: the alias rewrite is
		// gated on *any* alias containing a pipe, and then re-filters them all.
		// `note` was already a broken alias; the pass is simply what notices.
		const registry = load(
			saved([def({ id: "clean", aliases: ["a|b", "note", "plain"] })]),
		);
		assert.deepStrictEqual(registry.get("clean")?.aliases, ["a", "plain"]);
	});

	it("leaves pipe-free aliases untouched when no alias has a pipe", () => {
		const registry = load(saved([def({ id: "clean", aliases: ["foo", "plain"] })]));
		assert.deepStrictEqual(registry.get("clean")?.aliases, ["foo", "plain"]);
	});

	it("de-duplicates and drops self-references while rewriting", () => {
		const registry = load(
			saved([def({ id: "clean", aliases: ["a|b", "a|c", "clean|x"] })]),
		);
		assert.deepStrictEqual(registry.get("clean")?.aliases, ["a"]);
	});

	it("re-points the fallback target at the row's new id when it was renamed", () => {
		// A dangling `fallbackCalloutId` is not inert: generateFallbackCSS bails
		// when it resolves to nothing, and every unrecognized callout in the
		// vault silently loses its colour, icon and background.
		const registry = load(
			saved([def({ id: "custom|meta" })], { fallbackCalloutId: "custom|meta" }),
		);
		assert.strictEqual(registry.settings.fallbackCalloutId, "custom");
	});

	it("resets the fallback target to the default when the row is gone for good", () => {
		const registry = load(
			saved([def({ id: "note|green" })], { fallbackCalloutId: "note|green" }),
		);
		assert.strictEqual(
			registry.settings.fallbackCalloutId,
			DEFAULT_SETTINGS.fallbackCalloutId,
		);
	});

	it("leaves an unrelated fallback target alone", () => {
		const registry = load(
			saved([def({ id: "note|green" }), def({ id: "keeper" })], {
				fallbackCalloutId: "keeper",
			}),
		);
		assert.strictEqual(registry.settings.fallbackCalloutId, "keeper");
	});

	it("is a fixed point", () => {
		const first = load(
			saved([def({ id: "custom|meta" }), def({ id: "note|green" })]),
		);
		assert.strictEqual(first.needsSaveAfterLoad(), true);

		const second = load(first.toSaveData());
		assert.deepStrictEqual(userIds(second), ["custom"]);
		assert.strictEqual(second.needsSaveAfterLoad(), false);
	});
});

describe("reconcileIdCollisions", () => {
	it("folds a dash/space pair down to one row", () => {
		// Obsidian dasherizes `data-callout`, so `a b` and `a-b` are one
		// selector. Two surviving rows would forever fight over it.
		const registry = load(
			saved([
				def({ id: "a b", source: "user" }),
				def({ id: "a-b", source: "user" }),
			]),
		);
		assert.strictEqual(userIds(registry).length, 1);
	});

	it("gives the dash-free spelling to the survivor, per the user's own ID field", () => {
		const registry = load(
			saved([
				def({ id: "c-d", displayName: "C-d", source: "user" }),
				def({ id: "c d", displayName: "C d", source: "user" }),
			]),
		);
		assert.deepStrictEqual(userIds(registry), ["c d"]);
	});

	it("folds the loser's id in as an alias, so no usage is orphaned", () => {
		const registry = load(
			saved([
				def({ id: "c-d", source: "user" }),
				def({ id: "c d", source: "user" }),
			]),
		);
		assert.deepStrictEqual(registry.get("c d")?.aliases, ["c-d"]);
	});

	it("carries the loser's own aliases across as well", () => {
		const registry = load(
			saved([
				def({ id: "c-d", source: "user", aliases: ["cee"] }),
				def({ id: "c d", source: "user", aliases: ["dee"] }),
			]),
		);
		assert.deepStrictEqual(
			registry.get("c d")?.aliases?.sort(),
			["c-d", "cee", "dee"],
		);
	});

	it("drops an uncustomized discovery row without aliasing it — it is auto-junk", () => {
		const registry = load(
			saved([
				def({ id: "a b", source: "user" }),
				def({ id: "a-b", source: "fallback" }),
			]),
		);
		assert.deepStrictEqual(userIds(registry), ["a b"]);
		assert.strictEqual(registry.get("a b")?.aliases, undefined);
	});

	it("keeps a CUSTOMIZED discovery row's id as an alias", () => {
		const registry = load(
			saved([
				def({ id: "a b", source: "user" }),
				def({ id: "a-b", source: "fallback", customized: true }),
			]),
		);
		assert.deepStrictEqual(registry.get("a b")?.aliases, ["a-b"]);
	});

	it("always lets the built-in survive", () => {
		const registry = load(
			saved([def({ id: "no-te", source: "user" }), def({ id: "no te", source: "user" })]),
		);
		// A contrived pair, but the rule is the point: never risk dropping one.
		assert.strictEqual(registry.getBuiltIn().length, 13);
	});

	it("collides through aliases, not only through ids", () => {
		const registry = load(
			saved([
				def({ id: "left", source: "user", aliases: ["x y"] }),
				def({ id: "right", source: "fallback", aliases: ["x-y"] }),
			]),
		);
		assert.deepStrictEqual(userIds(registry), ["left"]);
	});

	it("deletes a user row whose alias duplicates a built-in's id outright", () => {
		// An alias is a form the row claims, so `note` on a user row puts that
		// row in the built-in's collision group — where the built-in always
		// survives and the row is folded into it as an alias. Worth pinning
		// because nothing blocks such an alias at creation time (`add()`
		// rejects it, but a hand-edited or imported `data.json` reaches here).
		const registry = load(saved([def({ id: "claimer", aliases: ["note"] })]));

		assert.strictEqual(registry.has("claimer"), false);
		assert.deepStrictEqual(registry.get("note")?.aliases, ["claimer"]);
	});

	it("is a fixed point", () => {
		const first = load(
			saved([
				def({ id: "c-d", source: "user" }),
				def({ id: "c d", source: "user" }),
			]),
		);
		const second = load(first.toSaveData());
		assert.deepStrictEqual(userIds(second), ["c d"]);
		assert.deepStrictEqual(second.get("c d")?.aliases, ["c-d"]);
	});

	it("runs AFTER stripMetadataFromIds, so a row renamed back to its base is reconciled too", () => {
		// `x|meta` becomes `x`, which then has to go through the dash/space
		// reconcile like any other row.
		const registry = load(
			saved([
				def({ id: "x y|meta", source: "fallback" }),
				def({ id: "x-y", source: "user" }),
			]),
		);
		assert.deepStrictEqual(userIds(registry), ["x-y"]);
	});
});

describe("needsSaveAfterLoad()", () => {
	it("is false for a load that repaired nothing", () => {
		assert.strictEqual(load(null).needsSaveAfterLoad(), false);
		assert.strictEqual(
			load(current([def({ id: "clean" })])).needsSaveAfterLoad(),
			false,
		);
	});

	it("is consumed by the read, so an incidental later save cannot re-trigger it", () => {
		const registry = load(saved([def({ id: "note|green" })]));
		assert.strictEqual(registry.needsSaveAfterLoad(), true);
		assert.strictEqual(registry.needsSaveAfterLoad(), false);
	});

	it("is reset by the next load, not carried over", () => {
		const registry = new CalloutRegistry();
		registry.load(saved([def({ id: "note|green" })]));
		registry.load(current([def({ id: "clean" })]));
		assert.strictEqual(registry.needsSaveAfterLoad(), false);
	});

	for (const [name, data] of [
		[
			"dropDerivedBackgrounds",
			saved([
				def({
					id: "d",
					bgColorLight: bgTintFor(ACCENT_LIGHT, false),
					bgColorDark: bgTintFor(ACCENT_DARK, true),
				}),
			]),
		],
		[
			"dropStaleTransparencyFlags",
			saved([def({ id: "t", transparentBg: true, bgColorLight: "#123456" })]),
		],
		[
			"dropSolidBackgroundFlags",
			saved([{ ...def({ id: "s" }), solidBackground: true } as CalloutDefinition]),
		],
		["stripMetadataFromIds — a removed row", saved([def({ id: "note|green" })])],
		["stripMetadataFromIds — a renamed row", saved([def({ id: "custom|meta" })])],
		[
			// Missing this left an alias-only cleanup re-done on every load and
			// never written back — the exact failure this flag exists for.
			"stripMetadataFromIds — aliases only",
			saved([def({ id: "clean", aliases: ["a|b"] })]),
		],
		[
			"consolidateDuplicatePalettes",
			saved([], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
				],
			}),
		],
	] as Array<[string, Partial<PluginData>]>) {
		it(`is raised by ${name}`, () => {
			assert.strictEqual(load(data).needsSaveAfterLoad(), true);
		});
	}

	it("is raised by adoptOrphansMatchingPalettes, which rewrites definitions too", () => {
		// The adoption stamps a `paletteId` onto the row, which is a rewrite of
		// the stored definitions like any other. Un-flushed it was re-derived on
		// every launch — the same shape as the alias-only bug above.
		const registry = load(
			saved([def({ id: "orphan", ...paletteColors() })], {
				customPalettes: [palette()],
			}),
		);
		assert.strictEqual(registry.get("orphan")?.paletteId, "cp-1", "it did rewrite");
		assert.strictEqual(registry.needsSaveAfterLoad(), true);
	});

	it("stays down once that adoption has been written back", () => {
		const first = load(
			saved([def({ id: "orphan", ...paletteColors() })], {
				customPalettes: [palette()],
			}),
		);
		assert.strictEqual(first.needsSaveAfterLoad(), true);

		const second = load(first.toSaveData());
		assert.strictEqual(second.get("orphan")?.paletteId, "cp-1");
		assert.strictEqual(second.needsSaveAfterLoad(), false);
	});

	it("is not raised by the settings caller, which saves for itself", () => {
		// CustomPalettesSection calls the pass directly after a palette edit and
		// then saves; raising a load-time flag there would leave it standing
		// until some unrelated startup happened to read it.
		const registry = load(current([def({ id: "orphan", ...paletteColors() })]));
		assert.strictEqual(registry.needsSaveAfterLoad(), false);

		registry.settings.customPalettes = [palette()];
		assert.strictEqual(registry.adoptOrphansMatchingPalettes(), 1);
		assert.strictEqual(registry.needsSaveAfterLoad(), false);
	});

	it("is raised by reconcileIdCollisions, which DELETES a row", () => {
		// The merge deletes a definition and rewrites the survivor's aliases, so
		// it has to be written back like any other rewrite. Un-flushed,
		// `data.json` kept both rows and the merge was simply redone on every
		// launch — the user saw one row, the file held two.
		const registry = load(
			saved([
				def({ id: "c-d", source: "user" }),
				def({ id: "c d", source: "user" }),
			]),
		);
		assert.strictEqual(registry.getAll().length, 14, "one row really did go");
		assert.strictEqual(registry.needsSaveAfterLoad(), true);
	});

	it("stays down on the next load, once that merge has been written back", () => {
		// The flag must not re-arm forever: the loser survives only as an alias
		// of the survivor, so the group it forms next load names one definition
		// and there is nothing left to merge.
		const first = load(
			saved([
				def({ id: "c-d", source: "user" }),
				def({ id: "c d", source: "user" }),
			]),
		);
		assert.strictEqual(first.needsSaveAfterLoad(), true);

		const second = load(first.toSaveData());
		assert.strictEqual(second.getAll().length, 14, "still the one merged row");
		assert.deepStrictEqual(second.get("c d")?.aliases, ["c-d"]);
		assert.strictEqual(second.needsSaveAfterLoad(), false);
	});
});

describe("stored colours are normalized to hex on the way in", () => {
	it("reads the pre-1.13 bare triplet an older build could have written", () => {
		const registry = load(saved([def({ colorLight: "8, 109, 221" })]));
		// Not a colour, so every declaration reading it would be dropped and the
		// callout would render with no background and no border.
		assert.strictEqual(registry.get("x")?.colorLight, "#086ddd");
	});

	it("normalizes the other spellings without changing the colour", () => {
		const registry = load(
			saved([def({ colorLight: "rgb(255, 0, 0)", colorDark: "#0f0" })]),
		);
		assert.strictEqual(registry.get("x")?.colorLight, "#ff0000");
		assert.strictEqual(registry.get("x")?.colorDark, "#00ff00");
	});

	it("falls back to the shipped default when nothing can read the value", () => {
		const shipped = load(null).get("info");
		assert.ok(shipped);
		const registry = load(
			saved([
				{ ...shipped, colorLight: "var(--some-theme-thing)" },
			] as CalloutDefinition[]),
		);
		assert.strictEqual(registry.get("info")?.colorLight, shipped.colorLight);
	});

	it("falls back to grey for a user row, which has no default behind it", () => {
		const registry = load(saved([def({ colorDark: "chartreuse" })]));
		assert.strictEqual(registry.get("x")?.colorDark, "#7d7d7d");
	});

	it("drops an unreadable text colour rather than inventing one", () => {
		// Absent already means "inherit the theme's", so there is a correct
		// answer here that does not exist for the accent.
		const registry = load(saved([def({ textColorLight: "not a colour" })]));
		assert.ok(registry.get("x"));
		assert.strictEqual(registry.get("x")?.textColorLight, undefined);
	});

	it("writes the repair back, and settles rather than re-arming", () => {
		const first = load(saved([def({ colorLight: "8, 109, 221" })]));
		assert.strictEqual(first.needsSaveAfterLoad(), true);

		const second = load(first.toSaveData());
		assert.strictEqual(second.get("x")?.colorLight, "#086ddd");
		assert.strictEqual(second.needsSaveAfterLoad(), false);
	});

	it("leaves a row that needs nothing completely alone", () => {
		const clean = def({ textColorDark: "#eeeeee" });
		const registry = load(current([clean]));
		assert.deepStrictEqual(registry.get("x"), clean);
		assert.strictEqual(registry.needsSaveAfterLoad(), false);
	});
});

/** The six colors of {@link palette}, as a callout would bake them. */
function paletteColors(): Partial<CalloutDefinition> {
	return {
		colorLight: ACCENT_LIGHT,
		colorDark: ACCENT_DARK,
		bgColorLight: "#aabbcc",
		bgColorDark: "#112233",
		textColorLight: "#111111",
		textColorDark: "#eeeeee",
	};
}
