/**
 * tests/declarativeIconLibrariesRow.test.ts — the Icon libraries row of the
 * Colors and icons box, as the declarative settings draw it
 * (settings/declarative/iconLibrariesRow.ts).
 *
 * The row is a door to the Manage icon libraries window, the one Pick an icon's
 * Manage libraries button opens (settings/iconpicker/openIconLibraries.ts), not
 * a page with a second copy of the list. Drawn through the test renderer
 * (tests/support/declarativeRenderer.ts), what is checked is what Obsidian would
 * show: the row's words and what the settings search finds it by; that its
 * button reads the pack files, counts the icons and opens that window with no
 * callout being edited; and that while a callout editor is open the button is
 * dimmed and a press explains instead of opening it (the editor holds an icon
 * the window could not account for when a library is deleted).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import { DEFAULT_SETTINGS } from "../src/constants";
import { t } from "../src/i18n";
import { ICON_SOURCE_IDS } from "../src/icons/registry";
import { ICON_LIBRARIES_ROW, iconLibrariesRow } from "../src/settings/declarative/iconLibrariesRow";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { IconLibrariesHost } from "../src/settings/iconpicker/IconLibrariesModal";
import { DeclarativeHarness, searchSettings } from "./support/declarativeRenderer";
import { installFakeDom } from "./support/fakeDom";
import { standInForLibrariesWindow, stubSourceIndexes } from "./support/iconLibrariesDoors";
import { Notice, PluginSettingTab, type ButtonLike } from "./support/obsidianStub";

installFakeDom();

/** A context whose plugin has only what the row and the window read. */
function setup(options: { editorOpen?: boolean } = {}) {
	const steps: string[] = [];
	const plugin = {
		app: { name: "app" },
		settings: structuredClone(DEFAULT_SETTINGS),
		settingsEditOpen: options.editorOpen === true,
		settingsWriter: { isFrozen: false },
		saveSettings: () => Promise.resolve(),
		registry: { getCommitted: () => [], getUserImages: () => [] },
		icons: {
			packs: {
				loadAllFromDisk: () => {
					steps.push("read");
					return Promise.resolve();
				},
			},
			deleteLibrary: () => Promise.resolve(false),
		},
	};
	const rows = new RowRegistry();
	const ctx: TreeContext = {
		app: {} as never,
		plugin: plugin as never,
		redraw: () => {},
		registerDisposer: () => {},
		rows,
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	return { ctx, plugin, steps, rows };
}

/** Draw the row in a box of its own, as the Colors and icons box holds it. */
function drawRow(ctx: TreeContext) {
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () =>
		toObsidianItems([
			{
				type: "group",
				id: "colors-and-icons",
				heading: t("settings.colorsAndIcons"),
				items: [iconLibrariesRow(ctx)],
			},
		]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness };
}

/** The button the row drew. */
function buttonOf(harness: DeclarativeHarness): ButtonLike {
	return harness.row(t("iconLibraries.title"))!.setting.components[0] as ButtonLike;
}

const isDimmed = (button: ButtonLike): boolean =>
	(button.buttonEl as unknown as HTMLElement).getAttribute("aria-disabled") === "true";

describe("the Icon libraries row", () => {
	it("is a row with a name, a sentence and a Manage libraries button, under the box's heading", () => {
		const { ctx } = setup();
		const { harness } = drawRow(ctx);
		const box = harness.rendered[0]!;
		assert.equal(box.def.heading, "Colors and icons");
		assert.deepEqual(
			box.children.map((row) => row.def.name),
			["Icon libraries"],
		);
		const row = harness.row("Icon libraries")!;
		assert.equal(row.def.desc, t("settings.iconLibrariesDesc"));
		assert.equal(
			(buttonOf(harness).buttonEl as unknown as HTMLElement).dataset.csText,
			t("iconPicker.manageLibraries"),
		);
		assert.equal(
			t("iconPicker.manageLibraries"),
			"Manage libraries",
			"the words of Pick an icon's button, so the two doors agree",
		);
		assert.deepEqual(harness.duplicateKeys, []);
	});

	it("is registered for a jump, under the name that never changes", () => {
		const { ctx, rows } = setup();
		const { harness } = drawRow(ctx);
		const el = harness.row("Icon libraries")!.settingEl;
		// The fake page is not in a document, and the registry only answers for a row on screen.
		(el as unknown as { isConnected: boolean }).isConnected = true;
		assert.equal(ICON_LIBRARIES_ROW, "icon-libraries");
		assert.equal(rows.get(ICON_LIBRARIES_ROW), el);
	});

	it("is found by the settings search, by its name and by the libraries' own", () => {
		const { ctx } = setup();
		const { tab } = drawRow(ctx);
		const names = (query: string): string[] => searchSettings(tab.settingItems, query).map((hit) => hit.name);
		assert.deepEqual(names("icon libraries"), ["Icon libraries"]);
		for (const library of [
			"Tabler",
			"Font Awesome",
			"Simple Icons",
			"RPG Awesome",
			"Octicons",
			"Lucide",
			"Material",
			"Emoji",
		]) {
			assert.deepEqual(names(library), ["Icon libraries"], library);
		}
		assert.deepEqual(names("download"), ["Icon libraries"], "the sentence says where to download");
	});
});

describe("pressing Manage libraries in the settings", () => {
	it("reads the pack files, counts the icons and opens the window with no callout being edited", async () => {
		const { ctx, plugin, steps } = setup();
		const restoreIndexes = stubSourceIndexes((id) => ICON_SOURCE_IDS.indexOf(id) + 100);
		let seen: IconLibrariesHost | undefined;
		const restoreWindow = standInForLibrariesWindow((host) => {
			steps.push("open");
			seen = host;
			return false;
		});
		try {
			const { harness } = drawRow(ctx);
			buttonOf(harness).press();
			await setImmediate();
			assert.deepEqual(steps, ["read", "open"]);
			assert.ok(seen);
			assert.equal(seen.settings, plugin.settings, "the window edits the plugin's own library settings");
			assert.equal(seen.editing, undefined, "no editor is open behind the settings");
			ICON_SOURCE_IDS.forEach((id, index) => assert.equal(seen?.countFor(id), index + 100, `the count of ${id}`));
		} finally {
			restoreWindow();
			restoreIndexes();
		}
	});

	it("opens the window without a count for a library whose index cannot be read", async () => {
		const { ctx, steps } = setup();
		const restoreIndexes = stubSourceIndexes((id) => (id === "emoji" ? new Error("no index") : 7));
		const warn = console.warn;
		console.warn = () => {};
		let seen: IconLibrariesHost | undefined;
		const restoreWindow = standInForLibrariesWindow((host) => {
			steps.push("open");
			seen = host;
			return false;
		});
		try {
			buttonOf(drawRow(ctx).harness).press();
			await setImmediate();
			assert.deepEqual(steps, ["read", "open"], "one missing count does not stop the window");
			assert.equal(seen?.countFor("emoji"), undefined);
			assert.equal(seen?.countFor("lucide"), 7);
		} finally {
			console.warn = warn;
			restoreWindow();
			restoreIndexes();
		}
	});
});

describe("while a callout editor is open", () => {
	it("dims the button, and only while it is open", () => {
		const open = drawRow(setup({ editorOpen: true }).ctx);
		assert.equal(isDimmed(buttonOf(open.harness)), true);
		const closed = drawRow(setup({ editorOpen: false }).ctx);
		assert.equal(isDimmed(buttonOf(closed.harness)), false);
	});

	it("explains instead of opening the window, and reads nothing", async () => {
		const { ctx, steps } = setup({ editorOpen: true });
		const restoreWindow = standInForLibrariesWindow(() => {
			steps.push("open");
			return false;
		});
		try {
			buttonOf(drawRow(ctx).harness).press();
			await setImmediate();
			assert.deepEqual(steps, [], "no file was read and no window opened");
			assert.equal(String(Notice.last?.message), t("settings.iconLibrariesEditorOpen"));
		} finally {
			restoreWindow();
		}
	});

	it("asks again at the press, so an editor closed since the page was drawn no longer blocks it", async () => {
		const { ctx, plugin, steps } = setup({ editorOpen: true });
		const restoreIndexes = stubSourceIndexes(() => 1);
		const restoreWindow = standInForLibrariesWindow(() => {
			steps.push("open");
			return false;
		});
		try {
			const { harness } = drawRow(ctx);
			plugin.settingsEditOpen = false;
			buttonOf(harness).press();
			await setImmediate();
			assert.deepEqual(steps, ["read", "open"]);
		} finally {
			restoreWindow();
			restoreIndexes();
		}
	});
});
