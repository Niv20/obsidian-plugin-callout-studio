/**
 * settings/paletteColorViewButton.ts — the palette editor's switch between one
 * base color and colors set one by one.
 *
 * Who calls it. `PaletteEditorModal`, once, when it builds the "Colors" group.
 *
 * The main idea. The switch is one icon button at the end of the group's
 * heading, as Obsidian puts a group's extra button, instead of a sentence with
 * a link inside it under the Base color row ("…you can control it separately
 * by clicking here"). The sentence was long for a column this narrow and
 * wrapped on every line; a button in the heading says the same thing in no
 * words at all, and the tooltip supplies them.
 *
 * It is one button for both directions, so the way in and the way back are in
 * the same place: the sliders icon opens the separate colors, and the undo
 * icon (not ↺, which in this plugin means "back to the default" and only shows
 * while something differs) puts the single base color back.
 */
import type { SettingGroup } from "obsidian";
import { t } from "../i18n";

/**
 * Which colors the group is showing. `none` is every style that has no
 * separate colors to switch to (Gradient, Transparent), where the button hides.
 */
export type ColorView = "simple" | "advanced" | "none";

/**
 * Add the button to the end of `group`'s heading.
 *
 * @param group The "Colors" group.
 * @param onClick Called on a press; it flips the view and calls the returned
 *   function again with the new one.
 * @returns The function that repaints the button for a view: its icon, its
 *   words, and whether it is there at all.
 */
export function addColorViewButton(group: SettingGroup, onClick: () => void): (view: ColorView) => void {
	let paint: (view: ColorView) => void = () => undefined;
	group.addExtraButton((button) => {
		button.onClick(onClick);
		paint = (view) => {
			button.extraSettingsEl.toggleClass("cs-hidden", view === "none");
			if (view === "advanced") {
				button.setIcon("undo-2").setTooltip(t("palette.colorViewSimple"));
			} else {
				button.setIcon("sliders-horizontal").setTooltip(t("palette.colorViewAdvanced"));
			}
		};
	});
	return (view) => paint(view);
}
