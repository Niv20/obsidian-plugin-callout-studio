/**
 * tests/retiredPresets.test.ts — Amber, Lime and Crimson left the menu, and
 * nobody's callouts changed.
 *
 * Retiring a preset is a menu decision, not a data migration. A callout stores
 * its colours, so taking a preset away must neither repaint the callouts that
 * wear it (Amber → Yellow is 16 CIEDE2000 in light mode — a different colour)
 * nor leave them reading "Deleted color". These pin both halves: what a load,
 * an import and the importer do (nothing), and what still knows the retired
 * presets (the id lookup, the editor's label, the importer's colour match) as
 * against what no longer offers them (the menu, metadata words).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { resolvePaletteEntry } from "../src/settings/paletteEntryResolution";
import type { PaletteEntry } from "../src/settings/paletteCombobox";
import type { CalloutDefinition, PluginData } from "../src/types";
import { metadataColorEntries } from "../src/utils/calloutMetadata";
import {
	findPresetByPaletteId,
	getAllColorPalettes,
	getRetiredPalettes,
	resolveCalloutManagerColors,
	type ColorPalette,
} from "../src/utils/colorPalettes";
import { bgTintFor } from "../src/utils/colorUtils";
import { applyImportedCallout } from "../src/utils/importedCallout";

const AMBER = { light: "#ff8f00", dark: "#ffd54f" };
const LIME = { light: "#afb42b", dark: "#dce775" };
const CRIMSON = { light: "#ff1744", dark: "#ff1744" };

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "warn",
		displayName: "Warn",
		icon: { type: "lucide", value: "star" },
		colorLight: AMBER.light,
		colorDark: AMBER.dark,
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

function loaded(callouts: CalloutDefinition[]): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load({ callouts } as Partial<PluginData>);
	return registry;
}

const colorsOf = (d: CalloutDefinition | undefined) => ({
	light: d?.colorLight,
	dark: d?.colorDark,
	bgLight: d?.bgColorLight,
	bgDark: d?.bgColorDark,
});

describe("the retired presets", () => {
	it("are gone from the menu and are no metadata word", () => {
		const offered = getAllColorPalettes().map((p) => p.id);
		const words = metadataColorEntries([]).flatMap((e) => [e.key, ...e.aliases]);
		for (const retired of getRetiredPalettes()) {
			assert.ok(!offered.includes(retired.id), `${retired.id} is still offered`);
			assert.ok(!words.includes(retired.id), `${retired.id} is a metadata word`);
		}
	});

	it("each resolve to themselves, Crimson also by its old role id", () => {
		for (const id of ["amber", "lime", "crimson"]) {
			assert.equal(findPresetByPaletteId(id)?.id, id);
		}
		assert.equal(findPresetByPaletteId("danger")?.id, "crimson");
	});

	it("are claimed by no current preset", () => {
		for (const preset of getAllColorPalettes()) {
			for (const id of ["amber", "lime", "crimson", "danger"]) {
				assert.ok(!preset.legacyIds?.includes(id), `${preset.id} answers to ${id}`);
			}
		}
	});

	it("keep the colours they shipped with", () => {
		const byId = new Map(getRetiredPalettes().map((p) => [p.id, p]));
		assert.equal(byId.get("amber")?.colorLight, AMBER.light);
		assert.equal(byId.get("lime")?.colorDark, LIME.dark);
		assert.equal(byId.get("crimson")?.colorLight, CRIMSON.light);
	});
});

describe("a load changes nobody's colours", () => {
	it("linked, unlinked and tinted callouts keep exactly what they had, with nothing to save", () => {
		const callouts = [
			def({ id: "a", paletteId: "amber" }),
			def({ id: "b", colorLight: LIME.light, colorDark: LIME.dark }),
			def({ id: "c", paletteId: "crimson", colorLight: CRIMSON.light, colorDark: CRIMSON.dark }),
			def({ id: "d", paletteId: "danger", colorLight: CRIMSON.light, colorDark: CRIMSON.dark }),
			def({
				id: "e",
				paletteId: "lime",
				colorLight: LIME.light,
				colorDark: LIME.dark,
				bgColorLight: "#123456",
				bgColorDark: "#654321",
			}),
		];
		const registry = loaded(structuredClone(callouts));
		for (const before of callouts) {
			assert.deepEqual(colorsOf(registry.get(before.id)), colorsOf(before), before.id);
			assert.equal(registry.get(before.id)?.paletteId, before.paletteId, before.id);
		}
		assert.deepEqual(registry.listOrphanPaletteGroups(), [], "no deleted colour");
		assert.equal(registry.needsSaveAfterLoad(), false);
	});

	it("a 2.0.0-era Crimson in its own darker red keeps it", () => {
		// 2.0.0's Crimson was #b71c1c / #e57373 under the same id.
		const registry = loaded([def({ id: "old", paletteId: "crimson", colorLight: "#b71c1c", colorDark: "#e57373" })]);
		assert.equal(registry.get("old")?.colorLight, "#b71c1c");
	});

	it("a built-in danger edited on a release that shipped it as #ff1744 keeps it", () => {
		// Releases 1.0.0–2.7.x shipped `danger` as #ff1744; an edited built-in
		// was saved whole, colours included.
		const registry = loaded([
			def({
				id: "danger",
				displayName: "Danger",
				builtIn: true,
				source: "builtin",
				icon: { type: "lucide", value: "flame" },
				colorLight: CRIMSON.light,
				colorDark: CRIMSON.dark,
				foldable: false,
			}),
		]);
		const danger = registry.get("danger");
		assert.equal(danger?.colorLight, CRIMSON.light);
		assert.ok(danger && !registry.isUnmodifiedBuiltIn(danger), "still the user's own colour");
		assert.equal(registry.needsSaveAfterLoad(), false);
	});

	it("an imported backup lands as it was written", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const old = def({ id: "old", paletteId: "lime", colorLight: LIME.light, colorDark: LIME.dark });
		assert.equal(applyImportedCallout(registry, structuredClone(old)), true);
		assert.deepEqual(colorsOf(registry.get("old")), colorsOf(old));
		assert.equal(registry.get("old")?.paletteId, "lime");
	});
});

describe("the editor still names a retired preset", () => {
	const entries: PaletteEntry[] = getAllColorPalettes().map((palette) => ({
		id: palette.id,
		name: palette.name,
		group: palette.group,
		palette,
	}));
	const wears = (light: string, dark: string) => (p: ColorPalette) =>
		p.colorLight === light && p.colorDark === dark;

	it("by id, keeping the id", () => {
		const resolved = resolvePaletteEntry(entries, "amber", () => false);
		assert.equal(resolved?.entry.id, "amber");
		assert.equal(resolved?.paletteId, "amber");
		assert.equal(resolvePaletteEntry(entries, "danger", () => false)?.paletteId, "danger");
	});

	it("by colour, for a callout saved before the link existed", () => {
		const resolved = resolvePaletteEntry(entries, undefined, wears(LIME.light, LIME.dark));
		assert.equal(resolved?.entry.id, "lime");
		assert.equal(resolved?.paletteId, "lime");
	});

	it("never lists it — the menu's own entries are untouched", () => {
		assert.ok(!entries.some((e) => e.id === "amber"));
	});

	it("keeps an id saved before a rename, while showing the preset's new name", () => {
		// An older synced build knows only "violet"; rewriting it on the next
		// save would show that device a deleted colour.
		const resolved = resolvePaletteEntry(entries, "violet", () => false);
		assert.equal(resolved?.entry.id, "purple");
		assert.equal(resolved?.paletteId, "violet");
	});
});

describe("the importer", () => {
	it("links Amber's colours to Amber rather than minting a palette, as before it retired", () => {
		const result = resolveCalloutManagerColors(AMBER.light, AMBER.dark, []);
		assert.equal(result.paletteId, "amber");
		assert.equal(result.createdPalette, undefined);
		assert.equal(result.colors.bgColorLight, bgTintFor(AMBER.light, false));
	});
});
