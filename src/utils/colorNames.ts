/**
 * utils/colorNames.ts — Human-friendly name suggestions for hex colors.
 *
 * Maps an arbitrary `#rrggbb` color to the nearest of ~19 anchor colors
 * (red, blue, teal, …), returning the localized label via `t("colorName.*")`.
 * Used to prefill the name field when the user saves a picked color as a
 * custom palette, and to name a palette an importer had to mint.
 *
 * A color is first judged achromatic or not; only then is a hue chosen. The
 * split matters, and doing it in one pass is what this used to get wrong — see
 * {@link suggestColorName}.
 */
import { hexToHsl, hexToRgb, relativeLuminance } from "./colorUtils";
import { t } from "../i18n";

/** Anchor reference points; key doubles as the `colorName.<key>` i18n suffix. */
export const COLOR_ANCHORS: { key: string; hex: string }[] = [
	{ key: "red", hex: "#f44336" },
	{ key: "orange", hex: "#ff9800" },
	{ key: "amber", hex: "#ffc107" },
	{ key: "yellow", hex: "#ffeb3b" },
	{ key: "lime", hex: "#cddc39" },
	{ key: "green", hex: "#4caf50" },
	{ key: "teal", hex: "#009688" },
	{ key: "cyan", hex: "#00bcd4" },
	{ key: "sky", hex: "#03a9f4" },
	{ key: "blue", hex: "#2962ff" },
	{ key: "indigo", hex: "#3f51b5" },
	{ key: "violet", hex: "#7c4dff" },
	{ key: "purple", hex: "#9c27b0" },
	{ key: "pink", hex: "#e91e63" },
	{ key: "rose", hex: "#f06292" },
	{ key: "brown", hex: "#795548" },
	{ key: "gray", hex: "#9e9e9e" },
	{ key: "black", hex: "#000000" },
	{ key: "white", hex: "#ffffff" },
];

/**
 * The three anchors that describe an absence of hue. They are reachable ONLY
 * from the achromatic branch below, and are deliberately skipped by the hue
 * search — leaving them in it is what made every pastel come out "Gray".
 */
const ACHROMATIC_KEYS: ReadonlySet<string> = new Set(["gray", "black", "white"]);

/**
 * Suggests a user-facing name for a color, e.g. "#1a73e8" → "Blue".
 *
 * Two stages, and they must stay separate. A color with no meaningful hue —
 * tiny channel spread, or too washed out to read as anything — is named by
 * luminance alone: black, white or gray. Everything else is matched to the
 * nearest *chromatic* anchor.
 *
 * That second stage compares in HSL with **hue dominant**, not by RGB distance,
 * because RGB distance is dominated by lightness: a pale color sits numerically
 * closer to the gray and white anchors than to its own hue, so lavender
 * (#c8a0ff) came out "Gray" and pastel pink (#ffc0cb) came out "White". Hue
 * alone is not enough either — it cannot tell brown from orange, which differ
 * mainly in lightness — hence the smaller saturation and lightness terms.
 *
 * The weights are measured, not tuned by eye: they are the ones under which all
 * 16 chromatic anchors still name themselves (see tests/colorNames.test.ts).
 */
export function suggestColorName(hex: string): string {
	const { r, g, b } = hexToRgb(hex);
	const spread = Math.max(r, g, b) - Math.min(r, g, b);
	const { h, s, l } = hexToHsl(hex);
	if (spread < 24 || s < 15) {
		const lum = relativeLuminance(hex);
		const key = lum < 0.05 ? "black" : lum > 0.8 ? "white" : "gray";
		return t(`colorName.${key}`);
	}

	let bestKey = "gray";
	let bestDist = Infinity;
	for (const anchor of COLOR_ANCHORS) {
		if (ACHROMATIC_KEYS.has(anchor.key)) continue;
		const a = hexToHsl(anchor.hex);
		const rawHue = Math.abs(a.h - h) % 360;
		const dHue = (rawHue > 180 ? 360 - rawHue : rawHue) / 180;
		const dist =
			dHue ** 2 +
			0.3 * ((a.s - s) / 100) ** 2 +
			0.6 * ((a.l - l) / 100) ** 2;
		if (dist < bestDist) {
			bestDist = dist;
			bestKey = anchor.key;
		}
	}
	return t(`colorName.${bestKey}`);
}

/** Names are compared case-insensitively, ignoring surrounding whitespace. */
export function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * "Blue" taken → "Blue 2", "Blue 3", … Used for auto-suggested palette names
 * (left empty by the user, or generated for an imported color) so a
 * collision never silently overwrites/hides another entry.
 */
export function dedupeColorName(name: string, takenNames: Set<string>): string {
	if (!takenNames.has(normalizeName(name))) return name;
	for (let n = 2; ; n++) {
		const candidate = `${name} ${n}`;
		if (!takenNames.has(normalizeName(candidate))) return candidate;
	}
}
