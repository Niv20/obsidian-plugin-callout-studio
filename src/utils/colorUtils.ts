/**
 * utils/colorUtils.ts — Color manipulation helpers.
 *
 * Stateless utility functions for converting between hex, RGB, and HSL color
 * formats, blending two hex colors together, and producing CSS rgb() strings.
 * Used by CSSInjector (for dynamic CSS generation), colorPalettes (for
 * auto-computed backgrounds), and CalloutEditor (for color field handling).
 */
import { requireApiVersion } from "obsidian";
import type { BgGradient } from "../types";

export interface RGB {
	r: number;
	g: number;
	b: number;
}

export function hexToRgb(hex: string): RGB {
	const cleaned = hex.replace(/^#/, "");
	const num = parseInt(cleaned, 16);
	return {
		r: (num >> 16) & 255,
		g: (num >> 8) & 255,
		b: num & 255,
	};
}

export function rgbToHex(r: number, g: number, b: number): string {
	return (
		"#" +
		[r, g, b]
			.map((c) =>
				Math.max(0, Math.min(255, Math.round(c)))
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")
	);
}

export function hslToRgb(h: number, s: number, l: number): RGB {
	const sNorm = s / 100;
	const lNorm = l / 100;
	const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = lNorm - c / 2;

	let rP: number, gP: number, bP: number;
	if (h < 60) {
		[rP, gP, bP] = [c, x, 0];
	} else if (h < 120) {
		[rP, gP, bP] = [x, c, 0];
	} else if (h < 180) {
		[rP, gP, bP] = [0, c, x];
	} else if (h < 240) {
		[rP, gP, bP] = [0, x, c];
	} else if (h < 300) {
		[rP, gP, bP] = [x, 0, c];
	} else {
		[rP, gP, bP] = [c, 0, x];
	}

	return {
		r: Math.round((rP + m) * 255),
		g: Math.round((gP + m) * 255),
		b: Math.round((bP + m) * 255),
	};
}

export function hexToRgbString(hex: string): string {
	const { r, g, b } = hexToRgb(hex);
	return `${r}, ${g}, ${b}`;
}

/**
 * Cached result of the Obsidian version check used by `calloutColorValue`.
 * `null` until first computed; avoids calling `requireApiVersion` for every
 * callout on every CSS inject.
 */
let calloutColorIsRaw: boolean | null = null;

/**
 * Returns the value to assign to Obsidian's `--callout-color` variable for the
 * current Obsidian version.
 *
 * Obsidian 1.13 changed `--callout-color` from a raw RGB triplet
 * (`255, 0, 0`, wrapped by Obsidian in `rgb(...)`) to a full CSS color
 * (`#ff0000`, used directly). We emit the right format for the running version
 * so a single release works on both ≤1.12 and 1.13+.
 */
export function calloutColorValue(hex: string): string {
	if (calloutColorIsRaw === null) {
		calloutColorIsRaw = !requireApiVersion("1.13.0");
	}
	return calloutColorIsRaw ? hexToRgbString(hex) : hex;
}

/**
 * Read one of Obsidian's own `--callout-*` variables as a real CSS color.
 *
 * Same ≤1.12 / 1.13+ split as {@link calloutColorValue}, from the other side:
 * on 1.13+ `--callout-info` already holds a color and can be used as-is, while
 * on ≤1.12 it holds a bare `8, 109, 221` triplet that only means anything
 * inside `rgb()`. This is what lets an untouched built-in leave
 * `--callout-color` alone — so core's own rule, and any theme that overrides
 * it, decides the accent — while `--cs-accent` still resolves to something the
 * plugin's `color-mix()` calls can consume.
 */
export function calloutAccentVarRef(cssVar: string): string {
	if (calloutColorIsRaw === null) {
		calloutColorIsRaw = !requireApiVersion("1.13.0");
	}
	return calloutColorIsRaw ? `rgb(var(${cssVar}))` : `var(${cssVar})`;
}

function rgbTripletToHex(r: string, g: string, b: string): string {
	return rgbToHex(parseInt(r, 10), parseInt(g, 10), parseInt(b, 10));
}

/**
 * Parses a CSS color value as it may appear in a `--callout-color` declaration
 * into a `#rrggbb` hex string. Handles the formats that occur in callout CSS
 * snippets across Obsidian versions:
 *   - hex: `#rgb`, `#rrggbb`
 *   - functional: `rgb(255, 0, 0)`, `rgba(255 0 0 / 0.5)`
 *   - bare RGB triplet (pre-1.13): `255, 0, 0`
 *
 * Returns `null` for anything else (named colors, `oklch()`, etc.), which the
 * caller should skip rather than import with a broken color.
 */
export function parseCssColorToHex(value: string): string | null {
	const v = value.trim();

	// #rgb or #rrggbb
	const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
	if (hexMatch && hexMatch[1]) {
		let h = hexMatch[1].toLowerCase();
		if (h.length === 3) {
			h = h
				.split("")
				.map((c) => c + c)
				.join("");
		}
		return "#" + h;
	}

	// rgb()/rgba() with comma- or space-separated channels (alpha ignored)
	const fnMatch =
		/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(v);
	if (fnMatch && fnMatch[1] && fnMatch[2] && fnMatch[3]) {
		return rgbTripletToHex(fnMatch[1], fnMatch[2], fnMatch[3]);
	}

	// Bare RGB triplet (pre-1.13 format): 255, 0, 0
	const tripletMatch = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/.exec(v);
	if (tripletMatch && tripletMatch[1] && tripletMatch[2] && tripletMatch[3]) {
		return rgbTripletToHex(tripletMatch[1], tripletMatch[2], tripletMatch[3]);
	}

	return null;
}

/**
 * Linearly blend two hex colours.
 * amount = 0 → hex1, amount = 1 → hex2.
 */
export function blendHex(hex1: string, hex2: string, amount: number): string {
	const c1 = hexToRgb(hex1);
	const c2 = hexToRgb(hex2);
	return rgbToHex(
		c1.r + (c2.r - c1.r) * amount,
		c1.g + (c2.g - c1.g) * amount,
		c1.b + (c2.b - c1.b) * amount,
	);
}

/** Default callout content text colors (shared by the editor and palette derivation). */
export const DEFAULT_TEXT_COLOR_LIGHT = "#1a1a1a";
export const DEFAULT_TEXT_COLOR_DARK = "#e0e0e0";

/**
 * Obsidian's own `--background-primary` per theme — the surface a callout is
 * normally painted on.
 *
 * These are the two values a derived tint is blended toward, and the backdrop
 * {@link translucentTintFor} solves against. Taken from the shipped `app.css`
 * (`--color-base-00`), not guessed: the dark one used to be written `#1e1e1e`
 * here, two levels lighter than the `#1c1c1c` Obsidian actually paints, which
 * put every derived dark tint a uniform +1.64/255 off the colour the user saw
 * behind it.
 *
 * A theme is free to redefine `--background-primary`, which is exactly why
 * backgrounds are emitted as a translucent tint rather than a baked hex — the
 * tint composites against whatever the theme actually paints, while these
 * constants only ever seed the editor's swatches.
 */
export const BG_PRIMARY_LIGHT = "#ffffff";
export const BG_PRIMARY_DARK = "#1c1c1c";

/**
 * How much of the accent color a derived background tint keeps (0..1); the rest
 * is the mode's base (white in light, near-black in dark). Higher = a bolder,
 * less transparent-looking background. The single source of truth for the tint
 * strength across the plugin (presets, per-callout defaults, palette editor).
 */
export const DEFAULT_BG_COLOR_AMOUNT = 0.18;
/** Bounds for the palette editor's background-intensity slider. */
export const MIN_BG_COLOR_AMOUNT = 0.1;
export const MAX_BG_COLOR_AMOUNT = 0.3;
/**
 * Default intensity-slider position for a brand-new palette in the Palette
 * Editor, split by background style: a two-stop gradient reads fainter than
 * a solid fill at the same blend amount, so it defaults higher. Only seeds a
 * fresh palette — an existing one always keeps its own saved intensity, and
 * the user can drag the slider to override either default.
 */
export const DEFAULT_BG_INTENSITY_SOLID = 0.1;
export const DEFAULT_BG_INTENSITY_GRADIENT = 0.2;

/**
 * The pale background tint for an accent color, resolved for one theme mode.
 * `amount` is the share of accent kept (see {@link DEFAULT_BG_COLOR_AMOUNT}).
 */
export function bgTintFor(
	accent: string,
	isDark: boolean,
	amount = DEFAULT_BG_COLOR_AMOUNT,
): string {
	return blendHex(
		accent,
		isDark ? BG_PRIMARY_DARK : BG_PRIMARY_LIGHT,
		1 - amount,
	);
}

/**
 * Floor and ceiling for a solved tint's alpha.
 *
 * The floor keeps a tint that is barely distinguishable from the page from
 * being expressed as a near-transparent wash of a wildly saturated colour — at
 * alpha 0.02 the solved source is 50× the distance from the backdrop, so a hex
 * rounding error is magnified 50× with it. The ceiling is where a "tint" stops
 * being one: past 60% the nesting step is already small, and the solved colour
 * is within a few levels of the authored one anyway.
 */
const MIN_TINT_ALPHA = 0.1;
const MAX_TINT_ALPHA = 0.6;

/**
 * A translucent tint that renders as `opaque` on the theme's own background.
 *
 * Obsidian gives nested callouts their stepped look purely by compositing: core
 * paints `color-mix(in oklch, var(--callout-color) 10%, transparent)`, so each
 * level lays another translucent layer over the one beneath it and the group
 * alpha climbs as `1 - 0.9ⁿ`, unbounded in depth. An OPAQUE background hides
 * whatever is behind it, so every level collapses onto one shade — under
 * `mix-blend-mode: darken` a colour over itself is `min(x, x) = x`, a step of
 * exactly zero. CSS cannot count nesting depth (a self-incrementing custom
 * property is a dependency cycle, `:has()` is a predicate not a counter, and
 * `counter()` only reaches `content:`), so re-expressing the colour as a tint is
 * not one way to restore the step — it is the only one.
 *
 * Solves `alpha * color + (1 - alpha) * backdrop === opaque` per channel. The
 * identity is exact in both themes despite core's blend mode: over white
 * `darken` gives `min(255, S) = S`, and over `#1c1c1c` `lighten` gives
 * `max(B, S) = S` for any tint at least as light as the page — which a callout
 * background always is, since `lighten` forbids painting darker than the page.
 *
 * `alpha` is the smallest that keeps every channel of `color` inside
 * `[0, 255]`, plus 2% headroom for rounding: the further the authored colour
 * sits from the page, the more opaque its source must be, and therefore the
 * weaker (but never absent) the nesting step. Returns `null` above
 * {@link MAX_TINT_ALPHA}, where the colour is so far from the backdrop that a
 * tint would be near-opaque anyway — the caller paints it solid and accepts no
 * step for that one callout.
 */
export function translucentTintFor(
	opaque: string,
	isDark: boolean,
): { color: string; alpha: number } | null {
	const alpha = resolveTintAlpha(minTintAlpha(opaque, isDark));
	if (alpha === null) return null;
	return { color: tintColorAt(opaque, isDark, alpha), alpha };
}

/** The theme mode's backdrop, as the tint solve sees it. */
export function tintBackdrop(isDark: boolean): RGB {
	return hexToRgb(isDark ? BG_PRIMARY_DARK : BG_PRIMARY_LIGHT);
}

/**
 * The smallest alpha at which `opaque` can still be expressed as a tint, i.e.
 * the one that puts a channel of the solved colour exactly at 0 or 255.
 *
 * Read it as the channel-wise distance from the backdrop normalised by the
 * headroom in that direction: a colour close to the page can be a faint wash,
 * one far from it cannot.
 */
export function minTintAlpha(opaque: string, isDark: boolean): number {
	const backdrop = tintBackdrop(isDark);
	const target = hexToRgb(opaque);
	let min = 0;
	for (const [c, b] of [
		[target.r, backdrop.r],
		[target.g, backdrop.g],
		[target.b, backdrop.b],
	] as Array<[number, number]>) {
		// Below the backdrop the binding constraint is `color >= 0`; above it,
		// `color <= 255`; equal needs no alpha at all. The guards keep a theme
		// whose background is pure black or pure white from dividing by zero.
		const needed =
			c < b ? (b === 0 ? 1 : (b - c) / b)
			: c > b ? (b === 255 ? 1 : (c - b) / (255 - b))
			: 0;
		if (needed > min) min = needed;
	}
	return min;
}

/**
 * Pick one alpha that satisfies every colour that has to share it.
 *
 * A gradient's two stops must be painted at the SAME alpha — they are one
 * `linear-gradient`, and an alpha ramp across it would tilt the sweep — so the
 * caller passes both minima and gets the alpha that clears both. Returns `null`
 * when even {@link MAX_TINT_ALPHA} is not enough, which is the caller's cue to
 * fall back to an opaque paint (and lose the nesting step for that callout).
 *
 * The 2% headroom absorbs the rounding of the solved colour to a hex; without
 * it a channel solved to exactly 255 could round to 256 and clamp, shifting the
 * rendered colour.
 */
export function resolveTintAlpha(...minima: number[]): number | null {
	const needed = Math.max(0, ...minima);
	if (needed > MAX_TINT_ALPHA) return null;
	return Math.min(
		MAX_TINT_ALPHA,
		Math.max(MIN_TINT_ALPHA, Math.ceil(needed * 1.02 * 100) / 100),
	);
}

/**
 * The tint colour that renders as `opaque` when painted at `alpha` over the
 * mode's backdrop. Only meaningful for an alpha at or above
 * {@link minTintAlpha}; below it the solve leaves the sRGB cube and the
 * channels clamp.
 */
export function tintColorAt(
	opaque: string,
	isDark: boolean,
	alpha: number,
): string {
	const backdrop = tintBackdrop(isDark);
	const target = hexToRgb(opaque);
	const solve = (c: number, b: number): number => (c - (1 - alpha) * b) / alpha;
	return rgbToHex(
		solve(target.r, backdrop.r),
		solve(target.g, backdrop.g),
		solve(target.b, backdrop.b),
	);
}

/**
 * A `background-color` value that composites the way Obsidian's own does.
 *
 * `color-mix(in oklch, C p%, transparent)` is exactly `rgba(C, p)` for an
 * opaque in-gamut colour: `transparent` is `rgb(0 0 0 / 0)`, its hue is
 * *powerless* at zero chroma so it adopts C's, and premultiplied interpolation
 * zeroes its contribution — leaving the mix an algebraic no-op on the colour
 * channels. Written as `color-mix` rather than `rgba()` because it is the exact
 * construct core uses for the same job, so the two stay in step by
 * construction. Safe on every supported build: `minAppVersion` 1.6.6 is
 * Chromium 122 and `color-mix` shipped in 111.
 *
 * `color` may be a hex or a `var()` reference, but never a bare RGB triplet —
 * see {@link calloutAccentValue} for why `--callout-color` cannot be used here
 * directly.
 */
export function tintCss(color: string, alpha: number): string {
	// `toFixed` then strip trailing zeros: 0.18 → "18", 0.185 → "18.5".
	const pct = (alpha * 100).toFixed(2).replace(/\.?0+$/, "");
	return `color-mix(in oklch, ${color} ${pct}%, transparent)`;
}

/**
 * The dark base {@link bgTintFor} blended toward before it was corrected to
 * Obsidian's real `--background-primary`. Only {@link derivedBgAmount} may read
 * it: every dark tint already on disk was computed against this value, and a
 * migration that recognised only the new one would mistake all of them for
 * colours the user chose by hand.
 */
const LEGACY_BG_PRIMARY_DARK = "#1e1e1e";

/**
 * The tint strength `background` was derived at, or null if it wasn't derived.
 *
 * Answers "did the plugin compute this background from the accent, or did the
 * user pick it?" — the question the background migration turns on. A derived
 * background carries no information the accent doesn't already carry, so it can
 * be dropped and the callout left on Obsidian's own translucent fill; a chosen
 * one must be preserved.
 *
 * Deliberately solves for the strength rather than comparing against
 * `bgTintFor(accent, isDark)` at the default: tints are produced at any
 * intensity between {@link MIN_BG_COLOR_AMOUNT} and {@link MAX_BG_COLOR_AMOUNT}
 * (the palette editor's slider), so a fixed-amount comparison would recognise
 * only the ones that happened to use 18% and leave every other palette's rows
 * opaque. Solved on the channel furthest from the base, where the rounding
 * `rgbToHex` applied is the smallest share of the signal, then verified by
 * recomputing — so a false positive is impossible, and the round-to-2/3-decimal
 * probes recover the strength the stored hex was actually produced from.
 *
 * Note this is NOT the inverse of a *palette's* background: `derivePaletteFromColor`
 * tints the seed colour and then walks the accent away from it for contrast, so
 * a palette's `bgColorLight` is a tint of a colour the definition never stores.
 * Those correctly come back null and keep their background.
 */
export function derivedBgAmount(
	accent: string,
	background: string,
	isDark: boolean,
): number | null {
	for (const base of isDark
		? [BG_PRIMARY_DARK, LEGACY_BG_PRIMARY_DARK]
		: [BG_PRIMARY_LIGHT]) {
		const amount = solveTintAmount(accent, background, base);
		if (amount !== null) return amount;
	}
	return null;
}

function solveTintAmount(
	accent: string,
	background: string,
	base: string,
): number | null {
	const a = hexToRgb(accent);
	const s = hexToRgb(background);
	const b = hexToRgb(base);

	// An accent equal to the base has no axis to solve along: every amount
	// produces the same colour, so the only question is whether it matches.
	const spans: Array<[number, number, number]> = [
		[a.r, s.r, b.r],
		[a.g, s.g, b.g],
		[a.b, s.b, b.b],
	];
	spans.sort(
		([a1, , b1], [a2, , b2]) => Math.abs(a2 - b2) - Math.abs(a1 - b1),
	);
	const widest = spans[0];
	if (!widest) return null;
	const [accentCh, storedCh, baseCh] = widest;
	if (accentCh === baseCh) {
		return background.toLowerCase() === accent.toLowerCase() ? 1 : null;
	}

	const exact = (storedCh - baseCh) / (accentCh - baseCh);
	for (const amount of [
		exact,
		Math.round(exact * 100) / 100,
		Math.round(exact * 1000) / 1000,
	]) {
		if (amount <= 0 || amount > 1) continue;
		if (
			blendHex(accent, base, 1 - amount).toLowerCase() ===
			background.toLowerCase()
		) {
			return amount;
		}
	}
	return null;
}

/**
 * Clamps an untrusted background-intensity value (saved settings, imports) into
 * the valid range, or returns `undefined` when it isn't a usable number so the
 * caller falls back to {@link DEFAULT_BG_COLOR_AMOUNT}.
 */
export function clampBgIntensity(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return Math.min(MAX_BG_COLOR_AMOUNT, Math.max(MIN_BG_COLOR_AMOUNT, value));
}

/** True for a normalized `#rrggbb` hex color string. */
export function isValidHexColor(value: unknown): value is string {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/** WCAG 2.x relative luminance (0..1) of an `#rrggbb` color. */
export function relativeLuminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	const channel = (c: number): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(hex1: string, hex2: string): number {
	const l1 = relativeLuminance(hex1);
	const l2 = relativeLuminance(hex2);
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Returns `hex` adjusted so it reads against `bg`: blends the ORIGINAL color
 * toward `towards` in 5% steps (non-compounding) until the contrast ratio
 * reaches `minRatio`, capping at fully-`towards`. Always terminates: the
 * endpoint (#000000 on a pale background / #ffffff on a dark one) exceeds any
 * ratio this plugin asks for.
 */
export function ensureContrast(
	hex: string,
	bg: string,
	towards: string,
	minRatio = 3,
): string {
	if (contrastRatio(hex, bg) >= minRatio) return hex;
	for (let step = 1; step <= 20; step++) {
		const candidate = blendHex(hex, towards, step * 0.05);
		if (contrastRatio(candidate, bg) >= minRatio) return candidate;
	}
	return towards;
}

/** HSL (h 0..360, s/l 0..100) of an `#rrggbb` color. Inverse of hslToRgb. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
	const { r, g, b } = hexToRgb(hex);
	const rN = r / 255;
	const gN = g / 255;
	const bN = b / 255;
	const max = Math.max(rN, gN, bN);
	const min = Math.min(rN, gN, bN);
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	let s = 0;
	if (d !== 0) {
		s = d / (1 - Math.abs(2 * l - 1));
		if (max === rN) {
			h = 60 * (((gN - bN) / d) % 6);
		} else if (max === gN) {
			h = 60 * ((bN - rN) / d + 2);
		} else {
			h = 60 * ((rN - gN) / d + 4);
		}
	}
	return { h: normalizeAngleDeg(h), s: s * 100, l: l * 100 };
}

/**
 * Rotates a color's hue by `deg`, keeping saturation and lightness. Used to
 * suggest a pleasant default gradient end color from the palette's base color.
 */
export function rotateHue(hex: string, deg: number): string {
	const { h, s, l } = hexToHsl(hex);
	const { r, g, b } = hslToRgb(normalizeAngleDeg(h + deg), s, l);
	return rgbToHex(r, g, b);
}

/** Normalizes any finite angle into [0, 360). */
export function normalizeAngleDeg(deg: number): number {
	return ((deg % 360) + 360) % 360;
}

/**
 * Mirrors a color's lightness (l → 100−l), keeping hue and saturation. A
 * plausible starting guess for "the same color in the opposite theme mode":
 * a pale light-mode tint becomes a deep dark-mode shade and vice versa.
 */
export function mirrorLightness(hex: string): string {
	const { h, s, l } = hexToHsl(hex);
	const { r, g, b } = hslToRgb(h, s, 100 - l);
	return rgbToHex(r, g, b);
}

/**
 * Infers a color for the OPPOSITE theme mode from one the user just picked
 * for one mode (the palette editor's advanced per-color rows use this to
 * keep the hidden mode in sync automatically). Mirrors lightness for a
 * plausible guess, then — when `minRatio` is given — nudges it toward
 * black/white against `oppositeBg` until it clears that contrast ratio,
 * exactly like {@link derivePaletteFromColor}'s own contrast fix.
 *
 * @param editingDark Whether `hex` is the color the user just set for DARK
 *   mode (so the inferred result is for LIGHT mode, and vice versa).
 * @param oppositeBg The background the inferred color will render against
 *   in the opposite mode; pass `null` together with `minRatio: null` for a
 *   channel with nothing to contrast against (the background channel).
 */
export function inferOppositeModeColor(
	hex: string,
	editingDark: boolean,
	oppositeBg: string | null,
	minRatio: number | null,
): string {
	const mirrored = mirrorLightness(hex);
	if (minRatio === null || oppositeBg === null) return mirrored;
	const towards = editingDark ? "#000000" : "#ffffff";
	return ensureContrast(mirrored, oppositeBg, towards, minRatio);
}

/**
 * CSS background-image value for a two-stop gradient starting at `from`
 * (the solid bg color of the current mode) and ending at `to`.
 */
export function bgGradientCss(
	from: string,
	to: string,
	gradient: BgGradient,
): string {
	return `linear-gradient(${normalizeAngleDeg(gradient.angleDeg)}deg, ${from}, ${to})`;
}

/**
 * Validates an untrusted `bgGradient` value (saved settings, imports).
 * Returns a clean copy — angle normalized to [0, 360), both end colors
 * verified `#rrggbb` — or `null` when the value is unusable, in which case
 * callers should fall back to a solid background.
 *
 * Gradients are always linear. Data written while a `type` field still existed
 * carries an angle either way, so a legacy `"radial"` value is simply dropped
 * and the gradient renders along its stored direction.
 *
 * The text-sweep fields degrade rather than reject: an unusable text end color
 * pair drops `textGradient` alone, leaving a working background gradient,
 * since a missing text sweep is a far smaller loss than no gradient at all.
 */
export function sanitizeBgGradient(raw: unknown): BgGradient | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const g = raw as Partial<BgGradient>;
	if (typeof g.angleDeg !== "number" || !Number.isFinite(g.angleDeg)) {
		return null;
	}
	if (!isValidHexColor(g.toColorLight) || !isValidHexColor(g.toColorDark)) {
		return null;
	}
	const clean: BgGradient = {
		angleDeg: normalizeAngleDeg(g.angleDeg),
		toColorLight: g.toColorLight,
		toColorDark: g.toColorDark,
	};
	// The text end colors are kept even while the toggle is off: they are the
	// user's own second color at accent strength, and re-deriving them from
	// the pale `toColor*` tints is not possible (that blend is lossy).
	if (isValidHexColor(g.textToColorLight) && isValidHexColor(g.textToColorDark)) {
		clean.textToColorLight = g.textToColorLight;
		clean.textToColorDark = g.textToColorDark;
		if (g.textGradient === true) clean.textGradient = true;
	}
	return clean;
}

/** True when both are the same gradient (or both absent). */
export function bgGradientsEqual(
	a: BgGradient | undefined,
	b: BgGradient | undefined,
): boolean {
	if (!a || !b) return !a && !b;
	const sameHex = (x?: string, y?: string): boolean =>
		(x ?? "").toLowerCase() === (y ?? "").toLowerCase();
	return (
		normalizeAngleDeg(a.angleDeg) === normalizeAngleDeg(b.angleDeg) &&
		a.toColorLight.toLowerCase() === b.toColorLight.toLowerCase() &&
		a.toColorDark.toLowerCase() === b.toColorDark.toLowerCase() &&
		!!a.textGradient === !!b.textGradient &&
		sameHex(a.textToColorLight, b.textToColorLight) &&
		sameHex(a.textToColorDark, b.textToColorDark)
	);
}

/** The six callout colors derived from a single base color. */
export interface DerivedPalette {
	colorLight: string;
	colorDark: string;
	bgColorLight: string;
	bgColorDark: string;
	textColorLight: string;
	textColorDark: string;
}

/**
 * Derives a full palette from a base color per mode. Backgrounds are pale tints
 * of the ORIGINAL color (same blend as makePalette in colorPalettes.ts) so the
 * hue is preserved; the accents are then auto-corrected per mode — a too-light
 * pick is darkened for light mode, a too-dark pick is lightened for dark mode
 * — so titles and icons always stay readable (>= 3:1, the WCAG non-text bar).
 *
 * `amount` controls how strongly the background shows (see
 * {@link DEFAULT_BG_COLOR_AMOUNT}); the contrast auto-fix runs against the
 * resulting bg, so accents stay readable at any intensity.
 *
 * The two hexes exist for the Callout Manager vault import: that plugin stores
 * a genuinely separate light and dark color per callout, and collapsing them
 * would throw away a distinction the user set on purpose. Everything else in
 * this plugin derives both modes from one pick, which is
 * {@link derivePaletteFromColor} — the same function with both sides equal.
 * Note the maths is per-mode either way (`bgTintFor` takes `isDark`, and the
 * contrast fix pulls towards black in light mode and white in dark), so this
 * is a parameter split rather than a second derivation.
 */
export function derivePaletteFromColors(
	hexLight: string,
	hexDark: string,
	amount = DEFAULT_BG_COLOR_AMOUNT,
): DerivedPalette {
	const bgColorLight = bgTintFor(hexLight, false, amount);
	const bgColorDark = bgTintFor(hexDark, true, amount);
	return {
		colorLight: ensureContrast(hexLight, bgColorLight, "#000000", 3),
		colorDark: ensureContrast(hexDark, bgColorDark, "#ffffff", 3),
		bgColorLight,
		bgColorDark,
		textColorLight: DEFAULT_TEXT_COLOR_LIGHT,
		textColorDark: DEFAULT_TEXT_COLOR_DARK,
	};
}

/** Derives a full palette from one base color, for both modes. */
export function derivePaletteFromColor(
	hex: string,
	amount = DEFAULT_BG_COLOR_AMOUNT,
): DerivedPalette {
	return derivePaletteFromColors(hex, hex, amount);
}
