/**
 * tests/declarativeCalloutListPage.test.ts — the Built-in callouts and
 * Callouts from your theme pages, which the plugin draws itself
 * (settings/declarative/calloutListPage.ts).
 *
 * What is checked: the rows that open them (their counts, "None" at none, and
 * the theme's showing only while the theme styles a callout, or while its
 * switch is off, with "Off" where the count would be), that their callouts stay
 * out of the settings search while the pages' own search field finds them, that
 * an open page draws its rows again when the callouts change (and keeps what is
 * typed in its search field), that it stops once left, what each page says when
 * it has no rows, the row that says nothing matches while a search finds
 * nothing, and the switch at the top of the theme's page.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings } from "./support/declarativeRenderer";
import { createdToggles, PluginSettingTab } from "./support/obsidianStub";
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
function treeContext(app: object, options: { paused?: boolean } = {}) {
	const registry = new CalloutRegistry();
	registry.load(null);
	const plugin = {
		app,
		registry,
		get settings() {
			return registry.settings;
		},
		settingsWriter: { isFrozen: options.paused === true },
		onIconCacheChange: () => () => {},
	};
	const ctx: TreeContext = {
		app: app as never,
		plugin: plugin as never,
		redraw: () => {},
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
		return () => {
			waiting.splice(waiting.indexOf(run), 1);
		};
	};
	const flush = (): void => {
		for (const run of waiting.splice(0)) run();
	};
	return { schedule, flush, pending: () => waiting.length };
}

/** The two rows that open the pages, drawn by the test renderer. */
function drawEntries(ctx: TreeContext) {
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () =>
		toObsidianItems([{ type: "group", id: "callouts", items: [themeCalloutsPage(ctx), builtInCalloutsPage(ctx)] }]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness };
}

/**
 * The names of the callout rows a page shows (hidden ones left out): the
 * name's own words, in their span, without the tag after it.
 */
function shownNames(page: CalloutListPage): string[] {
	return Array.from(page.containerEl.querySelectorAll<HTMLElement>(".cs-callout-row"))
		.filter((row) => row.isShown())
		.map((row) => row.querySelector(".cs-row-name")?.textContent ?? "");
}

/** Type `query` into the page's own search field. */
function searchPage(page: CalloutListPage, query: string): void {
	const input = page.containerEl.querySelector<HTMLInputElement>(".search-input-container input")!;
	input.value = query;
	(input as unknown as { fire(type: string): void }).fire("input");
}

describe("the rows that open the pages", () => {
	it('say "None" at none, never nothing', () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		registry.setThemeOwnedIds(new Set(registry.getBuiltIn().map((def) => def.id)));
		const { harness } = drawEntries(ctx);
		assert.equal(
			harness.row(t("settings.builtInCallouts"))?.settingEl.querySelector(".setting-item-value")?.textContent,
			"None",
		);
	});

	it("keep the theme's row while its switch is off, with Off where the count would be", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		const entry = (): { shown: boolean; value: string | null | undefined } => {
			const row = drawEntries(ctx).harness.row(t("settings.themeCalloutsHeading"))!;
			return {
				shown: row.settingEl.isShown(),
				value: row.settingEl.querySelector(".setting-item-value")?.textContent,
			};
		};
		// A theme that styles no callout, and the switch on: nothing to show.
		assert.equal(entry().shown, false);
		// The switch off took the theme's callouts away: the row stays, to bring them back.
		registry.settings.themeCalloutStyles.enabled = false;
		assert.deepEqual(entry(), { shown: true, value: "Off" });
		// Obsidian's default theme has nothing to switch off.
		const noTheme = treeContext(fakeApp());
		noTheme.registry.settings.themeCalloutStyles.enabled = false;
		assert.equal(
			drawEntries(noTheme.ctx).harness.row(t("settings.themeCalloutsHeading"))!.settingEl.isShown(),
			false,
		);
	});

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
		assert.deepEqual(
			searchSettings(tab.settingItems, "note").map((hit) => hit.name),
			[],
		);
		assert.deepEqual(
			searchSettings(tab.settingItems, "warning").map((hit) => hit.name),
			[],
		);
	});
});

describe("Built-in callouts", () => {
	it("opens on the built-ins A→Z, which its own search filters by name or id", () => {
		const { ctx, registry } = treeContext(fakeApp());
		const { harness } = drawEntries(ctx);
		harness.openPage([CALLOUT_LIST_PAGES.builtIn]);
		const page = harness.customPage as unknown as CalloutListPage;
		const expected = registry
			.getBuiltIn()
			.map((def) => def.displayName)
			.sort((a, b) => a.localeCompare(b));
		assert.deepEqual(shownNames(page), expected);
		// Every row in Obsidian's list box, which keeps it one line.
		assert.equal(
			page.containerEl.querySelectorAll(".setting-group.mod-list .cs-callout-row").length,
			expected.length,
		);
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
		assert.deepEqual(shownNames(page), [], 'Note left the page, and the search still holds "no"');
		page.hide();
		registry.setThemeOwnedIds(new Set());
		assert.equal(pending(), 0, "a left page no longer listens");
	});

	it("says every built-in is the theme's when the theme styles them all", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		registry.setThemeOwnedIds(new Set(registry.getBuiltIn().map((def) => def.id)));
		const page = new CalloutListPage(ctx, "builtin", manualSchedule().schedule);
		page.display();
		assert.equal(
			page.containerEl.querySelector(".mod-empty-state .setting-item-name")?.textContent,
			t("settings.builtInAllThemeStyled", { theme: "Minimal" }),
		);
		assert.equal(
			page.containerEl.querySelector(".setting-group-search"),
			null,
			"no search field in the page without rows, as for any Obsidian box",
		);
		page.hide();
	});

	it("says nothing matches, with the row Obsidian draws for an empty list, only while a search finds nothing", () => {
		const { ctx } = treeContext(fakeApp());
		const page = new CalloutListPage(ctx, "builtin", manualSchedule().schedule);
		page.display();
		const row = (): HTMLElement => page.containerEl.querySelector<HTMLElement>(".cs-no-matches")!;
		assert.equal(row().isShown(), false, "hidden until something is searched for");
		searchPage(page, "zzz");
		assert.equal(row().isShown(), true);
		assert.ok(row().hasClass("mod-empty-state"), "Obsidian's grey row");
		assert.equal(
			row().querySelector(".setting-item-name")?.textContent,
			t("calloutPicker.noMatches", { query: "zzz" }),
		);
		assert.deepEqual(shownNames(page), []);
		// The words follow the query, and the row goes when something matches again.
		searchPage(page, "  yyy ");
		assert.equal(
			row().querySelector(".setting-item-name")?.textContent,
			t("calloutPicker.noMatches", { query: "yyy" }),
		);
		searchPage(page, "caution");
		assert.equal(row().isShown(), false);
		assert.deepEqual(shownNames(page), ["Warning"]);
		searchPage(page, "zzz");
		searchPage(page, "");
		assert.equal(row().isShown(), false, "an empty search matches everything");
		page.hide();
	});

	it("keeps saying so through a redraw while the search still finds nothing", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		const { schedule, flush } = manualSchedule();
		const page = new CalloutListPage(ctx, "builtin", schedule);
		page.display();
		searchPage(page, "zzz");
		registry.setThemeOwnedIds(new Set(["note"]));
		flush();
		const row = page.containerEl.querySelector<HTMLElement>(".cs-no-matches")!;
		assert.equal(row.isShown(), true);
		assert.equal(page.containerEl.querySelectorAll(".cs-no-matches").length, 1, "one row, not one per draw");
		page.hide();
	});
});

describe("the switch at the top of Callouts from your theme", () => {
	afterEach(() => {
		createdToggles.length = 0;
	});

	/** The theme's page, open in a theme that owns Note. */
	function openThemePage(options: { paused?: boolean } = {}) {
		const made = treeContext(fakeApp("Minimal"), options);
		made.registry.setThemeOwnedIds(new Set(["note"]));
		const { schedule, flush } = manualSchedule();
		const page = new CalloutListPage(made.ctx, "theme", schedule);
		page.display();
		return { ...made, page, flush };
	}

	/** The one toggle the page drew. */
	const theSwitch = (): (typeof createdToggles)[number] => createdToggles[createdToggles.length - 1]!;

	it("is the page's first row, in a box of its own, above the list", () => {
		const { page } = openThemePage();
		const [switchBox, listBox] = Array.from(page.containerEl.children);
		assert.ok(switchBox!.hasClass("setting-group") && switchBox!.hasClass("cs-box"));
		assert.equal(switchBox!.querySelector(".setting-item-name")?.textContent, t("settings.themeCalloutStyles"));
		assert.equal(
			switchBox!.querySelector(".setting-item-description")?.textContent,
			t("settings.themeCalloutStylesDesc"),
		);
		assert.ok(listBox!.hasClass("mod-list"));
		assert.equal(theSwitch().getValue(), true, "on, as the setting is");
		page.hide();
	});

	it("is not on the Built-in callouts page, which has nothing to switch", () => {
		const { ctx } = treeContext(fakeApp("Minimal"));
		const page = new CalloutListPage(ctx, "builtin", manualSchedule().schedule);
		page.display();
		assert.equal(createdToggles.length, 0);
		page.hide();
	});

	it("saves a flip through the registry's change round, which repaints and saves", async () => {
		const { page, registry } = openThemePage();
		const rounds: boolean[] = [];
		registry.onChange((change) => {
			rounds.push(change.persists);
		});
		await theSwitch().commit(false);
		assert.equal(registry.settings.themeCalloutStyles.enabled, false);
		assert.deepEqual(rounds, [true]);
		page.hide();
	});

	it("refuses while saving is paused, says why, and puts the switch back", () => {
		const { page, registry } = openThemePage({ paused: true });
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			assert.equal(theSwitch().disabled, true, "greyed");
			void theSwitch().commit(false);
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
		assert.equal(registry.settings.themeCalloutStyles.enabled, true, "nothing changed");
		assert.equal(theSwitch().getValue(), true, "the switch is back on");
		assert.equal(notices.length, 1);
		page.hide();
	});

	it("empties the page when it goes off, says why, and fills it again when it goes on", () => {
		const { page, registry, flush } = openThemePage();
		void theSwitch().commit(false);
		// The switch takes the theme's styles away, so the registry stops listing its callouts.
		registry.setThemeOwnedIds(new Set());
		flush();
		assert.deepEqual(shownNames(page), []);
		assert.equal(
			page.containerEl.querySelector(".mod-empty-state"),
			null,
			"no line about it: the page is the switch alone",
		);
		assert.equal(
			page.containerEl.querySelector<HTMLElement>(".mod-list .setting-items")?.isShown(),
			false,
			"the empty box is hidden too",
		);
		assert.equal(
			page.containerEl.querySelector(".setting-group-search"),
			null,
			"the field leaves the page: hidden, it would still square the rows' corners",
		);
		void theSwitch().commit(true);
		registry.setThemeOwnedIds(new Set(["note"]));
		flush();
		assert.deepEqual(shownNames(page), ["Note"]);
		assert.equal(
			page.containerEl.querySelector<HTMLElement>(".mod-list .setting-items")?.isShown(),
			true,
			"the box is back with the rows",
		);
		const search = page.containerEl.querySelector(".setting-group-search");
		assert.ok(search, "the same field comes back with the rows");
		const inBox = Array.from(search.parentElement!.children);
		assert.ok(
			(inBox[inBox.indexOf(search) + 1] as HTMLElement | undefined)?.hasClass("setting-items"),
			"right above the rows, where Obsidian draws it",
		);
		page.hide();
	});

	it("follows the setting when another device changes it", () => {
		const { page, registry, flush } = openThemePage();
		registry.settings.themeCalloutStyles.enabled = false;
		registry.setThemeOwnedIds(new Set());
		flush();
		assert.equal(theSwitch().getValue(), false);
		page.hide();
	});
});

describe("Callouts from your theme", () => {
	it("lists the theme's rows (👁, not ✎)", () => {
		const { ctx, registry } = treeContext(fakeApp("Minimal"));
		registry.setThemeOwnedIds(new Set(["note"]));
		const page = new CalloutListPage(ctx, "theme", manualSchedule().schedule);
		page.display();
		assert.deepEqual(shownNames(page), ["Note"]);
		const row = page.containerEl.querySelector<HTMLElement>(".cs-callout-row")!;
		assert.equal(row.querySelector('[data-cs-tooltip^="Edit"]'), null, "no ✎ on a theme's row");
		page.hide();
	});
});
