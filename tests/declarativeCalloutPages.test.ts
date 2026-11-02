/**
 * tests/declarativeCalloutPages.test.ts — the user's own callouts as the
 * declarative settings draw them (settings/declarative/calloutPages.ts): the
 * My callout types page and its Scan row. (The main page has no Add new
 * callout of its own: the list's + adds one.)
 *
 * Drawn through the test renderer, so what is checked is what Obsidian would
 * show and find: the count on the page's row, the callouts A→Z as the same
 * rows as on the old page, the list's search and the settings search finding a
 * callout by any of its ids, the row that says nothing matches while a search
 * finds nothing, a row drawn again without a second icon or a second menu, the
 * grey row when there is none, Scan saying "Scanning…", and what saving being
 * paused leaves usable.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type RenderedBox } from "./support/declarativeRenderer";
import { PluginSettingTab, Setting, type ButtonLike } from "./support/obsidianStub";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CALLOUT_PAGES, myCalloutsPage } from "../src/settings/declarative/calloutPages";
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

/** The main page's row that opens My callout types, drawn by the test renderer. */
function drawMine(plugin: object) {
	let redraws = 0;
	const ctx = treeContext(plugin, () => { redraws++; tab.update(); });
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([
		{ type: "group", id: "callouts", items: [myCalloutsPage(ctx)] },
	]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness, redraws: () => redraws };
}

/** The page's list of callouts (under its own id while it has none). */
function list(harness: DeclarativeHarness): RenderedBox {
	const box = harness.rendered.find((b) => b.def.id === CALLOUT_PAGES.mineList || b.def.id === CALLOUT_PAGES.mineListEmpty);
	assert.ok(box, "no list");
	return box;
}

/** The list's rows that are callouts: all but the last row, which says nothing matches. */
function calloutRows(box: RenderedBox): RenderedBox["children"] {
	return box.children.filter((row) => row.def.id !== CALLOUT_PAGES.noMatches);
}

/** The row that says nothing matches. */
function noMatchesRow(box: RenderedBox): RenderedBox["children"][number] {
	const row = box.children.find((child) => child.def.id === CALLOUT_PAGES.noMatches);
	assert.ok(row, "no row for a search that finds nothing");
	return row;
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
		const rows = calloutRows(list(harness));
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
		const shown = (): string[] => calloutRows(list(harness)).filter((row) => row.settingEl.isShown()).map((row) => row.def.name ?? "");
		searchList(list(harness), "QUOTE2");
		assert.deepEqual(shown(), ["Recite"]);
		searchList(list(harness), "agen");
		assert.deepEqual(shown(), ["Agenda"]);
	});

	it("says nothing matches, in a row of its own, only while a search finds nothing", () => {
		const { harness } = drawMine(fakePlugin([RECITE, AGENDA]).plugin);
		harness.openPage([CALLOUT_PAGES.mine]);
		const shown = (): boolean => noMatchesRow(list(harness)).settingEl.isShown();
		assert.equal(shown(), false, "hidden until something is searched for");
		searchList(list(harness), "zzz");
		assert.equal(shown(), true);
		assert.equal(noMatchesRow(list(harness)).setting.nameEl.textContent, t("calloutPicker.noMatches", { query: "zzz" }));
		assert.ok(noMatchesRow(list(harness)).settingEl.hasClass("mod-empty-state"), "Obsidian's grey row");
		// The words follow the query, and the row goes when something matches again.
		searchList(list(harness), "yyy");
		assert.equal(noMatchesRow(list(harness)).setting.nameEl.textContent, t("calloutPicker.noMatches", { query: "yyy" }));
		searchList(list(harness), "agen");
		assert.equal(shown(), false);
		searchList(list(harness), "zzz");
		searchList(list(harness), "");
		assert.equal(shown(), false, "an empty search matches everything");
	});

	it("has the row only while there is a list to search, and it is no result of the settings search", () => {
		const some = drawMine(fakePlugin([RECITE]).plugin);
		some.harness.openPage([CALLOUT_PAGES.mine]);
		assert.equal(list(some.harness).children.some((row) => row.def.id === CALLOUT_PAGES.noMatches), true);
		const none = drawMine(fakePlugin([]).plugin);
		none.harness.openPage([CALLOUT_PAGES.mine]);
		assert.equal(list(none.harness).children.length, 0, "an empty list is only its grey row, which has no search");
		assert.equal(list(none.harness).searchInputEl, undefined);
		// Nothing for the settings search to find: no name, and hidden.
		const names = searchSettings(some.tab.settingItems, "match").map((hit) => hit.name);
		assert.deepEqual(names, []);
	});

	it("gets its search field when a scan finds the first callout, without leaving the page", () => {
		const { plugin, registry } = fakePlugin([]);
		const { tab, harness } = drawMine(plugin);
		harness.openPage([CALLOUT_PAGES.mine]);
		assert.equal(list(harness).searchInputEl, undefined, "nothing to search yet");
		// What a scan does: the callouts arrive in the registry, then the page is drawn again.
		registry.add(RECITE);
		registry.add(AGENDA);
		tab.update();
		assert.ok(list(harness).searchInputEl, "the search field is there for the callouts the scan found");
		assert.equal(list(harness).emptyStateEl, undefined, "and the grey row is gone");
		const shown = (): string[] => calloutRows(list(harness)).filter((row) => row.settingEl.isShown()).map((row) => row.def.name ?? "");
		searchList(list(harness), "quote2");
		assert.deepEqual(shown(), ["Recite"]);
		searchList(list(harness), "zzz");
		assert.equal(noMatchesRow(list(harness)).settingEl.isShown(), true);
	});

	it("takes its search field away with its last callout, and gives it back with the next", () => {
		const { plugin, registry } = fakePlugin([RECITE]);
		const { tab, harness } = drawMine(plugin);
		harness.openPage([CALLOUT_PAGES.mine]);
		assert.ok(list(harness).searchInputEl);
		registry.remove(RECITE.id);
		tab.update();
		assert.equal(list(harness).searchInputEl, undefined, "nothing left to search");
		assert.equal(list(harness).emptyStateEl?.textContent, t("settings.noCalloutsNow"));
		registry.add(AGENDA);
		tab.update();
		assert.ok(list(harness).searchInputEl);
		assert.deepEqual(calloutRows(list(harness)).map((row) => row.def.name), ["Agenda"]);
	});

	it("keeps one search field, and what was typed in it, while the callouts change under it", () => {
		const { plugin, registry } = fakePlugin([RECITE]);
		const { tab, harness } = drawMine(plugin);
		harness.openPage([CALLOUT_PAGES.mine]);
		const field = list(harness).searchInputEl;
		searchList(list(harness), "rec");
		registry.add(AGENDA);
		tab.update();
		assert.equal(list(harness).searchInputEl, field, "the same box, drawn in place");
		assert.equal(list(harness).searchInputEl?.value, "rec");
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
		// "None" at none, where the count would be: the end of the row is never blank.
		assert.equal(harness.row(t("settings.myCalloutTypes"))!.settingEl.querySelector(".setting-item-value")?.textContent, t("recovery.details.value.none"));
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

	it("keeps its icon through the cleanup alone, which is all leaving the page runs", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(RECITE);
		const ctx = { app: {}, plugin: { app: {}, registry, settings: registry.settings } } as never;
		const handlers = { onEdit: () => {}, onOpenBuiltInMenu: () => {}, onOpenUserMenu: () => {} };
		const setting = new Setting(createDiv() as never);
		const undo = drawCalloutRow(ctx, setting as never, RECITE, "user", handlers);
		const rowEl = setting.settingEl as unknown as { querySelector(sel: string): { textContent: string | null } | null };
		const iconBefore = rowEl.querySelector(".callout-studio-row-icon");
		assert.ok(iconBefore?.textContent, "the icon is drawn");
		// Obsidian's `closePage` runs every row's cleanup and only then slides the
		// page away, so an icon taken off here would vanish from a page still in view.
		undo();
		assert.equal(rowEl.querySelector(".callout-studio-row-icon"), iconBefore, "the icon is still there");
		assert.ok(iconBefore?.textContent, "and still drawn");
		// A redraw (cleanup, `clear()`, draw) repaints that same element.
		setting.clear();
		drawCalloutRow(ctx, setting as never, RECITE, "user", handlers);
		assert.equal(rowEl.querySelector(".callout-studio-row-icon"), iconBefore, "a redraw reuses it");
	});
});

describe("while saving is paused", () => {
	it("leaves the rows as they are, dims only ✎, and has ✎, + and Scan say why", async () => {
		const { plugin, registry } = fakePlugin([RECITE], true);
		const { harness } = drawMine(plugin);
		const notices = await noticesDuring(() => {
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
		assert.equal(notices.length, 3);
		assert.equal(registry.getUserDefined().length, 1);
	});
});
