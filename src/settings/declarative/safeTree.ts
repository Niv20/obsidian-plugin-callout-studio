/**
 * settings/declarative/safeTree.ts — the settings tree must never make
 * Obsidian, or the plugin's load, fail.
 *
 * Who calls it. The settings tab, around the whole tree; and every module that
 * builds a render row, around that row's `render`.
 *
 * The main idea. Obsidian runs two kinds of plugin code without catching what
 * it throws (read in app.js 1.14.4):
 *
 * - `getSettingDefinitions()`, through `update()`. `addSettingTab` calls
 *   `update()` while the plugin loads, so an error while building the tree
 *   would stop Callout Studio from loading at all.
 * - A render row's `render(setting, group)`, while a page is drawn. An error in
 *   one row stops the rest of the page from being drawn.
 *
 * So the tree is built inside {@link buildTreeSafely}, and every render body is
 * wrapped by {@link guardRender}. A failure is logged to the console and the
 * page carries on.
 */
import type { Setting, SettingGroup } from "obsidian";
import type { CsItem } from "./types";

/** The signature of a render row's `render`. */
export type RenderRow = (setting: Setting, group: SettingGroup) => void | (() => void);

/**
 * Build the tree, or return `fallback` if building throws.
 *
 * @param fallback What Obsidian gets instead. An empty array makes Obsidian
 *   draw the tab the old way, through `display()`, while that still exists.
 */
export function buildTreeSafely(build: () => CsItem[], fallback: CsItem[]): CsItem[] {
	try {
		return build();
	} catch (error) {
		console.error("Callout Studio: could not build the settings page.", error);
		return fallback;
	}
}

/**
 * Wrap a render body so an error leaves the row with just its name instead of
 * stopping the page. The cleanup the body returns, if any, is passed on.
 *
 * @param rowName Named in the console message, to find the row that failed.
 */
export function guardRender(rowName: string, render: RenderRow): RenderRow {
	return (setting, group) => {
		try {
			return render(setting, group);
		} catch (error) {
			console.error(`Callout Studio: could not draw the settings row "${rowName}".`, error);
			return undefined;
		}
	};
}
