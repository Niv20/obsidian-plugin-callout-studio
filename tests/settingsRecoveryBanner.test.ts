import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { getLocale, registerLocale, setLocale } from "../src/i18n";
import { en } from "../src/i18n/en";
import { confirmFreshStart } from "../src/manager/settingsNotices";
import { SettingsSaveStatus } from "../src/manager/settingsSaveStatus";
import { renderSaveStatusBanner } from "../src/settings/saveStatusBanner";
import { ConfirmModal } from "../src/utils/ConfirmModal";
import { installFakeDom } from "./support/fakeDom";
import { recoveryActionHarness } from "./support/recoveryActionHarness";
import { definition } from "./support/discoveryHarness";

const dom = installFakeDom();

function bannerHarness(hasRecoveryState: boolean, restore = true, retry: () => Promise<boolean> = async () => false) {
	const status = new SettingsSaveStatus();
	const host = { app: {} as App, settingsWriter: {
		status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false, hasRecoveryState,
	} };
	const container = dom.document.createElement("div");
	const dispose = renderSaveStatusBanner(host, container as unknown as HTMLElement, {
		retry, ...(restore ? { startFresh: async () => true } : {}),
	});
	status.freeze("missing");
	return { container, status, dispose };
}

describe("missing settings recovery banner", () => {
	it("offers restore on a running device as soon as its accepted file disappears", async () => {
		const h = recoveryActionHarness(); await h.boot();
		const container = h.dom.document.createElement("div");
		const dispose = renderSaveStatusBanner(h.host, container as unknown as HTMLElement, {
			retry: () => h.editor.retrySettingsRecovery!(), startFresh: () => h.editor.startFreshSettings!(),
		});
		try {
			h.state.disk = null;
			h.host.registry.add(definition({ id: "local-change" }));
			await h.host.saveSettings();
			assert.equal(container.querySelector(".cs-readonly-banner-title")?.textContent, "Saving is paused");
			assert.deepEqual(container.querySelectorAll("button").map(button => button.textContent), ["Restore these settings", "Check again"]);
			assert.equal(container.querySelector(".mod-warning"), null);
		} finally { dispose(); h.host.settingsWriter.destroy(); }
	});
	for (const recovered of [true, false]) {
		it(`uses ${recovered ? "restore" : "create"} wording for ${recovered ? "a saved recovery" : "an unavailable recovery"} state`, () => {
			const h = bannerHarness(recovered);
			try {
				const buttons = h.container.querySelectorAll("button");
				assert.equal(buttons[0]?.textContent, recovered ? "Restore these settings" : "Create settings file");
				assert.equal(buttons[0]?.hasClass("mod-cta"), recovered);
				assert.equal(buttons[1]?.textContent, "Check again");
				assert.equal(h.container.querySelector(".mod-warning"), null);
			} finally { h.dispose(); }
		});
	}
	it("keeps the result of a completed check visible and leaves further checks available", async () => {
		let finish!: (value: boolean) => void;
		const h = bannerHarness(true, true, () => new Promise(resolve => { finish = resolve; }));
		try {
			h.container.querySelectorAll("button")[1]!.dispatchEvent({ type: "click" });
			assert.match(h.container.textContent, /Checking saving and recovery/);
			assert.ok(h.container.querySelectorAll("button").every(button => button.disabled));
			finish(false); await Promise.resolve(); await Promise.resolve();
			assert.match(h.container.textContent, /The settings file is still missing/);
			assert.match(h.container.textContent, /Checking again does not recreate it/);
			assert.ok(h.container.querySelectorAll("button").every(button => !button.disabled));
			h.status.clear();
			assert.match(h.container.textContent, /The settings file is still missing/);
			h.status.thaw();
			assert.equal(h.container.querySelector(".cs-readonly-banner"), null);
		} finally { h.dispose(); }
	});
	it("directs an editor to recovery on the same device without claiming unsaved edits survive closing", () => {
		const h = bannerHarness(true, false);
		try {
			assert.equal(h.container.querySelectorAll("button").length, 1);
			assert.match(h.container.textContent, /on this device, open Callout Studio settings/);
			assert.match(h.container.textContent, /Before closing this editor, copy any unsaved edits/);
		} finally { h.dispose(); }
	});
	it("keeps ordinary write and unreadable failures separate from missing-file restoration", () => {
		const h = bannerHarness(true);
		try {
			h.status.thaw(); h.status.fail("write");
			assert.equal(h.container.querySelector(".cs-readonly-banner-title")?.textContent, "Settings were not saved");
			assert.deepEqual(h.container.querySelectorAll("button").map(button => button.textContent), ["Retry saving and recovery"]);
			h.status.freeze("unreadable");
			assert.equal(h.container.querySelectorAll("button").length, 1);
			assert.match(h.container.textContent, /The existing file has been kept/);
		} finally { h.dispose(); }
	});
	it("falls back to revised English when an existing translation only contains the old reset wording", async () => {
		const locale = getLocale();
		const original = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		let confirmation: { title: string; message: string; confirmLabel: string; confirmClass: string } | undefined;
		try {
			registerLocale("test-old-recovery", {
				"saveStatus.newFile": "Obsolete action", "confirm.titleStartFresh": "Obsolete title",
				"confirm.startFresh": "Obsolete explanation", "confirm.startFreshOk": "Obsolete button",
			});
			setLocale("test-old-recovery");
			const h = bannerHarness(true);
			try { assert.equal(h.container.querySelector("button")?.textContent, "Restore these settings"); }
			finally { h.dispose(); }
			ConfirmModal.prototype.confirm = function () {
				confirmation = this as unknown as NonNullable<typeof confirmation>;
				return Promise.resolve(false);
			};
			assert.equal(await confirmFreshStart({} as App, null, async () => true, true), false);
			assert.equal(confirmation?.title, en["confirm.titleRestoreSettings"]);
			assert.equal(confirmation?.confirmLabel, "Restore these settings");
			assert.equal(confirmation?.confirmClass, "mod-cta");
			assert.match(confirmation?.message ?? "", /callout types and preferences currently shown/);
			assert.match(confirmation?.message ?? "", /recovery copy is backed up first/);
			assert.match(confirmation?.message ?? "", /other devices/);
		} finally {
			setLocale(locale);
			Object.defineProperty(ConfirmModal.prototype, "confirm", original);
		}
	});
});

describe("the way out of an unreadable file", () => {
	function unreadable(diagnosis: import("../src/manager/settingsDiagnosis").SettingsDiagnosis, reason: "unreadable" | "recovery-read" = "unreadable") {
		const status = new SettingsSaveStatus();
		const host = { app: {} as App, settingsWriter: {
			status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false,
		} };
		const calls: string[] = [];
		const container = dom.document.createElement("div");
		const dispose = renderSaveStatusBanner(host, container as unknown as HTMLElement, {
			retry: async () => false,
			diagnose: async () => diagnosis,
			replaceUnreadable: async () => { calls.push("replace"); return true; },
			discardRecoveryCopy: async () => { calls.push("discard"); return true; },
			openRecovery: () => { calls.push("recovery"); },
		});
		status.freeze(reason);
		return { container, calls, dispose, buttons: () => container.querySelectorAll("button") };
	}
	const settle = () => new Promise(resolve => setImmediate(resolve));

	it("names the cause, and offers to replace a file that waiting will not fix", async () => {
		const h = unreadable("merge-markers");
		try {
			await settle();
			assert.ok(h.container.textContent.includes(en["saveStatus.diagnosis.mergeMarkers"]!));
			const replace = h.buttons().find(button => button.textContent === en["saveStatus.replaceUnreadable"]);
			assert.ok(replace?.hasClass("mod-warning"));
		} finally { h.dispose(); }
	});

	it("does not offer to replace a file that is only unavailable on this device", async () => {
		const h = unreadable("unavailable");
		try {
			await settle();
			assert.ok(h.container.textContent.includes(en["saveStatus.diagnosis.unavailable"]!));
			assert.ok(!h.buttons().some(button => button.textContent === en["saveStatus.replaceUnreadable"]));
		} finally { h.dispose(); }
	});

	it("replaces only after a confirmation that says an exact copy is kept", async () => {
		const confirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		const asked: string[] = [];
		ConfirmModal.prototype.confirm = function (this: ConfirmModal) {
			asked.push((this as unknown as { message: string }).message);
			return Promise.resolve(asked.length > 1);
		};
		const h = unreadable("combined");
		try {
			await settle();
			const replace = () => h.buttons().find(button => button.textContent === en["saveStatus.replaceUnreadable"])!;
			replace().fire("click"); await settle(); await settle();
			assert.deepEqual(h.calls, [], "replaced without a yes");
			replace().fire("click"); await settle(); await settle();
			assert.deepEqual(h.calls, ["replace"]);
			assert.deepEqual(asked, [en["confirm.replaceUnreadableSalvage"], en["confirm.replaceUnreadableSalvage"]]);
		} finally { h.dispose(); Object.defineProperty(ConfirmModal.prototype, "confirm", confirm); }
	});

	it("offers to discard an unreadable recovery copy, and earlier setups in every paused state", async () => {
		const h = unreadable("readable", "recovery-read");
		try {
			await settle();
			const labels = h.buttons().map(button => button.textContent);
			assert.ok(labels.includes(en["saveStatus.discardRecoveryCopy"]!));
			assert.ok(labels.includes(en["saveStatus.openRecovery"]!));
			h.buttons().find(button => button.textContent === en["saveStatus.openRecovery"])!.fire("click");
			assert.deepEqual(h.calls, ["recovery"]);
		} finally { h.dispose(); }
	});
});
