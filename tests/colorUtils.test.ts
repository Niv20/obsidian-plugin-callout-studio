/**
 * tests/colorUtils.test.ts — the colour maths under every callout.
 *
 * `colorPalettes.test.ts` already covers the palette-matching layer above this
 * one. What is tested here is the layer that layer stands on, and the two parts
 * of it that are load-bearing enough to be worth stating as tests:
 *
 * - **The nesting invariant.** A background is painted as a translucent tint or
 *   not at all — `translucentTintFor` must either return an alpha inside
 *   [MIN, MAX] whose solved colour recomposites to the authored one, or `null`
 *   so the caller knows it is falling back to an opaque paint. Anything between
 *   those two — a tint that renders as the wrong colour, or one silently pinned
 *   at full opacity — is what breaks Obsidian's stepped nesting, and it breaks
 *   it invisibly.
 * - **The explicit-undefined cascade.** `sanitizeBgGradient` degrades rather
 *   than rejects: an unusable text sweep drops `textGradient` alone and leaves
 *   a working background gradient, because a missing sweep is a far smaller
 *   loss than no gradient.
 *
 * The rest is round-trip and boundary work on conversions that everything else
 * calls: a rounding error here moves every colour in the vault by a level.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	BG_PRIMARY_DARK,
	BG_PRIMARY_LIGHT,
	DEFAULT_BG_COLOR_AMOUNT,
	MAX_BG_COLOR_AMOUNT,
	MIN_BG_COLOR_AMOUNT,
	bgGradientCss,
	bgGradientsEqual,
	bgTintFor,
	blendHex,
	clampBgIntensity,
	contrastRatio,
	derivedBgAmount,
	ensureContrast,
	hexToHsl,
	hexToRgb,
	hexToRgbString,
	hslToRgb,
	inferOppositeModeColor,
	isValidHexColor,
	minTintAlpha,
	mirrorLightness,
	normalizeAngleDeg,
	parseCssColorToHex,
	relativeLuminance,
	resolveTintAlpha,
	rgbToHex,
	rotateHue,
	sanitizeBgGradient,
	tintColorAt,
	tintCss,
	translucentTintFor,
} from "../src/utils/colorUtils";
import {
	calloutAccentVarRef,
	calloutColorValue,
} from "../src/utils/calloutColorFormat";
import type { AccentDialect } from "../src/manager/theme/accentDialect";
import type { BgGradient } from "../src/types";

/** A spread wide enough that a per-channel bug cannot hide in it. */
const SAMPLE_HEXES = [
	"#000000",
	"#ffffff",
	"#ff0000",
	"#00ff00",
	"#0000ff",
	"#448aff",
	"#7f3fbf",
	"#e0af68",
	"#1c1c1c",
	"#808080",
	"#123456",
	"#fedcba",
];

/* ------------------------------------------------------------------ *
 * 7. hexToRgb / rgbToHex / hslToRgb
 * ------------------------------------------------------------------ */

describe("hexToRgb", () => {
	it("reads a six-digit hex with or without the leading #", () => {
		assert.deepStrictEqual(hexToRgb("#ff8800"), { r: 255, g: 136, b: 0 });
		assert.deepStrictEqual(hexToRgb("ff8800"), { r: 255, g: 136, b: 0 });
	});

	it("is case-insensitive", () => {
		assert.deepStrictEqual(hexToRgb("#FF8800"), hexToRgb("#ff8800"));
	});

	it("assumes six digits — the three-digit form is expanded upstream", () => {
		// parseCssColorToHex is what accepts `#f80`; by the time a value reaches
		// here it has already been normalized, so the short form is NOT handled
		// and must never be passed in directly.
		const expanded = parseCssColorToHex("#f80");
		assert.equal(expanded, "#ff8800");
		assert.deepStrictEqual(hexToRgb(expanded as string), {
			r: 255,
			g: 136,
			b: 0,
		});
	});

	it("degrades to black rather than throwing on junk", () => {
		// data.json is hand-editable, so this is reached in the wild. Black is
		// the wrong colour but it renders; an exception would kill the inject.
		assert.deepStrictEqual(hexToRgb("#zzzzzz"), { r: 0, g: 0, b: 0 });
		assert.deepStrictEqual(hexToRgb(""), { r: 0, g: 0, b: 0 });
	});
});

describe("rgbToHex", () => {
	it("pads each channel to two digits", () => {
		assert.equal(rgbToHex(0, 0, 0), "#000000");
		assert.equal(rgbToHex(1, 2, 3), "#010203");
		assert.equal(rgbToHex(255, 136, 0), "#ff8800");
	});

	it("clamps out-of-range channels instead of producing a broken string", () => {
		assert.equal(rgbToHex(-5, 300, 12.6), "#00ff0d");
	});

	it("rounds fractional channels", () => {
		assert.equal(rgbToHex(127.4, 127.5, 127.6), "#7f8080");
	});
});

describe("hexToRgb ⇄ rgbToHex round-trip", () => {
	for (const hex of SAMPLE_HEXES) {
		it(`${hex} survives the trip`, () => {
			const { r, g, b } = hexToRgb(hex);
			assert.equal(rgbToHex(r, g, b), hex);
		});
	}
});

describe("hslToRgb", () => {
	it("hits the primaries at full saturation", () => {
		assert.deepStrictEqual(hslToRgb(0, 100, 50), { r: 255, g: 0, b: 0 });
		assert.deepStrictEqual(hslToRgb(120, 100, 50), { r: 0, g: 255, b: 0 });
		assert.deepStrictEqual(hslToRgb(240, 100, 50), { r: 0, g: 0, b: 255 });
	});

	it("ignores hue at zero saturation", () => {
		assert.deepStrictEqual(hslToRgb(0, 0, 0), { r: 0, g: 0, b: 0 });
		assert.deepStrictEqual(hslToRgb(0, 0, 100), { r: 255, g: 255, b: 255 });
		assert.deepStrictEqual(hslToRgb(200, 0, 100), { r: 255, g: 255, b: 255 });
	});

	it("covers every 60° sector", () => {
		// One probe per branch of the piecewise definition, so a mis-ordered
		// comparison cannot pass by luck.
		assert.deepStrictEqual(hslToRgb(30, 100, 50), { r: 255, g: 128, b: 0 });
		assert.deepStrictEqual(hslToRgb(90, 100, 50), { r: 128, g: 255, b: 0 });
		assert.deepStrictEqual(hslToRgb(150, 100, 50), { r: 0, g: 255, b: 128 });
		assert.deepStrictEqual(hslToRgb(210, 100, 50), { r: 0, g: 128, b: 255 });
		assert.deepStrictEqual(hslToRgb(270, 100, 50), { r: 128, g: 0, b: 255 });
		assert.deepStrictEqual(hslToRgb(330, 100, 50), { r: 255, g: 0, b: 128 });
	});
});

describe("hexToHsl ⇄ hslToRgb round-trip", () => {
	for (const hex of SAMPLE_HEXES) {
		it(`${hex} comes back within a level`, () => {
			const { h, s, l } = hexToHsl(hex);
			const { r, g, b } = hslToRgb(h, s, l);
			const original = hexToRgb(hex);
			// Within 1/255 per channel: HSL is a lossy intermediate and the
			// round-trip rounds twice.
			assert.ok(Math.abs(r - original.r) <= 1, `r ${r} vs ${original.r}`);
			assert.ok(Math.abs(g - original.g) <= 1, `g ${g} vs ${original.g}`);
			assert.ok(Math.abs(b - original.b) <= 1, `b ${b} vs ${original.b}`);
		});
	}
});

/* ------------------------------------------------------------------ *
 * 8. parseCssColorToHex
 * ------------------------------------------------------------------ */

describe("parseCssColorToHex", () => {
	it("accepts a six-digit hex", () => {
		assert.equal(parseCssColorToHex("#ff0000"), "#ff0000");
		assert.equal(parseCssColorToHex("#FF0000"), "#ff0000");
	});

	it("expands a three-digit hex", () => {
		assert.equal(parseCssColorToHex("#f00"), "#ff0000");
		assert.equal(parseCssColorToHex("#ABC"), "#aabbcc");
	});

	it("reads rgb() and rgba(), comma- or space-separated", () => {
		assert.equal(parseCssColorToHex("rgb(255, 0, 0)"), "#ff0000");
		assert.equal(parseCssColorToHex("rgb(255 0 0)"), "#ff0000");
		assert.equal(parseCssColorToHex("rgba(255, 0, 0, 0.5)"), "#ff0000");
		assert.equal(parseCssColorToHex("rgba(255 0 0 / 0.5)"), "#ff0000");
		assert.equal(parseCssColorToHex("RGB(8, 109, 221)"), "#086ddd");
	});

	it("reads the bare pre-1.13 triplet", () => {
		assert.equal(parseCssColorToHex("255, 0, 0"), "#ff0000");
		assert.equal(parseCssColorToHex("8,109,221"), "#086ddd");
	});

	it("trims surrounding whitespace", () => {
		assert.equal(parseCssColorToHex("  #abc  "), "#aabbcc");
		assert.equal(parseCssColorToHex("\t255, 0, 0\n"), "#ff0000");
	});

	it("clamps an out-of-range channel rather than rejecting the colour", () => {
		assert.equal(parseCssColorToHex("rgb(300, 0, 0)"), "#ff0000");
	});

	it("returns null for anything it cannot read", () => {
		// The caller skips these rather than importing a broken colour.
		for (const junk of [
			"red",
			"transparent",
			"oklch(0.7 0.1 200)",
			"hsl(200, 50%, 50%)",
			"var(--callout-info)",
			"#ff00",
			"#1234567",
			"#gg0000",
			"ff0000",
			"255, 0",
			"",
			"   ",
			"{}",
		]) {
			assert.equal(parseCssColorToHex(junk), null, junk);
		}
	});

	it("is idempotent on anything it accepts", () => {
		for (const value of ["#f00", "rgb(1, 2, 3)", "255, 0, 0"]) {
			const once = parseCssColorToHex(value) as string;
			assert.equal(parseCssColorToHex(once), once, value);
		}
	});
});

/* ------------------------------------------------------------------ *
 * 9. translucentTintFor / minTintAlpha / resolveTintAlpha
 *    — the nesting invariant.
 * ------------------------------------------------------------------ */

/** Recomposite a tint over the mode's backdrop, the way the browser will. */
function composite(tint: string, alpha: number, isDark: boolean): string {
	const src = hexToRgb(tint);
	const bg = hexToRgb(isDark ? BG_PRIMARY_DARK : BG_PRIMARY_LIGHT);
	return rgbToHex(
		alpha * src.r + (1 - alpha) * bg.r,
		alpha * src.g + (1 - alpha) * bg.g,
		alpha * src.b + (1 - alpha) * bg.b,
	);
}

describe("translucentTintFor — no background is ever silently opaque", () => {
	for (const isDark of [false, true]) {
		const mode = isDark ? "dark" : "light";

		it(`every derived background tints cleanly in ${mode} mode`, () => {
			// These are the colours the injector actually paints: pale tints of
			// an accent. Every one of them must be expressible as a tint, or the
			// nesting step is lost for that callout.
			for (const accent of SAMPLE_HEXES) {
				const opaque = bgTintFor(accent, isDark);
				const tint = translucentTintFor(opaque, isDark);
				assert.ok(tint, `${accent} → ${opaque} had no tint in ${mode}`);
				assert.ok(
					tint.alpha >= 0.1 && tint.alpha <= 0.6,
					`alpha ${tint.alpha} outside [0.1, 0.6] for ${opaque}`,
				);
			}
		});

		it(`a returned tint recomposites to the authored colour in ${mode} mode`, () => {
			// The identity the whole approach rests on:
			//   alpha * color + (1 - alpha) * backdrop === opaque
			for (const accent of SAMPLE_HEXES) {
				const opaque = bgTintFor(accent, isDark);
				const tint = translucentTintFor(opaque, isDark);
				if (!tint) continue;
				const back = hexToRgb(composite(tint.color, tint.alpha, isDark));
				const want = hexToRgb(opaque);
				for (const ch of ["r", "g", "b"] as const) {
					assert.ok(
						Math.abs(back[ch] - want[ch]) <= 1,
						`${opaque} ${ch}: recomposited ${back[ch]}, wanted ${want[ch]}`,
					);
				}
			}
		});
	}

	it("returns null when the colour is too far from the page to be a tint", () => {
		// Black on white needs alpha 1 — a "tint" there is an opaque paint, and
		// the caller is told so rather than being handed a lie.
		assert.equal(translucentTintFor("#000000", false), null);
		assert.equal(translucentTintFor("#000000", true), null);
		assert.equal(translucentTintFor("#448aff", false), null);
	});

	it("expresses the backdrop itself at the floor alpha", () => {
		const light = translucentTintFor(BG_PRIMARY_LIGHT, false);
		assert.deepStrictEqual(light, { color: "#ffffff", alpha: 0.1 });
		const dark = translucentTintFor(BG_PRIMARY_DARK, true);
		assert.deepStrictEqual(dark, { color: BG_PRIMARY_DARK, alpha: 0.1 });
	});
});

describe("minTintAlpha", () => {
	it("is zero for the backdrop itself — no opacity needed at all", () => {
		assert.equal(minTintAlpha(BG_PRIMARY_LIGHT, false), 0);
		assert.equal(minTintAlpha(BG_PRIMARY_DARK, true), 0);
	});

	it("is 1 where a channel has to travel the full distance", () => {
		// Black on white: the `color >= 0` constraint binds at exactly 1.
		assert.equal(minTintAlpha("#000000", false), 1);
		// White on the dark page: the `color <= 255` constraint binds, also at 1.
		assert.equal(minTintAlpha("#ffffff", true), 1);
	});

	it("rises with the distance from the page", () => {
		const near = minTintAlpha("#f4f4f4", false);
		const far = minTintAlpha("#808080", false);
		assert.ok(near < far, `${near} should be below ${far}`);
	});

	it("takes the widest channel, not an average", () => {
		// Red is at the backdrop in light mode; green and blue are not. The
		// binding constraint is the channel that has to move furthest.
		const red = minTintAlpha("#ff0000", false);
		assert.ok(Math.abs(red - 1) < 1e-9, `expected 1, got ${red}`);
	});

	it("never divides by zero on a pure-black or pure-white page", () => {
		for (const hex of SAMPLE_HEXES) {
			for (const isDark of [false, true]) {
				const a = minTintAlpha(hex, isDark);
				assert.ok(Number.isFinite(a), `${hex} ${isDark} → ${a}`);
				assert.ok(a >= 0 && a <= 1, `${hex} ${isDark} → ${a}`);
			}
		}
	});
});

describe("resolveTintAlpha", () => {
	it("clears the largest minimum it is given", () => {
		// A gradient's two stops share one alpha, so both minima must be cleared.
		const alpha = resolveTintAlpha(0.2, 0.5);
		assert.ok(alpha !== null);
		assert.ok(alpha >= 0.5, `${alpha} does not clear 0.5`);
	});

	it("floors at 0.1 so a faint tint is not a wildly amplified colour", () => {
		assert.equal(resolveTintAlpha(0), 0.1);
		assert.equal(resolveTintAlpha(0.01), 0.1);
		assert.equal(resolveTintAlpha(), 0.1);
	});

	it("ceilings at 0.6, and refuses anything above it", () => {
		assert.equal(resolveTintAlpha(0.6), 0.6);
		assert.equal(resolveTintAlpha(0.61), null);
		assert.equal(resolveTintAlpha(1), null);
		assert.equal(resolveTintAlpha(0.1, 0.9), null);
	});

	it("adds 2% headroom so a solved channel cannot round past 255", () => {
		// 0.5 → ceil(51)/100. Without the headroom this would be exactly 0.50.
		assert.equal(resolveTintAlpha(0.5), 0.51);
	});

	it("ignores negative minima", () => {
		assert.equal(resolveTintAlpha(-1, -0.5), 0.1);
	});
});

describe("tintColorAt", () => {
	it("is the exact inverse of compositing, at or above the minimum alpha", () => {
		for (const isDark of [false, true]) {
			for (const accent of SAMPLE_HEXES) {
				const opaque = bgTintFor(accent, isDark);
				const min = minTintAlpha(opaque, isDark);
				const alpha = resolveTintAlpha(min);
				if (alpha === null) continue;
				const solved = tintColorAt(opaque, isDark, alpha);
				const back = hexToRgb(composite(solved, alpha, isDark));
				const want = hexToRgb(opaque);
				for (const ch of ["r", "g", "b"] as const) {
					assert.ok(Math.abs(back[ch] - want[ch]) <= 1, `${opaque} ${ch}`);
				}
			}
		}
	});

	it("returns the colour itself at alpha 1", () => {
		assert.equal(tintColorAt("#123456", false, 1), "#123456");
		assert.equal(tintColorAt("#123456", true, 1), "#123456");
	});

	it("clamps rather than leaving the sRGB cube below the minimum alpha", () => {
		// Documented precondition: below minTintAlpha the solve is out of gamut.
		// It must still return a usable hex rather than `#NaNNaNNaN`.
		const out = tintColorAt("#000000", false, 0.1);
		assert.ok(isValidHexColor(out), out);
	});
});

describe("tintCss", () => {
	it("emits the same color-mix construct core uses", () => {
		assert.equal(
			tintCss("#abc123", 0.18),
			"color-mix(in oklch, #abc123 18%, transparent)",
		);
	});

	it("strips trailing zeros but keeps a real fraction", () => {
		assert.ok(tintCss("#000000", 0.1).includes(" 10%,"));
		assert.ok(tintCss("#000000", 0.6).includes(" 60%,"));
		assert.ok(tintCss("#000000", 1).includes(" 100%,"));
		assert.ok(tintCss("#000000", 0.185).includes(" 18.5%,"));
	});

	it("accepts a var() reference as well as a hex", () => {
		assert.equal(
			tintCss("var(--cs-accent)", 0.2),
			"color-mix(in oklch, var(--cs-accent) 20%, transparent)",
		);
	});
});

/* ------------------------------------------------------------------ *
 * 10. bgTintFor — consistency across modes
 * ------------------------------------------------------------------ */

describe("bgTintFor", () => {
	it("blends toward the mode's own background", () => {
		assert.equal(bgTintFor("#ff0000", false, 0), BG_PRIMARY_LIGHT);
		assert.equal(bgTintFor("#ff0000", true, 0), BG_PRIMARY_DARK);
	});

	it("is the accent itself at full strength", () => {
		assert.equal(bgTintFor("#ff0000", false, 1), "#ff0000");
		assert.equal(bgTintFor("#ff0000", true, 1), "#ff0000");
	});

	it("defaults to DEFAULT_BG_COLOR_AMOUNT", () => {
		assert.equal(
			bgTintFor("#448aff", false),
			bgTintFor("#448aff", false, DEFAULT_BG_COLOR_AMOUNT),
		);
	});

	it("gives light mode a lighter tint than dark mode, for every accent", () => {
		for (const accent of SAMPLE_HEXES) {
			const light = relativeLuminance(bgTintFor(accent, false));
			const dark = relativeLuminance(bgTintFor(accent, true));
			assert.ok(light > dark, `${accent}: light ${light} vs dark ${dark}`);
		}
	});

	it("moves monotonically toward the accent as the amount rises", () => {
		const accent = "#ff0000";
		let previous = -1;
		for (const amount of [0, 0.1, 0.18, 0.3, 0.6, 1]) {
			const distance =
				255 - hexToRgb(bgTintFor(accent, false, amount)).g;
			assert.ok(distance > previous, `amount ${amount}`);
			previous = distance;
		}
	});
});

describe("blendHex", () => {
	it("returns the endpoints at 0 and 1", () => {
		assert.equal(blendHex("#ff0000", "#0000ff", 0), "#ff0000");
		assert.equal(blendHex("#ff0000", "#0000ff", 1), "#0000ff");
	});

	it("meets in the middle at 0.5", () => {
		assert.equal(blendHex("#000000", "#ffffff", 0.5), "#808080");
	});
});

/* ------------------------------------------------------------------ *
 * 11. derivedBgAmount / clampBgIntensity
 * ------------------------------------------------------------------ */

describe("derivedBgAmount", () => {
	it("recognizes a background the plugin computed itself", () => {
		for (const isDark of [false, true]) {
			for (const amount of [0.1, 0.18, 0.25, 0.3]) {
				const accent = "#448aff";
				const bg = bgTintFor(accent, isDark, amount);
				const solved = derivedBgAmount(accent, bg, isDark);
				assert.ok(
					solved !== null,
					`${accent}@${amount} (${isDark ? "dark" : "light"}) read as hand-picked`,
				);
				// The solve recovers the strength the stored hex was produced
				// from, which need not be the exact float that produced it —
				// what must hold is that it reproduces the same colour.
				assert.equal(bgTintFor(accent, isDark, solved), bg);
			}
		}
	});

	it("recognizes a dark tint computed against the LEGACY base", () => {
		// Every dark background already on disk was blended toward #1e1e1e. A
		// migration that knew only the corrected #1c1c1c would mistake all of
		// them for colours the user chose by hand and leave them opaque.
		const accent = "#ff0000";
		const legacy = blendHex(accent, "#1e1e1e", 1 - 0.18);
		assert.notEqual(legacy, bgTintFor(accent, true, 0.18));
		assert.ok(derivedBgAmount(accent, legacy, true) !== null);
	});

	it("returns null for a background the user picked", () => {
		assert.equal(derivedBgAmount("#ff0000", "#00ff00", false), null);
		assert.equal(derivedBgAmount("#448aff", "#ffeeaa", false), null);
	});

	it("returns 1 when the background IS the accent", () => {
		assert.equal(derivedBgAmount("#ffffff", "#ffffff", false), 1);
		assert.equal(derivedBgAmount("#ff0000", "#ff0000", false), 1);
	});

	it("returns null when an accent equal to the base does not match", () => {
		// No axis to solve along: every amount produces the same colour.
		assert.equal(derivedBgAmount("#ffffff", "#eeeeee", false), null);
	});
});

describe("clampBgIntensity", () => {
	it("clamps into the slider's range", () => {
		assert.equal(clampBgIntensity(0.05), MIN_BG_COLOR_AMOUNT);
		assert.equal(clampBgIntensity(0.5), MAX_BG_COLOR_AMOUNT);
		assert.equal(clampBgIntensity(-1), MIN_BG_COLOR_AMOUNT);
	});

	it("passes an in-range value through untouched", () => {
		assert.equal(clampBgIntensity(0.18), 0.18);
		assert.equal(clampBgIntensity(MIN_BG_COLOR_AMOUNT), MIN_BG_COLOR_AMOUNT);
		assert.equal(clampBgIntensity(MAX_BG_COLOR_AMOUNT), MAX_BG_COLOR_AMOUNT);
	});

	it("distinguishes 0 from absent — 0 is a number and clamps to the floor", () => {
		// The caller falls back to DEFAULT_BG_COLOR_AMOUNT only on `undefined`,
		// so a stored 0 must NOT come back as `undefined`.
		assert.equal(clampBgIntensity(0), MIN_BG_COLOR_AMOUNT);
		assert.equal(clampBgIntensity(undefined), undefined);
	});

	it("rejects anything that is not a finite number", () => {
		for (const junk of [
			"0.2",
			null,
			NaN,
			Infinity,
			-Infinity,
			{},
			[],
			true,
		]) {
			assert.equal(clampBgIntensity(junk), undefined, JSON.stringify(junk));
		}
	});
});

/* ------------------------------------------------------------------ *
 * 12. relativeLuminance / contrastRatio / ensureContrast
 * ------------------------------------------------------------------ */

describe("relativeLuminance", () => {
	it("pins the endpoints", () => {
		assert.equal(relativeLuminance("#ffffff"), 1);
		assert.equal(relativeLuminance("#000000"), 0);
	});

	it("matches the WCAG channel coefficients", () => {
		assert.ok(Math.abs(relativeLuminance("#ff0000") - 0.2126) < 1e-9);
		assert.ok(Math.abs(relativeLuminance("#00ff00") - 0.7152) < 1e-9);
		assert.ok(Math.abs(relativeLuminance("#0000ff") - 0.0722) < 1e-9);
	});

	it("uses the linear segment below the 0.03928 knee", () => {
		// #050505 is 5/255 ≈ 0.0196, under the knee, so it is divided by 12.92
		// rather than raised to 2.4.
		assert.ok(Math.abs(relativeLuminance("#050505") - 5 / 255 / 12.92) < 1e-12);
	});
});

describe("contrastRatio", () => {
	it("is 21 for black on white and 1 for a colour on itself", () => {
		assert.equal(contrastRatio("#ffffff", "#000000"), 21);
		assert.equal(contrastRatio("#000000", "#ffffff"), 21);
		assert.equal(contrastRatio("#448aff", "#448aff"), 1);
	});

	it("is symmetric", () => {
		assert.equal(
			contrastRatio("#448aff", "#ffffff"),
			contrastRatio("#ffffff", "#448aff"),
		);
	});

	it("matches published values", () => {
		// #767676 is the canonical "smallest grey that clears 4.5:1 on white".
		assert.ok(Math.abs(contrastRatio("#767676", "#ffffff") - 4.54) < 0.01);
		assert.ok(Math.abs(contrastRatio("#0000ff", "#ffffff") - 8.59) < 0.01);
	});
});

describe("ensureContrast", () => {
	it("leaves a colour that already clears the bar untouched", () => {
		assert.equal(ensureContrast("#000000", "#ffffff", "#000000", 3), "#000000");
		assert.equal(ensureContrast("#0000ff", "#ffffff", "#000000", 3), "#0000ff");
	});

	it("darkens a pale accent until it reads on a pale background", () => {
		const fixed = ensureContrast("#ffff00", "#ffffff", "#000000", 3);
		assert.notEqual(fixed, "#ffff00");
		assert.ok(contrastRatio(fixed, "#ffffff") >= 3);
	});

	it("lightens a dark accent until it reads on a dark background", () => {
		const fixed = ensureContrast("#000080", "#1c1c1c", "#ffffff", 3);
		assert.ok(contrastRatio(fixed, "#1c1c1c") >= 3);
	});

	it("always terminates, capping at the endpoint", () => {
		// Nothing but pure black clears 21:1 on white.
		assert.equal(ensureContrast("#ffffff", "#ffffff", "#000000", 21), "#000000");
	});

	it("blends from the ORIGINAL colour each step, not compounding", () => {
		// A compounding blend converges far faster and lands somewhere else;
		// this pins the non-compounding behaviour by construction.
		const fixed = ensureContrast("#ffff00", "#ffffff", "#000000", 3);
		let expected: string | null = null;
		for (let step = 1; step <= 20; step++) {
			const candidate = blendHex("#ffff00", "#000000", step * 0.05);
			if (contrastRatio(candidate, "#ffffff") >= 3) {
				expected = candidate;
				break;
			}
		}
		assert.equal(fixed, expected);
	});

	it("clears the requested ratio for every sample against both pages", () => {
		for (const hex of SAMPLE_HEXES) {
			const onLight = ensureContrast(hex, BG_PRIMARY_LIGHT, "#000000", 3);
			assert.ok(
				contrastRatio(onLight, BG_PRIMARY_LIGHT) >= 3 - 1e-9,
				`${hex} on light → ${onLight}`,
			);
			const onDark = ensureContrast(hex, BG_PRIMARY_DARK, "#ffffff", 3);
			assert.ok(
				contrastRatio(onDark, BG_PRIMARY_DARK) >= 3 - 1e-9,
				`${hex} on dark → ${onDark}`,
			);
		}
	});
});

/* ------------------------------------------------------------------ *
 * 13. hexToHsl / rotateHue / normalizeAngleDeg
 * ------------------------------------------------------------------ */

describe("hexToHsl", () => {
	it("reads the primaries", () => {
		assert.deepStrictEqual(hexToHsl("#ff0000"), { h: 0, s: 100, l: 50 });
		assert.deepStrictEqual(hexToHsl("#00ff00"), { h: 120, s: 100, l: 50 });
		assert.deepStrictEqual(hexToHsl("#0000ff"), { h: 240, s: 100, l: 50 });
	});

	it("reports zero saturation for greys, whatever the hue would be", () => {
		assert.deepStrictEqual(hexToHsl("#000000"), { h: 0, s: 0, l: 0 });
		assert.deepStrictEqual(hexToHsl("#ffffff"), { h: 0, s: 0, l: 100 });
		assert.equal(hexToHsl("#808080").s, 0);
	});

	it("normalizes a negative hue into [0, 360)", () => {
		// Magenta's raw computation is 60 * -1 = -60.
		assert.equal(hexToHsl("#ff00ff").h, 300);
	});

	it("always returns a hue in range for every sample", () => {
		for (const hex of SAMPLE_HEXES) {
			const { h, s, l } = hexToHsl(hex);
			assert.ok(h >= 0 && h < 360, `${hex} h=${h}`);
			assert.ok(s >= 0 && s <= 100, `${hex} s=${s}`);
			assert.ok(l >= 0 && l <= 100, `${hex} l=${l}`);
		}
	});
});

describe("rotateHue", () => {
	it("walks the colour wheel", () => {
		assert.equal(rotateHue("#ff0000", 120), "#00ff00");
		assert.equal(rotateHue("#ff0000", 240), "#0000ff");
		assert.equal(rotateHue("#ff0000", -120), "#0000ff");
	});

	it("is a no-op at a full turn", () => {
		assert.equal(rotateHue("#448aff", 360), rotateHue("#448aff", 0));
		assert.equal(rotateHue("#448aff", 720), rotateHue("#448aff", 0));
	});

	it("leaves a grey grey — there is no hue to rotate", () => {
		assert.equal(rotateHue("#808080", 90), rotateHue("#808080", 0));
	});

	it("keeps saturation and lightness", () => {
		const before = hexToHsl("#e0af68");
		const after = hexToHsl(rotateHue("#e0af68", 45));
		assert.ok(Math.abs(before.s - after.s) < 1, `${before.s} vs ${after.s}`);
		assert.ok(Math.abs(before.l - after.l) < 1, `${before.l} vs ${after.l}`);
	});
});

describe("normalizeAngleDeg", () => {
	it("folds any finite angle into [0, 360)", () => {
		assert.equal(normalizeAngleDeg(0), 0);
		assert.equal(normalizeAngleDeg(359), 359);
		assert.equal(normalizeAngleDeg(360), 0);
		assert.equal(normalizeAngleDeg(361), 1);
		assert.equal(normalizeAngleDeg(720), 0);
		assert.equal(normalizeAngleDeg(725), 5);
	});

	it("folds negatives forward rather than leaving them negative", () => {
		assert.equal(normalizeAngleDeg(-1), 359);
		assert.equal(normalizeAngleDeg(-360), 0);
		assert.equal(normalizeAngleDeg(-720), 0);
		assert.equal(normalizeAngleDeg(-725), 355);
	});

	it("is idempotent", () => {
		for (const deg of [-725, -1, 0, 90, 360, 725]) {
			const once = normalizeAngleDeg(deg);
			assert.equal(normalizeAngleDeg(once), once, String(deg));
		}
	});
});

/* ------------------------------------------------------------------ *
 * 14. mirrorLightness / inferOppositeModeColor
 * ------------------------------------------------------------------ */

describe("mirrorLightness", () => {
	it("swaps the ends of the lightness axis", () => {
		assert.equal(mirrorLightness("#ffffff"), "#000000");
		assert.equal(mirrorLightness("#000000"), "#ffffff");
	});

	it("keeps hue and saturation", () => {
		const before = hexToHsl("#448aff");
		const after = hexToHsl(mirrorLightness("#448aff"));
		assert.ok(Math.abs(before.h - after.h) < 1, `${before.h} vs ${after.h}`);
		assert.ok(Math.abs(before.s - after.s) < 1, `${before.s} vs ${after.s}`);
	});

	it("turns a pale tint into a deep shade and back", () => {
		const pale = "#ddeaff";
		const deep = mirrorLightness(pale);
		assert.ok(relativeLuminance(deep) < relativeLuminance(pale));
		const back = mirrorLightness(deep);
		// Lossy by a level — HSL round-trips through two roundings.
		const a = hexToRgb(back);
		const b = hexToRgb(pale);
		for (const ch of ["r", "g", "b"] as const) {
			assert.ok(Math.abs(a[ch] - b[ch]) <= 2, `${ch}: ${a[ch]} vs ${b[ch]}`);
		}
	});
});

describe("inferOppositeModeColor", () => {
	it("is a plain mirror when nothing has to be contrasted against", () => {
		assert.equal(
			inferOppositeModeColor("#448aff", true, null, null),
			mirrorLightness("#448aff"),
		);
		// A null minRatio wins even when a background was supplied.
		assert.equal(
			inferOppositeModeColor("#448aff", true, "#ffffff", null),
			mirrorLightness("#448aff"),
		);
	});

	it("pulls toward black when the result is for LIGHT mode", () => {
		// editingDark: true → the user set the DARK colour, so the inferred one
		// is for light mode and must darken to read on a pale page.
		const inferred = inferOppositeModeColor("#ffff00", true, "#ffffff", 3);
		assert.ok(contrastRatio(inferred, "#ffffff") >= 3);
		assert.ok(relativeLuminance(inferred) < relativeLuminance("#ffff00"));
	});

	it("pulls toward white when the result is for DARK mode", () => {
		const inferred = inferOppositeModeColor("#333366", false, "#1c1c1c", 3);
		assert.ok(contrastRatio(inferred, "#1c1c1c") >= 3);
	});

	it("clears the ratio for every sample, in both directions", () => {
		for (const hex of SAMPLE_HEXES) {
			const toLight = inferOppositeModeColor(hex, true, BG_PRIMARY_LIGHT, 3);
			assert.ok(
				contrastRatio(toLight, BG_PRIMARY_LIGHT) >= 3 - 1e-9,
				`${hex} → light ${toLight}`,
			);
			const toDark = inferOppositeModeColor(hex, false, BG_PRIMARY_DARK, 3);
			assert.ok(
				contrastRatio(toDark, BG_PRIMARY_DARK) >= 3 - 1e-9,
				`${hex} → dark ${toDark}`,
			);
		}
	});
});

/* ------------------------------------------------------------------ *
 * 15. bgGradientCss / sanitizeBgGradient / bgGradientsEqual
 * ------------------------------------------------------------------ */

function gradient(over: Partial<BgGradient> = {}): BgGradient {
	return {
		angleDeg: 90,
		toColorLight: "#ffeeaa",
		toColorDark: "#332200",
		...over,
	};
}

describe("bgGradientCss", () => {
	it("emits a linear-gradient from the mode's solid colour", () => {
		assert.equal(
			bgGradientCss("#ffffff", "#ffeeaa", gradient({ angleDeg: 90 })),
			"linear-gradient(90deg, #ffffff, #ffeeaa)",
		);
	});

	it("normalizes the angle on the way out", () => {
		assert.equal(
			bgGradientCss("#a1a1a1", "#b2b2b2", gradient({ angleDeg: 450 })),
			"linear-gradient(90deg, #a1a1a1, #b2b2b2)",
		);
		assert.equal(
			bgGradientCss("#a1a1a1", "#b2b2b2", gradient({ angleDeg: -90 })),
			"linear-gradient(270deg, #a1a1a1, #b2b2b2)",
		);
	});
});

describe("sanitizeBgGradient", () => {
	it("returns null for anything that is not an object", () => {
		for (const junk of [null, undefined, 42, "linear-gradient(…)", [], true]) {
			assert.equal(sanitizeBgGradient(junk), null, JSON.stringify(junk));
		}
	});

	it("requires a finite angle", () => {
		assert.equal(sanitizeBgGradient({ ...gradient(), angleDeg: "90" }), null);
		assert.equal(sanitizeBgGradient({ ...gradient(), angleDeg: NaN }), null);
		assert.equal(sanitizeBgGradient({ ...gradient(), angleDeg: Infinity }), null);
		const { angleDeg: _drop, ...noAngle } = gradient();
		assert.equal(sanitizeBgGradient(noAngle), null);
	});

	it("requires BOTH end colours as six-digit hex", () => {
		assert.equal(sanitizeBgGradient(gradient({ toColorLight: "#fea" })), null);
		assert.equal(sanitizeBgGradient(gradient({ toColorDark: "red" })), null);
		const { toColorDark: _drop, ...noDark } = gradient();
		assert.equal(sanitizeBgGradient(noDark), null);
	});

	it("returns a clean copy with the angle normalized", () => {
		assert.deepStrictEqual(sanitizeBgGradient(gradient({ angleDeg: 450 })), {
			angleDeg: 90,
			toColorLight: "#ffeeaa",
			toColorDark: "#332200",
		});
	});

	it("drops a legacy `type: radial` rather than honouring it", () => {
		// Gradients are always linear now; the stored angle still applies.
		const clean = sanitizeBgGradient({ ...gradient(), type: "radial" });
		assert.deepStrictEqual(clean, {
			angleDeg: 90,
			toColorLight: "#ffeeaa",
			toColorDark: "#332200",
		});
		assert.ok(!("type" in (clean as object)));
	});

	it("keeps a valid text sweep, with or without the toggle on", () => {
		const withToggle = sanitizeBgGradient(
			gradient({
				textToColorLight: "#aa0000",
				textToColorDark: "#ffaaaa",
				textGradient: true,
			}),
		);
		assert.equal(withToggle?.textToColorLight, "#aa0000");
		assert.equal(withToggle?.textGradient, true);

		// The colours survive the toggle being off: they are the user's own
		// second colour, and re-deriving them from the pale tints is impossible.
		const toggleOff = sanitizeBgGradient(
			gradient({ textToColorLight: "#aa0000", textToColorDark: "#ffaaaa" }),
		);
		assert.equal(toggleOff?.textToColorLight, "#aa0000");
		assert.equal(toggleOff?.textGradient, undefined);
	});

	it("degrades rather than rejects when only the text sweep is broken", () => {
		// The explicit-undefined cascade: a bad sweep costs the sweep alone.
		const clean = sanitizeBgGradient(
			gradient({
				textToColorLight: "#aa0000",
				textToColorDark: "not a colour",
				textGradient: true,
			}),
		);
		assert.ok(clean, "the background gradient should have survived");
		assert.equal(clean.toColorLight, "#ffeeaa");
		assert.equal(clean.textToColorLight, undefined);
		assert.equal(clean.textToColorDark, undefined);
		assert.equal(clean.textGradient, undefined);
	});

	it("never sets textGradient without both text colours behind it", () => {
		const clean = sanitizeBgGradient(gradient({ textGradient: true }));
		assert.equal(clean?.textGradient, undefined);
	});

	it("treats a non-true textGradient as off", () => {
		const clean = sanitizeBgGradient(
			gradient({
				textToColorLight: "#aa0000",
				textToColorDark: "#ffaaaa",
				textGradient: "yes" as unknown as boolean,
			}),
		);
		assert.equal(clean?.textGradient, undefined);
	});

	it("is idempotent", () => {
		const once = sanitizeBgGradient(
			gradient({
				angleDeg: 450,
				textToColorLight: "#aa0000",
				textToColorDark: "#ffaaaa",
				textGradient: true,
			}),
		);
		assert.deepStrictEqual(sanitizeBgGradient(once), once);
	});
});

describe("bgGradientsEqual", () => {
	it("calls two absent gradients equal", () => {
		assert.equal(bgGradientsEqual(undefined, undefined), true);
	});

	it("calls one absent gradient unequal to a present one", () => {
		assert.equal(bgGradientsEqual(gradient(), undefined), false);
		assert.equal(bgGradientsEqual(undefined, gradient()), false);
	});

	it("ignores hex case", () => {
		assert.equal(
			bgGradientsEqual(
				gradient({ toColorLight: "#FFEEAA" }),
				gradient({ toColorLight: "#ffeeaa" }),
			),
			true,
		);
	});

	it("compares the angle after normalization", () => {
		assert.equal(
			bgGradientsEqual(gradient({ angleDeg: 90 }), gradient({ angleDeg: 450 })),
			true,
		);
		assert.equal(
			bgGradientsEqual(gradient({ angleDeg: 90 }), gradient({ angleDeg: 91 })),
			false,
		);
	});

	it("treats an absent textGradient as false", () => {
		assert.equal(
			bgGradientsEqual(gradient(), gradient({ textGradient: false })),
			true,
		);
		assert.equal(
			bgGradientsEqual(gradient(), gradient({ textGradient: true })),
			false,
		);
	});

	it("treats an absent text colour as the empty string", () => {
		assert.equal(
			bgGradientsEqual(gradient(), gradient({ textToColorLight: undefined })),
			true,
		);
		assert.equal(
			bgGradientsEqual(gradient(), gradient({ textToColorLight: "#aa0000" })),
			false,
		);
	});

	it("notices a changed end colour in either mode", () => {
		assert.equal(
			bgGradientsEqual(gradient(), gradient({ toColorDark: "#000000" })),
			false,
		);
	});
});

/* ------------------------------------------------------------------ *
 * 16. calloutColorValue / calloutAccentVarRef / hexToRgbString
 * ------------------------------------------------------------------ */

describe("hexToRgbString", () => {
	it("emits the bare triplet Obsidian ≤1.12 wraps in rgb()", () => {
		assert.equal(hexToRgbString("#ff8800"), "255, 136, 0");
		assert.equal(hexToRgbString("#000000"), "0, 0, 0");
	});
});

describe("calloutColorValue / calloutAccentVarRef", () => {
	/** `declared` takes either one spelling for both modes, or a per-mode pair. */
	const dialect = (
		read: "triplet" | "color",
		declared: Record<
			string,
			"triplet" | "color" | { light?: "triplet" | "color"; dark?: "triplet" | "color" }
		> = {},
	): AccentDialect => ({
		read,
		declared: new Map(
			Object.entries(declared).map(([k, v]) => [
				k,
				typeof v === "string"
					? { light: v, dark: v }
					: { light: v.light, dark: v.dark },
			]),
		),
		unguarded: new Set(),
	});

	it("writes the spelling the read sites asked for", () => {
		assert.equal(calloutColorValue("#ff8800", dialect("triplet")), "255, 136, 0");
		assert.equal(calloutColorValue("#ff8800", dialect("color")), "#ff8800");
	});

	it("reads a theme variable in the spelling that theme declared it", () => {
		// Per variable, not per theme: Composer declares --callout-error as a
		// triplet while reading --callout-color as a colour, so one answer for
		// the whole sheet is wrong for half of it.
		const d = dialect("color", { "--callout-error": "triplet" });
		assert.equal(calloutAccentVarRef("--callout-error", d, "light"), "rgb(var(--callout-error))");
		assert.equal(calloutAccentVarRef("--callout-info", d, "light"), "var(--callout-info)");
	});

	it("reads it per MODE, because a theme can declare only one", () => {
		// Nier declares all thirteen under `.theme-dark` alone, as triplets, and
		// leaves light mode on core's colours. One answer for both modes wraps
		// the wrong one in `rgb()`, which fails `--cs-accent-theme`'s `<color>`
		// registration and greys every heading bar and pill in that mode.
		const d = dialect("triplet", { "--callout-warning": { dark: "triplet" } });
		assert.equal(calloutAccentVarRef("--callout-warning", d, "dark"), "rgb(var(--callout-warning))");
		assert.equal(
			calloutAccentVarRef("--callout-warning", d, "light"),
			"var(--callout-warning)",
			"undeclared in light — core supplies it there, in core's spelling",
		);
	});

	it("emits a value the CSS side can actually parse", () => {
		for (const read of ["triplet", "color"] as const) {
			const value = calloutColorValue("#ff8800", dialect(read));
			assert.ok(isValidHexColor(value) || /^\d+, \d+, \d+$/.test(value), value);
		}
	});
});

/* ------------------------------------------------------------------ *
 * 17. isValidHexColor
 * ------------------------------------------------------------------ */

describe("isValidHexColor", () => {
	it("accepts a six-digit hex in either case", () => {
		assert.equal(isValidHexColor("#ff0000"), true);
		assert.equal(isValidHexColor("#FF0000"), true);
		assert.equal(isValidHexColor("#AbCdEf"), true);
	});

	it("rejects the three-digit form — storage is always normalized", () => {
		assert.equal(isValidHexColor("#f00"), false);
	});

	it("rejects an eight-digit hex, alpha and all", () => {
		assert.equal(isValidHexColor("#ff0000ff"), false);
	});

	it("requires the leading #", () => {
		assert.equal(isValidHexColor("ff0000"), false);
	});

	it("rejects a wrong length either side of six", () => {
		assert.equal(isValidHexColor("#ff000"), false);
		assert.equal(isValidHexColor("#ff00000"), false);
		assert.equal(isValidHexColor("#"), false);
	});

	it("rejects non-hex characters", () => {
		assert.equal(isValidHexColor("#gg0000"), false);
		assert.equal(isValidHexColor("#ff 000"), false);
		assert.equal(isValidHexColor(" #ff0000"), false);
		assert.equal(isValidHexColor("#ff0000 "), false);
	});

	it("rejects every non-string", () => {
		for (const junk of [null, undefined, 0xff0000, {}, [], true, NaN]) {
			assert.equal(isValidHexColor(junk), false, JSON.stringify(junk));
		}
	});
});
