/**
 * tests/declarativePalettesPage.test.ts — the Saved color palettes page, as
 * the declarative settings draw it (settings/declarative/palettesPage.ts).
 *
 * Drawn through the test renderer, so what is checked is what Obsidian would
 * show: the entry's count, the palettes A→Z with their colours first, ✎ and
 * Obsidian's ✕, the empty row, the settings search finding a palette by name,
 * ✕ asking before it deletes, and nothing changing while saving is paused.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type RenderedBox } from "./support/declarativeRenderer";
import { PluginSettingTab, type ButtonLike } from "./support/obsidianStub";
import { stubConfirm } from "./support/importSafetyStubs";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { PALETTES_PAGE, palettesPage } from "../src/settings/declarative/palettesPage";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { CustomPalette } from "../src/types";

installFakeDom();

/** A palette with the fields `CustomPalette` requires. */
function palette(id: string, name: string): CustomPalette {
	return {
		id,
		name,
		colorLight: "#336699",
		colorDark: "#88bbee",
		bgColorLight: "#eef3f8",
		bgColorDark: "#1a2733",
		textColorLight: "#000000",
		textColorDark: "#ffffff",
	};
}

/** A plugin with a real registry holding `names` as palettes (added in this order). */
function fakePlugin(names: string[], paused = false) {
	const registry = new CalloutRegistry();
	registry.load(null);
	names.forEach((name, i) => registry.settings.customPalettes.push(palette(`p${i}`, name)));
	const saves: number[] = [];
	const plugin = {
		registry,
		get settings() { return registry.settings; },
		settingsWriter: { isFrozen: paused },
		saveSettings: () => { saves.push(1); return Promise.resolve(); },
		// What the delete question reads to name a palette's metadata word.
		cssInjector: { metadataCatalog: { snippetWords: () => new Set<string>(), sourcesNow: () => [] } },
	};
	return { plugin, registry, saves };
}

/** The entry on a page of its own, drawn by the test renderer. */
function drawPalettes(plugin: object) {
	let redraws = 0;
	const ctx: TreeContext = {
		app: {} as never,
		plugin: plugin as never,
		display: () => { redraws++; tab.update(); },
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([{ type: "group", id: "style", items: [palettesPage(ctx)] }]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness, redraws: () => redraws };
}

/** The entry's value: what Obsidian shows at the end of the row that opens the page. */
function entryValue(harness: DeclarativeHarness): string {
	const entry = harness.row(t("settings.customPalettes"))!;
	return entry.settingEl.querySelector(".setting-item-value")?.textContent ?? "";
}

/** The page's one box, the list. */
function list(harness: DeclarativeHarness): RenderedBox {
	const box = harness.rendered.find((b) => b.def.id === PALETTES_PAGE.list);
	assert.ok(box, "no palette list");
	return box;
}

/** Wait for the flows a button started (a question, then a save). */
async function settle(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("the entry on the main page", () => {
	it("says how many palettes there are", () => {
		assert.equal(entryValue(drawPalettes(fakePlugin(["Ocean", "Forest", "Sand"]).plugin).harness), "3 palettes");
		assert.equal(entryValue(drawPalettes(fakePlugin(["Ocean"]).plugin).harness), "1 palette");
		assert.equal(entryValue(drawPalettes(fakePlugin([]).plugin).harness), "");
	});
});

describe("the page", () => {
	it("lists the palettes A→Z, each starting with its colours, with ✎ and Obsidian's ✕", () => {
		const { harness } = drawPalettes(fakePlugin(["Sand", "Ocean", "Forest"]).plugin);
		harness.openPage([PALETTES_PAGE.page]);
		const rows = list(harness).children;
		assert.deepEqual(rows.map((row) => row.def.name), ["Forest", "Ocean", "Sand"]);
		for (const row of rows) {
			assert.ok(row.settingEl.firstElementChild?.hasClass("cs-color-circles"), "colours first");
			const [edit, remove] = row.setting.extraButtons;
			// The stub keeps a tooltip in `data-cs-tooltip`; Obsidian's is also the button's name.
			assert.equal((edit!.extraSettingsEl as unknown as HTMLElement).dataset.csTooltip, t("settings.editPaletteAria", { name: row.def.name ?? "" }));
			assert.ok((remove!.extraSettingsEl as unknown as HTMLElement).hasClass("cs-test-delete"), "Obsidian's ✕ last");
		}
	});

	it("draws again without doubling the colours", () => {
		const { tab, harness } = drawPalettes(fakePlugin(["Ocean", "Forest"]).plugin);
		harness.openPage([PALETTES_PAGE.page]);
		tab.update();
		tab.update();
		for (const row of list(harness).children) {
			assert.equal(row.settingEl.querySelectorAll(".cs-color-circles").length, 1);
		}
	});

	it("shows Obsidian's empty row when there is none", () => {
		const { harness } = drawPalettes(fakePlugin([]).plugin);
		harness.openPage([PALETTES_PAGE.page]);
		assert.equal(list(harness).emptyStateEl?.textContent, t("settings.customPalettesEmpty"));
	});

	it("is where the settings search finds a palette by its name", () => {
		const { tab } = drawPalettes(fakePlugin(["Ocean", "Forest"]).plugin);
		const hits = searchSettings(tab.settingItems, "ocean").map((hit) => hit.name);
		assert.deepEqual(hits, ["Ocean"]);
	});

	it("deletes on ✕ only after a yes, saying how many callouts link to the palette", async () => {
		const { plugin, registry, saves } = fakePlugin(["Ocean", "Forest"]);
		const { harness, redraws } = drawPalettes(plugin);
		harness.openPage([PALETTES_PAGE.page]);
		const confirm = stubConfirm(false);
		try {
			// Row 1 is Ocean (A→Z: Forest, Ocean).
			list(harness).settingGroup.pressDelete(1);
			await settle();
			assert.deepEqual(confirm.messages, [t("settings.deletePaletteConfirm", { name: "Ocean" })]);
			assert.equal(registry.settings.customPalettes.length, 2, "a no keeps it");
		} finally { confirm.restore(); }
		const yes = stubConfirm(true);
		try {
			list(harness).settingGroup.pressDelete(1);
			await settle();
			assert.deepEqual(registry.settings.customPalettes.map((p) => p.name), ["Forest"]);
			assert.equal(saves.length, 1);
			assert.equal(redraws(), 1);
		} finally { yes.restore(); }
	});
});

describe("while saving is paused", () => {
	it("+ and ✕ explain instead of acting, and ✎ is dimmed and explains", async () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		const confirm = stubConfirm(true);
		try {
			const { plugin, registry } = fakePlugin(["Ocean"], true);
			const { harness } = drawPalettes(plugin);
			harness.openPage([PALETTES_PAGE.page]);
			const box = list(harness);
			(box.settingGroup.extraButtons[0] as ButtonLike).press();
			box.settingGroup.pressDelete(0);
			const edit = box.children[0]!.setting.extraButtons[0] as ButtonLike;
			assert.equal((edit.extraSettingsEl as unknown as HTMLElement).getAttribute("aria-disabled"), "true");
			edit.press();
			await settle();
			assert.equal(notices.length, 3, "each press says why");
			assert.deepEqual(confirm.asked, [], "no question was asked");
			assert.equal(registry.settings.customPalettes.length, 1);
		} finally {
			confirm.restore();
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});
});
