/**
 * tests/declarativeCommandsPage.test.ts — Commands and shortcuts as a
 * settings page (settings/declarative/commandsPage.ts).
 *
 * Drawn through the test renderer. What is checked: the page's order (the
 * intro, the user's commands first, then the built-in ones), a command's row
 * (its callout's icon, Obsidian's shortcut chips, ⊕ and ✎), ⊕ opening
 * Obsidian's Hotkeys page on the command, a command whose callout is gone
 * saying so, a built-in command switched off keeping its row, the switches and
 * the ↺ that turns them all back on, ✕ asking first, the settings search, and
 * what saving being paused leaves usable.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type RenderedBox } from "./support/declarativeRenderer";
import { PluginSettingTab, type ButtonLike, type ToggleComponent } from "./support/obsidianStub";
import { stubConfirm } from "./support/importSafetyStubs";
import { t } from "../src/i18n";
import { FIXED_COMMAND_IDS, FIXED_COMMAND_NAME_KEYS, type FixedCommandId } from "../src/editor/commands";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { commandName } from "../src/settings/command/commandFlows";
import { COMMANDS_PAGE, commandsPage } from "../src/settings/declarative/commandsPage";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { CustomCommand } from "../src/types";

installFakeDom();

/** A command that wraps the selection in a Note callout. */
const WRAP_NOTE: CustomCommand = { id: "c1", calloutId: "note", role: "regular" };
/** A command whose callout no longer exists. */
const GONE: CustomCommand = { id: "c2", calloutId: "vanished", role: "regular" };

/** A plugin with a real registry, a command list, and a Hotkeys page to open. */
function fakePlugin(commands: CustomCommand[], options: { paused?: boolean; off?: FixedCommandId[] } = {}) {
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.settings.disabledFixedCommands = [...(options.off ?? [])];
	const list = [...commands];
	const hotkeySearches: string[] = [];
	const app = {
		// Obsidian's one-shortcut helper: Open settings is bound, nothing else is.
		hotkeyManager: { printHotkeyForCommand: (id: string) => (id === "callout-studio:open-settings" ? "Ctrl + ," : "") },
		setting: { open: () => {}, openTabById: () => ({ setQuery: (query: string) => { hotkeySearches.push(query); } }) },
	};
	const plugin = {
		app,
		registry,
		get settings() { return registry.settings; },
		settingsWriter: { isFrozen: options.paused === true },
		manifest: { id: "callout-studio", name: "Callout Studio" },
		customCommands: {
			list: () => list,
			remove: async (id: string) => { list.splice(list.findIndex((c) => c.id === id), 1); return true; },
		},
		setFixedCommandEnabled: async (id: FixedCommandId, enabled: boolean) => {
			const off = registry.settings.disabledFixedCommands;
			registry.settings.disabledFixedCommands = enabled ? off.filter((x) => x !== id) : [...off, id];
		},
	};
	return { plugin, app, registry, list, hotkeySearches };
}

/** The page, drawn by the test renderer and opened. */
function drawCommands(made: ReturnType<typeof fakePlugin>) {
	let redraws = 0;
	const ctx: TreeContext = {
		app: made.app as unknown as App,
		plugin: made.plugin as never,
		redraw: () => { redraws++; tab.update(); },
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([{ type: "group", id: "menus", items: [commandsPage(ctx)] }]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	harness.openPage([COMMANDS_PAGE.page]);
	return { tab, harness, redraws: () => redraws };
}

/** The drawn box with this id. */
function box(harness: DeclarativeHarness, id: string): RenderedBox {
	const found = harness.rendered.find((b) => b.def.id === id);
	assert.ok(found, `no box "${id}"`);
	return found;
}

/** The drawn row with this id. */
function row(harness: DeclarativeHarness, id: string) {
	const found = harness.rows().find((r) => r.def.id === id);
	assert.ok(found, `no row "${id}"`);
	return found;
}

/** The text of a row's shortcut chips. */
function chips(rowEl: HTMLElement): string[] {
	return Array.from(rowEl.querySelectorAll(".setting-command-hotkeys .setting-hotkey"), (chip) => chip.textContent ?? "");
}

/** Wait for a flow (a question, then a save) to finish. */
async function settle(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("Commands and shortcuts", () => {
	it("is the user's commands, then the built-in ones", () => {
		const { harness } = drawCommands(fakePlugin([WRAP_NOTE]));
		assert.deepEqual(harness.rendered.map((b) => b.def.id), [COMMANDS_PAGE.mine, COMMANDS_PAGE.builtIn]);
		assert.equal(box(harness, COMMANDS_PAGE.mine).def.heading, t("commandBuilder.yourCommands"));
		assert.equal(box(harness, COMMANDS_PAGE.builtIn).children.length, FIXED_COMMAND_IDS.length);
	});

	it("draws a command as its callout's icon, its name, Obsidian's shortcut chips, ⊕ and ✎ (✕ is Obsidian's)", () => {
		const made = fakePlugin([WRAP_NOTE]);
		const { harness } = drawCommands(made);
		const command = row(harness, "command-c1");
		assert.equal(command.def.name, commandName(WRAP_NOTE, made.registry.get("note")));
		assert.ok(command.settingEl.firstElementChild?.hasClass("callout-studio-row-icon"), "the icon first");
		assert.deepEqual(chips(command.settingEl), [t("commandBuilder.hotkeyBlank")]);
		const [hotkey, edit, remove] = command.setting.extraButtons;
		assert.ok((hotkey!.extraSettingsEl as unknown as HTMLElement).hasClass("mod-hotkeys"), "Obsidian hides it on a phone");
		assert.equal((edit!.extraSettingsEl as unknown as HTMLElement).dataset.csTooltip, t("commandBuilder.editAria", { name: command.def.name ?? "" }));
		assert.ok((remove!.extraSettingsEl as unknown as HTMLElement).hasClass("cs-test-delete"));
	});

	it("opens Obsidian's Hotkeys page on a command with ⊕", () => {
		const made = fakePlugin([]);
		const { harness } = drawCommands(made);
		const openSettings = row(harness, "command-open-settings");
		assert.deepEqual(chips(openSettings.settingEl), ["Ctrl + ,"]);
		(openSettings.setting.extraButtons[0] as ButtonLike).press();
		assert.deepEqual(made.hotkeySearches, [`Callout Studio: ${t(FIXED_COMMAND_NAME_KEYS["open-settings"])}`]);
	});

	it("tags a command whose callout is gone, with the whole sentence in the tag's tooltip", () => {
		const { harness } = drawCommands(fakePlugin([GONE]));
		const paused = row(harness, "command-c2");
		const tag = paused.settingEl.querySelector<HTMLElement>(".cs-paused-tag");
		assert.equal(tag?.textContent, t("commandBuilder.missingTag"));
		assert.equal(tag?.dataset.csTooltip, t("commandBuilder.missingCallout"));
		assert.ok(paused.settingEl.hasClass("is-command-paused"), "the row is dimmed");
		assert.ok(paused.settingEl.querySelector(".callout-studio-row-icon")?.hasClass("cs-icon-none"), "the dashed ring where the icon would be");
		assert.equal(paused.setting.descEl.textContent, "", "no sentence under the name");
	});

	it("leaves a command that can run without a tag", () => {
		const { harness } = drawCommands(fakePlugin([WRAP_NOTE]));
		const live = row(harness, "command-c1");
		assert.equal(live.settingEl.querySelector(".cs-paused-tag"), null);
		assert.equal(live.settingEl.hasClass("is-command-paused"), false);
	});

	it("keeps a switched-off built-in command's row as it is, without its shortcuts and ⊕", () => {
		const { harness } = drawCommands(fakePlugin([], { off: ["open-settings"] }));
		const off = row(harness, "command-open-settings");
		assert.equal(off.settingEl.hasClass("is-disabled"), false, "not faded");
		assert.equal(off.settingEl.querySelector(".setting-command-hotkeys"), null);
		assert.equal(off.setting.extraButtons.length, 0);
		assert.equal((off.setting.components[0] as ToggleComponent).getValue(), false);
	});

	it("switches a built-in command, and turns them all back on with ↺, dimmed while all are on", async () => {
		const made = fakePlugin([]);
		const { harness, redraws } = drawCommands(made);
		const reset = box(harness, COMMANDS_PAGE.builtIn).settingGroup.extraButtons[0] as ButtonLike;
		const idle = (): boolean => (reset.extraSettingsEl as unknown as HTMLElement).hasClass("cs-reset-idle");
		assert.equal(idle(), true);
		await (row(harness, "command-create-callout").setting.components.at(-1) as ToggleComponent).commit(false);
		assert.deepEqual(made.registry.settings.disabledFixedCommands, ["create-callout"]);
		assert.equal(redraws(), 1);
		assert.equal(idle(), false);
		reset.press();
		await settle();
		assert.deepEqual(made.registry.settings.disabledFixedCommands, []);
		assert.equal(idle(), true);
	});

	it("deletes a command on ✕ only after a yes", async () => {
		const made = fakePlugin([WRAP_NOTE]);
		const { harness } = drawCommands(made);
		const no = stubConfirm(false);
		try {
			box(harness, COMMANDS_PAGE.mine).settingGroup.pressDelete(0);
			await settle();
			assert.equal(made.list.length, 1);
		} finally { no.restore(); }
		const yes = stubConfirm(true);
		try {
			box(harness, COMMANDS_PAGE.mine).settingGroup.pressDelete(0);
			await settle();
			assert.equal(made.list.length, 0);
			assert.equal(box(harness, COMMANDS_PAGE.mine).emptyStateEl?.textContent, t("commandBuilder.empty"));
		} finally { yes.restore(); }
	});

	it("is where the settings search finds a command by its name", () => {
		const made = fakePlugin([WRAP_NOTE]);
		const { tab } = drawCommands(made);
		const name = commandName(WRAP_NOTE, made.registry.get("note"));
		assert.ok(searchSettings(tab.settingItems, name).some((hit) => hit.name === name));
		assert.ok(searchSettings(tab.settingItems, t(FIXED_COMMAND_NAME_KEYS["open-settings"])).length > 0);
	});
});

describe("while saving is paused", () => {
	it("+, ✕ and ↺ say why, ✎ is dimmed, and the built-in rows are greyed", () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			const made = fakePlugin([WRAP_NOTE], { paused: true, off: ["open-settings"] });
			const { harness } = drawCommands(made);
			const mine = box(harness, COMMANDS_PAGE.mine);
			(mine.settingGroup.extraButtons[0] as ButtonLike).press();
			mine.settingGroup.pressDelete(0);
			(box(harness, COMMANDS_PAGE.builtIn).settingGroup.extraButtons[0] as ButtonLike).press();
			assert.equal(notices.length, 3);
			const edit = row(harness, "command-c1").setting.extraButtons[1]!;
			assert.equal((edit.extraSettingsEl as unknown as HTMLElement).getAttribute("aria-disabled"), "true");
			assert.equal(row(harness, "command-create-callout").setting.disabled, true);
			assert.equal(made.list.length, 1);
			assert.deepEqual(made.registry.settings.disabledFixedCommands, ["open-settings"]);
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});
});
