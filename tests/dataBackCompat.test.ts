/**
 * tests/dataBackCompat.test.ts — opening a `data.json` written by an older
 * version.
 *
 * Every vault that has ever run this plugin is a saved file in some shape the
 * current build no longer writes, and there is exactly one chance to read each
 * one correctly: `load()` runs, the plugin saves at some point after, and
 * whatever was misread is gone. There is no undo and no report — the user just
 * finds a setting reset or a callout missing, weeks later.
 *
 * The fixtures below are not invented. They are the literal shapes of
 * `PluginSettings` and `CalloutDefinition` at the 1.0.0 and 2.0.0 tags, read
 * out of those commits, so what is being tested is a file that really exists in
 * real vaults rather than a plausible-looking one.
 *
 * Two rules run through all of it:
 *
 * - **Nothing keys on `data.version`.** An imported, hand-edited or
 *   sync-conflicted file can carry any number it likes, so every migration asks
 *   what the data actually *contains*. The stamp is provenance and nothing more,
 *   and the tests below assert that by loading modern content stamped `1` and
 *   ancient content stamped `99`.
 * - **A missing field is a default, never an absence.** `mergeSavedSettings`
 *   rebuilds the whole settings object, so a file that predates a feature gets
 *   that feature switched to whatever a fresh install gets — not to `undefined`,
 *   which is what would reach the CSS generator and the settings UI.
 *
 * The individual repair passes (`dropSolidBackgroundFlags`,
 * `dropStaleTransparencyFlags`, `stripMetadataFromIds`,
 * `reconcileAttrIdCollisions`, the palette passes) have their own suite in
 * `calloutRegistryMigrations.test.ts`, including their idempotence. This file is
 * about whole saved *files*: the shapes, the fields that were retired between
 * them, and what a load leaves behind for the next save.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DEFAULT_CALLOUTS, DEFAULT_SETTINGS } from "../src/constants";
import type { CalloutDefinition, PluginData } from "../src/types";

// Seeded before the first load, for the reason calloutRegistryCore's header
// gives: `load()` runs the `lucide-` repair migration and `icons/lucideId.ts`
// memoizes the prefixed half of `getIconIds()` the first time it is asked.
// The bare entries are the other two halves of that list — Obsidian's internal
// set and ids other plugins registered — which is exactly what v2.7.0 broke.
(globalThis as { __CS_ICON_IDS__?: string[] }).__CS_ICON_IDS__ = [
	"lucide-pencil",
	"lucide-star",
	"lucide-info",
	"dice",
	"remix-QuestionnaireFill",
];

/** The version stamp the current build writes. */
const CURRENT_DATA_VERSION = 4;

const load = (data: Partial<PluginData> | null): CalloutRegistry => {
	const registry = new CalloutRegistry();
	registry.load(data);
	return registry;
};

const userIds = (registry: CalloutRegistry): string[] =>
	registry
		.getAll()
		.filter((d) => !d.builtIn)
		.map((d) => d.id)
		.sort();

/* ────────────────────────────────────────────────────────────────────────────
 * 1.0.0 — the first released shape
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A `data.json` exactly as 1.0.0 wrote one.
 *
 * Read off the 1.0.0 tag: `contextMenu` was three booleans rather than an
 * ordered item list, `autocomplete` carried two preview toggles, `iconSources`
 * named Material directly, and `globalStyle` had no role frame styles at all
 * because heading and inline callouts did not exist yet. There was no
 * `language`, no `welcomeSeen`, and none of the three lists.
 */
function vaultFrom_1_0_0(): Partial<PluginData> {
	return {
		version: 1,
		callouts: [
			{
				id: "recipe",
				displayName: "Recipe",
				icon: { type: "lucide", value: "star" },
				colorLight: "#b3541e",
				colorDark: "#ff9f5a",
				foldable: true,
				defaultFolded: false,
				builtIn: false,
				source: "user",
				iconOffsetX: 2,
				iconSize: 1.2,
				aliases: ["cook"],
				customized: true,
			},
			// A built-in the user recoloured. Merged onto the shipped default
			// rather than replacing it, so fields added since are not lost.
			{
				id: "note",
				displayName: "Memo",
				icon: { type: "lucide", value: "pencil" },
				colorLight: "#7b1fa2",
				colorDark: "#7b1fa2",
				foldable: false,
				defaultFolded: false,
				builtIn: true,
				source: "builtin",
			},
		] as CalloutDefinition[],
		settings: {
			globalStyle: {
				borderSides: { top: false, right: false, bottom: false, left: true },
				borderWidth: 3,
				titleScale: 1.1,
				contentScale: 1,
				borderRadius: 8,
			},
			contextMenu: {
				enabled: true,
				showEditCallout: true,
				showOpenSettings: true,
				showCopyMarkdown: false,
			},
			autocomplete: {
				enabled: false,
				showIconPreviews: true,
				showColorPreviews: false,
			},
			iconSources: {
				materialStyleDefault: "outlined",
				materialWeightDefault: 400,
				lastMaterialCategory: "Actions",
			},
			firstRunCompleted: true,
			fallbackCalloutId: "recipe",
		},
	} as unknown as Partial<PluginData>;
}

describe("a data.json written by 1.0.0", () => {
	it("opens, with all 13 built-ins and the user's own callout", () => {
		const registry = load(vaultFrom_1_0_0());

		assert.strictEqual(registry.getBuiltIn().length, DEFAULT_CALLOUTS.length);
		assert.deepStrictEqual(userIds(registry), ["recipe"]);
	});

	it("keeps every field the old definition carried", () => {
		const recipe = load(vaultFrom_1_0_0()).get("recipe");

		assert.strictEqual(recipe?.colorLight, "#b3541e");
		assert.strictEqual(recipe.iconOffsetX, 2);
		assert.strictEqual(recipe.iconSize, 1.2);
		assert.deepStrictEqual(recipe.aliases, ["cook"]);
		assert.strictEqual(recipe.customized, true);
	});

	it("merges a recoloured built-in onto the shipped default", () => {
		// `{...shipped, ...saved}` rather than a replacement, so a field the
		// current version added to that built-in survives a file that predates
		// it — and `builtIn`/`source` are re-stamped whatever the file said.
		const note = load(vaultFrom_1_0_0()).get("note");

		assert.strictEqual(note?.displayName, "Memo");
		assert.strictEqual(note.colorLight, "#7b1fa2");
		assert.strictEqual(note.builtIn, true);
		assert.strictEqual(note.source, "builtin");
	});

	it("keeps the global style values it did have", () => {
		const style = load(vaultFrom_1_0_0()).settings.globalStyle;

		assert.strictEqual(style.borderWidth, 3);
		assert.strictEqual(style.borderRadius, 8);
		assert.strictEqual(style.titleScale, 1.1);
		assert.deepStrictEqual(style.borderSides, {
			top: false,
			right: false,
			bottom: false,
			left: true,
		});
	});

	it("fills in every role style the file predates", () => {
		// Heading and inline callouts did not exist in 1.0.0, so `globalStyle`
		// had no `heading`/`inline` at all. Left undefined they would reach the
		// CSS generator as `undefined.borderWidth`.
		const style = load(vaultFrom_1_0_0()).settings.globalStyle;

		assert.deepStrictEqual(style.heading, DEFAULT_SETTINGS.globalStyle.heading);
		assert.deepStrictEqual(style.inline, DEFAULT_SETTINGS.globalStyle.inline);
		assert.strictEqual(
			style.alignContentWithTitle,
			DEFAULT_SETTINGS.globalStyle.alignContentWithTitle,
		);
	});

	it("fills in every whole section added since", () => {
		const settings = load(vaultFrom_1_0_0()).settings;

		assert.deepStrictEqual(settings.headingCallouts, DEFAULT_SETTINGS.headingCallouts);
		assert.deepStrictEqual(settings.inlineCallouts, DEFAULT_SETTINGS.inlineCallouts);
		assert.strictEqual(settings.language, DEFAULT_SETTINGS.language);
		assert.strictEqual(settings.welcomeSeen, DEFAULT_SETTINGS.welcomeSeen);
	});

	it("gives it all three lists, empty", () => {
		const settings = load(vaultFrom_1_0_0()).settings;

		assert.deepStrictEqual(settings.customPalettes, []);
		assert.deepStrictEqual(settings.userImages, []);
		assert.deepStrictEqual(settings.customCommands, []);
		assert.deepStrictEqual(settings.disabledFixedCommands, []);
	});

	it("keeps the settings it can still honour", () => {
		const settings = load(vaultFrom_1_0_0()).settings;

		assert.strictEqual(settings.autocomplete.enabled, false);
		assert.strictEqual(settings.contextMenu.enabled, true);
		assert.strictEqual(settings.firstRunCompleted, true);
		assert.strictEqual(settings.fallbackCalloutId, "recipe");
		assert.strictEqual(settings.iconSources.materialStyleDefault, "outlined");
		assert.strictEqual(settings.iconSources.materialWeightDefault, 400);
	});

	it("folds `lastMaterialCategory` into the source-keyed `lastCategory`", () => {
		const sources = load(vaultFrom_1_0_0()).settings.iconSources;

		assert.strictEqual(sources.lastCategory?.material, "Actions");
		assert.ok(!("lastMaterialCategory" in sources));
	});

	it("drops the retired autocomplete preview toggles", () => {
		// The dropdown always shows an icon and a colour now. A key nothing
		// reads would otherwise be re-saved forever and copied into every export.
		const autocomplete = load(vaultFrom_1_0_0()).settings
			.autocomplete as unknown as Record<string, unknown>;

		assert.ok(!("showIconPreviews" in autocomplete));
		assert.ok(!("showColorPreviews" in autocomplete));
	});

	it("carries the granular menu toggles onto the item list", () => {
		// 1.x had three booleans; the menu is an ordered, per-role item list now.
		// Until the two shapes were mapped onto each other a vault that had
		// hidden "Copy markdown" got it back on the first launch of a modern
		// build — small and reversible in one click, but a setting reset by an
		// upgrade without the user asking.
		const items = load(vaultFrom_1_0_0()).settings.contextMenu.items;
		const copyMarkdown = items.regular.find((i) => i.id === "copyMarkdown");

		assert.strictEqual(copyMarkdown?.enabled, false, "the saved `false` holds");
		assert.deepStrictEqual(
			items.regular.map((i) => i.id),
			DEFAULT_CONTEXT_MENU_REGULAR,
			"the order is still the default one — 1.x had no order to keep",
		);
		assert.deepStrictEqual(
			items.regular.filter((i) => i.enabled).map((i) => i.id),
			["foldDefaults", "edit", "openSettings"],
			"and the two the file left on are still on",
		);
		const menu = load(vaultFrom_1_0_0()).settings.contextMenu as unknown as Record<
			string,
			unknown
		>;
		assert.ok(!("showCopyMarkdown" in menu), "and the dead key is dropped");
	});

	it("re-stamps the file to the current data version on the next save", () => {
		const saved = load(vaultFrom_1_0_0()).toSaveData();
		assert.strictEqual(saved.version, CURRENT_DATA_VERSION);
	});

	it("is not flushed at all, because nothing has to be re-derived", () => {
		// The retired 1.x settings keys need no forced save: they are already
		// gone from the in-memory object, the first ordinary save writes the
		// cleaned-up shape, and until then `data.json` keeps the 1.x one — which
		// is what makes downgrading harmless. A 1.0.0 file predates every key
		// the load-time migration looks for, so it asks for nothing.
		const registry = load(vaultFrom_1_0_0());
		assert.strictEqual(registry.needsSaveAfterLoad(), false);
	});
});

const DEFAULT_CONTEXT_MENU_REGULAR = [
	"copyMarkdown",
	"foldDefaults",
	"edit",
	"openSettings",
];

/* ────────────────────────────────────────────────────────────────────────────
 * 2.0.0 — the shape after the two extra roles landed
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A `data.json` exactly as 2.0.0 wrote one.
 *
 * By then `contextMenu` was an ordered item list and the role frame styles
 * existed, but `heading` still carried `paddingStart` (the icon-indent slider,
 * removed in 2.7.0), `iconSources` still named Material's category directly,
 * `headingCallouts` had no `showFoldArrow`, `inlineCallouts` no `allowContent`,
 * and `customPalettes` was the only one of the three lists.
 */
function vaultFrom_2_0_0(): Partial<PluginData> {
	return {
		version: 2,
		callouts: [
			{
				id: "spec",
				displayName: "Spec",
				icon: { type: "lucide", value: "lucide-star" },
				colorLight: "#336699",
				colorDark: "#88bbee",
				foldable: true,
				defaultFolded: false,
				builtIn: false,
				source: "user",
				customized: true,
			},
		] as CalloutDefinition[],
		settings: {
			globalStyle: {
				borderSides: { top: false, right: false, bottom: false, left: false },
				borderWidth: 2.5,
				titleScale: 1,
				contentScale: 1,
				borderRadius: 4,
				alignContentWithTitle: false,
				heading: {
					borderSides: { top: false, right: false, bottom: false, left: false },
					borderWidth: 1.5,
					borderRadius: 4,
					paddingTop: 0.25,
					paddingBottom: 0.25,
					paddingStart: 10,
				},
				inline: {
					borderSides: { top: false, right: false, bottom: false, left: false },
					borderWidth: 1.5,
					borderRadius: 16,
					fontScale: 1,
				},
			},
			contextMenu: {
				enabled: true,
				items: {
					regular: [
						{ id: "edit", enabled: true },
						{ id: "copyMarkdown", enabled: false },
					],
				},
			},
			autocomplete: { enabled: true },
			iconSources: {
				materialStyleDefault: "rounded",
				materialWeightDefault: 300,
				lastMaterialCategory: "Social",
				lastEmojiSkinTone: 2,
			},
			headingCallouts: { enabled: true, refCleanTitles: false, refShowIcon: false },
			inlineCallouts: { enabled: false },
			firstRunCompleted: true,
			welcomeSeen: true,
			fallbackCalloutId: "note",
			language: "de",
			customPalettes: [],
		},
	} as unknown as Partial<PluginData>;
}

describe("a data.json written by 2.0.0", () => {
	it("opens with the user's callout and every built-in", () => {
		const registry = load(vaultFrom_2_0_0());
		assert.deepStrictEqual(userIds(registry), ["spec"]);
		assert.strictEqual(registry.getBuiltIn().length, DEFAULT_CALLOUTS.length);
	});

	it("drops `heading.paddingStart`, which is a static 10px in CSS now", () => {
		const heading = load(vaultFrom_2_0_0()).settings.globalStyle
			.heading as unknown as Record<string, unknown>;

		assert.ok(!("paddingStart" in heading));
		assert.strictEqual(heading.paddingTop, 0.25, "the rest of the block is kept");
	});

	it("adds `showFoldArrow` and `allowContent`, which the file predates", () => {
		const settings = load(vaultFrom_2_0_0()).settings;

		assert.strictEqual(
			settings.headingCallouts.showFoldArrow,
			DEFAULT_SETTINGS.headingCallouts.showFoldArrow,
		);
		assert.strictEqual(
			settings.inlineCallouts.allowContent,
			DEFAULT_SETTINGS.inlineCallouts.allowContent,
		);
		assert.strictEqual(settings.inlineCallouts.enabled, false, "and keeps the toggle");
	});

	it("forces back on the two heading options that stopped being options", () => {
		// Outline/link cleaning and the reference icon are always on now, so a
		// saved `false` from a build where they were switchable is ignored rather
		// than migrated — the feature it turned off no longer exists.
		const headings = load(vaultFrom_2_0_0()).settings.headingCallouts;

		assert.strictEqual(headings.refCleanTitles, true);
		assert.strictEqual(headings.refShowIcon, true);
	});

	it("keeps the saved menu order and appends the items added since", () => {
		const regular = load(vaultFrom_2_0_0()).settings.contextMenu.items.regular;

		assert.deepStrictEqual(regular.slice(0, 2).map((i) => i.id), [
			"edit",
			"copyMarkdown",
		]);
		assert.strictEqual(regular[1]?.enabled, false, "and the user's own `false`");
		assert.deepStrictEqual(
			regular.map((i) => i.id).sort(),
			[...DEFAULT_CONTEXT_MENU_REGULAR].sort(),
		);
	});

	it("defaults the roles the file said nothing about", () => {
		const items = load(vaultFrom_2_0_0()).settings.contextMenu.items;
		assert.ok(items.heading.length > 0);
		assert.ok(items.inline.length > 0);
	});

	it("adds the two lists that came after it, and keeps the one that did not", () => {
		const settings = load(vaultFrom_2_0_0()).settings;

		assert.deepStrictEqual(settings.customPalettes, []);
		assert.deepStrictEqual(settings.userImages, []);
		assert.deepStrictEqual(settings.customCommands, []);
	});

	it("keeps the saved language rather than resetting it to auto", () => {
		assert.strictEqual(load(vaultFrom_2_0_0()).settings.language, "de");
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * Icons written by versions that spelled them differently
 * ──────────────────────────────────────────────────────────────────────────── */

function withIcon(icon: unknown): Partial<PluginData> {
	return {
		callouts: [
			{
				id: "row",
				displayName: "Row",
				icon,
				colorLight: "#336699",
				colorDark: "#88bbee",
				foldable: true,
				defaultFolded: false,
				builtIn: false,
				source: "user",
			},
		],
	} as unknown as Partial<PluginData>;
}

describe("icons from older builds", () => {
	it("replaces the removed `svg` icon type with a generic pencil", () => {
		// Nothing draws that type any more, and a definition naming it would
		// crash the renderer rather than simply look wrong.
		const icon = load(withIcon({ type: "svg", value: "<svg/>" })).get("row")?.icon;
		assert.deepStrictEqual(icon, { type: "lucide", value: "lucide-pencil" });
	});

	it("treats a missing icon type as Lucide rather than crashing", () => {
		const icon = load(withIcon({ value: "star" })).get("row")?.icon;
		assert.strictEqual(icon?.value, "star");
	});

	it("undoes v2.7.0's `lucide-` prefix on an id that is not core Lucide", () => {
		// The prefix tells `getIcon` to look in Obsidian's core Lucide table and
		// NOWHERE else, so on another plugin's `addIcon()` id it named nothing at
		// all and the callout lost its icon everywhere at once.
		const icon = load(
			withIcon({ type: "lucide", value: "lucide-remix-QuestionnaireFill" }),
		).get("row")?.icon;

		assert.strictEqual(icon?.value, "remix-QuestionnaireFill");
	});

	it("undoes it on Obsidian's own internal ids too", () => {
		const icon = load(withIcon({ type: "lucide", value: "lucide-dice" })).get("row")
			?.icon;
		assert.strictEqual(icon?.value, "dice");
	});

	it("leaves a genuine core Lucide id prefixed", () => {
		// That spelling is what `getIconIds()` hands back for a core icon, and it
		// is what the picker stores. Stripping it would be the same mistake in
		// the other direction.
		const icon = load(withIcon({ type: "lucide", value: "lucide-star" })).get("row")
			?.icon;
		assert.strictEqual(icon?.value, "lucide-star");
	});

	it("leaves a bare id alone — it is already the forgiving spelling", () => {
		const icon = load(withIcon({ type: "lucide", value: "pencil" })).get("row")?.icon;
		assert.strictEqual(icon?.value, "pencil");
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The two caches older files carried
 * ──────────────────────────────────────────────────────────────────────────── */

describe("the pre-2.4 Material caches", () => {
	const legacy = (): Partial<PluginData> =>
		({
			version: 2,
			callouts: [],
			materialIconsCache: { note: ["metadata", "nobody", "reads"] },
			materialSvgCache: [
				{ name: "rocket", style: "rounded", weight: 300, svg: "<svg>rocket</svg>" },
			],
		}) as unknown as Partial<PluginData>;

	it("folds `materialSvgCache` into the pack-agnostic `iconSvgCache`", () => {
		// Without it, every Material icon in the vault would be re-downloaded on
		// the first launch of 2.4 — offline, that means every one of them draws
		// nothing until the network comes back.
		const registry = load(legacy());

		assert.strictEqual(registry.iconSvgCache.length, 1);
		assert.strictEqual(registry.iconSvgCache[0]?.pack, "material");
		assert.strictEqual(registry.iconSvgCache[0]?.name, "rocket");
		assert.strictEqual(registry.iconSvgCache[0]?.svg, "<svg>rocket</svg>");
	});

	it("keys the folded entry by the pack's own cache variant", () => {
		// Material draws different artwork per style and weight, so the variant
		// is what keeps `rocket` at 300 from overwriting `rocket` at 700.
		const registry = load(legacy());
		assert.strictEqual(typeof registry.iconSvgCache[0]?.variant, "string");
		assert.ok(
			(registry.iconSvgCache[0]?.variant ?? "").length > 0,
			"Material encodes style and weight, so it is never empty",
		);
	});

	it("never writes either legacy cache back", () => {
		// Writing both would let them drift apart. Downgrading to a pre-2.4
		// build simply re-downloads the SVGs, which is the cheap direction.
		const saved = load(legacy()).toSaveData() as unknown as Record<
			string,
			unknown
		>;

		assert.ok(!("materialSvgCache" in saved));
		assert.ok(!("materialIconsCache" in saved));
		assert.strictEqual((saved.iconSvgCache as unknown[]).length, 1);
	});

	it("prefers an already-migrated `iconSvgCache` and folds the legacy one in beside it", () => {
		const registry = load({
			...legacy(),
			iconSvgCache: [
				{ pack: "tabler-outline", name: "flame", variant: "", svg: "<svg/>" },
			],
		} as unknown as Partial<PluginData>);

		assert.deepStrictEqual(
			registry.iconSvgCache.map((e) => e.name).sort(),
			["flame", "rocket"],
		);
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The version stamp is provenance, not an instruction
 * ──────────────────────────────────────────────────────────────────────────── */

describe("`data.version` is never read", () => {
	it("repairs 1.x content stamped with the current version", () => {
		// The realistic route to this state is an export edited by hand, or a
		// sync conflict resolved by taking one file's stamp and another's body.
		const data = vaultFrom_1_0_0();
		data.version = CURRENT_DATA_VERSION;
		const sources = load(data).settings.iconSources;

		assert.strictEqual(sources.lastCategory?.material, "Actions");
		assert.ok(!("lastMaterialCategory" in sources));
	});

	it("repairs content stamped with a version that does not exist", () => {
		const data = vaultFrom_2_0_0();
		data.version = 99;
		const heading = load(data).settings.globalStyle.heading as unknown as Record<
			string,
			unknown
		>;

		assert.ok(!("paddingStart" in heading));
	});

	it("loads a file with no version stamp at all", () => {
		const data = vaultFrom_1_0_0();
		delete data.version;

		assert.deepStrictEqual(userIds(load(data)), ["recipe"]);
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * Files that are barely files
 * ──────────────────────────────────────────────────────────────────────────── */

describe("a file that says almost nothing", () => {
	it("`null` is a fresh install: 13 built-ins and the defaults", () => {
		const registry = load(null);

		assert.strictEqual(registry.getBuiltIn().length, DEFAULT_CALLOUTS.length);
		assert.deepStrictEqual(userIds(registry), []);
		assert.deepStrictEqual(registry.settings, DEFAULT_SETTINGS);
	});

	it("`{}` is the same thing", () => {
		assert.deepStrictEqual(load({}).settings, DEFAULT_SETTINGS);
		assert.strictEqual(load({}).getBuiltIn().length, DEFAULT_CALLOUTS.length);
	});

	it("callouts without settings, and settings without callouts, both load", () => {
		assert.deepStrictEqual(
			load({ callouts: vaultFrom_1_0_0().callouts }).settings,
			DEFAULT_SETTINGS,
		);
		assert.deepStrictEqual(
			userIds(load({ settings: vaultFrom_1_0_0().settings })),
			[],
		);
	});

	it("seeds the built-ins even when the file lists none of them", () => {
		// The README states this as an invariant, and CSSInjector, AutoComplete
		// and the public API all assume it: `getAll()` always returns every
		// built-in, whatever `data.json` says.
		const registry = load({ callouts: [] });
		assert.strictEqual(registry.getBuiltIn().length, DEFAULT_CALLOUTS.length);
	});

	it("demotes a row saved as a built-in this version has no built-in for", () => {
		// The mirror of the reclaim above. `load()` merges a `builtIn: true` row
		// onto the shipped default; when there is none to merge onto it used to
		// skip the row entirely, so a callout some build shipped as a built-in
		// and a later one retired took every vault's customization of it away —
		// while notes went on writing `[!retired-builtin]`. Unreachable today
		// (the 13 have never changed), and the shape to hold to if one ever is.
		const registry = load({
			callouts: [retiredBuiltIn()],
		});
		const row = registry.get("retired-builtin");

		assert.strictEqual(row?.displayName, "Retired");
		assert.strictEqual(row.colorLight, "#336699", "its styling came with it");
		assert.strictEqual(row.builtIn, false, "but not the flag it lied about");
		assert.strictEqual(row.source, "user");
	});

	it("shows it in the user's own list, and never among the built-ins", () => {
		// The lists partition on `builtIn`, so a row left claiming the flag
		// would re-home itself into the built-in half and be compared against a
		// shipped default that does not exist.
		const registry = load({ callouts: [retiredBuiltIn()] });

		assert.deepStrictEqual(userIds(registry), ["retired-builtin"]);
		assert.strictEqual(registry.getBuiltIn().length, DEFAULT_CALLOUTS.length);
	});

	it("keeps a non-`builtin` source it also carried", () => {
		// Only the one claim is disproved: `builtIn: true` on a row with no
		// shipped default. The `source` it arrived with is preserved.
		const registry = load({
			callouts: [{ ...retiredBuiltIn(), source: "plugin" }],
		});

		assert.strictEqual(registry.get("retired-builtin")?.source, "plugin");
		assert.strictEqual(registry.get("retired-builtin")?.builtIn, false);
	});

	it("re-homes an old `theme` row, which used to mean nothing at all", () => {
		// `source: "theme"` was inert before the two-mode model — it had zero
		// readers and only ever arrived from a long-removed registration API.
		// It now means "the active theme declares this id", and rows wearing it
		// are pruned when the theme stops doing so, which would silently delete
		// this one. See manager/styleModeMigration.ts.
		const registry = load({
			callouts: [{ ...retiredBuiltIn(), source: "theme" }],
		});

		assert.strictEqual(registry.get("retired-builtin")?.source, "user");
	});

	it("rewrites the file so the broken shape stops coming back", () => {
		// Same treatment the reclaim gets: repaired in memory AND flushed, or
		// every launch would demote it again and the next export would carry
		// the lie onward.
		const registry = load({ callouts: [retiredBuiltIn()] });

		assert.strictEqual(registry.needsSaveAfterLoad(), true);
		const saved = registry.toSaveData().callouts.find(
			(c) => c.id === "retired-builtin",
		);
		assert.strictEqual(saved?.builtIn, false);
		assert.strictEqual(saved.source, "user");
	});
});

/** A row that claims to be one of the shipped built-ins, on an id that is not. */
function retiredBuiltIn(): CalloutDefinition {
	return {
		id: "retired-builtin",
		displayName: "Retired",
		icon: { type: "lucide", value: "star" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
	} as CalloutDefinition;
}
