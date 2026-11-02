/**
 * tests/declarativeMenuPage.test.ts — Customize right-click menu as a settings
 * page (settings/declarative/menuPage.ts).
 *
 * Drawn through the test renderer. What is checked: the page's layout (two
 * lists per role, every box keyed apart, the hidden list only while something
 * is hidden), ✕ hiding an item, a move, a hidden item coming back at the end,
 * ↺ putting a role back as shipped and showing only while a menu differs from
 * it, the settings search finding the page but none of its rows, and nothing
 * changing while saving is paused.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type RenderedBox } from "./support/declarativeRenderer";
import { PluginSettingTab, type ButtonLike } from "./support/obsidianStub";
import { DEFAULT_CONTEXT_MENU_ITEMS } from "../src/constants";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { MENU_PAGE, menuPage } from "../src/settings/declarative/menuPage";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import { ITEM_LABEL_KEY } from "../src/settings/menuItems";
import type { CalloutRenderRole } from "../src/types";

installFakeDom();

/** A plugin with a real registry (its menus as shipped), counting its saves. */
function fakePlugin(paused = false) {
	const registry = new CalloutRegistry();
	registry.load(null);
	let saves = 0;
	const plugin = {
		registry,
		get settings() {
			return registry.settings;
		},
		settingsWriter: { isFrozen: paused },
		saveSettings: () => {
			saves++;
			return Promise.resolve();
		},
	};
	return { plugin, registry, saves: () => saves };
}

/** The page, drawn by the test renderer and opened. */
function drawMenu(plugin: object) {
	let redraws = 0;
	const ctx: TreeContext = {
		app: {} as never,
		plugin: plugin as never,
		redraw: () => {
			redraws++;
			tab.update();
		},
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([{ type: "group", id: "menus", items: [menuPage(ctx)] }]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	harness.openPage([MENU_PAGE.page]);
	return { tab, harness, redraws: () => redraws };
}

/** The drawn box with this id. */
function box(harness: DeclarativeHarness, id: string): RenderedBox {
	const found = harness.rendered.find((b) => b.def.id === id);
	assert.ok(found, `no box "${id}"`);
	return found;
}

/** The names of a box's rows. */
function names(harness: DeclarativeHarness, id: string): string[] {
	return box(harness, id).children.map((row) => row.def.name ?? "");
}

/** A role's ↺, the extra button in its menu's heading. */
function resetButton(harness: DeclarativeHarness, id: string): ButtonLike {
	return box(harness, id).settingGroup.extraButtons[0] as ButtonLike;
}

/** Whether a role's ↺ is hidden, as it is while that role's menu is as shipped. */
function resetIdle(harness: DeclarativeHarness, id: string): boolean {
	const el = resetButton(harness, id).extraSettingsEl as unknown as HTMLElement;
	// Invisible (`cs-reset-idle`) and said to be disabled: never one without the other.
	assert.equal(el.hasClass("cs-reset-idle"), el.getAttribute("aria-disabled") === "true");
	return el.hasClass("cs-reset-idle");
}

/** The name of a menu item. */
const label = (id: keyof typeof ITEM_LABEL_KEY): string => t(ITEM_LABEL_KEY[id]);

/** What `role`'s menu shows as shipped. */
const shipped = (role: CalloutRenderRole): string[] =>
	DEFAULT_CONTEXT_MENU_ITEMS[role].filter((item) => item.enabled).map((item) => label(item.id));

describe("Customize right-click menu", () => {
	it("is the intro, then each role's menu and what it hides, every box keyed apart", () => {
		const { harness } = drawMenu(fakePlugin().plugin);
		assert.deepEqual(
			harness.rendered.map((b) => b.def.id),
			[
				MENU_PAGE.intro,
				"menu-heading",
				"menu-heading-hidden",
				"menu-inline",
				"menu-inline-hidden",
				"menu-regular",
				"menu-regular-hidden",
			],
		);
		assert.deepEqual(harness.duplicateKeys, []);
		assert.deepEqual(names(harness, "menu-heading"), shipped("heading"));
		// The shipped menus hide nothing, so no hidden box shows.
		assert.equal(box(harness, "menu-heading-hidden").groupEl.isShown(), false);
	});

	it("gives each item its icon, Obsidian's handle and ✕", () => {
		const { harness } = drawMenu(fakePlugin().plugin);
		const first = box(harness, "menu-heading").children[0]!;
		assert.ok(first.setting.iconEl, "an icon at the start of the row");
		const buttons = first.setting.extraButtons.map((b) => (b.extraSettingsEl as unknown as HTMLElement).className);
		assert.ok(buttons.some((cls) => cls.includes("cs-test-delete")));
		assert.ok(buttons.some((cls) => cls.includes("mod-drag-handle")));
	});

	it("hides an item with ✕, and brings it back at the end with a press", () => {
		const { plugin, registry, saves } = fakePlugin();
		const { harness } = drawMenu(plugin);
		const firstName = names(harness, "menu-heading")[0]!;
		box(harness, "menu-heading").settingGroup.pressDelete(0);
		assert.equal(saves(), 1);
		assert.ok(!names(harness, "menu-heading").includes(firstName));
		assert.deepEqual(names(harness, "menu-heading-hidden"), [firstName]);
		assert.equal(box(harness, "menu-heading-hidden").groupEl.isShown(), true);
		box(harness, "menu-heading-hidden").children[0]!.settingEl.click();
		assert.equal(names(harness, "menu-heading").at(-1), firstName, "back at the end");
		assert.equal(
			registry.settings.contextMenu.items.heading.every((item) => item.enabled),
			true,
		);
	});

	it("moves an item with Alt+↓, and ↺ puts only that role back as shipped", () => {
		const { plugin } = fakePlugin();
		const { harness } = drawMenu(plugin);
		const [first, second] = names(harness, "menu-regular");
		box(harness, "menu-regular").settingGroup.pressAltArrow(0, 1);
		assert.deepEqual(names(harness, "menu-regular").slice(0, 2), [second, first]);
		// Another role's own order is not the reset's business.
		box(harness, "menu-heading").settingGroup.pressAltArrow(0, 1);
		const heading = names(harness, "menu-heading");
		assert.notDeepEqual(heading, shipped("heading"));
		(box(harness, "menu-regular").settingGroup.extraButtons[0] as ButtonLike).press();
		assert.deepEqual(names(harness, "menu-regular"), shipped("regular"));
		assert.deepEqual(names(harness, "menu-heading"), heading, "the heading menu keeps its order");
	});

	it("shows a role's ↺ only while that role's menu differs from the shipped one", () => {
		const { harness } = drawMenu(fakePlugin().plugin);
		for (const id of ["menu-heading", "menu-inline", "menu-regular"]) {
			assert.equal(resetIdle(harness, id), true, `${id}: nothing to reset, so no arrow`);
		}
		box(harness, "menu-regular").settingGroup.pressAltArrow(0, 1);
		assert.equal(resetIdle(harness, "menu-regular"), false, "moved an item, so its role's arrow shows");
		assert.equal(resetIdle(harness, "menu-heading"), true, "another role's arrow stays out of sight");
		box(harness, "menu-regular").settingGroup.pressDelete(0);
		assert.equal(resetIdle(harness, "menu-regular"), false);
		resetButton(harness, "menu-regular").press();
		assert.equal(resetIdle(harness, "menu-regular"), true, "put back as shipped, the arrow goes again");
	});

	it("shows the ↺ at once on a page that opens with a changed menu", () => {
		const { plugin, registry } = fakePlugin();
		registry.settings.contextMenu.items.heading[0]!.enabled = false;
		const { harness } = drawMenu(plugin);
		assert.equal(resetIdle(harness, "menu-heading"), false);
		assert.equal(resetIdle(harness, "menu-inline"), true);
	});

	it("repaints the ↺ when the menu changes behind the page's back, as another device's sync does", () => {
		const { plugin, registry } = fakePlugin();
		const { tab, harness } = drawMenu(plugin);
		assert.equal(resetIdle(harness, "menu-inline"), true);
		registry.settings.contextMenu.items.inline[0]!.enabled = false;
		// What the updater does when the signature moves.
		tab.update();
		assert.equal(resetIdle(harness, "menu-inline"), false);
		registry.settings.contextMenu.items.inline[0]!.enabled = true;
		tab.update();
		assert.equal(resetIdle(harness, "menu-inline"), true);
	});

	it("never counts the row that repaints the arrows among a menu's items", () => {
		const { harness } = drawMenu(fakePlugin().plugin);
		// Alt+↓ on the last item must have nowhere to go: the repainting row sits in the
		// intro box, not in the list, so the list holds only the items.
		const list = box(harness, "menu-heading");
		assert.equal(list.settingGroup.settings.length, shipped("heading").length);
		const intro = box(harness, MENU_PAGE.intro);
		assert.equal(
			intro.children.some((row) => row.def.id === "menu-resets-repaint"),
			true,
		);
		assert.equal(intro.children.find((row) => row.def.id === "menu-resets-repaint")!.settingEl.isShown(), false);
	});

	it("is found by its name, but none of its rows is", () => {
		const { tab } = drawMenu(fakePlugin().plugin);
		assert.deepEqual(
			searchSettings(tab.settingItems, "right-click").map((hit) => hit.name),
			[t("menuCustomize.title")],
		);
		assert.deepEqual(
			searchSettings(tab.settingItems, label("cutSection")).map((hit) => hit.name),
			[],
		);
	});
});

describe("while saving is paused", () => {
	it("changes nothing: ✕, a move, a hidden item and ↺ say why, and a moved row goes back", () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			const { plugin, registry, saves } = fakePlugin(true);
			registry.settings.contextMenu.items.heading[0]!.enabled = false;
			const { harness, redraws } = drawMenu(plugin);
			const before = names(harness, "menu-heading");
			box(harness, "menu-heading").settingGroup.pressDelete(0);
			box(harness, "menu-heading").settingGroup.pressAltArrow(0, 1);
			box(harness, "menu-heading-hidden").children[0]!.settingEl.click();
			(box(harness, "menu-heading").settingGroup.extraButtons[0] as ButtonLike).press();
			assert.equal(notices.length, 4);
			assert.equal(saves(), 0);
			assert.equal(redraws(), 1, "the moved row is put back by a redraw");
			assert.deepEqual(names(harness, "menu-heading"), before);
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});
});
