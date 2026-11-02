/**
 * tests/declarativeGeneralRows.test.ts — Default fallback callout, Language and
 * Use your theme's callout styles, as the declarative settings draw them
 * (settings/declarative/generalRows.ts).
 *
 * Drawn through the test renderer with the real settings tab, so the theme's
 * switch saves the way Obsidian makes it save (the tab's control binding). The
 * plugin around them is a fake with a real registry. What is checked: the
 * fallback picker is one picker for the whole visit, the rows go grey while
 * saving is paused, the language row follows its download, and the switch
 * shows when the old page showed it and saves through the registry.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { App } from "obsidian";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings } from "./support/declarativeRenderer";
import type { ButtonLike, ToggleComponent } from "./support/obsidianStub";
import { DEFAULT_SETTINGS } from "../src/constants";
import { setLocale, t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutStudioSettingsTab } from "../src/settings/SettingsTab";
import { fallbackRow, GENERAL_ROWS, languageRows, themeStylesRow } from "../src/settings/declarative/generalRows";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { SettingsTabPlugin } from "../src/settings/sections/types";

installFakeDom();

// The language row watches its own layout; the fake DOM has neither of these.
const previousStyle = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
const previousObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
before(() => {
	Object.defineProperty(globalThis, "getComputedStyle", {
		configurable: true, value: () => ({ flexDirection: "row" }),
	});
	Object.defineProperty(globalThis, "ResizeObserver", {
		configurable: true, value: class { observe(): void {} disconnect(): void {} },
	});
});
after(() => {
	for (const [key, descriptor] of [["getComputedStyle", previousStyle], ["ResizeObserver", previousObserver]] as const) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
	setLocale("en");
});

/** What the fake plugin is like: each field can be changed between draws. */
interface PluginState {
	paused: boolean;
	/** The chosen language is on this device. */
	ready: boolean;
	/** The chosen language is downloading. */
	downloading: boolean;
}

/** A plugin with a real registry (whose settings are the plugin's) and a log of what it was asked. */
function fakePlugin(state: Partial<PluginState> = {}) {
	const now: PluginState = { paused: false, ready: true, downloading: false, ...state };
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.settings.fallbackCalloutId = "warning";
	const calls: string[] = [];
	const plugin = {
		registry,
		get settings() { return registry.settings; },
		settingsWriter: { get isFrozen() { return now.paused; } },
		restyleUncustomizedFallbackRows: () => calls.push("restyle"),
		refreshCallouts: () => calls.push("refresh"),
		saveSettings: () => { calls.push("save"); return Promise.resolve(); },
		locales: {
			isReady: (pref: string) => pref === "en" || now.ready,
			state: () => (now.downloading ? "loading" : "absent"),
		},
		ensureLocale: () => { calls.push("ensureLocale"); return Promise.resolve(false); },
		applyLocaleChange: () => calls.push("applyLocaleChange"),
	};
	return { plugin, registry, calls, now };
}

/** The three rows in one box, drawn by the real settings tab. */
function drawGeneral(plugin: object, app: object = {}) {
	let redraws = 0;
	const ctx: TreeContext = {
		app: app as App,
		plugin: plugin as SettingsTabPlugin,
		redraw: () => { redraws++; tab.update(); },
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	const tab = new CalloutStudioSettingsTab(app as App, plugin as SettingsTabPlugin);
	tab.getSettingDefinitions = () => toObsidianItems([
		{ type: "group", id: "general", items: [fallbackRow(ctx), ...languageRows(ctx), themeStylesRow(ctx)] },
	]);
	const harness = new DeclarativeHarness(tab as never);
	tab.update();
	/** The drawn row with this id. */
	const row = (id: string) => {
		const found = harness.rows().find((r) => r.def.id === id);
		assert.ok(found, `no row "${id}"`);
		return found;
	};
	return { tab, harness, row, redraws: () => redraws };
}

/** Pick `name` in a callout picker: open it, search, and press Enter on the first match. */
function pickCallout(rowEl: HTMLElement, name: string): void {
	const input = rowEl.querySelector<HTMLInputElement>(".cs-combobox-input")!;
	const press = { preventDefault: () => {}, stopPropagation: () => {} };
	(rowEl.querySelector(".cs-dropdown-field") as unknown as { fire(type: string): void }).fire("click");
	input.value = name;
	(input as unknown as { fire(type: string, init?: object): void }).fire("input");
	(input as unknown as { fire(type: string, init?: object): void }).fire("keydown", { key: "Enter", ...press });
}

/** Whether a row's ↺ is out of sight (nothing to reset). */
function resetHidden(button: ButtonLike): boolean {
	return (button.extraSettingsEl as unknown as HTMLElement).hasClass("cs-hidden");
}

describe("Default fallback callout", () => {
	it("keeps one picker through redraws, showing the saved fallback each time", () => {
		const { plugin, registry } = fakePlugin();
		const { tab, row } = drawGeneral(plugin);
		const pickerOf = (): Element | null => row(GENERAL_ROWS.fallback).settingEl.querySelector(".cs-combobox");
		const first = pickerOf();
		assert.ok(first);
		// Another device's settings arrive with a different fallback.
		registry.settings.fallbackCalloutId = "note";
		tab.update();
		assert.equal(pickerOf(), first, "the same picker");
		assert.equal(row(GENERAL_ROWS.fallback).settingEl.querySelectorAll(".cs-combobox").length, 1);
		assert.equal(row(GENERAL_ROWS.fallback).settingEl.querySelector(".cs-dropdown-field-label")?.textContent, "Note");
	});

	it("repaints and saves a pick, and draws again for the reset arrow", () => {
		const { plugin, registry, calls } = fakePlugin();
		const { row, redraws } = drawGeneral(plugin);
		const reset = (): ButtonLike => row(GENERAL_ROWS.fallback).setting.extraButtons[0] as ButtonLike;
		assert.equal((reset().extraSettingsEl as unknown as HTMLElement).hasClass("cs-hidden"), false);
		pickCallout(row(GENERAL_ROWS.fallback).settingEl, "Note");
		assert.equal(registry.settings.fallbackCalloutId, DEFAULT_SETTINGS.fallbackCalloutId);
		assert.deepEqual(calls, ["restyle", "refresh", "save"]);
		assert.equal(redraws(), 1);
		assert.equal((reset().extraSettingsEl as unknown as HTMLElement).hasClass("cs-hidden"), true);
	});

	it("puts Note back with ↺, paints before it saves, and hides the arrow", async () => {
		const { plugin, registry, calls } = fakePlugin();
		const { row } = drawGeneral(plugin);
		const reset = row(GENERAL_ROWS.fallback).setting.extraButtons[0] as ButtonLike;
		reset.press();
		assert.equal(registry.settings.fallbackCalloutId, DEFAULT_SETTINGS.fallbackCalloutId);
		assert.equal(row(GENERAL_ROWS.fallback).settingEl.querySelector(".cs-dropdown-field-label")?.textContent, "Note");
		assert.equal(resetHidden(reset), true);
		await Promise.resolve();
		// Painted before the save, which it must never wait on.
		assert.deepEqual(calls, ["restyle", "refresh", "save"]);
	});

	it("shows no ↺ at the defaults, and writes nothing for being drawn", () => {
		const { plugin, registry, calls } = fakePlugin();
		registry.settings.fallbackCalloutId = DEFAULT_SETTINGS.fallbackCalloutId;
		registry.settings.language = DEFAULT_SETTINGS.language;
		const { row } = drawGeneral(plugin);
		for (const id of [GENERAL_ROWS.fallback, GENERAL_ROWS.language]) {
			assert.equal(resetHidden(row(id).setting.extraButtons[0] as ButtonLike), true, id);
		}
		assert.deepEqual(calls, []);
	});

	it("goes grey while saving is paused: the picker and its reset arrow too", () => {
		const { plugin } = fakePlugin({ paused: true });
		const { row } = drawGeneral(plugin);
		const fallback = row(GENERAL_ROWS.fallback);
		assert.equal(fallback.setting.disabled, true);
		assert.ok(fallback.settingEl.querySelector(".cs-dropdown-field")?.hasClass("mod-disabled"), "Obsidian's disabled dropdown");
		const reset = (fallback.setting.extraButtons[0] as ButtonLike).buttonEl as unknown as HTMLElement;
		assert.equal(reset.getAttribute("aria-disabled"), "true");
	});
});

describe("Language", () => {
	it("is found by every language's own name", () => {
		const { tab } = drawGeneral(fakePlugin().plugin);
		const names = (query: string): string[] => searchSettings(tab.settingItems, query).map((hit) => hit.name);
		assert.deepEqual(names("Deutsch"), [t("settings.language")]);
		assert.deepEqual(names("עברית"), [t("settings.language")]);
	});

	it("offers Retry while the chosen language is missing, and hides it once it is here", async () => {
		const { plugin, registry, calls, now } = fakePlugin({ ready: false });
		registry.settings.language = "he";
		const { tab, row, redraws } = drawGeneral(plugin);
		const missing = row(GENERAL_ROWS.languageMissing);
		assert.ok(missing.settingEl.isShown());
		assert.equal(missing.setting.nameEl.textContent, t("locale.notDownloaded", { name: "עברית" }));
		(missing.setting.components[0] as ButtonLike).press();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepEqual(calls, ["ensureLocale"]);
		assert.equal(redraws(), 1);
		now.ready = true;
		tab.update();
		assert.equal(row(GENERAL_ROWS.languageMissing).settingEl.isShown(), false);
	});

	it("says Downloading… and holds still while the chosen language downloads", () => {
		const { plugin, registry } = fakePlugin({ ready: false, downloading: true });
		registry.settings.language = "he";
		const { row } = drawGeneral(plugin);
		const language = row(GENERAL_ROWS.language);
		assert.equal(language.setting.descEl.textContent, t("locale.downloading"));
		assert.equal(language.setting.disabled, true);
		const retry = (row(GENERAL_ROWS.languageMissing).setting.components[0] as ButtonLike).buttonEl as unknown as HTMLButtonElement;
		assert.equal(retry.hasClass("mod-loading"), true, "Obsidian's spinner on Retry");
		assert.equal(retry.getAttribute("aria-busy"), "true");
	});

	it("follows Obsidian's language again with ↺", async () => {
		// Obsidian is in English here (the stub's default), so Hebrew is a pin.
		const { plugin, registry, calls } = fakePlugin();
		registry.settings.language = "he";
		const { row, redraws } = drawGeneral(plugin);
		try {
			const reset = row(GENERAL_ROWS.language).setting.extraButtons[0] as ButtonLike;
			assert.equal(resetHidden(reset), false);
			reset.press();
			assert.equal(registry.settings.language, DEFAULT_SETTINGS.language);
			// Following Obsidian shows as Obsidian's own language.
			assert.equal(row(GENERAL_ROWS.language).settingEl.querySelector(".cs-dropdown-field-label")?.textContent, "English");
			await Promise.resolve();
			await Promise.resolve();
			assert.deepEqual(calls, ["save", "applyLocaleChange"]);
			assert.ok(redraws() >= 1, "the page is drawn again in the new language");
		} finally {
			setLocale("en");
		}
	});

	it("goes grey while saving is paused", () => {
		const { row } = drawGeneral(fakePlugin({ paused: true }).plugin);
		assert.equal(row(GENERAL_ROWS.language).setting.disabled, true);
		assert.equal(row(GENERAL_ROWS.language).settingEl.querySelector(".cs-dropdown-field")?.hasClass("mod-disabled"), true);
	});
});

describe("Use your theme's callout styles", () => {
	const inMinimal = { customCss: { theme: "Minimal" } };

	it("shows in a theme that styles no callout only while it is off", () => {
		const shown = (enabled: boolean, app: object): boolean => {
			const { plugin, registry } = fakePlugin();
			registry.settings.themeCalloutStyles.enabled = enabled;
			return drawGeneral(plugin, app).row(GENERAL_ROWS.themeStyles).settingEl.isShown();
		};
		assert.equal(shown(true, inMinimal), false);
		assert.equal(shown(false, inMinimal), true);
		// Obsidian's default theme: there is nothing to switch off.
		assert.equal(shown(false, {}), false);
	});

	it("saves through the registry's change round, which repaints and saves", async () => {
		const { plugin, registry } = fakePlugin();
		registry.settings.themeCalloutStyles.enabled = false;
		const rounds: boolean[] = [];
		registry.onChange((change) => { rounds.push(change.persists); });
		const { row } = drawGeneral(plugin, inMinimal);
		const toggle = row(GENERAL_ROWS.themeStyles).setting.components[0] as ToggleComponent;
		assert.equal(toggle.getValue(), false);
		await toggle.commit(true);
		assert.equal(registry.settings.themeCalloutStyles.enabled, true);
		assert.deepEqual(rounds, [true]);
	});
});
