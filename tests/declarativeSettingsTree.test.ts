/**
 * tests/declarativeSettingsTree.test.ts — the whole settings tab as the tree
 * Obsidian draws (SettingsTab.ts's `getSettingDefinitions()`,
 * declarative/declarativeSettings.ts, declarative/settingsTree.ts).
 *
 * Drawn through the test renderer with the real tab and a fake plugin around a
 * real registry. What is checked: the main page's boxes in order, and no two
 * boxes or rows sharing a key on any page; the visit (one version in the
 * history) starting once per opening of the tab and ending when it is left;
 * what the settings search finds, and that it leaves the built-in callouts
 * out; a change in the registry drawing the page again on the next frame; and
 * everything stopping when the plugin unloads.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { App } from "obsidian";
import { installFakeDom, type FakeWindow } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type LooseDef } from "./support/declarativeRenderer";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsSaveStatus } from "../src/manager/settingsSaveStatus";
import { CalloutStudioSettingsTab } from "../src/settings/SettingsTab";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import type { CalloutDefinition } from "../src/types";

installFakeDom();

// The language row watches its layout, which the fake DOM cannot; the style
// pages' preview draws its static fallback, and says so once.
const saved = {
	style: Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle"),
	observer: Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver"),
	warn: console.warn,
};
before(() => {
	Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: () => ({ flexDirection: "row" }) });
	Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: class { observe(): void {} disconnect(): void {} } });
	console.warn = (...args: unknown[]) => {
		if (String(args[0]).includes("embedded live preview unavailable")) return;
		saved.warn(...args);
	};
});
after(() => {
	for (const [key, descriptor] of [["getComputedStyle", saved.style], ["ResizeObserver", saved.observer]] as const) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
	console.warn = saved.warn;
});

/** One of the user's callouts. */
const RECITE: CalloutDefinition = {
	id: "recite",
	displayName: "Recite",
	icon: { type: "emoji", value: "📌" },
	colorLight: "#336699",
	colorDark: "#88bbee",
	foldable: true,
	defaultFolded: false,
	builtIn: false,
	source: "user",
};

/** A plugin with what the whole tree reads, around a real registry. */
function fakePlugin() {
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.add(RECITE);
	const visits = { opened: 0, ended: 0 };
	const unloads: (() => void)[] = [];
	const app = { workspace: { on: () => ({}), offref: () => {} }, customCss: { theme: "" } };
	const plugin = {
		app,
		registry,
		get settings() { return registry.settings; },
		settingsWriter: {
			isFrozen: false,
			status: new SettingsSaveStatus(),
			openVisit: () => {
				visits.opened++;
				return () => { visits.ended++; };
			},
		},
		locales: { isReady: () => true, state: () => "ready", onChange: () => () => {} },
		customCommands: { list: () => [] },
		manifest: { id: "callout-studio", name: "Callout Studio", version: "2.18.0" },
		recovery: {},
		onIconCacheChange: () => () => {},
		cssInjector: { inject: () => {}, metadataCatalog: { snippetWords: () => new Set<string>(), sourcesNow: () => [] } },
		saveSettings: () => Promise.resolve(),
		register: (unload: () => void) => { unloads.push(unload); },
	};
	return { plugin, app, registry, visits, unload: () => unloads.forEach((unload) => unload()) };
}

/** The tab, with the test renderer drawing what Obsidian would. */
function drawTab() {
	const made = fakePlugin();
	const tab = new CalloutStudioSettingsTab(made.app as unknown as App, made.plugin as unknown as SettingsTabPlugin);
	const harness = new DeclarativeHarness(tab as never);
	tab.update();
	return { ...made, tab, harness };
}

/** Every page in the tree (that the plugin does not draw itself), as page-id paths. */
function itemsPages(items: LooseDef[], path: string[] = []): string[][] {
	const found: string[][] = [];
	for (const item of items) {
		if (item.type === "page" && item.items) {
			const here = [...path, item.id ?? ""];
			found.push(here, ...itemsPages(item.items, here));
		} else if (item.items) {
			found.push(...itemsPages(item.items, path));
		}
	}
	return found;
}

/** The fake window the tab's frames come from. */
const win = (tab: CalloutStudioSettingsTab): FakeWindow => tab.containerEl.ownerDocument.defaultView as unknown as FakeWindow;

describe("the settings tab as a tree", () => {
	it("lays the main page out in its boxes, in order", () => {
		const { harness } = drawTab();
		assert.deepEqual(harness.rendered.map((box) => box.def.id), [
			"banners", "callouts", "colors-and-icons", "callout-style", "menus-and-commands",
			"import-export", "danger-zone", "footer",
		]);
		assert.equal(harness.rendered[0]!.groupEl.isShown(), false, "no notices, so no box");
	});

	it("keeps what callouts are drawn from together, under the callouts and before the global styling", () => {
		const { harness } = drawTab();
		const box = (id: string) => harness.rendered.find((candidate) => candidate.def.id === id)!;
		const rowsOf = (id: string): (string | undefined)[] => box(id).children.map((row) => row.def.name);
		// The saved palettes (a page) and the icon libraries (a row that opens the
		// window Pick an icon opens too) - the two things a callout's color and icon come from.
		assert.equal(box("colors-and-icons").def.heading, t("settings.colorsAndIcons"));
		assert.deepEqual(rowsOf("colors-and-icons"), [t("settings.customPalettes"), t("iconLibraries.title")]);
		// The first box is the callouts and the fallback, no longer the palettes.
		assert.equal(rowsOf("callouts").includes(t("settings.customPalettes")), false);
		assert.ok(rowsOf("callouts").includes(t("settings.fallbackCallout")));
		assert.ok(rowsOf("callouts").includes(t("settings.myCalloutTypes")));
	});

	it("marks every box, at every depth, with the plugin's box class and keeps the classes it had", () => {
		const { tab, harness } = drawTab();
		for (const box of harness.rendered) assert.ok(box.groupEl.hasClass("cs-box"), `${box.def.id} carries the box class`);
		assert.ok(harness.rendered.find((box) => box.def.id === "callouts")!.groupEl.hasClass("cs-callouts-box"), "and keeps the class it already had");
		// The pages' own boxes too (the lists, the style pages' groups).
		const pageBoxes = (items: LooseDef[]): LooseDef[] => items.flatMap((item) => [
			...(item.type === "group" || item.type === "list" ? [item] : []),
			...pageBoxes(item.items ?? []),
		]);
		const boxes = pageBoxes(tab.settingItems as LooseDef[]);
		assert.ok(boxes.length > 10, "the tree has many boxes");
		assert.deepEqual(boxes.filter((box) => !(box.cls ?? "").split(" ").includes("cs-box")).map((box) => box.id), []);
	});

	it("has no Add new callout and no theme switch on the main page: the list's + adds a callout, the theme's page holds the switch", () => {
		const { harness } = drawTab();
		const names = harness.rendered.flatMap((box) => box.children.map((row) => row.def.name));
		assert.equal(names.includes("Add new callout"), false);
		assert.equal(names.includes("Use your theme's callout styles"), false);
		assert.equal(names.includes("Language"), false, "the language is the footer's globe now");
	});

	it("keys every box and row apart, on every page", () => {
		const { tab, harness } = drawTab();
		const pages = itemsPages(tab.settingItems as LooseDef[]);
		// Built-in callouts and the theme's are drawn by the plugin, so they are not here.
		assert.deepEqual(pages.map((path) => path.join(" › ")).sort(), [
			"autocomplete-and-metadata", "callouts-mine", "commands", "palettes", "right-click-menu", "style-block",
			"style-heading", "style-inline",
		]);
		for (const path of pages) harness.openPage(path);
		assert.deepEqual(harness.duplicateKeys, []);
	});

	it("starts one visit per opening of the tab, and ends it when the tab is left", () => {
		const { tab, visits } = drawTab();
		assert.equal(visits.opened, 1);
		tab.update();
		assert.equal(visits.opened, 1, "a redraw is the same visit");
		tab.hide();
		assert.equal(visits.ended, 1);
		tab.update();
		assert.equal(visits.opened, 2, "opened again");
	});

	it("is what the settings search finds, without the built-in callouts", () => {
		const { tab } = drawTab();
		const names = (query: string): string[] => searchSettings(tab.settingItems, query).map((hit) => hit.name);
		assert.ok(names("fallback").includes(t("settings.fallbackCallout")));
		assert.ok(names("palette").includes(t("settings.customPalettes")));
		assert.deepEqual(names("recite"), ["Recite"]);
		assert.ok(names("corner").length >= 3);
		assert.ok(!names("warning").includes("Warning"), "a built-in callout is not a search result");
	});

	it("draws the page again on the next frame when a callout is added, and stops when the plugin unloads", () => {
		const { tab, harness, registry, unload } = drawTab();
		const before = (tab as unknown as { updateCount: number }).updateCount;
		registry.add({ ...RECITE, id: "memo", displayName: "Memo" });
		win(tab).flushFrames();
		assert.equal((tab as unknown as { updateCount: number }).updateCount, before + 1);
		assert.ok(harness.rows().some((row) => row.def.name === t("settings.myCalloutTypes")));
		assert.deepEqual(searchSettings(tab.settingItems, "memo").map((hit) => hit.name), ["Memo"]);
		unload();
		registry.add({ ...RECITE, id: "later", displayName: "Later" });
		win(tab).flushFrames();
		win(tab).flushTimers();
		assert.equal((tab as unknown as { updateCount: number }).updateCount, before + 1, "nothing after the unload");
	});
});
