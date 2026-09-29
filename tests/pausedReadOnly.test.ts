/**
 * While saving is paused the settings page takes no edits. A change made there
 * used to look applied and vanish on the next launch. Everything that would
 * change a setting is inert; the title, the banner, folding the lists, Export,
 * Earlier setups and Review conversion are not.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { makePausedReadOnly } from "../src/settings/sections/pausedReadOnly";
import { renderBackupSection, renderImportExportSection, renderResetSection } from "../src/settings/sections/DataManagementSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { SettingsSaveStatus } from "../src/manager/settingsSaveStatus";
import { renderSaveStatusBanner } from "../src/settings/saveStatusBanner";
import { t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { fakeDom, type FakeElement } from "./support/fakeDom";

const inert = (el: FakeElement | null | undefined) => el?.getAttribute("inert") !== null && el?.getAttribute("inert") !== undefined;

function page() {
	const root = fakeDom.document.body.createDiv({ cls: "callout-studio-settings" });
	const header = root.createDiv({ cls: "setting-item cs-header-row" });
	const slot = root.createDiv();
	const section = root.createDiv({ cls: "cs-sticky-section" });
	const heading = section.createDiv({ cls: "setting-item cs-sticky-heading" });
	const fold = heading.createDiv({ cls: "setting-item-info" });
	const add = heading.createDiv({ cls: "setting-item-control" });
	const rows = section.createDiv();
	const plugin = { recovery: {}, settingsWriter: { isFrozen: true } };
	const ctx = { app: {} as App, plugin, display: () => {} } as unknown as SettingsSectionContext;
	renderImportExportSection(ctx, root as unknown as HTMLElement);
	renderBackupSection(ctx, root as unknown as HTMLElement);
	renderResetSection(ctx, root as unknown as HTMLElement);
	const row = (label: string) => root.querySelectorAll(".setting-item").find(el => el.dataset.csName === label);
	return { root, header, slot, fold, add, rows, row };
}

describe("the settings page while saving is paused", () => {
	it("makes every edit inert and leaves the way out usable", () => {
		const p = page();
		try {
			makePausedReadOnly(p.root as unknown as HTMLElement, [p.slot as unknown as HTMLElement]);
			assert.ok(p.root.hasClass("cs-settings-paused"));
			for (const [label, blocked] of [
				[t("settings.importTitle"), true],
				[t("settings.resetAll"), true],
				[t("settings.exportTitle"), false],
				[t("settings.recovery"), false],
				[t("portable.title"), false],
			] as const) {
				assert.equal(inert(p.row(label)), blocked, label);
			}
			assert.equal(inert(p.header), false, "the title row");
			assert.equal(inert(p.slot), false, "the banner");
			assert.equal(inert(p.fold), false, "folding a list is browsing, not editing");
			assert.equal(inert(p.add), true, "Add new callout");
			assert.equal(inert(p.rows), true, "the callout rows");
		} finally { p.root.remove(); }
	});

	it("says in the banner that nothing can be changed, and why that is safe", () => {
		const status = new SettingsSaveStatus();
		const container = fakeDom.document.createElement("div");
		const dispose = renderSaveStatusBanner({ app: {} as App, settingsWriter: {
			status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false,
		} }, container as unknown as HTMLElement, { pausedNote: true });
		try {
			status.freeze("missing");
			assert.ok(container.textContent.includes(en["saveStatus.readOnlyWhilePaused"]!));
		} finally { dispose(); }
	});
});
