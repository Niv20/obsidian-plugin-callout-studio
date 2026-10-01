/**
 * settings/paletteBaseColorRow.ts — the palette editor's "Base color" row.
 *
 * One swatch and one sentence of hint under it, whose link leads into the
 * advanced per-channel grid. Split out of `PaletteEditorModal` because that
 * file sits on the line-count ratchet and this is a self-contained row.
 *
 * **The readability correction is deliberately not announced here.**
 * `derivePaletteFromColors` contrast-corrects the accent it derives against its
 * own tint, so a pure `#ffff00` is stored as `#8c8c00` for titles and icons —
 * the swatch keeps showing what you picked while something slightly different
 * paints. Simple mode fixes that quietly and says nothing; the advanced grid,
 * one link away, stores what you pick verbatim and shows a warning badge
 * instead. So the way to see and override the correction exists and is reachable
 * from this row; it just isn't volunteered.
 *
 * What the row DOES owe the user is a swatch that reopens on their own colour
 * rather than on the correction's output — that is `seedBaseColor` below, and
 * it is the whole reason `CustomPalette.baseColor` exists.
 */
import { Setting } from "obsidian";
import {
	derivePaletteFromColor,
	hexToRgb,
	isValidHexColor,
	rgbToHex,
} from "../utils/colorUtils";
import { palettesVisuallyEqual, type ColorPalette } from "../utils/colorPalettes";
import { createColorSwatchInput } from "../ui/ColorSwatchInput";
import { renderInlineLinkHint } from "../ui/inlineLinkHint";
import type { CustomPalette } from "../types";
import { t } from "../i18n";

/**
 * Which color the Base swatch should open on, for an existing palette or a
 * seed (`null` for a brand-new one).
 *
 * `baseColor` before `colorLight`, and the difference is the whole point.
 * `colorLight` is what `derivePaletteFromColors` RETURNED after contrast-
 * correcting the pick, so seeding from it feeds the correction its own output:
 * the next re-derivation runs from a color the user never chose, which for a
 * yellow palette collapses the dark accent to olive and drains the hue out of
 * both backgrounds — surfacing as the Intensity slider jumping on its first
 * step. Preferring the stored pick is what keeps the slider a slider.
 *
 * The fallback is still `colorLight` because a palette saved before the field
 * existed, or a seed built by `paletteSeedFromDefinition` from a baked callout,
 * has nothing better to offer — the correction is not invertible.
 */
export function seedBaseColor(
	base: Pick<CustomPalette, "baseColor" | "colorLight"> | null,
	fallback: string,
): string {
	if (base?.baseColor && isValidHexColor(base.baseColor)) return base.baseColor;
	if (base?.colorLight && isValidHexColor(base.colorLight)) {
		return base.colorLight;
	}
	return fallback;
}

/**
 * The base color a brand-new palette opens on: `preferred`, unless the six
 * colors it derives already belong to a saved palette or a preset.
 *
 * Without this, a user who once saved the default color is greeted by the
 * duplicate-color error on every later "New color" — before they have touched
 * anything. When (and only when) that is the case, one channel moves by a
 * single step, which no one can see and which makes the palette unique.
 *
 * The test is on the derived palette, not the base hex, because that is what
 * `findColorClash` compares and what two palettes can actually share: the
 * derivation rounds, so one step does not always change the result and the
 * search keeps going (blue, then green, then red, then two steps, ...). A
 * channel at 255 steps down instead of up. Returns `preferred` untouched when
 * nothing is taken, which is the common case and costs one derivation.
 */
export function unclaimedBaseColor(
	preferred: string,
	amount: number,
	taken: readonly ColorPalette[],
): string {
	const isTaken = (hex: string): boolean => {
		const candidate: ColorPalette = {
			id: "",
			name: "",
			group: "custom",
			...derivePaletteFromColor(hex, amount),
		};
		return taken.some((p) => palettesVisuallyEqual(p, candidate));
	};
	if (!isTaken(preferred)) return preferred;
	const rgb = hexToRgb(preferred);
	for (let step = 1; step <= 255; step++) {
		for (const channel of ["b", "g", "r"] as const) {
			const up = rgb[channel] + step;
			const value = up <= 255 ? up : rgb[channel] - step;
			if (value < 0) continue;
			const next = rgbToHex(
				channel === "r" ? value : rgb.r,
				channel === "g" ? value : rgb.g,
				channel === "b" ? value : rgb.b,
			);
			if (!isTaken(next)) return next;
		}
	}
	return preferred;
}

/** Builds the row and returns it, for the card's teardown list. */
export function renderBaseColorRow(
	parent: HTMLElement,
	options: {
		base: string;
		/**
		 * Whether to render the hint at all. False under Gradient, which has no
		 * advanced per-channel view for the link to lead to.
		 */
		showHint: boolean;
		onPick: (hex: string) => void;
		onAdvanced: () => void;
	},
): HTMLElement {
	// Every colour row in this card carries `cs-row-inline`: the control is
	// one small swatch, which the phone would otherwise park on a full-width
	// row of its own under the label. See the class in styles.css.
	const setting = new Setting(parent)
		.setName(t("palette.baseColor"))
		.setClass("cs-row-inline");
	createColorSwatchInput(setting.controlEl, options.base, options.onPick);

	if (options.showHint) {
		renderInlineLinkHint(setting.descEl, {
			textKey: "palette.baseColorHint",
			linkKey: "palette.baseColorHintLink",
			onClick: options.onAdvanced,
		});
	}

	return setting.settingEl;
}
