/**
 * settings/paletteModeButton.ts — the palette editor's switch between light and
 * dark mode.
 *
 * Who calls it. `PaletteEditorModal`, once, when it builds the "Colors" group,
 * and again when it closes, to put the mode back.
 *
 * The main idea. A palette has its own colors for light mode and for dark mode,
 * and the editor shows the colors of the mode on screen. To see and set the
 * other mode, this button switches all of Obsidian to it for as long as the
 * editor is open: the live preview, the swatches and the window around them
 * then look exactly as they will in that mode, theme included.
 *
 * It is done the way Obsidian does it. Obsidian has no API for setting the mode
 * (only `app.isDarkMode()` for reading it); it switches by putting
 * `theme-dark` or `theme-light` on the main window's body, and every other
 * window — Settings among them — copies the main window's classes. So the
 * classes go on the main window, never only on the window the editor is in,
 * which would be undone at the next copy. Nothing is saved to Obsidian's
 * settings, and the editor puts the mode back when it closes.
 *
 * Painting the preview alone in the other mode was not an option. A light box
 * inside a dark window still matches every `.theme-dark …` rule, this plugin's
 * own and most themes', so it would show colors the note will never have.
 */
import type { App, SettingGroup } from "obsidian";
import { t } from "../i18n";

/**
 * Show all of Obsidian in dark mode (`true`) or light mode (`false`).
 *
 * @param app The app, whose main window every other window copies.
 * @param dark Which mode to show.
 */
export function showMode(app: App, dark: boolean): void {
	const body = app.workspace.containerEl.ownerDocument.body;
	body.toggleClass("theme-dark", dark);
	body.toggleClass("theme-light", !dark);
}

/**
 * Add the button to the end of `group`'s heading.
 *
 * @param group The "Colors" group.
 * @param onClick Called on a press; it switches the mode and calls the returned
 *   function again with the new one.
 * @returns The function that repaints the button for the mode on screen: a sun
 *   in dark mode (the press brings light) and a moon in light mode.
 */
export function addModeButton(group: SettingGroup, onClick: () => void): (dark: boolean) => void {
	let paint: (dark: boolean) => void = () => undefined;
	group.addExtraButton((button) => {
		button.onClick(onClick);
		paint = (dark) => {
			if (dark) {
				button.setIcon("sun").setTooltip(t("palette.showLightMode"));
			} else {
				button.setIcon("moon").setTooltip(t("palette.showDarkMode"));
			}
		};
	});
	return (dark) => paint(dark);
}
