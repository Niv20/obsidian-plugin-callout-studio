/**
 * tests/declarativeControlBinding.test.ts — a declarative control saves the
 * plugin's way, never Obsidian's (settings/declarative/controlBinding.ts and
 * the settings tab's `get/setControlValue` overrides).
 *
 * Obsidian's default `setControlValue` writes `plugin.settings[key]` and calls
 * `plugin.saveData(plugin.settings)`, which in Callout Studio would overwrite
 * data.json with the settings alone and lose every callout. These tests pin
 * the replacement: dotted keys into the nested settings, a refusal while saving
 * is paused, the change painted before it is saved, and `saveData` never
 * called. They also draw a real control row through the test renderer, so the
 * whole path Obsidian takes is covered.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness } from "./support/declarativeRenderer";
import { readSettingAt, writeControlValue, writeSettingAt } from "../src/settings/declarative/controlBinding";
import { CalloutStudioSettingsTab } from "../src/settings/SettingsTab";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import type { ToggleComponent } from "./support/obsidianStub";

installFakeDom();

/** Settings nested the way the plugin's are. */
function nestedSettings() {
	return { language: "en", globalStyle: { block: { alignContentWithTitle: false } } };
}

/** A plugin whose every save is recorded, in order, with what happened around it. */
function recordingPlugin(paused = false) {
	const log: string[] = [];
	const plugin = {
		settings: nestedSettings(),
		settingsWriter: { isFrozen: paused },
		saveSettings: async () => { log.push("saveSettings"); },
		saveData: async () => { log.push("saveData"); },
		cssInjector: { inject: () => { log.push("inject"); } },
	};
	return { plugin, log };
}

describe("dotted keys", () => {
	it("read and write nested fields", () => {
		const settings = nestedSettings();
		assert.equal(readSettingAt(settings, "language"), "en");
		assert.equal(readSettingAt(settings, "globalStyle.block.alignContentWithTitle"), false);
		assert.equal(writeSettingAt(settings, "globalStyle.block.alignContentWithTitle", true), true);
		assert.equal(settings.globalStyle.block.alignContentWithTitle, true);
	});

	it("refuse a key the settings do not have, rather than invent it", () => {
		const settings = nestedSettings();
		assert.equal(readSettingAt(settings, "globalStyle.nope.field"), undefined);
		assert.equal(writeSettingAt(settings, "globalStyle.nope.field", 1), false);
		assert.equal(writeSettingAt(settings, "globalStyle.block.typo", 1), false);
		assert.deepEqual(settings, nestedSettings());
	});
});

describe("writeControlValue", () => {
	it("writes, paints, then saves", async () => {
		const { plugin, log } = recordingPlugin();
		await writeControlValue(plugin, "language", "he", {
			afterWrite: () => log.push(`paint ${plugin.settings.language}`),
			onRefused: () => log.push("refused"),
		});
		assert.deepEqual(log, ["paint he", "saveSettings"]);
	});

	it("refuses while saving is paused: nothing written, nothing saved", async () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			const { plugin, log } = recordingPlugin(true);
			await writeControlValue(plugin, "language", "he", {
				afterWrite: () => log.push("paint"),
				onRefused: (key) => log.push(`refused ${key}`),
			});
			assert.deepEqual(log, ["refused language"]);
			assert.equal(plugin.settings.language, "en");
			assert.equal(notices.length, 1, "the user is told why");
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});

	it("saves nothing for a key the settings do not have", async () => {
		const { plugin, log } = recordingPlugin();
		await writeControlValue(plugin, "nope", 1, { afterWrite: () => log.push("paint"), onRefused: () => log.push("refused") });
		assert.deepEqual(log, []);
	});
});

describe("the settings tab's control binding", () => {
	/** A tab drawing one toggle bound to a nested key, through the test renderer. */
	function tabWithToggle(paused = false) {
		const { plugin, log } = recordingPlugin(paused);
		const tab = new CalloutStudioSettingsTab({} as App, plugin as unknown as SettingsTabPlugin);
		tab.getSettingDefinitions = () => [{ name: "Align", control: { type: "toggle", key: "globalStyle.block.alignContentWithTitle" } }];
		const harness = new DeclarativeHarness(tab as never);
		tab.update();
		const toggle = harness.row("Align")!.setting.components[0] as ToggleComponent;
		return { plugin, log, tab, toggle };
	}

	it("reads a nested key, and saves through saveSettings, never saveData", async () => {
		const { plugin, log, toggle } = tabWithToggle();
		assert.equal(toggle.getValue(), false);
		await toggle.commit(true);
		assert.equal(plugin.settings.globalStyle.block.alignContentWithTitle, true);
		assert.deepEqual(log, ["inject", "saveSettings"]);
	});

	it("puts a refused change back by redrawing the page", async () => {
		const { plugin, log, tab, toggle } = tabWithToggle(true);
		const updates = (tab as unknown as { updateCount: number }).updateCount;
		await toggle.commit(true);
		assert.equal(plugin.settings.globalStyle.block.alignContentWithTitle, false);
		assert.deepEqual(log, []);
		assert.equal((tab as unknown as { updateCount: number }).updateCount, updates + 1);
	});
});
