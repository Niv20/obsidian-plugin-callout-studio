/**
 * settings/declarative/themeStylesSwitch.ts — the "Use your theme's callout
 * styles" switch, the top row of the Callouts from your theme page.
 *
 * Who calls it. CalloutListPage (calloutListPage.ts), when it draws the
 * theme's page.
 *
 * The main idea. The switch decides whether the active theme's callout styles
 * count at all (manager/theme/themeCalloutsOff.ts). It sits on the page of the
 * callouts it controls, in a box of its own above them. That page is drawn by
 * the plugin and not from a list of rows, so the switch is drawn here with
 * Obsidian's own toggle, and saved the way a declarative `control` row is
 * saved (controlBinding.ts): never through Obsidian's `saveData`, which would
 * replace data.json with the settings alone. The row that opens the page says
 * "Off" in place of its count while the switch is off (calloutListPage.ts).
 *
 * Because the page's rows are not in Obsidian's settings search, the switch is
 * found through the page's own name, Callouts from your theme.
 */
import { Setting, SettingGroup, type ToggleComponent } from "obsidian";
import { t } from "../../i18n";
import { readSettingAt, writeControlValue } from "./controlBinding";
import { PLUGIN_BOX_CLASS } from "./rowParts";
import type { TreeContext } from "./types";

/** Where the switch saves, as a dotted path into the settings. */
export const THEME_STYLES_KEY = "themeCalloutStyles.enabled";

export class ThemeStylesSwitch {
	/** Obsidian's toggle; null until the switch is drawn. */
	private toggle: ToggleComponent | null = null;

	constructor(private readonly ctx: TreeContext) {}

	/** Draw the switch in a box of its own at the end of `parent`. */
	draw(parent: HTMLElement): void {
		const box = new SettingGroup(parent);
		box.addClass(PLUGIN_BOX_CLASS);
		new Setting(box.listEl)
			.setName(t("settings.themeCalloutStyles"))
			.setDesc(t("settings.themeCalloutStylesDesc"))
			.addToggle((toggle) => {
				this.toggle = toggle;
				toggle.onChange((enabled) => this.save(enabled));
			});
		this.sync();
	}

	/**
	 * Show what the settings say now, and grey the switch while saving is
	 * paused. Called after every draw of the page, so a change that came from
	 * another device, or one that was refused, is shown as it really is.
	 */
	sync(): void {
		const toggle = this.toggle;
		if (!toggle) return;
		toggle.setValue(readSettingAt(this.ctx.plugin.settings, THEME_STYLES_KEY) === true);
		toggle.setDisabled(this.ctx.plugin.settingsWriter.isFrozen);
	}

	/** The page was left: let go of the toggle. */
	dispose(): void {
		this.toggle = null;
	}

	/**
	 * The user flipped the switch. The same two steps the settings tab takes
	 * for any control (SettingsTab.setControlValue): the registry's change
	 * round repaints and saves, and while saving is paused the change is
	 * refused and the switch put back.
	 */
	private save(enabled: boolean): void {
		writeControlValue(this.ctx.plugin, THEME_STYLES_KEY, enabled, {
			announce: () => this.ctx.plugin.registry.settingsChanged(),
			onRefused: () => this.sync(),
		});
	}
}
