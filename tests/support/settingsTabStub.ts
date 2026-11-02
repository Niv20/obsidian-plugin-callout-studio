/**
 * tests/support/settingsTabStub.ts — Obsidian's `PluginSettingTab` and
 * `SettingPage`, as far as the tests need them. Re-exported by obsidianStub.ts,
 * which the test runner puts in place of the `obsidian` module.
 *
 * What is real here:
 *
 * - **`update()`** stores `getSettingDefinitions()` in `settingItems`, as
 *   Obsidian's does (and counts the calls, for tests about how often a tab
 *   asks to be redrawn). Drawing the items is the test renderer's job
 *   (tests/support/declarativeRenderer.ts), not this class's.
 * - **`getControlValue` / `setControlValue`** behave as Obsidian's defaults:
 *   read `plugin.settings[key]`, and write it then call
 *   `plugin.saveData(plugin.settings)`. That second one is exactly the
 *   behaviour Callout Studio must override (it would overwrite data.json), so a
 *   test can prove the override is the one that runs.
 *
 * Elements are made on first use, not in the constructor: plenty of suites
 * construct a settings tab without installing the fake DOM first, and the
 * global `createDiv` exists only once it is installed.
 */

/** The part of a plugin the default control binding touches. */
interface PluginLike {
	settings?: Record<string, unknown>;
	saveData?(data: unknown): Promise<void>;
}

/** A minimal element factory, from the fake DOM's globals. */
function makeDiv(cls: string): HTMLElement {
	return createDiv({ cls });
}

export class PluginSettingTab {
	app: unknown;
	plugin: unknown;
	icon = "";
	/** What the last `update()` stored, as Obsidian's tab keeps it. */
	settingItems: unknown[] = [];
	/** How many times `update()` ran. */
	updateCount = 0;
	/** How many times `refreshDomState()` ran. */
	refreshDomStateCount = 0;
	private containerElValue: HTMLElement | null = null;

	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
	}

	/** The tab's page element (`div.vertical-tab-content`), made on first use. */
	get containerEl(): HTMLElement {
		this.containerElValue ??= makeDiv("vertical-tab-content");
		return this.containerElValue;
	}

	getSettingDefinitions(): unknown[] {
		return [];
	}

	update(): void {
		this.settingItems = this.getSettingDefinitions();
		this.updateCount++;
	}

	refreshDomState(): void {
		this.refreshDomStateCount++;
	}

	/** Obsidian's default: `plugin.settings[key]`. */
	getControlValue(key: string): unknown {
		return (this.plugin as PluginLike).settings?.[key];
	}

	/** Obsidian's default, the dangerous one: write the field, then `saveData(settings)`. */
	setControlValue(key: string, value: unknown): void | Promise<void> {
		const plugin = this.plugin as PluginLike;
		if (!plugin.settings) return;
		plugin.settings[key] = value;
		return plugin.saveData?.(plugin.settings);
	}

	display(): void { /* drawn by the test renderer, not here */ }
	hide(): void { /* nothing to undo */ }
}

/**
 * Obsidian's `SettingPage`: `div.setting-page.vertical-tab-content` holding a
 * title bar and a content element, made on first use.
 */
export class SettingPage {
	title = "";
	private elements: { rootEl: HTMLElement; titlebarEl: HTMLElement; containerEl: HTMLElement } | null = null;

	private get parts() {
		if (!this.elements) {
			const rootEl = makeDiv("setting-page vertical-tab-content");
			this.elements = {
				rootEl,
				titlebarEl: rootEl.createDiv({ cls: "setting-page-titlebar" }),
				containerEl: rootEl.createDiv({ cls: "setting-page-content" }),
			};
		}
		return this.elements;
	}

	get rootEl(): HTMLElement { return this.parts.rootEl; }
	get titlebarEl(): HTMLElement { return this.parts.titlebarEl; }
	get containerEl(): HTMLElement { return this.parts.containerEl; }

	display(): void { /* each page draws itself */ }
	hide(): void { /* nothing to undo */ }
}
