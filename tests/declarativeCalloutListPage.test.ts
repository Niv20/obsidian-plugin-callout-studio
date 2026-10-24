/**
 * tests/declarativeCalloutListPage.test.ts — the Built-in callouts and
 * Callouts from your theme pages, which the plugin draws itself
 * (settings/declarative/calloutListPage.ts).
 *
 * What is checked: the rows that open them (their counts, and the theme's
 * showing only while the theme styles a callout), that their callouts stay out
 * of the settings search while the pages' own search field finds them, that an
 * open page draws its rows again when the callouts change (and keeps what is
 * typed in its search field), that it stops once left, and what each page says
 * when it has no rows.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings } from "./support/declarativeRenderer";
import { PluginSettingTab } from "./support/obsidianStub";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	builtInCalloutsPage,
	CALLOUT_LIST_PAGES,
	CalloutListPage,
	themeCalloutsPage,
} from "../src/settings/declarative/calloutListPage";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import type { Scheduler } from "../src/settings/declarative/treeUpdater";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";

installFakeDom();

/** An app in the community theme `theme` (or Obsidian's default theme with none). */
function fakeApp(theme?: string) {
	return {
		customCss: { theme: theme ?? "" },
		workspace: { on: () => ({}), offref: () => {} },
	};
}

/** A tree context around a real registry (with its built-ins loaded). */
function treeContext(app: object) {
	const registry = new CalloutRegistry();
	registry.load(null);
	const plugin = {
		app,
		registry,
		get settings() { return registry.settings; },
		settingsWriter: { isFrozen: false },
		onIconCacheChange: () => () => {},
	};
	const ctx: TreeContext = {
		app: app as never,
		plugin: plugin as never,
		display: () => {},
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	return { ctx, registry };
}

/** A scheduler that waits until the test says to run. */
function manualSchedule() {
	const waiting: (() => void)[] = [];
	const schedule: Scheduler = (run) => {
		waiting.push(run);
		return () => { waiting.splice(waiting.indexOf(run), 1); };
	};
	const flush = (): void => { for (const run of waiting.splice(0)) run(); };
	return { schedule, flush, pending: () => waiting.length };
}

/** The two rows that open the pages, drawn by the test renderer. */
function drawEntries(ctx: TreeContext) {
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([
		{ type: "group", id: "callouts", items: [themeCalloutsPage(ctx), builtInCalloutsPage(ctx)] },
	]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness };
}

/**
 * The names of the callout rows a page shows (hidden ones left out): the
 * name's own text, without the Default flair after it.
 */
function shownNames(page: CalloutListPage): string[] {
	const TEXT_NODE = 3;
	return Array.from(page.containerEl.querySelectorAll<HTMLElement>(".cs-callout-row"))
		.filter((row) => row.isShown())
		.map((row) => Array.from(row.querySelector(".setting-item-name")?.childNodes ?? [])
			.filter((node) => node.nodeType === TEXT_NODE)
			.map((node) => node.textContent)
			.join(""));
}

/** Type `query` into the page's own search field. */
function searchPage(page: CalloutListPage, query: string): void {
	const input = page.containerEl.querySelector<HTMLInputElement>(".search-input-container input")!;
	input.value = query;
	(input as unknown as { fire(type: string): void }).fire("input");
}

describe("the rows that open the pages", () => {
	it("say how many callouts each holds, and the theme's shows only while the theme styles one", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		const value = (harness: DeclarativeHarness, name: string): string | null | undefined =>
			harness.row(name)?.settingEl.querySelector(".setting-item-value")?.textContent;
		let { harness } = drawEntries(ctx);
		const builtIns = registry.getBuiltIn().length;
		assert.equal(value(harness, t("settings.builtInCallouts")), `${builtIns} callouts`);
		assert.equal(harness.row(t("settings.themeCalloutsHeading"))!.settingEl.isShown(), false);
		registry.setThemeOwnedIds(new Set(["note"]));
		({ harness } = drawEntries(ctx));
		assert.equal(harness.row(t("settings.themeCalloutsHeading"))!.settingEl.isShown(), true);
		assert.equal(value(harness, t("settings.themeCalloutsHeading")), "1 callout");
		assert.equal(value(harness, t("settings.builtInCallouts")), `${builtIns - 1} callouts`);
	});

	it("leave the callouts out of the settings search", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		registry.setThemeOwnedIds(new Set(["note"]));
		const { tab } = drawEntries(ctx);
		assert.deepEqual(searchSettings(tab.settingItems, "note").map((hit) => hit.name), []);
		assert.deepEqual(searchSettings(tab.settingItems, "warning").map((hit) => hit.name), []);
	});
});

describe("Built-in callouts", () => {
	it("opens on the built-ins A→Z, which its own search filters by name or id", () => {
		const { ctx, registry } = treeContext(fakeApp());
		const { harness } = drawEntries(ctx);
		harness.openPage([CALLOUT_LIST_PAGES.builtIn]);
		const page = harness.customPage as unknown as CalloutListPage;
		const expected = registry.getBuiltIn().map((def) => def.displayName).sort((a, b) => a.localeCompare(b));
		assert.deepEqual(shownNames(page), expected);
		searchPage(page, "caution");
		assert.deepEqual(shownNames(page), ["Warning"]);
	});

	it("draws its rows again when the callouts change, keeping the search, and stops once left", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		const { schedule, flush, pending } = manualSchedule();
		const page = new CalloutListPage(ctx, "builtin", schedule);
		page.display();
		searchPage(page, "no");
		assert.deepEqual(shownNames(page), ["Note"]);
		// The theme takes Note: an announced change, as a real theme switch is.
		registry.setThemeOwnedIds(new Set(["note"]));
		assert.equal(pending(), 1);
		flush();
		assert.deepEqual(shownNames(page), [], "Note left the page, and the search still holds \"no\"");
		page.hide();
		registry.setThemeOwnedIds(new Set());
		assert.equal(pending(), 0, "a left page no longer listens");
	});

	it("says every built-in is the theme's when the theme styles them all", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		registry.setThemeOwnedIds(new Set(registry.getBuiltIn().map((def) => def.id)));
		const page = new CalloutListPage(ctx, "builtin", manualSchedule().schedule);
		page.display();
		assert.equal(page.containerEl.querySelector(".mod-empty-state .setting-item-name")?.textContent, t("settings.builtInAllThemeStyled", { theme: "Minimal" }));
		assert.equal(page.containerEl.querySelector(".search-input-container"), null, "no search without rows");
		page.hide();
	});
});

describe("Callouts from your theme", () => {
	it("names the theme above its rows, which are the theme's (👁, not ✎)", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		registry.setThemeOwnedIds(new Set(["note"]));
		const page = new CalloutListPage(ctx, "theme", manualSchedule().schedule);
		page.display();
		assert.match(page.containerEl.textContent ?? "", /Minimal/);
		assert.deepEqual(shownNames(page), ["Note"]);
		const row = page.containerEl.querySelector<HTMLElement>(".cs-callout-row")!;
		assert.equal(row.querySelector('[data-cs-tooltip^="Edit"]'), null, "no ✎ on a theme's row");
		page.hide();
	});
});
