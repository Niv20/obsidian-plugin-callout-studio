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
import { isValidHexColor } from "../utils/colorUtils";
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
