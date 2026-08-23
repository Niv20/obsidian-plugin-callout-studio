/**
 * tests/paletteBaseColor.test.ts — the palette editor's base color must survive
 * a round-trip through a saved palette.
 *
 * `derivePaletteFromColors` contrast-corrects the accent it derives, so its
 * output is NOT a valid input: feeding `colorLight` back in as the base derives
 * a different palette. The editor used to do exactly that — it seeded its base
 * from the saved `colorLight`, having no record of the pick — and the first
 * touch of the Intensity slider then re-derived all six colors from a color the
 * user never chose. `CustomPalette.baseColor` exists to break that loop, and
 * these tests are what say so.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	derivePaletteFromColor,
	MAX_BG_COLOR_AMOUNT,
	MIN_BG_COLOR_AMOUNT,
	hexToRgb,
} from "../src/utils/colorUtils";
import {
	seedBaseColor,
} from "../src/settings/paletteBaseColorRow";
import { sanitizeCustomPalettes } from "../src/utils/paletteSanitize";
import { mergeSavedSettings } from "../src/utils/settingsMerge";
import { palettesVisuallyEqual, customPaletteToColorPalette } from "../src/utils/colorPalettes";
import type { CustomPalette } from "../src/types";

/** Pure yellow: the loudest case, and the one this was reported against. */
const YELLOW = "#ffff00";
/** What ensureContrast returns for YELLOW at any slider position. */
const YELLOW_FIXED = "#8c8c00";

const maxDelta = (a: string, b: string): number => {
	const x = hexToRgb(a);
	const y = hexToRgb(b);
	return Math.max(
		Math.abs(x.r - y.r),
		Math.abs(x.g - y.g),
		Math.abs(x.b - y.b),
	);
};

/* -------------------------------------------------------------------------- */
/* 1 — the derivation is not idempotent, which is the whole reason for the field */
/* -------------------------------------------------------------------------- */

describe("derivePaletteFromColor is not idempotent", () => {
	it("returns a contrast-corrected accent, not the color it was given", () => {
		// Documented behaviour, not a bug: #ffff00 on its own pale tint scores
		// 1.06:1, far under the 3:1 bar a callout title has to clear.
		const p = derivePaletteFromColor(YELLOW, MIN_BG_COLOR_AMOUNT);
		assert.equal(p.colorLight, YELLOW_FIXED);
		// Dark mode needs no help — yellow on #333319 is already readable.
		assert.equal(p.colorDark, YELLOW);
	});

	it("corrects to the same accent at every slider position", () => {
		// The background moves with the intensity; the accent does not. This is
		// what makes the correction safe to disclose once, in one sentence.
		for (const amount of [0.1, 0.11, 0.18, 0.2, 0.3]) {
			const p = derivePaletteFromColor(YELLOW, amount);
			assert.equal(p.colorLight, YELLOW_FIXED, `light @ ${amount}`);
			assert.equal(p.colorDark, YELLOW, `dark @ ${amount}`);
		}
	});

	it("re-deriving from its OWN output lands somewhere else", () => {
		// The bug in one assertion. Seeding the base from a saved `colorLight`
		// is this call, and it is why one nudge of the Intensity slider used to
		// turn a yellow palette olive.
		const saved = derivePaletteFromColor(YELLOW, 0.1);
		const reDerived = derivePaletteFromColor(saved.colorLight, 0.11);
		assert.equal(reDerived.colorDark, YELLOW_FIXED);
		assert.notEqual(reDerived.colorDark, saved.colorDark);
		assert.notEqual(reDerived.bgColorLight, saved.bgColorLight);
	});
});

/* -------------------------------------------------------------------------- */
/* 2 — with the base preserved, the Intensity slider is continuous            */
/* -------------------------------------------------------------------------- */

describe("the Intensity slider, from a preserved base color", () => {
	it("never changes either accent across its whole range", () => {
		// The reported symptom was a *jump* at 10% → 11%. From a fixed base
		// there is nothing to jump: intensity steers the background tint only.
		const first = derivePaletteFromColor(YELLOW, MIN_BG_COLOR_AMOUNT);
		for (let pct = 10; pct <= Math.round(MAX_BG_COLOR_AMOUNT * 100); pct++) {
			const p = derivePaletteFromColor(YELLOW, pct / 100);
			assert.equal(p.colorLight, first.colorLight, `light @ ${pct}%`);
			assert.equal(p.colorDark, first.colorDark, `dark @ ${pct}%`);
		}
	});

	it("moves the background by a hair per step, monotonically", () => {
		// Every 1% step is a few levels at most, in one direction. The old
		// behaviour crossed 23 levels of blue between 10% and 11% AND dropped
		// the hue, which is what read as "suddenly darker".
		let prev = derivePaletteFromColor(YELLOW, MIN_BG_COLOR_AMOUNT);
		for (let pct = 11; pct <= Math.round(MAX_BG_COLOR_AMOUNT * 100); pct++) {
			const p = derivePaletteFromColor(YELLOW, pct / 100);
			const step = maxDelta(prev.bgColorLight, p.bgColorLight);
			assert.ok(step <= 6, `light bg jumped ${step} levels at ${pct}%`);
			// Away from white in light mode, away from near-black in dark mode.
			assert.ok(
				hexToRgb(p.bgColorLight).b <= hexToRgb(prev.bgColorLight).b,
				`light bg went back toward white at ${pct}%`,
			);
			assert.ok(
				hexToRgb(p.bgColorDark).r >= hexToRgb(prev.bgColorDark).r,
				`dark bg went back toward black at ${pct}%`,
			);
			prev = p;
		}
	});

	it("is stable across a save/reopen round-trip", () => {
		// Reopening seeds from `baseColor`, so re-deriving at the SAME intensity
		// has to reproduce the palette exactly. Without the field this held only
		// for colors the correction happened to leave alone.
		const saved = derivePaletteFromColor(YELLOW, 0.18);
		const reopened = derivePaletteFromColor(YELLOW, 0.18);
		assert.deepStrictEqual(reopened, saved);
	});
});

/* -------------------------------------------------------------------------- */
/* 3 — seedBaseColor: which color the editor reopens on                        */
/* -------------------------------------------------------------------------- */

const FALLBACK = "#448aff";

describe("seedBaseColor", () => {
	it("prefers the stored pick over the corrected accent", () => {
		// The fix, in one assertion. Reopening the yellow palette must put the
		// user's #ffff00 back in the swatch, not the #8c8c00 that was derived
		// from it — otherwise the next re-derivation runs from the wrong base.
		assert.equal(
			seedBaseColor(
				{ baseColor: YELLOW, colorLight: YELLOW_FIXED },
				FALLBACK,
			),
			YELLOW,
		);
	});

	it("falls back to colorLight for a palette saved before the field", () => {
		// The old behaviour, kept deliberately: the correction is not
		// invertible, so colorLight is the best guess such a palette can offer.
		assert.equal(
			seedBaseColor({ colorLight: YELLOW_FIXED }, FALLBACK),
			YELLOW_FIXED,
		);
	});

	it("falls back for a seed built from a baked callout", () => {
		// paletteSeedFromDefinition reads a CalloutDefinition, which carries no
		// record of a base color at all.
		assert.equal(seedBaseColor({ colorLight: "#e93147" }, FALLBACK), "#e93147");
	});

	it("uses the default for a brand-new palette", () => {
		assert.equal(seedBaseColor(null, FALLBACK), FALLBACK);
	});

	it("ignores a junk stored pick rather than seeding the swatch with it", () => {
		// A native <input type="color"> silently shows black for a value it
		// cannot parse, which would look like the palette lost its color.
		assert.equal(
			seedBaseColor(
				{ baseColor: "transparent", colorLight: YELLOW_FIXED },
				FALLBACK,
			),
			YELLOW_FIXED,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 4 — baseColor survives the settings loader, and is not a *color*            */
/* -------------------------------------------------------------------------- */

const palette = (extra: Partial<CustomPalette> = {}): Record<string, unknown> => ({
	id: "cp-1",
	name: "Amber",
	colorLight: YELLOW_FIXED,
	colorDark: YELLOW,
	bgColorLight: "#ffffe6",
	bgColorDark: "#333319",
	textColorLight: "#1a1a1a",
	textColorDark: "#e0e0e0",
	...extra,
});

/** The one palette the sanitizer kept, asserted present so the type narrows. */
const only = (raw: unknown): CustomPalette => {
	const [p] = sanitizeCustomPalettes([raw]);
	assert.ok(p, "the sanitizer dropped the whole palette");
	return p;
};

describe("sanitizeCustomPalettes and baseColor", () => {
	it("keeps a valid base color", () => {
		assert.equal(only(palette({ baseColor: YELLOW })).baseColor, YELLOW);
	});

	it("drops a junk base color without dropping the palette", () => {
		// Same tolerance as bgIntensity: the six colors still describe the
		// palette, and the editor falls back to seeding from colorLight.
		for (const junk of ["nope", "#fff", 42, null, {}]) {
			const p = only(palette({ baseColor: junk as never }));
			assert.equal(
				p.baseColor,
				undefined,
				`kept baseColor ${JSON.stringify(junk)}`,
			);
		}
	});

	it("loads a palette saved before the field existed", () => {
		const p = only(palette());
		assert.equal(p.baseColor, undefined);
		assert.equal(p.colorLight, YELLOW_FIXED);
	});

	it("survives the real load path, which import shares", () => {
		// mergeSavedSettings is what CalloutRegistry.load() runs on data.json AND
		// what settingsValidator runs on an imported file, so one assertion here
		// covers save→load and export→import both.
		const merged = mergeSavedSettings({
			customPalettes: [
				palette({ baseColor: YELLOW }) as unknown as CustomPalette,
			],
		});
		assert.equal(merged.customPalettes[0]?.baseColor, YELLOW);
	});

	it("does not make two identically-rendering palettes distinct", () => {
		// baseColor is editor state, already baked into the six hexes. Two
		// palettes that paint the same thing stay duplicates however they were
		// reached, or the editor's duplicate-color block springs a leak.
		const a = only(palette({ baseColor: YELLOW }));
		const b = only(palette({ id: "cp-2", baseColor: "#f5f500" }));
		assert.equal(
			palettesVisuallyEqual(
				customPaletteToColorPalette(a),
				customPaletteToColorPalette(b),
			),
			true,
		);
	});
});
