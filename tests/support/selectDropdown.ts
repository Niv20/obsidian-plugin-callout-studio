/**
 * tests/support/selectDropdown.ts — drive a plain choice (`SelectDropdown`)
 * the way a user does: click its field, then pick a row in the menu.
 *
 * The menu is Obsidian's `Menu`, which in the tests is the stub in
 * `obsidianStub.ts`. It draws nothing; it records each item it was given
 * (title, icon, ✓) in `items`, and every menu ever built is kept in
 * `createdMenus`, newest last. So "the open menu" is simply the newest one.
 */
import assert from "node:assert/strict";
import { createdMenus, type Menu, type MenuItemRecord } from "./obsidianStub";
import type { FakeElement } from "./fakeDom";

/** The field of the plain choice inside `root`. */
export function dropdownButton(root: HTMLElement): FakeElement {
	const button = root.querySelector(".cs-select-button");
	assert.ok(button, "no plain choice (.cs-select-button) under this element");
	return button as unknown as FakeElement;
}

/** The words the field shows for the current option. */
export function dropdownValue(root: HTMLElement): string {
	return root.querySelector(".cs-select-value")?.textContent ?? "";
}

/**
 * Open a fresh menu for the plain choice inside `root` and return it. A menu
 * already open is closed first (a second click on the field), because an open
 * Obsidian menu keeps the options it was built with. Fails when the click
 * opens nothing, for example while the field is disabled.
 */
export function openDropdownMenu(root: HTMLElement): Menu {
	const button = dropdownButton(root);
	if (button.getAttribute("aria-expanded") === "true") button.fire("click");
	button.fire("click");
	const menu = createdMenus[createdMenus.length - 1];
	assert.ok(menu?.shown, "clicking the field did not open a menu");
	return menu;
}

/** The menu's items, in order: what each says, its icon and whether it is ✓. */
export function dropdownOptions(root: HTMLElement): MenuItemRecord[] {
	return openDropdownMenu(root).items;
}

/** Open the menu and click the item titled `label`, as a user would. */
export function pickDropdown(root: HTMLElement, label: string): void {
	openDropdownMenu(root).clickItem(label);
}
