/**
 * tests/declarativeMainPageGroups.test.ts — the boxes at the foot of the main
 * settings page, as the declarative settings draw them
 * (settings/declarative/mainPageGroups.ts).
 *
 * Drawn through the test renderer (tests/support/declarativeRenderer.ts), so
 * what is checked is what Obsidian would show: the boxes and their rows, what
 * the settings search finds, what is dimmed while saving is paused (and that a
 * press then explains instead of acting), and the About box's links.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings } from "./support/declarativeRenderer";
import { PluginSettingTab, type ButtonLike } from "./support/obsidianStub";
import { aboutGroup, dangerZoneGroup, iconLibrariesRow, importExportGroup, MAIN_PAGE_ROWS } from "../src/settings/declarative/mainPageGroups";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";

installFakeDom();

/** A context with a plugin that has only what these rows read. */
function treeContext(options: { paused?: boolean; recovery?: boolean } = {}): TreeContext {
	const plugin = {
		settingsWriter: { isFrozen: options.paused === true },
		recovery: options.recovery === false ? undefined : { listVersions: () => Promise.resolve([]) },
		manifest: { version: "2.18.0" },
	};
	return {
		app: {} as never,
		plugin: plugin as never,
		redraw: () => {},
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
}

/** Draw the three boxes, and the icon-libraries row in a box of its own. */
function drawMainPage(ctx: TreeContext) {
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([
		{ type: "group", id: "style", items: [iconLibrariesRow(ctx)] },
		importExportGroup(ctx),
		dangerZoneGroup(ctx),
		aboutGroup(ctx),
	]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness };
}

/** The button a button row drew. */
function buttonOf(harness: DeclarativeHarness, rowName: string): ButtonLike {
	return harness.row(rowName)!.setting.components[0] as ButtonLike;
}

describe("the boxes at the foot of the main page", () => {
	it("draws each box under its heading, in order", () => {
		const { harness } = drawMainPage(treeContext());
		const boxes = harness.rendered.filter((box) => box.def.heading).map((box) => [
			box.def.heading,
			box.children.map((row) => row.def.name),
		]);
		assert.deepEqual(boxes, [
			["Import and export", ["Import callouts", "Export callouts"]],
			["Danger zone", ["Restore an earlier version", "Convert to standard Markdown", "Reset everything"]],
			["About", ["About Callout Studio", "", "Icon licenses", "Version"]],
		]);
		assert.deepEqual(harness.duplicateKeys, []);
	});

	it("hides Restore an earlier version on a host that keeps no versions", () => {
		const { harness } = drawMainPage(treeContext({ recovery: false }));
		const row = harness.row("Restore an earlier version")!;
		assert.equal(row.settingEl.isShown(), false);
	});

	it("is found by the settings search", () => {
		const { tab } = drawMainPage(treeContext());
		const names = (query: string): string[] => searchSettings(tab.settingItems, query).map((hit) => hit.name);
		assert.deepEqual(names("Admonition"), ["Import callouts"]);
		assert.deepEqual(names("icon"), ["Manage icon libraries", "Icon licenses"]);
		assert.deepEqual(names("tabler"), ["Manage icon libraries"]);
		assert.deepEqual(names("github"), ["Version"]);
		assert.deepEqual(names("reset"), ["Reset everything"]);
		assert.ok(!names("bugs").includes(""), "the nameless contact row is not a search result");
	});
});

describe("while saving is paused", () => {
	it("dims the buttons that would change the setup, and only those", () => {
		const { harness } = drawMainPage(treeContext({ paused: true }));
		const dimmed = (name: string): string | null => (buttonOf(harness, name).buttonEl as unknown as HTMLElement).getAttribute("aria-disabled");
		assert.equal(dimmed("Import callouts"), "true");
		assert.equal(dimmed("Reset everything"), "true");
		assert.equal(dimmed("Export callouts"), "false");
		assert.equal(dimmed("Convert to standard Markdown"), "false");
	});

	it("explains instead of acting when a dimmed button is pressed", () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			const { harness } = drawMainPage(treeContext({ paused: true }));
			// Pressing would open the import window, which the stub cannot: no
			// error is how the test sees that nothing opened.
			buttonOf(harness, "Import callouts").press();
			assert.equal(notices.length, 1);
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});
});

describe("the About box", () => {
	it("holds the contact sentence with its two links, and the version with the project's links", () => {
		const { harness } = drawMainPage(treeContext());
		const contact = harness.row("")!.setting.descEl as unknown as HTMLElement;
		assert.deepEqual(Array.from(contact.querySelectorAll("a"), (a) => a.getAttribute("href")), [
			"https://github.com/Niv20/obsidian-plugin-callout-studio/issues/new/choose",
			"mailto:anivbniv@gmail.com",
		]);
		const version = harness.row("Version")!.setting;
		assert.deepEqual(Array.from((version.descEl as unknown as HTMLElement).querySelectorAll("a"), (a) => a.textContent), ["Source code", "Contribute", "Plugin license"]);
		const release = (version.controlEl as unknown as HTMLElement).querySelector("a")!;
		assert.equal(release.textContent, "v2.18.0");
		assert.match(release.getAttribute("href") ?? "", /releases\/tag\/2\.18\.0$/);
	});

	it("draws the same links again after a redraw, not twice", () => {
		const { tab, harness } = drawMainPage(treeContext());
		tab.update();
		const contact = harness.row("")!.setting.descEl as unknown as HTMLElement;
		assert.equal(contact.querySelectorAll("a").length, 2);
	});
});

describe("rows the plugin jumps to", () => {
	it("registers Import callouts under its name", () => {
		const ctx = treeContext();
		const { harness } = drawMainPage(ctx);
		const el = harness.row("Import callouts")!.settingEl;
		(el as unknown as { isConnected: boolean }).isConnected = true;
		assert.equal(ctx.rows.get(MAIN_PAGE_ROWS.importCallouts), el);
	});

	it("opens Version history as a page, whose id is where the saving notice's button goes", () => {
		const { harness } = drawMainPage(treeContext());
		const page = harness.openPage([MAIN_PAGE_ROWS.earlierVersions]);
		assert.equal(page.customPage?.constructor.name, "VersionHistoryPage");
		assert.equal(page.pagePath.join("/"), MAIN_PAGE_ROWS.earlierVersions);
	});
});
