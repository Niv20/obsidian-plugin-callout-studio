/**
 * tests/declarativeRenderer.test.ts — the test renderer behaves as Obsidian's
 * declarative settings renderer does (tests/support/declarativeRenderer.ts).
 *
 * Every later test of the settings tree trusts this renderer to show what
 * Obsidian 1.14.4 would show, so its own behaviour is pinned first, one rule
 * of app.js at a time: boxes and keys, what a redraw keeps and rebuilds,
 * `visible`/`disabled`, the list extras, a box's own search, pages, and the
 * settings search.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type LooseDef } from "./support/declarativeRenderer";
import { Platform, PluginSettingTab, SettingPage, type ButtonLike } from "./support/obsidianStub";

installFakeDom();

/** A settings tab whose tree is whatever `tree()` returns at each `update()`. */
function tabWith(tree: () => LooseDef[]) {
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = tree;
	const harness = new DeclarativeHarness(tab);
	// The harness makes `update()` store the tree and draw it, as Obsidian's does.
	tab.update();
	return { tab, harness };
}

/** A render row that counts its draws and its cleanups. */
function countingRow(name: string, counts: { draws: number; cleanups: number }, extra: Partial<LooseDef> = {}): LooseDef {
	return {
		name,
		render: () => {
			counts.draws++;
			return () => { counts.cleanups++; };
		},
		...extra,
	};
}

describe("boxes and keys", () => {
	it("wraps loose rows in one box without a heading, and keeps boxes in order", () => {
		const { harness } = tabWith(() => [
			{ name: "First" },
			{ name: "Second" },
			{ type: "group", heading: "Later", items: [{ name: "Third" }] },
		]);
		assert.equal(harness.rendered.length, 2);
		assert.deepEqual(harness.rendered[0]!.children.map((row) => row.def.name), ["First", "Second"]);
		assert.equal(harness.rendered[1]!.def.heading, "Later");
	});

	it("reports the duplicate keys Obsidian logs", () => {
		const { harness } = tabWith(() => [{ name: "Same" }, { name: "Same" }]);
		assert.deepEqual(harness.duplicateKeys, ["box: name:Same"]);
	});
});

describe("a redraw", () => {
	it("reuses a row by key: its cleanup runs, then it is drawn again", () => {
		const counts = { draws: 0, cleanups: 0 };
		const { tab, harness } = tabWith(() => [countingRow("Row", counts, { id: "row" })]);
		const first = harness.row("Row")!.settingEl;
		tab.update();
		assert.equal(harness.row("Row")!.settingEl, first, "the same element");
		assert.deepEqual(counts, { draws: 2, cleanups: 1 });
	});

	it("keeps a row whose id stays while its name changes", () => {
		let name = "Before";
		const { tab, harness } = tabWith(() => [{ id: "row", name }]);
		const element = harness.row("Before")!.settingEl;
		name = "After";
		tab.update();
		assert.equal(harness.row("After")!.settingEl, element);
		assert.equal(harness.row("After")!.setting.nameEl.textContent, "After");
	});

	it("drops a row that left the tree, running its cleanup", () => {
		const counts = { draws: 0, cleanups: 0 };
		let present = true;
		const { tab, harness } = tabWith(() => (present ? [countingRow("Gone", counts), { name: "Stays" }] : [{ name: "Stays" }]));
		present = false;
		tab.update();
		assert.equal(harness.row("Gone"), undefined);
		assert.equal(counts.cleanups, 1);
	});
});

describe("visible and disabled", () => {
	it("hides a row, and a group whose rows are all hidden", () => {
		let show = true;
		const { tab, harness } = tabWith(() => [{ type: "group", heading: "Box", items: [{ name: "Only", visible: () => show }] }]);
		show = false;
		tab.refreshDomState();
		assert.equal(harness.row("Only")!.settingEl.isShown(), false);
		assert.equal(harness.box("Box")!.groupEl.isShown(), false);
	});

	it("disables a row's components through its `disabled` predicate", () => {
		let paused = false;
		const { tab, harness } = tabWith(() => [{
			name: "Row",
			disabled: () => paused,
			render: (setting) => { setting.addExtraButton(() => {}); },
		}]);
		paused = true;
		tab.refreshDomState();
		const row = harness.row("Row")!;
		assert.ok(row.settingEl.hasClass("is-disabled"));
		const button = (row.setting.extraButtons[0] as ButtonLike).extraSettingsEl as unknown as HTMLElement;
		assert.equal(button.getAttribute("aria-disabled"), "true");
	});
});

describe("lists", () => {
	it("shows the empty-state row only while the list has no rows", () => {
		let entries: LooseDef[] = [];
		const { tab, harness } = tabWith(() => [{ type: "list", heading: "List", emptyState: "Nothing yet", items: entries }]);
		assert.ok(harness.box("List")!.emptyStateEl?.hasClass("mod-empty-state"));
		entries = [{ name: "One" }];
		tab.update();
		assert.equal(harness.box("List")!.emptyStateEl, undefined);
	});

	it("puts addItem in the heading on a computer and as a last row on mobile", () => {
		let added = 0;
		const list = (): LooseDef[] => [{ type: "list", heading: "List", addItem: { name: "Add", action: () => { added++; } }, items: [{ name: "One" }] }];
		const desktop = tabWith(list).harness.box("List")!;
		assert.equal(desktop.addItemEl, undefined);
		desktop.settingGroup.extraButtons[0]!.press();
		Platform.isMobile = true;
		try {
			const mobile = tabWith(list).harness.box("List")!;
			assert.ok(mobile.addItemEl?.hasClass("mod-add-item"));
			assert.equal(mobile.groupEl.querySelector(".setting-items")!.lastElementChild, mobile.addItemEl);
			mobile.addItemEl!.click();
		} finally {
			Platform.isMobile = false;
		}
		assert.equal(added, 2);
	});

	it("gives each row a ✕ and the Delete key when the list has onDelete", () => {
		const deleted: number[] = [];
		const { harness } = tabWith(() => [{ type: "list", heading: "List", onDelete: (index) => { deleted.push(index); }, items: [{ name: "A" }, { name: "B" }] }]);
		harness.row("B")!.setting.extraButtons[0]!.press();
		harness.box("List")!.settingGroup.pressDelete(0);
		assert.deepEqual(deleted, [1, 0]);
	});

	it("reorders with Alt+arrows when the list has onReorder", () => {
		const moves: Array<[number, number]> = [];
		const { harness } = tabWith(() => [{ type: "list", heading: "List", onReorder: (from, to) => { moves.push([from, to]); }, items: [{ name: "A" }, { name: "B" }] }]);
		const group = harness.box("List")!.settingGroup;
		group.pressAltArrow(0, 1);
		group.pressAltArrow(0, -1);
		assert.deepEqual(moves, [[0, 1]], "Alt+↑ on the first row goes nowhere");
		assert.ok(harness.row("A")!.settingEl.querySelector(".mod-drag-handle"));
	});

	it("filters a box's rows with its own search, leaving unsearchable rows alone", () => {
		const { harness } = tabWith(() => [{
			type: "list",
			heading: "List",
			search: { match: (def, query) => (def.name ?? "").toLowerCase().includes(query.toLowerCase()) },
			items: [{ name: "Apple" }, { name: "Banana" }, { name: "Note", searchable: false }],
		}]);
		const input = harness.box("List")!.searchInputEl!;
		input.value = "ban";
		input.dispatchEvent(new Event("input"));
		assert.deepEqual(harness.rows().filter((row) => row.settingEl.isShown()).map((row) => row.def.name), ["Banana", "Note"]);
	});
});

describe("pages", () => {
	it("opens a page's own rows from its navigable row, and redraws them on update", () => {
		let count = 1;
		const { tab, harness } = tabWith(() => [{ type: "page", id: "inner", name: "Inner", displayValue: `${count} things`, items: [{ name: `Row ${count}` }] }]);
		const pageRow = harness.row("Inner")!;
		assert.ok(pageRow.settingEl.hasClass("mod-navigable"));
		assert.equal(pageRow.settingEl.querySelector(".setting-item-value")!.textContent, "1 things");
		pageRow.settingEl.click();
		assert.deepEqual(harness.pagePath, ["inner"]);
		count = 2;
		tab.update();
		assert.ok(harness.row("Row 2"), "the open page is drawn again");
	});

	it("draws a factory page with its own display, and leaves it alone on update", () => {
		let displays = 0;
		class OwnPage extends SettingPage {
			display(): void { displays++; this.containerEl.createDiv({ text: "drawn here" }); }
		}
		const { tab, harness } = tabWith(() => [{ type: "page", id: "own", name: "Own", page: () => new OwnPage() }]);
		harness.openPage(["own"]);
		assert.equal(harness.customPage?.title, "Own");
		assert.equal(harness.pageEl.textContent, "drawn here");
		tab.update();
		assert.equal(displays, 1, "Obsidian refreshes only pages drawn from items");
	});
});

describe("the settings search", () => {
	const tree: LooseDef[] = [
		{ name: "Default fallback callout", aliases: ["unknown"] },
		{ name: "Reset everything", desc: "Deletes every palette." },
		{ name: "Hidden row", searchable: false },
		{ name: "Invisible row", visible: false },
		{ type: "page", id: "lists", name: "My callout types", items: [{ type: "list", items: [{ name: "Idea" }] }] },
		{ type: "page", id: "own", name: "Built-in callouts", page: () => new SettingPage() },
	];

	it("finds rows by name, description and alias, every word counting", () => {
		assert.deepEqual(searchSettings(tree, "fallback").map((hit) => hit.name), ["Default fallback callout"]);
		assert.deepEqual(searchSettings(tree, "unknown").map((hit) => hit.name), ["Default fallback callout"]);
		assert.deepEqual(searchSettings(tree, "palette").map((hit) => hit.name), ["Reset everything"]);
		assert.deepEqual(searchSettings(tree, "reset palette").map((hit) => hit.name), []);
	});

	it("skips unsearchable and invisible rows, and finds pages by name and the rows inside them", () => {
		assert.deepEqual(searchSettings(tree, "hidden"), []);
		assert.deepEqual(searchSettings(tree, "invisible"), []);
		assert.deepEqual(searchSettings(tree, "idea"), [{ name: "Idea", pagePath: ["lists"], kind: "row" }]);
		assert.deepEqual(searchSettings(tree, "built-in"), [{ name: "Built-in callouts", pagePath: ["own"], kind: "page" }]);
	});
});
