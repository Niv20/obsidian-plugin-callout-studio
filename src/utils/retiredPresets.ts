/**
 * utils/retiredPresets.ts — presets folded into another one, and moving the
 * callouts that wore them.
 *
 * Amber and Lime were dropped because they sat too close to Yellow (Lime is
 * near-identical to it in dark mode). A renamed preset only needs its old id in
 * `legacyIds`; a *retired* one also has to repaint, because a callout stores
 * its colours, not just a link: picking a preset saves its two accent hexes
 * beside the `paletteId`. Left alone, a callout on `"amber"` would resolve to
 * Yellow by id and keep painting amber — the editor's label and the callout
 * itself would disagree.
 *
 * So the callout is moved for real, to exactly what picking the successor in
 * the editor would have saved:
 *
 * - the accent becomes the successor's;
 * - a background that was only a tint of the OLD accent goes with it, which
 *   leaves the callout on the new accent's own tint (what a preset stores — no
 *   background at all). A background somebody authored is kept;
 * - text colours, gradients and transparency are not a preset's to change;
 * - the `paletteId` is left as written. The successor lists it in `legacyIds`,
 *   so this build reads "Yellow"; an older build on a synced device still knows
 *   `amber` and does not list the callout as a deleted colour.
 *
 * Which callouts wore a retired preset:
 *
 * - **Linked by id** — `paletteId` names it. Moved whatever its colours,
 *   because the editor already labelled it by that id.
 * - **Unlinked** — no `paletteId` (saved before the link existed) but the
 *   colours the editor would have matched to that preset: the same accents,
 *   no gradient, not transparent, and either no background or the preset's own
 *   tint. Skipped when a saved palette of the user's has those very colours —
 *   the adoption pass links the callout to that palette instead.
 *
 * Idempotent: a moved callout no longer matches, and one linked by id already
 * carries the successor's accents. Runs on load and on every imported row, so
 * an old backup lands already moved rather than waiting for the next launch.
 */
import type { CalloutDefinition, CustomPalette } from "../types";
import {
	customPaletteToColorPalette,
	findPresetByPaletteId,
	palettesVisuallyEqual,
	type ColorPalette,
} from "./colorPalettes";
import { bgTintFor, derivedBgAmount } from "./colorUtils";

interface RetiredPreset {
	/** Accent, light mode — exactly as the preset shipped it. */
	colorLight: string;
	/** Accent, dark mode. */
	colorDark: string;
	/** The preset its callouts move to. Must list this id in its `legacyIds`. */
	successor: string;
}

/** Retired preset id → what it was and where its callouts go. */
export const RETIRED_PRESETS: Readonly<Record<string, RetiredPreset>> = {
	amber: { colorLight: "#ff8f00", colorDark: "#ffd54f", successor: "yellow" },
	lime: { colorLight: "#afb42b", colorDark: "#dce775", successor: "yellow" },
};

const sameHex = (a: string | undefined, b: string | undefined): boolean =>
	(a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** The retired preset as the palette it was, for colour comparison. */
function asPalette(id: string, retired: RetiredPreset): ColorPalette {
	return {
		id,
		name: id,
		group: "preset",
		colorLight: retired.colorLight,
		colorDark: retired.colorDark,
		bgColorLight: bgTintFor(retired.colorLight, false),
		bgColorDark: bgTintFor(retired.colorDark, true),
	};
}

/** Whether an unlinked callout wears exactly this retired preset. */
function wearsUnlinked(def: CalloutDefinition, palette: ColorPalette): boolean {
	if (def.transparentBg === true || def.bgGradient) return false;
	if (!sameHex(def.colorLight, palette.colorLight)) return false;
	if (!sameHex(def.colorDark, palette.colorDark)) return false;
	const noBackground = def.bgColorLight === undefined && def.bgColorDark === undefined;
	return (
		noBackground ||
		(sameHex(def.bgColorLight, palette.bgColorLight) &&
			sameHex(def.bgColorDark, palette.bgColorDark))
	);
}

/** The retired preset `def` wears, with its id, or null. */
function retiredPresetOf(
	def: CalloutDefinition,
	customPalettes: readonly CustomPalette[],
): RetiredPreset | null {
	if (def.paletteId) {
		return Object.prototype.hasOwnProperty.call(RETIRED_PRESETS, def.paletteId)
			? RETIRED_PRESETS[def.paletteId] ?? null
			: null;
	}
	for (const [id, retired] of Object.entries(RETIRED_PRESETS)) {
		const palette = asPalette(id, retired);
		if (!wearsUnlinked(def, palette)) continue;
		const own = customPalettes.some((p) =>
			palettesVisuallyEqual(customPaletteToColorPalette(p), palette),
		);
		return own ? null : retired;
	}
	return null;
}

/**
 * `def` moved off a retired preset onto its successor, or null when it wears
 * no retired preset (or already wears the successor's accents).
 */
export function movedOffRetiredPreset(
	def: CalloutDefinition,
	customPalettes: readonly CustomPalette[],
): CalloutDefinition | null {
	// A theme overlay row is the theme's colour, read fresh on every scan.
	if (def.source === "theme") return null;
	const retired = retiredPresetOf(def, customPalettes);
	if (!retired) return null;
	const successor = findPresetByPaletteId(retired.successor);
	if (!successor) return null;
	if (
		sameHex(def.colorLight, successor.colorLight) &&
		sameHex(def.colorDark, successor.colorDark)
	) {
		return null;
	}
	const moved: CalloutDefinition = {
		...def,
		colorLight: successor.colorLight,
		colorDark: successor.colorDark,
	};
	// Only a background the old accent produced; checked against the callout's
	// OWN old accent, since a linked callout may predate the preset's hexes.
	const { bgColorLight, bgColorDark } = def;
	if (
		bgColorLight !== undefined &&
		bgColorDark !== undefined &&
		!def.bgGradient &&
		derivedBgAmount(def.colorLight, bgColorLight, false) !== null &&
		derivedBgAmount(def.colorDark, bgColorDark, true) !== null
	) {
		delete moved.bgColorLight;
		delete moved.bgColorDark;
	}
	return moved;
}
