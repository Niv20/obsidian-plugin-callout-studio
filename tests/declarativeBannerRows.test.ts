/**
 * tests/declarativeBannerRows.test.ts — the notices at the top of the
 * declarative settings page, and the guards that keep the page read-only while
 * saving is paused (settings/declarative/bannerRows.ts, pausedGuards.ts).
 *
 * The saving notice is the case that made "parts that survive a redraw"
 * necessary: while one of its actions runs, its buttons are disabled, and a
 * redraw in the middle used to enable them again, letting a second restore
 * start. These tests run an action that has not finished, redraw the page,
 * and check that the notice is still the same, still busy.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness } from "./support/declarativeRenderer";
import { PluginSettingTab } from "./support/obsidianStub";
import { bannersGroup } from "../src/settings/declarative/bannerRows";
import { disabledWhilePaused, refuseWhilePaused } from "../src/settings/declarative/pausedGuards";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import { armCompetitorImportBanner } from "../src/settings/competitorImportState";
import { SettingsSaveStatus } from "../src/manager/settingsSaveStatus";
import { t } from "../src/i18n";

installFakeDom();

/** A plugin whose saving is paused because the settings file is missing (or not). */
function fakePlugin(paused: boolean) {
	const status = new SettingsSaveStatus();
	if (paused) status.freeze("missing");
	let finishRetry: (worked: boolean) => void = () => {};
	return {
		plugin: {
			settingsWriter: { isFrozen: paused, isDestroyed: false, status, hasRecoveryState: true },
			// A retry that waits until the test lets it finish.
			retrySettingsRecovery: () => new Promise<boolean>((resolve) => { finishRetry = resolve; }),
			startFreshSettings: () => Promise.resolve(true),
			recovery: {},
			// What the import offer reads and writes when dismissed.
			registry: { settings: {} },
			localState: { markImportBannerHandled: () => {} },
			settings: {},
			saveSettings: () => Promise.resolve(),
		},
		status,
		finishRetry: (worked: boolean) => finishRetry(worked),
	};
}

/** The banners box drawn through the test renderer, with the jumps it asks for recorded. */
function drawBanners(plugin: object, app: object = {}) {
	const jumps: string[] = [];
	let redraws = 0;
	const ctx: TreeContext = {
		app: app as never,
		plugin: plugin as never,
		redraw: () => { redraws++; tab.update(); },
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: (rowId) => { jumps.push(rowId); },
	};
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([bannersGroup(ctx), { name: "Something else" }]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness, jumps, redraws: () => redraws };
}

/**
 * The saving notice's own element, the one the parts store keeps. The notice
 * draws into a slot inside it and redraws that slot whenever its state
 * changes, so the `.cs-readonly-banner` inside is new after every change: it
 * is the element two levels up that must stay the same.
 */
function noticePart(row: HTMLElement): Element | null {
	return row.querySelector(".cs-readonly-banner")?.parentElement?.parentElement ?? null;
}

/** The button in `el` whose text is `text`. */
function buttonWithText(el: HTMLElement, text: string): HTMLButtonElement {
	const found = Array.from(el.querySelectorAll("button")).find((button) => button.textContent === text);
	assert.ok(found, `no "${text}" button`);
	return found;
}

describe("the saving notice", () => {
	it("shows while saving is paused, and the box hides when nothing needs saying", () => {
		const paused = drawBanners(fakePlugin(true).plugin).harness;
		const row = paused.rows().find((r) => r.def.id === "saving-notice")!;
		assert.ok(row.settingEl.isShown());
		assert.equal(row.settingEl.querySelector(".cs-readonly-banner-title")?.textContent, t("saveStatus.titlePaused"));
		const quiet = drawBanners(fakePlugin(false).plugin).harness;
		assert.equal(quiet.rendered[0]!.groupEl.isShown(), false);
	});

	it("stays the same notice, still busy, through redraws in the middle of an action", () => {
		const { plugin, finishRetry } = fakePlugin(true);
		const { tab, harness } = drawBanners(plugin);
		const notice = (): HTMLElement => harness.rows().find((r) => r.def.id === "saving-notice")!.settingEl;
		const part = noticePart(notice());
		assert.ok(part);
		buttonWithText(notice(), t("saveStatus.checkAgain")).click();
		tab.update();
		tab.update();
		assert.equal(notice().querySelectorAll(".cs-readonly-banner").length, 1, "not doubled");
		assert.equal(noticePart(notice()), part, "not rebuilt");
		const disabled = Array.from(notice().querySelectorAll("button")).map((button) => button.disabled);
		assert.ok(disabled.length > 0 && disabled.every(Boolean), "every button still waits for the action");
		finishRetry(false);
	});

	it("goes to the Earlier versions row with Go to version history", () => {
		const { harness, jumps } = drawBanners(fakePlugin(true).plugin);
		const notice = harness.rows().find((r) => r.def.id === "saving-notice")!.settingEl;
		buttonWithText(notice, t("saveStatus.goToVersions")).click();
		assert.deepEqual(jumps, ["earlier-versions"]);
	});
});

describe("the import offer", () => {
	/** An app with Admonition installed and enabled. */
	const withAdmonition = {
		plugins: {
			enabledPlugins: new Set(["obsidian-admonition"]),
			manifests: { "obsidian-admonition": {} },
		},
	};

	it("shows once armed, sends Import to the Import row, and does not double on redraw", () => {
		const { plugin } = fakePlugin(false);
		armCompetitorImportBanner(plugin as never);
		const { tab, harness, jumps } = drawBanners(plugin, withAdmonition);
		const offer = (): HTMLElement => harness.rows().find((r) => r.def.id === "import-offer")!.settingEl;
		assert.ok(offer().isShown());
		assert.match(offer().textContent ?? "", /Admonition/);
		tab.update();
		assert.equal(offer().querySelectorAll(".cs-competitor-import-banner").length, 1);
		buttonWithText(offer(), t("importBanner.action")).click();
		assert.deepEqual(jumps, ["import-callouts"]);
	});

	it("goes away for good when dismissed", () => {
		const { plugin } = fakePlugin(false);
		armCompetitorImportBanner(plugin as never);
		const { harness, redraws } = drawBanners(plugin, withAdmonition);
		const offer = harness.rows().find((r) => r.def.id === "import-offer")!.settingEl;
		(offer.querySelector(".cs-competitor-import-banner-dismiss") as HTMLElement).click();
		assert.equal(redraws(), 1);
		assert.equal(harness.rows().find((r) => r.def.id === "import-offer")!.settingEl.isShown(), false);
	});
});

describe("paused guards", () => {
	it("refuse a change while paused, explaining why and putting the screen back", () => {
		const notices: string[] = [];
		(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
		try {
			const writer = { isFrozen: true };
			const calls: number[] = [];
			let putBack = 0;
			const onDelete = refuseWhilePaused(writer, (index: number) => { calls.push(index); }, () => { putBack++; });
			onDelete(2);
			assert.deepEqual(calls, []);
			assert.equal(putBack, 1);
			assert.equal(notices.length, 1);
			writer.isFrozen = false;
			onDelete(2);
			assert.deepEqual(calls, [2], "the arguments pass through untouched");
			assert.equal(disabledWhilePaused(writer)(), false);
		} finally {
			delete (globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__;
		}
	});
});
