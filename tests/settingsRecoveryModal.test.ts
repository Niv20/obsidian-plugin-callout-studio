/**
 * The window that lists every earlier setup: device history, backups and stray
 * copies of the settings file, each with how far it is from now. Restoring asks
 * first and is unavailable while saving is paused; exporting always works.
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
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { stubConfirm } from "./support/importSafetyStubs";

const older: Partial<PluginData> = { callouts: [] };
const same: Partial<PluginData> = { version: 5 };

function open(frozen: boolean, sources: RecoverySource[]) {
	fakeDom.light();
	const restored: unknown[] = [];
	const recovery = {
		listSources: () => Promise.resolve(sources),
		difference: (data: unknown) => ({ callouts: 1, changed: data === same ? 0 : 2 }),
		exportJson: () => "{}",
		restore: (data: unknown) => { restored.push(data); return Promise.resolve("restored" as const); },
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
	return { contentEl, restored, buttons, isClosed: () => closed, destroy: () => containerEl.remove() };
}

const history: RecoverySource = { kind: "history", time: Date.UTC(2026, 8, 20, 9), path: null, origin: "this-device", data: older };
const unchanged: RecoverySource = { kind: "backup", time: Date.UTC(2026, 8, 21, 9), path: "b/data-x.json", origin: "other-device", data: same };
const unreadable: RecoverySource = { kind: "copy", time: null, path: ".obsidian/plugins/callout-studio/data 2.json", origin: null, data: null };

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

	it("offers nothing to restore while saving is paused, and says why", async () => {
		const h = open(true, [history]);
		try {
			await setImmediate();
			assert.ok(h.contentEl.textContent.includes(en["recovery.pausedHint"]!));
			const restore = h.buttons(en["recovery.restore"]!)[0]!;
			assert.equal(restore.getAttribute("aria-disabled"), "true");
			restore.fire("click");
			await setImmediate();
			assert.deepEqual(h.restored, []);
			assert.equal(h.buttons(en["recovery.export"]!).length, 1, "exporting still works");
		} finally { h.destroy(); }
	});

	it("disables restoring a setup that is the same as now", async () => {
		const h = open(false, [unchanged]);
		try {
			await setImmediate();
			assert.equal(h.buttons(en["recovery.restore"]!)[0]!.getAttribute("aria-disabled"), "true");
		} finally { h.destroy(); }
	});
});
