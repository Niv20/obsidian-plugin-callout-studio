/**
 * settings/SettingsTab.ts — the plugin's tab in Obsidian's settings.
 *
 * Who uses it. main.ts registers it (`addSettingTab`); a few modules ask it to
 * draw again after a change from outside (`settingsTab?.update()`).
 *
 * The main idea. The tab is a tree Obsidian draws (Obsidian 1.13's declarative
 * settings): `getSettingDefinitions()` hands it over, built by
 * declarative/declarativeSettings.ts, and Obsidian draws its pages and indexes
 * every row for its settings search. The tab itself only adds what Obsidian
 * cannot know: how a control's value is read and saved in this plugin's nested
 * settings, and what ends when the tab is left.
 */
import { PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionItem } from "obsidian";
import { PLUGIN_ICON_ID } from "../constants";
import { readSettingAt, writeControlValue } from "./declarative/controlBinding";
import { DeclarativeSettings } from "./declarative/declarativeSettings";
import type { SettingsTabPlugin } from "./sections/types";

/** Marks the main page's element, which is the plugin's alone (styles.css). */
const TAB_CLASS = "cs-settings-tab";

export class CalloutStudioSettingsTab extends PluginSettingTab {
	plugin: SettingsTabPlugin;
	/**
	 * Drawn beside "Callout Studio" in Obsidian's settings search results, as
	 * every core tab's is. The sidebar list does not show it: Obsidian hides
	 * every community plugin's tab icon there.
	 */
	icon = PLUGIN_ICON_ID;
	/** The tree's side of the tab; made the first time Obsidian asks for the tree. */
	private declarative: DeclarativeSettings | null = null;

	constructor(app: App, plugin: SettingsTabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.containerEl.addClass(TAB_CLASS);
	}

	/**
	 * The tab's tree (declarative/declarativeSettings.ts). Obsidian asks for it
	 * on every `update()`, the first time while the plugin loads.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		// `??=` makes it only the first time: "if null, make one".
		this.declarative ??= new DeclarativeSettings(this);
		return this.declarative.definitions();
	}

	/**
	 * A declarative control's current value. Obsidian's own reads
	 * `plugin.settings[key]`; here the keys are dotted paths into the nested
	 * settings, read live each time. @see declarative/controlBinding.ts
	 */
	getControlValue(key: string): unknown {
		return readSettingAt(this.plugin.settings, key);
	}

	/**
	 * Save a declarative control's change through the plugin's own save, never
	 * through Obsidian's default, which calls `saveData(plugin.settings)` and
	 * would overwrite data.json with the settings alone, losing every callout.
	 * The registry's change round repaints and saves. While saving is paused
	 * the change is refused and the page redrawn, which puts the control back.
	 * @see declarative/controlBinding.ts
	 */
	setControlValue(key: string, value: unknown): void {
		writeControlValue(this.plugin, key, value, {
			announce: () => this.plugin.registry.settingsChanged(),
			onRefused: () => this.update(),
		});
	}

	/** The tab was left, or the settings closed: end the visit the tree started. */
	hide(): void {
		this.declarative?.hide();
		super.hide();
	}
}
