/**
 * tests/colorPalettes.test.ts — resolving an imported color to a palette.
 *
 * The bug this guards against was invisible and cost the user a palette per
 * import. `resolveCalloutManagerColors` compared a candidate against the
 * CONTRAST-CORRECTED accents `derivePaletteFromColors` produces, but a built-in
 * preset stores the raw hex `makePalette` was handed. Any preset whose own
 * accent needs correcting was therefore unmatchable — 10 of the 16 — so
 * importing #9e9e9e, which is literally the Gray preset, minted a near-duplicate
 * custom palette called "Gray 2".
 *
 * The round-trip below is the real regression test, and it asserts over the
 * whole preset list rather than a hand-picked few: the failure mode is one
 * preset quietly dropping out after its hexes are retuned, which a sample would
 * miss.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	findPresetByPaletteId,
	getAllColorPalettes,
	getExtraPalettes,
	getObsidianPalettes,
	resolveCalloutManagerColor,
	resolveCalloutManagerColors,
} from "../src/utils/colorPalettes";
import { derivePaletteFromColor } from "../src/utils/colorUtils";
import type { CustomPalette } from "../src/types";

describe("resolveCalloutManagerColors — every preset is reachable", () => {
	for (const preset of getAllColorPalettes()) {
		it(`${preset.name} (${preset.colorLight}/${preset.colorDark}) resolves to itself`, () => {
			const resolved = resolveCalloutManagerColors(
				preset.colorLight,
				preset.colorDark,
				[],
			);
			assert.equal(
				resolved.paletteId,
				preset.id,
				`expected the ${preset.name} preset, got ${resolved.paletteId}`,
			);
			assert.equal(
				resolved.createdPalette,
				undefined,
				`${preset.name} minted a duplicate instead of matching`,
			);
		});
	}

	it("bakes the preset's own colors, not a corrected version of them", () => {
		// The deliberate half of the fix: a matched preset keeps its raw accent
		// even where that is below the 3:1 the derivation enforces, because that
		// is what choosing it in the editor's dropdown gives.
		const resolved = resolveCalloutManagerColor("#9e9e9e", []);
		assert.equal(resolved.paletteId, "gray");
		assert.equal(resolved.colors.colorLight, "#9e9e9e");
		assert.equal(resolved.colors.colorDark, "#9e9e9e");
	});
});

describe("resolveCalloutManagerColors — a color that matches nothing", () => {
	it("mints exactly one palette for it", () => {
		const resolved = resolveCalloutManagerColor("#fa7814", []);
		assert.ok(resolved.createdPalette, "expected a new palette");
		assert.equal(resolved.paletteId, resolved.createdPalette?.id);
	});

	it("reuses that palette for the next callout with the same color", () => {
		// The caller pushes each created palette onto its live array precisely so
		// the next entry can find it; this is that contract.
		const palettes: CustomPalette[] = [];
		const first = resolveCalloutManagerColor("#fa7814", palettes);
		assert.ok(first.createdPalette);
		palettes.push(first.createdPalette);

		const second = resolveCalloutManagerColor("#fa7814", palettes);
		assert.equal(second.createdPalette, undefined);
		assert.equal(second.paletteId, first.paletteId);
	});

	it("keeps two different colors apart", () => {
		const palettes: CustomPalette[] = [];
		const red = resolveCalloutManagerColor("#ff1f1f", palettes);
		assert.ok(red.createdPalette);
		palettes.push(red.createdPalette);

		const otherRed = resolveCalloutManagerColor("#ff0000", palettes);
		assert.ok(otherRed.createdPalette, "#ff0000 is not #ff1f1f");
		assert.notEqual(otherRed.paletteId, red.paletteId);
	});

	it("never adopts a transparent palette, however well its hexes match", () => {
		// A "None" palette keeps all six colors beside the flag, so it can match
		// every hex here — and baking it would leave a callout that asked for a
		// fill with no background at all.
		const derived = derivePaletteFromColor("#fa7814");
		const transparent: CustomPalette = {
			id: "cp-transparent",
			name: "Ghost",
			...derived,
			transparentBg: true,
		};
		const resolved = resolveCalloutManagerColor("#fa7814", [transparent]);
		assert.notEqual(resolved.paletteId, "cp-transparent");
		assert.ok(resolved.createdPalette);
	});
});

describe("resolveCalloutManagerColors — two-tone imports", () => {
	it("keeps a genuinely different dark accent", () => {
		const resolved = resolveCalloutManagerColors("#1478c8", "#78beff", []);
		assert.equal(resolved.colors.colorLight, "#1478c8");
		assert.equal(resolved.colors.colorDark, "#78beff");
	});

	it("is the single-color path when both sides agree", () => {
		assert.deepEqual(
			resolveCalloutManagerColors("#9e9e9e", "#9e9e9e", []).colors,
			resolveCalloutManagerColor("#9e9e9e", []).colors,
		);
	});
});

describe("the preset list — groups, and every id ever saved", () => {
	it("Obsidian's group is exactly the colours Obsidian's callouts use", () => {
		assert.deepEqual(
			getObsidianPalettes().map((p) => p.id),
			["blue", "cyan", "green", "orange", "red", "purple", "gray"],
		);
		assert.deepEqual(
			getExtraPalettes().map((p) => p.id),
			["crimson", "coral", "yellow", "teal", "brown", "grape", "plum", "pink"],
		);
	});

	it("carries Obsidian's own hexes for Purple and Yellow", () => {
		// app.css: --color-purple #7852ee / #a882ff, --color-yellow #e0ac00 / #e0de71.
		const purple = findPresetByPaletteId("purple");
		assert.equal(purple?.colorLight, "#7852ee");
		assert.equal(purple?.colorDark, "#a882ff");
		const yellow = findPresetByPaletteId("yellow");
		assert.equal(yellow?.colorLight, "#e0ac00");
		assert.equal(yellow?.colorDark, "#e0de71");
	});

	// Every `paletteId` a released build could have written for a preset. A
	// stored id is never rewritten, so each one must find its preset forever —
	// dropping one turns that user's callouts into "Deleted color".
	const SAVED_ONCE: Record<string, string> = {
		// Role names, before the presets were named for their hue.
		note: "blue", abstract: "cyan", tip: "teal", success: "green",
		question: "orange", failure: "red", danger: "crimson", example: "purple",
		quote: "gray",
		// Hue names that later took Obsidian's own word for the colour.
		violet: "purple", bubblegum: "pink",
		// Retired as too close to Yellow; their callouts were repainted onto it.
		amber: "yellow", lime: "yellow",
	};
	for (const [saved, now] of Object.entries(SAVED_ONCE)) {
		it(`a callout saved on "${saved}" resolves to ${now}`, () => {
			assert.equal(findPresetByPaletteId(saved)?.id, now);
		});
	}

	it("every current id resolves to itself", () => {
		for (const preset of getAllColorPalettes()) {
			assert.equal(findPresetByPaletteId(preset.id)?.id, preset.id);
		}
	});

	it("no legacy id is a current id, and none answers for two presets", () => {
		const current = new Set(getAllColorPalettes().map((p) => p.id));
		const legacy = getAllColorPalettes().flatMap((p) => p.legacyIds ?? []);
		for (const id of legacy) assert.ok(!current.has(id), `${id} is both`);
		assert.equal(new Set(legacy).size, legacy.length);
	});

	it("knows nothing of a custom palette's id", () => {
		assert.equal(findPresetByPaletteId("cp-abc"), null);
		assert.equal(findPresetByPaletteId(""), null);
	});
});
