/**
 * utils/settingsGuards.ts — the values a settings blob is allowed to carry.
 *
 * `mergeSavedSettings` merges `globalStyle` field by field. That settles its
 * *shape* and says nothing about its *values*: whatever the file says lands in
 * the settings object, and `CSSInjector` interpolates it straight into a stylesheet
 * (`border-radius: ${gs.borderRadius}px`). Both inputs to that merge are
 * untrusted — an import file, and a `data.json` that syncs between devices and
 * can be hand-edited — so "whatever the file says" also covers a `titleScale`
 * of 0 (every callout title vanishes, with nothing on screen to explain why), a
 * radius of 1e6, and a *string*, which closes that declaration and opens rules
 * of its own.
 *
 * The sliders can neither reach any of that nor repair it: an out-of-range
 * value sits in the settings until the user happens to drag the one control it
 * belongs to. So it is repaired on the way in, once, at the single funnel the
 * loader and the importer already share.
 *
 * The limits are deliberately wider than the sliders — a guard, not a style
 * rule, the same posture as `MAX_NAME_LENGTH` in `userImages.ts`. The inline
 * corner slider reaches 25px, while previously saved values up to 64px remain
 * valid. These guards catch absurd and malformed values without reshaping a
 * person's existing style.
 */
import { DEFAULT_SETTINGS } from "../constants";
import type { GlobalStyleSettings } from "../types";

/**
 * The saved UI language preference, or the default when the file's value is not
 * even a string.
 *
 * `main.ts` hands this straight to `setLocale` and `LocaleStore.prepare` during
 * load, both of which lowercase it — so a `data.json` carrying `"language": 5`
 * is not one mislabelled button, it is a `TypeError` before the plugin has
 * registered anything, and a vault whose callouts have lost their styling
 * altogether. An unrecognized *string* needs no guard: `resolve()` already walks
 * the language chain down to English.
 */
export function localePreference(pref: unknown): string {
	return typeof pref === "string" ? pref : DEFAULT_SETTINGS.language;
}

interface Range {
	min: number;
	max: number;
}

/** Border thickness, px. The sliders offer 1–4; 0 is a legacy "no border". */
const WIDTH: Range = { min: 0, max: 20 };
/** Corner rounding, px. Block/heading sliders offer 0–24; inline offers 0–25. */
const RADIUS: Range = { min: 0, max: 64 };
/** Font scale, a multiplier. The sliders offer 0.5–1.5; 0 would erase the text. */
const SCALE: Range = { min: 0.1, max: 10 };
/** Heading padding and gap, em. The sliders offer 0–1 and 0–2. */
const SPACING: Range = { min: 0, max: 10 };

/**
 * `value` if it is a number within `range`, the nearest end of the range if it
 * is a number outside it, and `fallback` if it is not a number at all.
 *
 * Anything non-numeric falls back rather than clamps, because there is nothing
 * to clamp: `"2px; } * { display: none } .x {"` is neither too big nor too
 * small, and the only safe reading of it is "the file did not say".
 */
function inRange(value: unknown, fallback: number, range: Range): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(range.max, Math.max(range.min, value));
}

/**
 * A global style whose numbers are all inside the guard ranges.
 *
 * Everything else is passed through untouched — the per-side border booleans,
 * the alignment flag, and any field a newer version adds — so this stays a
 * value check and never becomes a second place that has to know the shape.
 * Idempotent, which it has to be: it runs on every load, over settings it
 * itself wrote on the last one.
 */
export function clampGlobalStyle(
	style: GlobalStyleSettings,
): GlobalStyleSettings {
	const fallback = DEFAULT_SETTINGS.globalStyle;
	return {
		...style,
		borderWidth: inRange(style.borderWidth, fallback.borderWidth, WIDTH),
		borderRadius: inRange(style.borderRadius, fallback.borderRadius, RADIUS),
		titleScale: inRange(style.titleScale, fallback.titleScale, SCALE),
		contentScale: inRange(style.contentScale, fallback.contentScale, SCALE),
		heading: {
			...style.heading,
			borderWidth: inRange(
				style.heading.borderWidth,
				fallback.heading.borderWidth,
				WIDTH,
			),
			borderRadius: inRange(
				style.heading.borderRadius,
				fallback.heading.borderRadius,
				RADIUS,
			),
			paddingTop: inRange(
				style.heading.paddingTop,
				fallback.heading.paddingTop,
				SPACING,
			),
			paddingBottom: inRange(
				style.heading.paddingBottom,
				fallback.heading.paddingBottom,
				SPACING,
			),
			marginTop: inRange(
				style.heading.marginTop,
				fallback.heading.marginTop,
				SPACING,
			),
		},
		inline: {
			...style.inline,
			borderWidth: inRange(
				style.inline.borderWidth,
				fallback.inline.borderWidth,
				WIDTH,
			),
			borderRadius: inRange(
				style.inline.borderRadius,
				fallback.inline.borderRadius,
				RADIUS,
			),
			fontScale: inRange(
				style.inline.fontScale,
				fallback.inline.fontScale,
				SCALE,
			),
		},
	};
}
