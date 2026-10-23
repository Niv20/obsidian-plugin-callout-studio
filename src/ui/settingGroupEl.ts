/**
 * ui/settingGroupEl.ts — find the outer element of an Obsidian `SettingGroup`.
 *
 * Who calls it. Code that builds a `SettingGroup` and later needs to hide or
 * show the whole group, heading included (the callout editor's Picture group
 * and icon-adjustment groups).
 *
 * The main idea. A group's DOM is `div.setting-group`, holding the heading row
 * and `div.setting-items` (the rounded box of rows). Obsidian's typings declare
 * only the box, as `listEl`; the group element itself exists but is not part
 * of the public API. The box's parent IS the group, so asking for the parent
 * reaches it through the declared API alone, without a cast.
 */
import type { SettingGroup } from "obsidian";

/**
 * The `div.setting-group` element of `group`.
 *
 * @param group A group made with `new SettingGroup(parent)`.
 * @returns The group's outer element. (`??`: if the box had somehow been taken
 *   out of its group, the box itself is the best element left to return.)
 */
export function settingGroupEl(group: SettingGroup): HTMLElement {
	return group.listEl.parentElement ?? group.listEl;
}
