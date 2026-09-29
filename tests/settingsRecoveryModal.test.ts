/**
 * The window that lists every earlier setup: device history, backups and stray
 * copies of the settings file, each with how far it is from now. Restoring asks
 * first and is unavailable while saving is paused; viewing remains available.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { Notice } from "./support/obsidianStub";
import type { PluginData } from "../src/types";
import { SettingsRecoveryModal, type RecoveryModalPlugin } from "../src/settings/SettingsRecoveryModal";
import type { RecoverySource, SettingsRecoveryService } from "../src/manager/settingsRecoveryService";
import { en } from "../src/i18n/en";
import { getLocale, setLocale } from "../src/i18n";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { stubConfirm } from "./support/importSafetyStubs";
import { readRepoFile } from "./support/sourceScan";

const older: Partial<PluginData> = { callouts: [] };
const same: Partial<PluginData> = { version: 5 };

function open(frozen: boolean, sources: RecoverySource[]) {
	fakeDom.light();
	const previousLocale = getLocale(); setLocale("en");
	const restored: unknown[] = [];
	const removed: RecoverySource[] = [];
	const recovery = {
		listSources: () => Promise.resolve(sources),
		difference: (data: unknown) => ({ callouts: 1, changed: data === same ? 0 : 2 }),
		restore: (data: unknown) => { restored.push(data); return Promise.resolve("restored" as const); },
		remove: (source: RecoverySource) => { removed.push(source); return Promise.resolve(true); },
	} as unknown as SettingsRecoveryService;
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const plugin: RecoveryModalPlugin = { recovery, settingsWriter: { isFrozen: frozen } };
	const modal = new SettingsRecoveryModal(app, plugin);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	let closed = false;
	Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; },
		close: () => { closed = true; modal.onClose(); } });
	modal.onOpen();
	const buttons = (label: string): FakeElement[] =>
		contentEl.querySelectorAll(".clickable-icon").filter(el => el.dataset.csText === label);
	const iconButtons = (tooltip: string): FakeElement[] =>
		contentEl.querySelectorAll(".clickable-icon").filter(el => el.dataset.csTooltip === tooltip);
	return { contentEl, restored, removed, buttons, iconButtons, isClosed: () => closed,
		destroy: () => { modal.onClose(); containerEl.remove(); setLocale(previousLocale); } };
}

const history: RecoverySource = { kind: "history", time: Date.UTC(2026, 8, 20, 9), path: null, historyHash: "h1", origin: "this-device", data: older };
const unchanged: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 21, 9), path: "b/data-x.json", historyHash: null, origin: "other-device", data: same };
const unreadable: RecoverySource = { kind: "copy", time: null, path: ".obsidian/plugins/callout-studio/data 2.json", historyHash: null, origin: null, data: null };

describe("the earlier-setups window", () => {
	it("groups what it found, and says how each differs from now", async () => {
		const h = open(false, [history, unchanged, unreadable]);
		try {
			await setImmediate();
			const text = h.contentEl.textContent;
			for (const key of ["recovery.sectionHistory", "recovery.sectionBackups", "recovery.sectionCopies", "recovery.same", "recovery.unreadable"]) {
				assert.ok(text.includes(en[key]!), key);
			}
			assert.ok(text.includes("data 2.json"));
			assert.equal(h.buttons(en["recovery.restore"]!).length, 2, "an unreadable copy offers nothing to restore");
			assert.equal(h.iconButtons(en["recovery.delete"]!).length, 3, "every entry can be deleted, even an unreadable one");
			const groups = h.contentEl.querySelectorAll(".cs-recovery-group");
			assert.equal(groups.length, 3);
			for (const group of groups) {
				const heading = group.querySelector(".cs-collapsible-heading");
				assert.ok(heading, "source group has a shared collapsible heading");
				assert.equal(heading.querySelector(".cs-disclosure-chevron") !== null, true, "source group uses the shared chevron");
				assert.equal(heading.querySelector(".setting-item-name")?.getAttribute("aria-expanded"), "true", "source groups start expanded");
				assert.equal(group.querySelector(".cs-recovery-group-count")?.textContent, "(1)");
				assert.equal(group.querySelector("summary"), null, "source groups do not use a native summary");
			}
			const firstGroup = groups[0]!;
			const firstHeading = firstGroup.querySelector(".cs-collapsible-heading");
			const firstName = firstHeading?.querySelector(".setting-item-name");
			const firstBody = firstGroup.querySelector(".cs-recovery-group-rows");
			assert.ok(firstName, "source group heading has a clickable name");
			assert.ok(firstBody, "source group has a collapsible body");
			firstName.fire("click");
			assert.equal(firstName.getAttribute("aria-expanded"), "false");
			assert.equal(firstBody.hasClass("is-collapsed"), true);
			firstName.fire("click");
			assert.equal(firstName.getAttribute("aria-expanded"), "true");
			assert.equal(firstBody.hasClass("is-collapsed"), false);
			assert.equal(h.contentEl.querySelectorAll(".cs-recovery-row.callout-studio-row").length, 3);
		} finally { h.destroy(); }
	});

	it("restores only after a yes, then closes", async () => {
		const confirm = stubConfirm(true);
		const h = open(false, [history]);
		try {
			await setImmediate();
			h.buttons(en["recovery.restore"]!)[0]!.fire("click");
			await setImmediate();
			assert.deepEqual(h.restored, [older]);
			assert.deepEqual(confirm.asked, [en["recovery.confirmTitle"]]);
			assert.ok(h.isClosed());
			assert.ok(String(Notice.last?.message).startsWith("Restored the setup from"));
		} finally { confirm.restore(); h.destroy(); }
	});

	it("deletes only after a yes, then refreshes the list", async () => {
		const confirm = stubConfirm(true);
		const h = open(false, [history]);
		try {
			await setImmediate();
			h.iconButtons(en["recovery.delete"]!)[0]!.fire("click");
			await setImmediate();
			assert.deepEqual(h.removed, [history]);
			assert.deepEqual(confirm.asked, [en["recovery.deleteConfirmTitle"]]);
			assert.ok(!h.isClosed(), "deleting does not close the window the way restoring does");
			assert.ok(String(Notice.last?.message).startsWith("Deleted the copy from"));
		} finally { confirm.restore(); h.destroy(); }
	});

	it("deletes nothing on a no", async () => {
		const confirm = stubConfirm(false);
		const h = open(false, [history]);
		try {
			await setImmediate();
			h.iconButtons(en["recovery.delete"]!)[0]!.fire("click");
			await setImmediate();
			assert.deepEqual(h.removed, []);
		} finally { confirm.restore(); h.destroy(); }
	});

	it("never shows a row's origin device, even for a backup from another device", async () => {
		const myBackup: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 22, 9), path: "b/data-y.json", historyHash: null, origin: "this-device", data: older };
		const h = open(false, [history, unchanged, myBackup]);
		try {
			await setImmediate();
			for (const key of ["recovery.originThisDevice", "recovery.originOtherDevice", "recovery.originOlderVersion"] as const) {
				assert.ok(!h.contentEl.textContent.includes(en[key]!), `should not surface ${key}`);
			}
		} finally { h.destroy(); }
	});

	it("offers nothing to restore while saving is paused, and says why", async () => {
		const h = open(true, [history]);
		try {
			await setImmediate();
			assert.ok(h.contentEl.textContent.includes(en["recovery.pausedViewHint"]!));
			const restore = h.buttons(en["recovery.restore"]!)[0]!;
			assert.equal(restore.getAttribute("aria-disabled"), "true");
			restore.fire("click");
			await setImmediate();
			assert.deepEqual(h.restored, []);
			assert.equal(h.contentEl.querySelectorAll(".clickable-icon").filter(button => button.dataset.csTooltip === en["recovery.details.view"]).length,
				1, "viewing details still works");
		} finally { h.destroy(); }
	});

	it("disables restoring a setup that is the same as now", async () => {
		const h = open(false, [unchanged]);
		try {
			await setImmediate();
			assert.equal(h.buttons(en["recovery.restore"]!)[0]!.getAttribute("aria-disabled"), "true");
		} finally { h.destroy(); }
	});

	// The row wears `.callout-studio-row`, a size container. Obsidian's unnamed
	// `@container (max-width: 400px)` settings rules then pinned its control to
	// the full row width in any narrow window, collapsing the text column to 0px.
	it("keeps its rows out of Obsidian's narrow-container settings rules", () => {
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		assert.match(css, /\.cs-recovery-row\.callout-studio-row\s*\{\s*container-type:\s*normal;/);
		const rowRules = css.match(/[^{}]*\.cs-recovery-row[^{}]*\{[^{}]*\}/g) ?? [];
		assert.ok(!rowRules.some(rule => /overflow-wrap:\s*anywhere/.test(rule)),
			"`anywhere` lets the text column shrink to a letter per line");
	});
});
