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
			["coral", "yellow", "teal", "sky", "indigo", "grape", "plum", "pink", "brown"],
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

	// Every `paletteId` a release since 2.1.0 could have written for a preset. A
	// stored id is never rewritten, so each one must find its preset forever —
	// dropping one turns that user's callouts into "Deleted color".
	const SAVED_ONCE: Record<string, string> = {
		// Role names, before the presets were named for their hue.
		note: "blue", abstract: "cyan", tip: "teal", success: "green",
		question: "orange", failure: "red", danger: "crimson", example: "purple",
		quote: "gray",
		// Hue names that later took Obsidian's own word for the colour.
		violet: "purple", bubblegum: "pink",
		// Retired from the menu, still known: see tests/retiredPresets.test.ts.
		amber: "amber", lime: "lime", crimson: "crimson",
	};
	for (const [saved, now] of Object.entries(SAVED_ONCE)) {
		it(`a callout saved on "${saved}" resolves to ${now}`, () => {
			assert.equal(findPresetByPaletteId(saved)?.id, now);
		});
	}

	// 2.0.0 shipped twelve more presets for four days; 2.1.0 dropped them, and
	// the callouts saved on them have read "Deleted color" — with Restore, which
	// saves their colours as a palette — ever since. Pinned so that stays a
	// decision rather than an accident.
	it("2.0.0's short-lived presets are deleted colours, not renamed ones", () => {
		for (const id of ["ocean", "cobalt", "emerald", "forest", "mint", "rose",
			"lavender", "sunset", "gold", "slate", "graphite", "storm"]) {
			assert.equal(findPresetByPaletteId(id), null, id);
		}
	});

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

/**
 * CIEDE2000 colour difference — how far apart two colours look to a person.
 * Under ~5 is near-identical side by side; under ~10, hard to tell apart.
 */
function deltaE2000(hexA: string, hexB: string): number {
	const lab = (hex: string): [number, number, number] => {
		const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
		const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
		const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
		const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
		const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
		const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
		return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
	};
	const rad = (d: number) => (d * Math.PI) / 180;
	const deg = (r: number) => ((r * 180) / Math.PI + 360) % 360;
	const [L1, a1, b1] = lab(hexA);
	const [L2, a2, b2] = lab(hexB);
	const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
	const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
	const a1p = (1 + G) * a1;
	const a2p = (1 + G) * a2;
	const C1 = Math.hypot(a1p, b1);
	const C2 = Math.hypot(a2p, b2);
	const h1 = deg(Math.atan2(b1, a1p));
	const h2 = deg(Math.atan2(b2, a2p));
	let dh = h2 - h1;
	if (C1 * C2 === 0) dh = 0;
	else if (dh > 180) dh -= 360;
	else if (dh < -180) dh += 360;
	const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(rad(dh / 2));
	const Lb = (L1 + L2) / 2;
	const Cb = (C1 + C2) / 2;
	const hb = C1 * C2 === 0 ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + 360) / 2;
	const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
	const Rc = 2 * Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7));
	const Rt = -Math.sin(rad(2 * 30 * Math.exp(-(((hb - 275) / 25) ** 2)))) * Rc;
	const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
	const Sc = 1 + 0.045 * Cb;
	const Sh = 1 + 0.015 * Cb * T;
	const dL = (L2 - L1) / Sl;
	const dC = (C2 - C1) / Sc;
	const dHs = dH / Sh;
	return Math.sqrt(dL ** 2 + dC ** 2 + dHs ** 2 + Rt * dC * dHs);
}

describe("no two presets look alike", () => {
	// Red and Crimson measured 3.5 / 4.3, Yellow and Lime 3.4 in dark mode — both
	// pairs were retired for it. The closest pair kept on purpose, Cyan and Teal,
	// is 7.8 in light mode; a new preset has to clear that floor in both themes.
	const FLOOR = 7;

	it("pins the yardstick to known values", () => {
		assert.ok(Math.abs(deltaE2000("#e93147", "#ff1744") - 3.5) < 0.1);
		assert.ok(Math.abs(deltaE2000("#00bfbc", "#00bfa5") - 7.8) < 0.1);
	});

	const presets = getAllColorPalettes();
	for (const [i, a] of presets.entries()) {
		for (const b of presets.slice(i + 1)) {
			it(`${a.id} and ${b.id} stay apart in both themes`, () => {
				const light = deltaE2000(a.colorLight, b.colorLight);
				const dark = deltaE2000(a.colorDark, b.colorDark);
				assert.ok(Math.min(light, dark) >= FLOOR, `light ${light.toFixed(1)}, dark ${dark.toFixed(1)}`);
			});
		}
	}
});
