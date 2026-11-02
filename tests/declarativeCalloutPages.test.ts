/**
 * tests/declarativeCalloutPages.test.ts — the user's own callouts as the
 * declarative settings draw them (settings/declarative/calloutPages.ts): the
 * My callout types page, its Scan row, and Add new callout.
 *
 * Drawn through the test renderer, so what is checked is what Obsidian would
 * show and find: the count on the page's row, the callouts A→Z as the same
 * rows as on the old page, the list's search and the settings search finding a
 * callout by any of its ids, a row drawn again without a second icon or a
 * second menu, the grey row when there is none, Scan saying "Scanning…", and
 * what saving being paused leaves usable.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type RenderedBox } from "./support/declarativeRenderer";
import { PluginSettingTab, Setting, type ButtonLike } from "./support/obsidianStub";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { addCalloutRow, CALLOUT_PAGES, myCalloutsPage } from "../src/settings/declarative/calloutPages";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import { drawCalloutRow } from "../src/settings/sections/CalloutRowRenderer";
import type { CalloutDefinition } from "../src/types";

installFakeDom();

/** One of the user's callouts. */
function callout(id: string, displayName: string, aliases?: string[]): CalloutDefinition {
	return {
		id,
		displayName,
		aliases,
		icon: { type: "emoji", value: "📌" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	};
}

/** A plugin with a real registry holding `callouts`, and a scan the test finishes. */
function fakePlugin(callouts: CalloutDefinition[], paused = false) {
	const registry = new CalloutRegistry();
	registry.load(null);
	for (const def of callouts) registry.add(def);
	let finishScan: (added: number) => void = () => {};
	const plugin = {
		app: {},
		registry,
		get settings() { return registry.settings; },
		settingsWriter: { isFrozen: paused },
		runVaultScan: () => new Promise<number>((resolve) => { finishScan = resolve; }),
	};
	return { plugin, registry, finishScan: (added: number) => finishScan(added) };
}

/** A context for the tree, counting the redraws it asks for. */
function treeContext(plugin: object, redraw: () => void): TreeContext {
	return {
		app: {} as never,
		plugin: plugin as never,
		redraw: redraw,
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
}

/** The main page's two rows (Add new callout, My callout types), drawn by the test renderer. */
function drawMine(plugin: object) {
	let redraws = 0;
	const ctx = treeContext(plugin, () => { redraws++; tab.update(); });
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([
		{ type: "group", id: "callouts", items: [myCalloutsPage(ctx), addCalloutRow(ctx)] },
	]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness, redraws: () => redraws };
}

/** The page's list of callouts. */
function list(harness: DeclarativeHarness): RenderedBox {
	const box = harness.rendered.find((b) => b.def.id === CALLOUT_PAGES.mineList);
	assert.ok(box, "no list");
	return box;
}

/** Type `query` into the list's own search field. */
function searchList(box: RenderedBox, query: string): void {
	const input = box.searchInputEl!;
	input.value = query;
	(input as unknown as { fire(type: string): void }).fire("input");
}

/** Collect the notices shown while `run` runs. */
async function noticesDuring(run: () => Promise<void> | void): Promise<string[]> {
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
	try { await run(); } finally { delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__; }
	return notices;
}

const RECITE = callout("recite", "Recite", ["quote2"]);
const AGENDA = callout("agenda", "Agenda");

describe("My callout types", () => {
	it("says how many on its row, and lists them A→Z as callout rows", () => {
		const { harness } = drawMine(fakePlugin([RECITE, AGENDA]).plugin);
		const entry = harness.row(t("settings.myCalloutTypes"))!;
		assert.equal(entry.settingEl.querySelector(".setting-item-value")?.textContent, "2 callouts");
		harness.openPage([CALLOUT_PAGES.mine]);
		// Obsidian's list box (`mod-list`) is what keeps a row one line, in a
		// narrow tab and on a phone; styles.css no longer does it.
		assert.ok(list(harness).groupEl.hasClass("mod-list"), "in Obsidian's list box");
		const rows = list(harness).children;
		assert.deepEqual(rows.map((row) => row.def.name), ["Agenda", "Recite"]);
		for (const row of rows) {
			assert.ok(row.settingEl.hasClass("cs-callout-row"));
			assert.ok(row.settingEl.firstElementChild?.hasClass("callout-studio-row-icon"), "the icon first");
		}
	});

	it("filters by name or by id in its own search, and keeps doing so after a redraw", () => {
		const { tab, harness } = drawMine(fakePlugin([RECITE, AGENDA]).plugin);
		harness.openPage([CALLOUT_PAGES.mine]);
		tab.update();
		const shown = (): string[] => list(harness).children.filter((row) => row.settingEl.isShown()).map((row) => row.def.name ?? "");
		searchList(list(harness), "QUOTE2");
		assert.deepEqual(shown(), ["Recite"]);
		searchList(list(harness), "agen");
		assert.deepEqual(shown(), ["Agenda"]);
	});

	it("is where the settings search finds a callout, by name or by id", () => {
		const { tab } = drawMine(fakePlugin([RECITE, AGENDA]).plugin);
		const names = (query: string): string[] => searchSettings(tab.settingItems, query).map((hit) => hit.name);
		assert.deepEqual(names("recite"), ["Recite"]);
		assert.deepEqual(names("quote2"), ["Recite"]);
	});

	it("draws a row again without a second icon", () => {
		const { tab, harness } = drawMine(fakePlugin([RECITE]).plugin);
		harness.openPage([CALLOUT_PAGES.mine]);
		tab.update();
		tab.update();
		const row = list(harness).children[0]!;
		assert.equal(row.settingEl.querySelectorAll(".callout-studio-row-icon").length, 1);
	});

	it("shows Obsidian's grey row when there is none", () => {
		const { harness } = drawMine(fakePlugin([]).plugin);
		// No count at none: Obsidian draws no value at all.
		assert.equal(harness.row(t("settings.myCalloutTypes"))!.settingEl.querySelector(".setting-item-value"), null);
		harness.openPage([CALLOUT_PAGES.mine]);
		assert.equal(list(harness).emptyStateEl?.textContent, t("settings.noCalloutsNow"));
	});

	it("says Scanning… while a scan runs, and draws again when it ends", async () => {
		const { plugin, finishScan } = fakePlugin([RECITE]);
		const { harness, redraws } = drawMine(plugin);
		harness.openPage([CALLOUT_PAGES.mine]);
		const scanName = (): string | null | undefined => harness.rows().find((row) => row.def.id === CALLOUT_PAGES.scanRow)?.setting.nameEl.textContent;
		assert.equal(scanName(), t("settings.rescanVaultHintAction"));
		await noticesDuring(async () => {
			harness.rows().find((row) => row.def.id === CALLOUT_PAGES.scanRow)!.settingEl.click();
			assert.equal(scanName(), t("manualDiscovery.scanning"));
			// The scan starts once "Scanning…" has been drawn, one wait later.
			await new Promise((resolve) => setImmediate(resolve));
			finishScan(0);
			for (let i = 0; i < 5; i++) await Promise.resolve();
		});
		assert.equal(redraws(), 2);
		assert.equal(scanName(), t("settings.rescanVaultHintAction"));
	});
});

describe("a callout row drawn twice on the same setting", () => {
	it("opens one menu per right-click, not one per draw", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(RECITE);
		const ctx = { app: {}, plugin: { app: {}, registry, settings: registry.settings } } as never;
		const opened: string[] = [];
		const handlers = { onEdit: () => {}, onOpenBuiltInMenu: () => {}, onOpenUserMenu: (_: unknown, def: CalloutDefinition) => { opened.push(def.id); } };
		const setting = new Setting(createDiv() as never);
		const undo = drawCalloutRow(ctx, setting as never, RECITE, "user", handlers);
		// What Obsidian does to redraw a row: its cleanup, then `clear()`, then draw.
		undo();
		setting.clear();
		drawCalloutRow(ctx, setting as never, RECITE, "user", handlers);
		const rowEl = setting.settingEl as unknown as { fire(type: string, init: object): void; querySelectorAll(sel: string): unknown[] };
		rowEl.fire("contextmenu", { preventDefault: () => {}, clientX: 0, clientY: 0 });
		assert.deepEqual(opened, ["recite"]);
		assert.equal(rowEl.querySelectorAll(".callout-studio-row-icon").length, 1);
	});
});

describe("while saving is paused", () => {
	it("leaves the rows as they are, dims only ✎, and has + , Scan and Add new callout say why", async () => {
		const { plugin, registry } = fakePlugin([RECITE], true);
		const { harness } = drawMine(plugin);
		const notices = await noticesDuring(() => {
			harness.row(t("settings.addNewCallout"))!.settingEl.click();
			harness.openPage([CALLOUT_PAGES.mine]);
			const row = list(harness).children[0]!;
			assert.equal(row.settingEl.hasClass("is-disabled"), false, "the row is not faded");
			const [edit, menu] = row.setting.extraButtons;
			assert.equal((edit!.extraSettingsEl as unknown as HTMLElement).getAttribute("aria-disabled"), "true");
			assert.notEqual((menu!.extraSettingsEl as unknown as HTMLElement).getAttribute("aria-disabled"), "true", "⋮ still opens");
			edit!.press();
			(list(harness).settingGroup.extraButtons[0] as ButtonLike).press();
			harness.rows().find((r) => r.def.id === CALLOUT_PAGES.scanRow)!.settingEl.click();
		});
		assert.equal(notices.length, 4);
		assert.equal(registry.getUserDefined().length, 1);
	});
});
