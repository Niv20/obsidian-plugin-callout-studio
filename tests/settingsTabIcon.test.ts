/**
 * tests/settingsTabIcon.test.ts — the settings tab carries the plugin's icon.
 *
 * Obsidian draws a tab's `icon` beside its rows in the settings search results,
 * as it does for every core tab; with none, "Callout Studio" was the one result
 * row without a mark. (The sidebar list hides every community plugin's icon, so
 * nothing changes there.)
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import type { App } from "obsidian";
import { PLUGIN_ICON_ID } from "../src/constants";
import { CalloutStudioSettingsTab } from "../src/settings/SettingsTab";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

it("gives the settings tab the icon that stands for Callout Studio", () => {
	const tab = new CalloutStudioSettingsTab({} as App, {} as SettingsTabPlugin);
	assert.equal(tab.icon, PLUGIN_ICON_ID);
});

it("marks the tab's page, so styles.css can end it 24px under the footer", () => {
	const tab = new CalloutStudioSettingsTab({} as App, {} as SettingsTabPlugin);
	assert.ok(tab.containerEl.hasClass("cs-settings-tab"));
});
