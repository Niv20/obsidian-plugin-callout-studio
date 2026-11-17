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
 *
 * The website offer is the third notice, and the one that must know its place:
 * it names every service in one sentence, and it waits while either of the
 * other two has something to say.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { DeclarativeHarness } from "./support/declarativeRenderer";
import { PluginSettingTab } from "./support/obsidianStub";
import { bannersGroup } from "../src/settings/declarative/bannerRows";
import { MAIN_PAGE_ROWS } from "../src/settings/declarative/mainPageGroups";
import { disabledWhilePaused, refuseWhilePaused } from "../src/settings/declarative/pausedGuards";
import { PersistentParts } from "../src/settings/declarative/persistentParts";
import { RowRegistry } from "../src/settings/declarative/rowRegistry";
import { toObsidianItems, type TreeContext } from "../src/settings/declarative/types";
import { armCompetitorImportBanner } from "../src/settings/competitorImportState";
import type { WebExportMemory } from "../src/manager/DeviceLocalStore";
import { refreshWebOffer } from "../src/manager/web/webOffer";
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
			retrySettingsRecovery: () =>
				new Promise<boolean>((resolve) => {
					finishRetry = resolve;
				}),
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
function drawBanners(plugin: object, app: object = { setting: { openPagePath() {} } }) {
	const jumps: string[] = [];
	const jumpPaths: (readonly string[] | undefined)[] = [];
	let redraws = 0;
	const ctx: TreeContext = {
		app: app as never,
		plugin: plugin as never,
		redraw: () => {
			redraws++;
			tab.update();
		},
		registerDisposer: () => {},
		rows: new RowRegistry(),
		parts: new PersistentParts(() => {}),
		jumpTo: (rowId, _fromKeyboard, pagePath) => {
			jumps.push(rowId);
			jumpPaths.push(pagePath);
		},
	};
	const tab = new PluginSettingTab({}, {});
	tab.getSettingDefinitions = () => toObsidianItems([bannersGroup(ctx), { name: "Something else" }]);
	const harness = new DeclarativeHarness(tab);
	tab.update();
	return { tab, harness, jumps, jumpPaths, redraws: () => redraws };
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
		assert.equal(
			row.settingEl.querySelector(".cs-readonly-banner-title")?.textContent,
			t("saveStatus.titlePaused"),
		);
		const box = row.settingEl.querySelector(".cs-readonly-banner");
		assert.ok(box);
		assert.ok(box.classList.contains("cs-banner"), "drawn in the banners' one box");
		assert.ok(box.classList.contains("cs-banner-warning"), "in the warning colour");
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

	it("opens the Version history page with Go to version history", () => {
		const { harness, jumps, jumpPaths } = drawBanners(fakePlugin(true).plugin);
		const notice = harness.rows().find((r) => r.def.id === "saving-notice")!.settingEl;
		buttonWithText(notice, t("saveStatus.goToVersions")).click();
		assert.deepEqual(jumps, ["earlier-versions"]);
		assert.deepEqual(jumpPaths, [["earlier-versions"]], "the page itself is where it goes");
	});

	it("leaves Go to version history out where Obsidian cannot open a page from code (1.13.x)", () => {
		const { harness } = drawBanners(fakePlugin(true).plugin, { setting: {} });
		const notice = harness.rows().find((r) => r.def.id === "saving-notice")!.settingEl;
		const labels = Array.from(notice.querySelectorAll("button")).map((button) => button.textContent);
		assert.ok(!labels.includes(t("saveStatus.goToVersions")), "a button that cannot go anywhere is not offered");
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
		const box = offer().querySelector(".cs-competitor-import-banner");
		assert.ok(box);
		assert.ok(box.classList.contains("cs-banner"), "drawn in the banners' one box");
		assert.ok(box.classList.contains("cs-banner-accent"), "in the accent");
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
		assert.equal(
			harness
				.rows()
				.find((r) => r.def.id === "import-offer")!
				.settingEl.isShown(),
			false,
		);
	});
});

describe("the website offer", () => {
	/** A plugin with a device memory for the website export, paused or not. */
	function publishing(paused = false) {
		const { plugin } = fakePlugin(paused);
		const memory: { value: WebExportMemory } = { value: {} };
		Object.defineProperty(plugin.localState, "webExport", {
			get: () => ({ ...memory.value }),
		});
		Object.assign(plugin.localState, {
			setWebExport(next: WebExportMemory): void {
				memory.value = next;
			},
		});
		return { plugin, memory };
	}

	/** An app whose vault has `files` in its top folder, and whatever else `extra` says. */
	const vaultWith = (files: string[], extra: object = {}) => ({
		setting: { openPagePath() {} },
		vault: {
			configDir: ".obsidian",
			getName: () => "Notes",
			getMarkdownFiles: () => [],
			adapter: {
				exists: (path: string) => Promise.resolve(files.includes(path)),
				read: () => Promise.resolve(""),
			},
		},
		metadataCache: { getFileCache: () => null },
		...extra,
	});

	const quartzAndPublish = ["quartz.config.ts", "publish.css"];

	it("stays out until the vault was looked at, then names every service in one notice", async () => {
		const { plugin } = publishing();
		const app = vaultWith(quartzAndPublish);
		const { tab, harness } = drawBanners(plugin, app);
		const offer = (): HTMLElement => harness.rows().find((r) => r.def.id === "web-offer")!.settingEl;
		assert.equal(offer().isShown(), false);
		assert.equal(harness.rendered[0]!.groupEl.isShown(), false, "and the box with it");

		assert.equal(await refreshWebOffer(app as never, plugin as never), true);
		tab.update();
		assert.ok(offer().isShown());
		assert.equal(
			offer().querySelector(".cs-competitor-import-banner-message")?.textContent,
			t("webOffer.message", { services: `${t("web.serviceQuartz")} and ${t("web.servicePublish")}` }),
		);
		tab.update();
		assert.equal(offer().querySelectorAll(".cs-competitor-import-banner").length, 1, "one notice, not one each");
	});

	it("waits while the import offer is up, and takes its place once that is dismissed", async () => {
		const { plugin } = publishing();
		armCompetitorImportBanner(plugin as never);
		const app = vaultWith(quartzAndPublish, {
			plugins: { enabledPlugins: new Set(["obsidian-admonition"]), manifests: { "obsidian-admonition": {} } },
		});
		await refreshWebOffer(app as never, plugin as never);
		const { harness } = drawBanners(plugin, app);
		const row = (id: string): HTMLElement => harness.rows().find((r) => r.def.id === id)!.settingEl;
		assert.ok(row("import-offer").isShown());
		assert.equal(row("web-offer").isShown(), false, "one offer at a time");
		(row("import-offer").querySelector(".cs-competitor-import-banner-dismiss") as HTMLElement).click();
		assert.equal(row("import-offer").isShown(), false);
		assert.ok(row("web-offer").isShown());
	});

	it("waits while saving needs attention", async () => {
		const { plugin } = publishing(true);
		const app = vaultWith(quartzAndPublish);
		await refreshWebOffer(app as never, plugin as never);
		const { harness } = drawBanners(plugin, app);
		assert.ok(
			harness
				.rows()
				.find((r) => r.def.id === "saving-notice")!
				.settingEl.isShown(),
		);
		assert.equal(
			harness
				.rows()
				.find((r) => r.def.id === "web-offer")!
				.settingEl.isShown(),
			false,
		);
	});

	it("goes away for good when dismissed, for every service it named", async () => {
		const { plugin, memory } = publishing();
		const app = vaultWith(quartzAndPublish);
		await refreshWebOffer(app as never, plugin as never);
		const { harness, redraws } = drawBanners(plugin, app);
		const offer = (): HTMLElement => harness.rows().find((r) => r.def.id === "web-offer")!.settingEl;
		(offer().querySelector(".cs-competitor-import-banner-dismiss") as HTMLElement).click();
		assert.equal(redraws(), 1);
		assert.equal(offer().isShown(), false);
		assert.deepEqual(memory.value.offered, ["quartz", "publish"]);
		assert.equal(await refreshWebOffer(app as never, plugin as never), false, "the next visit offers nothing");
	});

	it("scrolls to the Publish to the web row with Show me, as the import offer does with its row", async () => {
		const { plugin, memory } = publishing();
		const app = vaultWith(quartzAndPublish);
		await refreshWebOffer(app as never, plugin as never);
		const { harness, jumps, jumpPaths } = drawBanners(plugin, app);
		const offer = harness.rows().find((r) => r.def.id === "web-offer")!.settingEl;
		buttonWithText(offer, t("webOffer.action")).click();
		assert.deepEqual(jumps, [MAIN_PAGE_ROWS.website]);
		assert.deepEqual(jumpPaths, [undefined], "the row on this page, not the page behind it");
		// Being shown where it is answers nothing: the offer stays until the
		// page is opened or the offer is dismissed.
		assert.equal(memory.value.offered, undefined);
		assert.ok(offer.isShown());
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
			const onDelete = refuseWhilePaused(
				writer,
				(index: number) => {
					calls.push(index);
				},
				() => {
					putBack++;
				},
			);
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
