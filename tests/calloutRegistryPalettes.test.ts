/**
 * tests/calloutRegistryPalettes.test.ts — the palette link and what it cascades.
 *
 * `paletteId` is a *link*, not a colour: the six hexes are always baked onto the
 * definition, and the id is what lets a later edit of the palette find its way
 * back to every callout that used it. Everything here follows from that split:
 *
 * - **The link and the paint are two separate steps.** `relinkPalette` re-points
 *   and repaints nothing (baking colours in would silently overwrite a group
 *   member whose hexes the user had since edited by hand); `applyPaletteColors`
 *   repaints exactly the rows it just re-stamped, and fires the one change
 *   event for both.
 * - **A deleted palette leaves its id standing as a group marker.** That dangling
 *   id is the only thing that can reconstitute the group — the colours cannot,
 *   since a member the user has since restyled no longer matches its siblings.
 *   `listOrphanPaletteGroups` reads it; `adoptOrphansMatchingPalettes` is the
 *   passive route home when the same colours come back as a new palette.
 * - **A preset id is a live id.** Preset ids never appear in `customPalettes`, so
 *   without that half of `isLivePaletteId` every callout sitting on "Blue" would
 *   look orphaned and be adoptable by any custom palette whose hexes matched.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { getAllColorPalettes } from "../src/utils/colorPalettes";
import type {
	CalloutDefinition,
	CustomPalette,
	PluginData,
} from "../src/types";

const ACCENT_LIGHT = "#336699";
const ACCENT_DARK = "#88bbee";

/** The six colours a callout bakes when it applies {@link palette}. */
const BAKED = {
	colorLight: ACCENT_LIGHT,
	colorDark: ACCENT_DARK,
	bgColorLight: "#aabbcc",
	bgColorDark: "#112233",
	textColorLight: "#111111",
	textColorDark: "#eeeeee",
} as const;

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

function palette(over: Partial<CustomPalette> = {}): CustomPalette {
	return { id: "cp-1", name: "Mine", ...BAKED, ...over };
}

function saved(
	callouts: CalloutDefinition[],
	settings?: Record<string, unknown>,
): Partial<PluginData> {
	return { callouts, ...(settings ? { settings } : {}) } as Partial<PluginData>;
}

function loaded(data: Partial<PluginData> | null): {
	registry: CalloutRegistry;
	events: () => number;
} {
	const registry = new CalloutRegistry();
	registry.load(data);
	let n = 0;
	registry.onChange(() => n++);
	return { registry, events: () => n };
}

/** `applyPaletteColors` takes every field explicitly, `undefined` included. */
function colors(
	over: Partial<Parameters<CalloutRegistry["applyPaletteColors"]>[1]> = {},
): Parameters<CalloutRegistry["applyPaletteColors"]>[1] {
	return {
		colorLight: "#010101",
		colorDark: "#020202",
		bgColorLight: undefined,
		bgColorDark: undefined,
		bgGradient: undefined,
		transparentBg: undefined,
		textColorLight: undefined,
		textColorDark: undefined,
		...over,
	};
}

describe("countPaletteLinks", () => {
	it("counts every callout carrying the id", () => {
		const { registry } = loaded(
			saved([
				def({ id: "a", paletteId: "cp-1" }),
				def({ id: "b", paletteId: "cp-1" }),
				def({ id: "c", paletteId: "cp-2" }),
				def({ id: "d" }),
			]),
		);
		assert.strictEqual(registry.countPaletteLinks("cp-1"), 2);
		assert.strictEqual(registry.countPaletteLinks("cp-2"), 1);
		assert.strictEqual(registry.countPaletteLinks("cp-none"), 0);
	});

	it("can exclude one callout — the 'how many OTHERS' question the UI asks", () => {
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-1" }), def({ id: "b", paletteId: "cp-1" })]),
		);
		assert.strictEqual(registry.countPaletteLinks("cp-1", "b"), 1);
		assert.strictEqual(registry.countPaletteLinks("cp-1", "missing"), 2);
	});

	it("treats a null exclusion as no exclusion", () => {
		const { registry } = loaded(saved([def({ id: "a", paletteId: "cp-1" })]));
		assert.strictEqual(registry.countPaletteLinks("cp-1", null), 1);
		assert.strictEqual(registry.countPaletteLinks("cp-1", undefined), 1);
	});

	it("counts exactly the rows relinkPalette would touch", () => {
		// It deliberately walks the same raw map, so a count taken from a list
		// view could promise a number the relink then fails to deliver.
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-1" }), def({ id: "b", paletteId: "cp-1" })]),
		);
		const promised = registry.countPaletteLinks("cp-1");
		assert.strictEqual(registry.relinkPalette("cp-1", "cp-2"), promised);
	});

	it("does NOT see a brand-new draft that carries a paletteId", () => {
		// The number is shown to the user as "how many other callouts will be
		// regrouped", and a callout still being typed in the editor is not one
		// of them. Relying on `CalloutEditor.buildPreviewDefinition` happening
		// to build without a `paletteId` is not an enforcement — `withIdentityOf`
		// does not strip the field either.
		const { registry } = loaded(saved([def({ id: "a", paletteId: "cp-1" })]));
		assert.strictEqual(registry.countPaletteLinks("cp-1"), 1);

		registry.setPreviewDefinition(def({ id: "draft", paletteId: "cp-1" }));
		assert.strictEqual(registry.countPaletteLinks("cp-1"), 1);

		registry.setPreviewDefinition(null);
		assert.strictEqual(registry.countPaletteLinks("cp-1"), 1);
	});

	it("counts the callout a preview shadows, not the preview's own link", () => {
		// An in-progress edit of a real callout is that callout for counting
		// purposes: the committed row is what a revive would regroup.
		const { registry } = loaded(saved([def({ id: "a", paletteId: "cp-1" })]));

		registry.setPreviewDefinition(def({ id: "a", paletteId: "cp-2" }));
		assert.strictEqual(registry.countPaletteLinks("cp-1"), 1, "still the real link");
		assert.strictEqual(registry.countPaletteLinks("cp-2"), 0, "not the draft's");
	});

	it("still excludes by id while a preview is up", () => {
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-1" }), def({ id: "b", paletteId: "cp-1" })]),
		);
		registry.setPreviewDefinition(def({ id: "a", paletteId: "cp-1" }));
		assert.strictEqual(registry.countPaletteLinks("cp-1", "a"), 1);
	});
});

describe("relinkPalette", () => {
	it("re-points every member and reports how many", () => {
		const { registry } = loaded(
			saved([
				def({ id: "a", paletteId: "cp-dead" }),
				def({ id: "b", paletteId: "cp-dead" }),
				def({ id: "c", paletteId: "cp-other" }),
			]),
		);

		assert.strictEqual(registry.relinkPalette("cp-dead", "cp-new"), 2);
		assert.strictEqual(registry.get("a")?.paletteId, "cp-new");
		assert.strictEqual(registry.get("b")?.paletteId, "cp-new");
		assert.strictEqual(registry.get("c")?.paletteId, "cp-other");
	});

	it("touches no colour at all", () => {
		// Baking colours in here would silently overwrite a group member whose
		// hexes the user had since edited by hand.
		const { registry } = loaded(
			saved([
				def({ id: "a", paletteId: "cp-dead", colorLight: "#ff0000", colorDark: "#00ff00" }),
			]),
		);
		registry.relinkPalette("cp-dead", "cp-new");

		assert.strictEqual(registry.get("a")?.colorLight, "#ff0000");
		assert.strictEqual(registry.get("a")?.colorDark, "#00ff00");
	});

	it("announces nothing — the caller's applyPaletteColors fires the one event", () => {
		const { registry, events } = loaded(saved([def({ id: "a", paletteId: "cp-dead" })]));
		registry.relinkPalette("cp-dead", "cp-new");
		assert.strictEqual(events(), 0);
	});

	it("is a no-op when the two ids are the same", () => {
		const { registry } = loaded(saved([def({ id: "a", paletteId: "cp-1" })]));
		assert.strictEqual(registry.relinkPalette("cp-1", "cp-1"), 0);
	});

	it("can spare the callout being edited", () => {
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-dead" }), def({ id: "b", paletteId: "cp-dead" })]),
		);
		assert.strictEqual(registry.relinkPalette("cp-dead", "cp-new", "a"), 1);
		assert.strictEqual(registry.get("a")?.paletteId, "cp-dead");
	});
});

describe("applyPaletteColors", () => {
	it("cascades onto every linked callout and reports the count", () => {
		const { registry } = loaded(
			saved([
				def({ id: "a", paletteId: "cp-1" }),
				def({ id: "b", paletteId: "cp-1" }),
				def({ id: "c", paletteId: "cp-2" }),
			]),
		);

		assert.strictEqual(registry.applyPaletteColors("cp-1", colors()), 2);
		assert.strictEqual(registry.get("a")?.colorLight, "#010101");
		assert.strictEqual(registry.get("b")?.colorDark, "#020202");
		assert.strictEqual(registry.get("c")?.colorLight, ACCENT_LIGHT, "untouched");
	});

	it("clears what the previous palette left behind, via explicit undefined", () => {
		// Callers pass every field, `undefined` included, precisely so this
		// spread can clear a stale value — a palette edited from "None" back to
		// Solid must actually un-transparent its callouts, and only an explicit
		// undefined can do that through a merge.
		const { registry } = loaded(
			saved([
				def({
					id: "a",
					paletteId: "cp-1",
					transparentBg: true,
					bgGradient: {
						angleDeg: 90,
						toColorLight: "#ffffff",
						toColorDark: "#000000",
					},
				}),
			]),
		);
		registry.applyPaletteColors("cp-1", colors({ bgColorLight: "#123456" }));

		const row = registry.get("a");
		assert.strictEqual(row?.transparentBg, undefined);
		assert.strictEqual(row?.bgGradient, undefined);
		assert.strictEqual(row?.bgColorLight, "#123456");
	});

	it("keeps the link itself — repainting a group must not dissolve it", () => {
		const { registry } = loaded(saved([def({ id: "a", paletteId: "cp-1" })]));
		registry.applyPaletteColors("cp-1", colors());
		assert.strictEqual(registry.get("a")?.paletteId, "cp-1");
	});

	it("announces once when it changed something, and not at all when it did not", () => {
		const { registry, events } = loaded(saved([def({ id: "a", paletteId: "cp-1" })]));

		assert.strictEqual(registry.applyPaletteColors("cp-none", colors()), 0);
		assert.strictEqual(events(), 0);

		assert.strictEqual(registry.applyPaletteColors("cp-1", colors()), 1);
		assert.strictEqual(events(), 1);
	});

	it("re-mirrors the fallback rows when the active fallback is in the group", () => {
		const { registry } = loaded(
			saved(
				[
					def({ id: "base", source: "user", paletteId: "cp-1" }),
					def({ id: "f1", source: "fallback" }),
				],
				{ fallbackCalloutId: "base" },
			),
		);
		registry.applyPaletteColors("cp-1", colors());

		assert.strictEqual(
			registry.get("f1")?.colorLight,
			"#010101",
			"the mirrored row follows the repainted fallback",
		);
	});

	it("costs ONE change round when it re-mirrors, not two", () => {
		// `restyleUncustomizedFallbackRows` notifies on its own before
		// `applyPaletteColors` notifies for the repaint, so un-batched one
		// logical operation regenerated the stylesheet and wrote data.json
		// twice. The class has `batch()` for exactly this.
		const { registry, events } = loaded(
			saved(
				[
					def({ id: "base", source: "user", paletteId: "cp-1" }),
					def({ id: "f1", source: "fallback" }),
				],
				{ fallbackCalloutId: "base" },
			),
		);
		registry.applyPaletteColors("cp-1", colors());
		assert.strictEqual(events(), 1);
	});
});

describe("isLivePaletteId — through listOrphanPaletteGroups", () => {
	it("counts a dangling id as orphaned", () => {
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-dead" }), def({ id: "b", paletteId: "cp-dead" })]),
		);
		assert.deepStrictEqual(
			registry.listOrphanPaletteGroups().map((g) => [g.paletteId, g.count]),
			[["cp-dead", 2]],
		);
	});

	it("does not count an id a saved custom palette still owns", () => {
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-1" })], { customPalettes: [palette()] }),
		);
		assert.deepStrictEqual(registry.listOrphanPaletteGroups(), []);
	});

	it("does not count a built-in preset id", () => {
		// Preset ids never appear in `customPalettes`, so without this half
		// every callout sitting on "Blue" would look orphaned.
		const { registry } = loaded(saved([def({ id: "a", paletteId: "blue" })]));
		assert.deepStrictEqual(registry.listOrphanPaletteGroups(), []);
	});

	it("does not count a preset's LEGACY id either", () => {
		// The presets were renamed from callout names to hue names; `legacyIds`
		// is what keeps a callout picked before that rename resolving.
		const legacy = getAllColorPalettes().find((p) => p.legacyIds?.length);
		assert.ok(legacy?.legacyIds?.[0], "expected at least one preset with legacyIds");

		const { registry } = loaded(
			saved([def({ id: "a", paletteId: legacy.legacyIds[0] })]),
		);
		assert.deepStrictEqual(registry.listOrphanPaletteGroups(), []);
	});

	it("keeps a callout saved on Violet or Bubblegum on its renamed preset", () => {
		// Violet became Purple and Bubblegum became Pink. A saved `paletteId` is
		// never rewritten (an older synced device would not know the new id), so
		// the old one must stay live — not an orphan group, and not adoptable by
		// a saved palette that happens to carry the same hexes.
		const { registry } = loaded(
			saved(
				[
					def({ id: "a", paletteId: "violet", ...BAKED }),
					def({ id: "b", paletteId: "bubblegum", ...BAKED }),
				],
				{ customPalettes: [palette()] },
			),
		);
		assert.deepStrictEqual(registry.listOrphanPaletteGroups(), []);
		assert.strictEqual(registry.get("a")?.paletteId, "violet");
		assert.strictEqual(registry.get("b")?.paletteId, "bubblegum");
	});

	it("ignores a callout with no palette link at all", () => {
		const { registry } = loaded(saved([def({ id: "a" })]));
		assert.deepStrictEqual(registry.listOrphanPaletteGroups(), []);
	});

	it("groups by the dead id, and seeds each group from its first member", () => {
		// The id reconstitutes the group, not the colours: a member the user
		// has since restyled by hand no longer matches its siblings.
		const { registry } = loaded(
			saved([
				def({ id: "a", paletteId: "cp-dead", colorLight: "#ff0000" }),
				def({ id: "b", paletteId: "cp-dead" }),
				def({ id: "c", paletteId: "cp-other" }),
			]),
		);
		const groups = registry.listOrphanPaletteGroups();

		assert.strictEqual(groups.length, 2);
		const dead = groups.find((g) => g.paletteId === "cp-dead");
		assert.strictEqual(dead?.count, 2);
		assert.strictEqual(dead?.sample.id, "a", "first in map order, stable across renders");
	});
});

describe("adoptOrphansMatchingPalettes", () => {
	it("links a callout saved before paletteId existed but whose colours match", () => {
		const { registry } = loaded(
			saved([def({ id: "orphan", ...BAKED })], { customPalettes: [palette()] }),
		);
		assert.strictEqual(registry.get("orphan")?.paletteId, "cp-1");
	});

	it("adopts a callout whose paletteId is present but dangling", () => {
		// The guard skips only ids that still RESOLVE. A `continue` on any
		// truthy id would cost an orphaned group the passive route home, where
		// recreating the same colours as a new palette re-adopts them.
		const { registry } = loaded(
			saved([def({ id: "orphan", paletteId: "cp-dead", ...BAKED })], {
				customPalettes: [palette()],
			}),
		);
		assert.strictEqual(registry.get("orphan")?.paletteId, "cp-1");
	});

	it("leaves a callout already on a LIVE palette alone", () => {
		const { registry } = loaded(
			saved([def({ id: "kept", paletteId: "cp-2", ...BAKED })], {
				customPalettes: [palette(), palette({ id: "cp-2", name: "Other", colorLight: "#ff0000" })],
			}),
		);
		assert.strictEqual(registry.get("kept")?.paletteId, "cp-2");
	});

	it("matches case-insensitively, as saved hexes vary in spelling", () => {
		const { registry } = loaded(
			saved(
				[
					def({
						id: "orphan",
						...BAKED,
						colorLight: ACCENT_LIGHT.toUpperCase(),
						bgColorLight: BAKED.bgColorLight.toUpperCase(),
					}),
				],
				{ customPalettes: [palette()] },
			),
		);
		assert.strictEqual(registry.get("orphan")?.paletteId, "cp-1");
	});

	it("refuses a match on the six hexes alone when transparency disagrees", () => {
		// A "None" palette keeps real background hexes beside its flag — they
		// are what a switch back to Solid restores — so on hexes alone a plain
		// solid callout matches all three variants of the same colour and can
		// be adopted by the wrong one.
		const { registry } = loaded(
			saved([def({ id: "solid", ...BAKED })], {
				customPalettes: [palette({ transparentBg: true })],
			}),
		);
		assert.strictEqual(registry.get("solid")?.paletteId, undefined);
	});

	it("refuses a match when the gradient disagrees", () => {
		const { registry } = loaded(
			saved([def({ id: "solid", ...BAKED })], {
				customPalettes: [
					palette({
						bgGradient: {
							angleDeg: 90,
							toColorLight: "#ffffff",
							toColorDark: "#000000",
						},
					}),
				],
			}),
		);
		assert.strictEqual(registry.get("solid")?.paletteId, undefined);
	});

	it("refuses a match when any one of the six hexes differs", () => {
		const { registry } = loaded(
			saved([def({ id: "near", ...BAKED, textColorDark: "#ffffff" })], {
				customPalettes: [palette()],
			}),
		);
		assert.strictEqual(registry.get("near")?.paletteId, undefined);
	});

	it("treats an absent background on the callout as the empty string, not a wildcard", () => {
		const { registry } = loaded(
			saved([def({ id: "nobg", colorLight: ACCENT_LIGHT, colorDark: ACCENT_DARK })], {
				customPalettes: [palette()],
			}),
		);
		assert.strictEqual(registry.get("nobg")?.paletteId, undefined);
	});

	it("does nothing at all when the user has saved no custom palettes", () => {
		const { registry } = loaded(saved([def({ id: "orphan", ...BAKED })]));
		assert.strictEqual(registry.adoptOrphansMatchingPalettes(), 0);
	});

	it("reports its count when called after load, as a palette edit does", () => {
		const { registry } = loaded(saved([def({ id: "orphan", ...BAKED })]));
		registry.settings.customPalettes = [palette()];

		assert.strictEqual(registry.adoptOrphansMatchingPalettes(), 1);
		assert.strictEqual(registry.get("orphan")?.paletteId, "cp-1");
		assert.strictEqual(
			registry.adoptOrphansMatchingPalettes(),
			0,
			"idempotent — the row now resolves",
		);
	});
});

describe("consolidateDuplicatePalettes", () => {
	it("merges palettes with identical colours, keeping the earliest", () => {
		// Insertion order, so the oldest palette keeps its name and id — which
		// is also what makes re-running this over its own output a no-op.
		const { registry } = loaded(
			saved([], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
					palette({ id: "cp-3", name: "Other", colorLight: "#ff0000" }),
				],
			}),
		);
		assert.deepStrictEqual(
			registry.settings.customPalettes.map((p) => p.id),
			["cp-1", "cp-3"],
		);
	});

	it("re-points every callout that linked to the merged-away duplicate", () => {
		// The relink is the whole point. Dropping alone would leave those
		// callouts with a dangling id and no route home — a tidy-up turned into
		// silent data loss.
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-2" })], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
				],
			}),
		);
		assert.strictEqual(registry.get("a")?.paletteId, "cp-1");
	});

	it("changes no colour — what is lost is the duplicate's name", () => {
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-2", colorLight: "#ff0000" })], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
				],
			}),
		);
		assert.strictEqual(registry.get("a")?.colorLight, "#ff0000");
	});

	it("runs BEFORE the adoption pass, so a merged-away link is not re-matched", () => {
		// Arriving already re-pointed is what stops it looking like an orphan.
		const { registry } = loaded(
			saved([def({ id: "a", paletteId: "cp-2", ...BAKED })], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
				],
			}),
		);
		assert.strictEqual(registry.get("a")?.paletteId, "cp-1");
		assert.deepStrictEqual(registry.listOrphanPaletteGroups(), []);
	});

	it("returns an empty list, and touches nothing, when there is no duplicate", () => {
		const { registry } = loaded(
			saved([], {
				customPalettes: [
					palette({ id: "cp-1" }),
					palette({ id: "cp-2", colorLight: "#ff0000" }),
				],
			}),
		);
		assert.deepStrictEqual(registry.consolidateDuplicatePalettes(), []);
		assert.strictEqual(registry.settings.customPalettes.length, 2);
	});

	it("neither saves nor notifies — load and the importer each do that once", () => {
		const { registry, events } = loaded(
			saved([], { customPalettes: [palette({ id: "cp-1" })] }),
		);
		registry.settings.customPalettes.push(palette({ id: "cp-2", name: "Dup" }));

		assert.strictEqual(registry.consolidateDuplicatePalettes().length, 1);
		assert.strictEqual(events(), 0);
	});
});

describe("takePaletteMerges", () => {
	it("reports what merged into what, by NAME — that is what the user lost", () => {
		const { registry } = loaded(
			saved([], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
				],
			}),
		);
		assert.deepStrictEqual(registry.takePaletteMerges(), [
			{ from: "Second", to: "First" },
		]);
	});

	it("hands them over exactly once, so a later settings render cannot repeat the notice", () => {
		const { registry } = loaded(
			saved([], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
				],
			}),
		);
		assert.strictEqual(registry.takePaletteMerges().length, 1);
		assert.deepStrictEqual(registry.takePaletteMerges(), []);
	});

	it("is empty after a load that merged nothing", () => {
		const { registry } = loaded(saved([], { customPalettes: [palette()] }));
		assert.deepStrictEqual(registry.takePaletteMerges(), []);
	});

	it("is cleared by the next load rather than carried across", () => {
		const registry = new CalloutRegistry();
		registry.load(
			saved([], {
				customPalettes: [
					palette({ id: "cp-1", name: "First" }),
					palette({ id: "cp-2", name: "Second" }),
				],
			}),
		);
		registry.load(null);
		assert.deepStrictEqual(registry.takePaletteMerges(), []);
	});
});
