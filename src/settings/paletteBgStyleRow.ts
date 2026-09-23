import { Setting } from "obsidian";
import { t } from "../i18n";
import { SelectDropdown } from "../ui/selectDropdown";

/**
 * How the palette paints its background. `"none"` is not a third way of
 * colouring one — it is the absence of a background (`transparentBg`), which is
 * why it lives here rather than at the bottom of the Intensity slider: an
 * intensity near zero is still an OPAQUE fill in the page's own colour, so it
 * looks transparent while quietly flattening the nesting step of every callout
 * stacked inside it (see `CalloutDefinition.transparentBg`).
 */
export type BgStyle = "solid" | "gradient" | "none";

/** The palette's finite background choices share the standard themed popup. */
export function buildPaletteBgStyleRow(parent: HTMLElement, value: BgStyle, onChange: (value: BgStyle) => void): SelectDropdown {
	const setting = new Setting(parent)
		.setName(t("palette.bgStyle"))
		.setClass("cs-palette-bgstyle-setting");
	return new SelectDropdown(setting.controlEl, t("palette.bgStyle"))
		.addOption("solid", t("palette.bgSolid"))
		.addOption("gradient", t("palette.bgGradient"))
		.addOption("none", t("palette.bgTransparent"))
		.setValue(value).onChange((raw) => onChange(raw as BgStyle));
}
