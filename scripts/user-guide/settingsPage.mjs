/**
 * scripts/user-guide/settingsPage.mjs — the plugin's settings, drawn for a
 * guide scene the way Obsidian draws them.
 *
 * Who calls it. The scenes that show a settings page (scenes-*.mjs), through
 * `mountSettingsPage`.
 *
 * The main idea. The settings are Obsidian's declarative tree since
 * 2026-10-25: the plugin builds a tree (`settingsTree`), and Obsidian draws it.
 * A scene builds that very tree and hands it to the test renderer
 * (tests/support/declarativeRenderer.ts), which draws it step for step as
 * Obsidian 1.14.4 does; here its `Setting` and `SettingGroup` are the guide
 * runtime's, so the boxes, rows, chevrons and page title bar are Obsidian's
 * real DOM and app.css paints them. A scene names a sub-page by its path of
 * page ids, as Obsidian's `openPagePath` does.
 */
import { DeclarativeHarness } from "../../tests/support/declarativeRenderer.ts";
import { settingsTree } from "../../src/settings/declarative/settingsTree.ts";
import { toObsidianItems } from "../../src/settings/declarative/types.ts";
import { RowRegistry } from "../../src/settings/declarative/rowRegistry.ts";
import { PersistentParts } from "../../src/settings/declarative/persistentParts.ts";
import { readSettingAt } from "../../src/settings/declarative/controlBinding.ts";

/** The row the real tab uses to notice a visit; it draws nothing, so here it does nothing. */
const VISIT_ROW = { id: "settings-visit", name: "", searchable: false, visible: false, render: () => {} };

/**
 * Draw the settings into a frame shaped like Obsidian's settings window and
 * return the scene's metadata.
 *
 * - `path`: the page to open, as page ids (`[]`, the default, is the main page).
 * - `boxes`: ids of the main page's boxes to keep; the others are hidden, for
 *   a scene about one part of a long page.
 * - `height`: a fixed height for the frame, for a scene that opens a menu or a
 *   list below a row and crops it.
 * - `after(harness, frame)`: what the scene does once the page is drawn, such
 *   as opening a picker (`rowById` finds a row).
 *
 * The rest of the options (title, description) is the scene's metadata.
 */
export function mountSettingsPage(plugin, { path = [], boxes, height, after, ...metadata } = {}) {
	const frame = document.body.createDiv({ cls: "modal mod-settings guide-settings-page", attr: { id: "guide-scene" } });
	const contentEl = frame.createDiv({ cls: "modal-content" }).createDiv({ cls: "vertical-tab-content-container" });
	if (height) frame.style.height = `${height}px`;

	// The context the real tab builds (declarative/declarativeSettings.ts), with
	// nothing behind the jumps: a scene is a still picture.
	const ctx = {
		app: plugin.app, plugin,
		redraw: () => tab.update(),
		registerDisposer() {},
		rows: new RowRegistry(),
		parts: new PersistentParts(),
		jumpTo() {},
		revealCallout() {},
	};
	// What the renderer needs from a settings tab: the tree, and the control
	// values read from the live settings (a scene never saves).
	const tab = {
		settingItems: [],
		containerEl: contentEl.createDiv({ cls: "vertical-tab-content" }),
		update() { this.settingItems = toObsidianItems(settingsTree(ctx, VISIT_ROW)); },
		refreshDomState() {},
		getControlValue: (key) => readSettingAt(plugin.settings, key),
		setControlValue() {},
	};
	const harness = new DeclarativeHarness(tab);
	tab.update();
	harness.draw();
	if (path.length > 0) {
		harness.openPage(path);
		contentEl.replaceChildren(harness.pageRootEl);
	}
	if (boxes) {
		for (const box of harness.rendered) {
			if (!boxes.includes(box.def.id)) box.groupEl.hide();
		}
	}
	after?.(harness, frame);
	return { selector: "#guide-scene", ...metadata };
}

/** The drawn row whose id is `id`, on the page now open. */
export function rowById(harness, id) {
	const row = harness.rows().find((candidate) => candidate.def.id === id);
	if (!row) throw new Error(`No settings row ${id} on this page`);
	return row.settingEl;
}
