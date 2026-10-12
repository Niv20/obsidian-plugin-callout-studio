/**
 * tests/retiredPresets.test.ts — Amber and Lime folded into Yellow, Crimson
 * into Red.
 *
 * A callout stores its colours, so retiring a preset has to repaint the
 * callouts that wore it, or a callout on `"amber"` would read "Yellow" in the
 * editor while still painting amber. These pin which callouts move, what they
 * end up storing (exactly what picking Yellow would have saved), and which ones
 * must be left alone — on load and on import alike.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CALLOUTS } from "../src/defaultCallouts";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { CalloutDefinition, CustomPalette, PluginData } from "../src/types";
import { findPresetByPaletteId, getAllColorPalettes } from "../src/utils/colorPalettes";
import { bgTintFor, DEFAULT_TEXT_COLOR_DARK, DEFAULT_TEXT_COLOR_LIGHT } from "../src/utils/colorUtils";
import { applyImportedCallout } from "../src/utils/importedCallout";
import { movedOffRetiredPreset, RETIRED_PRESETS } from "../src/utils/retiredPresets";

const YELLOW = { light: "#e0ac00", dark: "#e0de71" };
const AMBER = { light: "#ff8f00", dark: "#ffd54f" };
const LIME = { light: "#afb42b", dark: "#dce775" };

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

const move = (d: CalloutDefinition, palettes: CustomPalette[] = []) =>
	movedOffRetiredPreset(d, palettes);

describe("the retired presets themselves", () => {
	it("are gone from the menu, and their successor answers to their ids", () => {
		const ids = getAllColorPalettes().map((p) => p.id);
		for (const [id, retired] of Object.entries(RETIRED_PRESETS)) {
			assert.ok(!ids.includes(id), `${id} is still listed`);
			assert.equal(findPresetByPaletteId(id)?.id, retired.successor);
		}
	});
});

describe("a callout linked to Amber or Lime by id", () => {
	for (const [id, from] of [["amber", AMBER], ["lime", LIME]] as const) {
		it(`moves from ${id} to Yellow, keeping its link`, () => {
			const moved = move(def({ paletteId: id, colorLight: from.light, colorDark: from.dark }));
			assert.ok(moved);
			assert.equal(moved.colorLight, YELLOW.light);
			assert.equal(moved.colorDark, YELLOW.dark);
			// Kept: this build reads it as Yellow, an older synced build still
			// knows it and does not call it a deleted colour.
			assert.equal(moved.paletteId, id);
		});
	}

	it("moves even when its accents drifted from the preset's", () => {
		// The editor labelled it by id, so it was Amber whatever it painted.
		const moved = move(def({ paletteId: "amber", colorLight: "#ff9900", colorDark: "#ffcc44" }));
		assert.equal(moved?.colorLight, YELLOW.light);
	});

	it("drops a background that was only the old accent's tint", () => {
		const moved = move(def({
			paletteId: "amber",
			bgColorLight: bgTintFor(AMBER.light, false),
			bgColorDark: bgTintFor(AMBER.dark, true),
		}));
		assert.ok(moved);
		assert.equal(moved.bgColorLight, undefined);
		assert.equal(moved.bgColorDark, undefined);
	});

	it("keeps an authored background, text colours, a gradient and transparency", () => {
		const gradient = { angleDeg: 90, toColorLight: "#111111", toColorDark: "#222222" };
		const moved = move(def({
			paletteId: "amber",
			bgColorLight: "#123456",
			bgColorDark: "#654321",
			textColorLight: "#010101",
			textColorDark: "#fefefe",
			bgGradient: gradient,
		}));
		assert.ok(moved);
		assert.equal(moved.bgColorLight, "#123456");
		assert.equal(moved.bgColorDark, "#654321");
		assert.equal(moved.textColorLight, "#010101");
		assert.equal(moved.textColorDark, "#fefefe");
		assert.deepEqual(moved.bgGradient, gradient);
		const transparent = move(def({ paletteId: "lime", transparentBg: true }));
		assert.equal(transparent?.transparentBg, true);
	});

	it("is a no-op once moved", () => {
		const moved = move(def({ paletteId: "amber" }));
		assert.ok(moved);
		assert.equal(move(moved), null);
	});
});

describe("a callout saved before the palette link existed", () => {
	it("moves when its colours are exactly Amber's, with no background", () => {
		assert.equal(move(def())?.colorLight, YELLOW.light);
	});

	it("moves when its background is Amber's own tint", () => {
		const moved = move(def({
			bgColorLight: bgTintFor(AMBER.light, false),
			bgColorDark: bgTintFor(AMBER.dark, true),
		}));
		assert.equal(moved?.colorLight, YELLOW.light);
		assert.equal(moved?.bgColorLight, undefined);
	});

	it("moves Lime's too, and gains no link it never had", () => {
		const moved = move(def({ colorLight: LIME.light.toUpperCase(), colorDark: LIME.dark }));
		assert.equal(moved?.colorDark, YELLOW.dark);
		assert.equal(moved?.paletteId, undefined);
	});

	it("stays when only the accent is Amber's — a background or gradient of its own, or transparent", () => {
		assert.equal(move(def({ bgColorLight: "#123456", bgColorDark: "#654321" })), null);
		assert.equal(move(def({ bgGradient: { angleDeg: 0, toColorLight: "#000000", toColorDark: "#ffffff" } })), null);
		assert.equal(move(def({ transparentBg: true })), null);
		assert.equal(move(def({ colorDark: "#000000" })), null);
	});

	it("stays when the user has a saved palette of exactly those colours", () => {
		// Amber's colours as a saved palette spells them out; the adoption pass
		// links the callout to it, so it is the user's colour now, not a preset.
		const own: CustomPalette = {
			id: "cp-amber",
			name: "My amber",
			colorLight: AMBER.light,
			colorDark: AMBER.dark,
			bgColorLight: bgTintFor(AMBER.light, false),
			bgColorDark: bgTintFor(AMBER.dark, true),
			textColorLight: DEFAULT_TEXT_COLOR_LIGHT,
			textColorDark: DEFAULT_TEXT_COLOR_DARK,
		};
		assert.equal(move(def(), [own]), null);
		assert.equal(move(def(), [{ ...own, colorDark: "#000000" }])?.colorLight, YELLOW.light, "a merely similar palette is not it");
	});
});

describe("Crimson, folded into Red", () => {
	const RED = { light: "#e93147", dark: "#fb464c" };
	const crimson = { colorLight: "#ff1744", colorDark: "#ff1744" };

	for (const id of ["crimson", "danger"]) {
		it(`a callout linked to ${id} moves to Red`, () => {
			const moved = move(def({ paletteId: id, ...crimson }));
			assert.equal(moved?.colorLight, RED.light);
			assert.equal(moved?.colorDark, RED.dark);
			assert.equal(moved?.paletteId, id);
			assert.equal(findPresetByPaletteId(id)?.id, "red");
		});
	}

	it("an unlinked callout in Crimson's colours moves to Red", () => {
		assert.equal(move(def(crimson))?.colorLight, RED.light);
	});
});

describe("callouts that never wore a retired preset", () => {
	it("include every built-in callout as it ships", () => {
		// An untouched built-in follows the theme; repainting one would freeze
		// it to a hex. None ships in a retired preset's colours.
		for (const builtIn of DEFAULT_CALLOUTS) {
			assert.equal(move(structuredClone(builtIn)), null, builtIn.id);
		}
	});

	it("are left alone", () => {
		assert.equal(move(def({ paletteId: "cp-mine" })), null, "a saved palette's callout");
		assert.equal(move(def({ paletteId: "orange" })), null, "another preset");
		assert.equal(move(def({ paletteId: "cp-dead" })), null, "an orphan keeps its colours");
		assert.equal(move(def({ colorLight: "#ec7500", colorDark: "#e9973f" })), null);
		assert.equal(move(def({ source: "theme" })), null, "a theme's own colour");
	});
});

describe("on load and on import", () => {
	function loaded(callouts: CalloutDefinition[]): CalloutRegistry {
		const registry = new CalloutRegistry();
		registry.load({ callouts } as Partial<PluginData>);
		return registry;
	}

	it("load moves them, flushes once, and lists no deleted colour", () => {
		const registry = loaded([
			def({ id: "a", paletteId: "amber" }),
			def({ id: "b", colorLight: LIME.light, colorDark: LIME.dark }),
			def({ id: "c", paletteId: "orange", colorLight: "#ec7500", colorDark: "#e9973f" }),
		]);
		assert.equal(registry.get("a")?.colorLight, YELLOW.light);
		assert.equal(registry.get("b")?.colorLight, YELLOW.light);
		assert.equal(registry.get("c")?.colorLight, "#ec7500");
		assert.deepEqual(registry.listOrphanPaletteGroups(), []);
		assert.equal(registry.needsSaveAfterLoad(), true);

		const again = loaded(registry.toSaveData().callouts);
		assert.equal(again.needsSaveAfterLoad(), false, "nothing left to move");
	});

	it("a modified built-in on Amber moves too", () => {
		const registry = loaded([
			def({ id: "warning", builtIn: true, source: "builtin", displayName: "Warning", paletteId: "amber" }),
		]);
		assert.equal(registry.get("warning")?.colorLight, YELLOW.light);
	});

	it("an imported backup lands already moved", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		assert.equal(applyImportedCallout(registry, def({ id: "old", paletteId: "lime", colorLight: LIME.light, colorDark: LIME.dark })), true);
		assert.equal(registry.get("old")?.colorLight, YELLOW.light);
		assert.equal(registry.get("old")?.colorDark, YELLOW.dark);
	});
});
