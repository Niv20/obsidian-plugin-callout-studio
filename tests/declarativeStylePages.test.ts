/**
 * tests/declarativeStylePages.test.ts — Heading callout, Inline callout and
 * Block callout as settings pages (settings/declarative/stylePages.ts).
 *
 * Drawn through the test renderer with the real settings tab, so the switches
 * save the way Obsidian makes them save (the tab's control binding). What is
 * checked: the main page's Callout style box, each page's boxes in order (↺ in
 * a heading only where a box has more than one control), what the settings
 * search finds, a border switch showing Border thickness, a slider's ↺ and a
 * box's ↺, and that everything goes grey while saving is paused.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { App } from "obsidian";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness, searchSettings, type RenderedBox } from "./support/declarativeRenderer";
import type { ButtonLike, SliderComponent, ToggleComponent } from "./support/obsidianStub";
import { DEFAULT_SETTINGS } from "../src/constants";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutStudioSettingsTab } from "../src/settings/SettingsTab";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { calloutStyleGroup, STYLE_PAGES } from "../src/settings/declarative/stylePages";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import type { SettingsTabPlugin } from "../src/settings/sections/types";

installFakeDom();

// The stub has no embedded editor, so the preview draws its static fallback
// and says so once a page: that one warning is expected.
const { warn } = console;
before(() => {
	console.warn = (...args: unknown[]) => {
		if (String(args[0]).includes("embedded live preview unavailable")) return;
		warn(...args);
	};
});
after(() => {
	console.warn = warn;
});

/** A plugin with a real registry, counting the change rounds it announces. */
function fakePlugin(paused = false) {
	const registry = new CalloutRegistry();
	registry.load(null);
	const rounds: boolean[] = [];
	registry.onChange((change) => { rounds.push(change.persists); });
	const plugin = {
		app: {},
		registry,
		get settings() { return registry.settings; },
		settingsWriter: { isFrozen: paused },
		cssInjector: { inject: () => {} },
		saveSettings: () => Promise.resolve(),
		settingsEditOpen: false,
	};
	return { plugin, registry, rounds };
}

/** The Callout style box, drawn by the real settings tab. */
function drawStyle(plugin: object) {
	let redraws = 0;
	const ctx: TreeContext = {
		app: {} as App,
		plugin: plugin as SettingsTabPlugin,
		display: () => { redraws++; tab.update(); },
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: () => {},
	};
	const tab = new CalloutStudioSettingsTab({} as App, plugin as SettingsTabPlugin);
	tab.getSettingDefinitions = () => toObsidianItems([calloutStyleGroup(ctx)]);
	const harness = new DeclarativeHarness(tab as never);
	tab.update();
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

/** Whether a ↺ is dimmed (nothing to reset). */
function idle(button: ButtonLike): boolean {
	return (button.extraSettingsEl as unknown as HTMLElement).getAttribute("aria-disabled") === "true";
}

describe("the Callout style box", () => {
	it("opens the three role pages, Heading first, then the saved palettes and the icon libraries", () => {
		const { harness } = drawStyle(fakePlugin().plugin);
		assert.deepEqual(box(harness, STYLE_PAGES.box).children.map((r) => r.def.name), [
			t("settings.calloutTypeHeading"),
			t("settings.calloutTypeInline"),
			t("settings.calloutTypeRegular"),
			t("settings.customPalettes"),
			t("iconLibraries.manage"),
		]);
	});

	it("is how the settings search finds each control", () => {
		const { tab } = drawStyle(fakePlugin().plugin);
		const names = (query: string): string[] => searchSettings(tab.settingItems, query).map((hit) => hit.name);
		assert.deepEqual(names("radius"), Array(3).fill(t("settings.borderRadius")));
		assert.deepEqual(names("title size"), [t("settings.titleScale")]);
		assert.ok(names("outline").includes(t("settings.borderTop")));
		assert.deepEqual(names("fold arrow"), [t("settings.headingFoldArrow")]);
	});
});

describe("a style page", () => {
	it("is the preview, then its boxes, with ↺ in a heading only where a box has several controls", () => {
		const { harness } = drawStyle(fakePlugin().plugin);
		const layout = (page: string): [string | undefined, number][] => {
			harness.openPage([page]);
			return harness.rendered.map((b) => [b.def.heading, b.settingGroup.extraButtons.length]);
		};
		assert.deepEqual(layout(STYLE_PAGES.regular), [
			[undefined, 0], [undefined, 0], [t("settings.border"), 1], [t("settings.fontScaleGroup"), 1],
		]);
		assert.deepEqual(layout(STYLE_PAGES.heading), [
			[undefined, 0], [undefined, 0], [t("settings.border"), 1], [t("settings.headingSpacingGroup"), 1],
		]);
		assert.deepEqual(layout(STYLE_PAGES.inline), [[undefined, 0], [undefined, 0], [t("settings.border"), 1]]);
		// The inline text size, alone in its box, is named for what it is.
		assert.ok(harness.rows().some((r) => r.def.name === t("settings.fontScaleGroup")));
	});

	it("saves a border switch through the registry, and shows Border thickness while a side has one", async () => {
		const { plugin, registry, rounds } = drawStyleWith();
		const { harness } = plugin;
		harness.openPage([STYLE_PAGES.regular]);
		const width = (): HTMLElement => row(harness, "regular-border-width").settingEl;
		assert.equal(width().isShown(), false, "no side has a border by default");
		await (row(harness, "regular-border-left").setting.components[0] as ToggleComponent).commit(true);
		assert.equal(registry.settings.globalStyle.borderSides.left, true);
		assert.deepEqual(rounds, [true]);
		assert.equal(width().isShown(), true);
	});

	it("resets a slider with its own ↺, which is dimmed while there is nothing to reset", () => {
		const { plugin, registry, rounds } = drawStyleWith();
		const { harness } = plugin;
		registry.settings.globalStyle.borderRadius = 12;
		harness.openPage([STYLE_PAGES.regular]);
		const reset = row(harness, "regular-corner-rounding").setting.extraButtons[0] as ButtonLike;
		assert.equal(idle(reset), false);
		reset.press();
		assert.equal(registry.settings.globalStyle.borderRadius, DEFAULT_SETTINGS.globalStyle.borderRadius);
		assert.equal((row(harness, "regular-corner-rounding").setting.components[1] as SliderComponent).getValue(), DEFAULT_SETTINGS.globalStyle.borderRadius);
		assert.deepEqual(rounds, [true], "saved once");
		assert.equal(idle(reset), true);
	});

	it("resets a whole box with the ↺ in its heading", () => {
		const { plugin, registry } = drawStyleWith();
		const { harness, redraws } = plugin;
		registry.settings.globalStyle.titleScale = 1.2;
		registry.settings.globalStyle.contentScale = 0.8;
		harness.openPage([STYLE_PAGES.regular]);
		const fontBox = box(harness, "style-block-font-scale");
		const reset = fontBox.settingGroup.extraButtons[0] as ButtonLike;
		assert.equal(idle(reset), false);
		reset.press();
		assert.equal(registry.settings.globalStyle.titleScale, DEFAULT_SETTINGS.globalStyle.titleScale);
		assert.equal(registry.settings.globalStyle.contentScale, DEFAULT_SETTINGS.globalStyle.contentScale);
		assert.equal(redraws(), 1, "drawn again to show the defaults");
	});

	it("keeps the preview the same through redraws, out of the settings search", () => {
		const { plugin } = drawStyleWith();
		const { tab, harness } = plugin;
		harness.openPage([STYLE_PAGES.inline]);
		const preview = (): Element | null => row(harness, `${STYLE_PAGES.inline}-preview`).settingEl.querySelector(".cs-style-preview");
		const first = preview();
		assert.ok(first, "the preview is drawn");
		tab.update();
		assert.equal(preview(), first);
		assert.equal(row(harness, `${STYLE_PAGES.inline}-preview`).def.searchable, false);
	});

	it("pins the preview under the page's title bar once the row is laid out on the page", () => {
		// A ResizeObserver for the row's own window, recording what it watches.
		const observed: unknown[] = [];
		let laidOut = (): void => {};
		class Observer {
			constructor(callback: () => void) { laidOut = callback; }
			observe(element: unknown): void { observed.push(element); }
			disconnect(): void {}
		}
		const { plugin } = drawStyleWith();
		const { tab, harness } = plugin;
		const view = tab.containerEl.ownerDocument.defaultView as object;
		Object.assign(view, { ResizeObserver: Observer });
		try {
			harness.openPage([STYLE_PAGES.regular]);
			const rowEl = row(harness, `${STYLE_PAGES.regular}-preview`).settingEl;
			assert.deepEqual(observed, [rowEl], "drawn before its box is on the page, so the row is watched");
			laidOut();
			const titlebar = rowEl.closest(".setting-page")?.querySelector(".setting-page-titlebar");
			assert.ok(titlebar, "the page has its title bar");
			assert.deepEqual(observed, [rowEl, titlebar], "then the bar, for its height");
			const boxEl = rowEl.closest(".setting-group") as HTMLElement;
			assert.equal(boxEl.style.getPropertyValue("--cs-sticky-top"), "36px", "the fake bar's height");
		} finally {
			Reflect.deleteProperty(view, "ResizeObserver");
		}
	});
});

describe("while saving is paused", () => {
	it("greys every control, and a box's ↺ says why", () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			const { plugin, registry } = drawStyleWith(true);
			const { harness } = plugin;
			registry.settings.globalStyle.titleScale = 1.2;
			harness.openPage([STYLE_PAGES.regular]);
			for (const id of ["regular-corner-rounding", "regular-title-scale", "regular-border-top", "regular-align"]) {
				assert.equal(row(harness, id).setting.disabled, true, id);
			}
			(box(harness, "style-block-font-scale").settingGroup.extraButtons[0] as ButtonLike).press();
			assert.equal(notices.length, 1);
			assert.equal(registry.settings.globalStyle.titleScale, 1.2, "nothing reset");
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});
});

/** A plugin and the Callout style box drawn for it, together. */
function drawStyleWith(paused = false) {
	const made = fakePlugin(paused);
	return { ...made, plugin: drawStyle(made.plugin) };
}
