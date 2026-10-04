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

function bannerHarness(hasRecoveryState: boolean, restore = true, retry: () => Promise<boolean> = async () => false,
	startFresh: () => Promise<boolean> = async () => true) {
	const status = new SettingsSaveStatus();
	const host = { app: {} as App, settingsWriter: {
		status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false, hasRecoveryState,
	} };
	const container = dom.document.createElement("div");
	const dispose = renderSaveStatusBanner(host, container as unknown as HTMLElement, {
		retry, ...(restore ? { startFresh } : {}),
	});
	status.freeze("missing");
	const buttons = () => container.querySelectorAll("button");
	const button = (label: string) => buttons().find(candidate => candidate.textContent === label)!;
	return { container, status, dispose, buttons, button, labels: () => buttons().map(candidate => candidate.textContent) };
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
			assert.deepEqual(container.querySelectorAll("button").map(button => button.textContent), ["Check again", "Restore these settings"]);
			assert.equal(container.querySelector(".mod-warning"), null);
		} finally { dispose(); h.host.settingsWriter.destroy(); }
	});
	for (const recovered of [true, false]) {
		it(`asks to check first, then offers ${recovered ? "restore" : "create"} wording for ${recovered ? "a saved recovery" : "an unavailable recovery"} state`, () => {
			const h = bannerHarness(recovered);
			try {
				const restore = recovered ? "Restore these settings" : "Create settings file";
				assert.deepEqual(h.labels(), ["Check again", restore]);
				assert.equal(h.button("Check again").hasClass("mod-cta"), true, "checking is the first step");
				assert.equal(h.button(restore).hasClass("mod-cta"), false);
				assert.equal(h.container.querySelector(".mod-warning"), null);
			} finally { h.dispose(); }
		});
	}
	for (const recovered of [true, false]) {
		it(`leads with ${recovered ? "restore" : "create"} once a check has come back empty, and keeps it there`, async () => {
			let cancelled = false;
			const h = bannerHarness(recovered, true, async () => false);
			const confirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
			ConfirmModal.prototype.confirm = function () { cancelled = true; return Promise.resolve(false); };
			try {
				const restore = recovered ? "Restore these settings" : "Create settings file";
				h.button("Check again").fire("click");
				await new Promise(resolve => setImmediate(resolve));
				assert.deepEqual(h.labels(), [restore, "Check again"]);
				// Restoring the setup shown is the main step now; creating a file from
				// what may be only the built-ins never is.
				assert.equal(h.button(restore).hasClass("mod-cta"), recovered);
				assert.equal(h.button("Check again").hasClass("mod-cta"), false);
				// A cancelled confirmation does not send the reader back to step one.
				h.button(restore).fire("click");
				await new Promise(resolve => setImmediate(resolve));
				assert.equal(cancelled, true);
				assert.deepEqual(h.labels(), [restore, "Check again"]);
				assert.equal(h.button(restore).hasClass("mod-cta"), recovered);
			} finally { h.dispose(); Object.defineProperty(ConfirmModal.prototype, "confirm", confirm); }
		});
	}
	it("keeps the result of a completed check visible and leaves further checks available", async () => {
		let finish!: (value: boolean) => void;
		const h = bannerHarness(true, true, () => new Promise(resolve => { finish = resolve; }));
		try {
			h.button("Check again").fire("click");
			assert.match(h.container.textContent, /Working on it…/);
			assert.match(h.container.textContent, /take a deep breath/, "the calm opening stays while checking");
			assert.deepEqual(h.labels(), ["Check again", "Restore these settings"], "the order holds while checking");
			assert.ok(h.buttons().every(button => button.disabled));
			finish(false); await Promise.resolve(); await Promise.resolve();
			assert.match(h.container.textContent, /The settings file still isn't back/);
			assert.match(h.container.textContent, /it never creates a new one/);
			assert.match(h.container.textContent, /iCloud, OneDrive, Google Drive or Dropbox/);
			assert.ok(h.buttons().every(button => !button.disabled));
			h.status.clear();
			assert.match(h.container.textContent, /The settings file still isn't back/);
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
			assert.deepEqual(h.container.querySelectorAll("button").map(button => button.textContent), ["Try again"]);
			h.status.freeze("unreadable");
			assert.equal(h.container.querySelectorAll("button").length, 1);
			assert.match(h.container.textContent, /it has left the file exactly as it is/);
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
			try { assert.ok(h.labels().includes("Restore these settings")); }
			finally { h.dispose(); }
			ConfirmModal.prototype.confirm = function () {
				confirmation = this as unknown as NonNullable<typeof confirmation>;
				return Promise.resolve(false);
			};
			assert.equal(await confirmFreshStart({} as App, null, async () => true, true), false);
			assert.equal(confirmation?.title, en["confirm.titleRestoreSettings"]);
			assert.equal(confirmation?.confirmLabel, "Restore these settings");
			assert.equal(confirmation?.confirmClass, "mod-cta");
			// Plain words, the same safety facts: what is saved, what is backed up
			// first, what reaches the other devices, and the last look for the file.
			assert.equal(confirmation?.message, en["confirm.saveDisplayedSettings"]);
			assert.match(confirmation?.message ?? "", /saves the setup you see now/);
			assert.match(confirmation?.message ?? "", /backed up first/);
			assert.match(confirmation?.message ?? "", /other devices/);
			assert.match(confirmation?.message ?? "", /looks for the settings file once more/);
		} finally {
			setLocale(locale);
			Object.defineProperty(ConfirmModal.prototype, "confirm", original);
		}
	});
});

describe("the way out of an unreadable file", () => {
	function unreadable(diagnosis: import("../src/manager/settingsDiagnosis").SettingsDiagnosis, reason: "unreadable" | "recovery-read" = "unreadable",
		diagnoses: import("../src/manager/settingsDiagnosis").SettingsDiagnosis[] = []) {
		const status = new SettingsSaveStatus();
		const host = { app: {} as App, settingsWriter: {
			status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false,
		} };
		const calls: string[] = [];
		const container = dom.document.createElement("div");
		const dispose = renderSaveStatusBanner(host, container as unknown as HTMLElement, {
			retry: async () => false,
			// Later looks can find something else: a file that changed meanwhile.
			diagnose: async () => diagnoses.shift() ?? diagnosis,
			replaceUnreadable: async () => { calls.push("replace"); return true; },
			discardRecoveryCopy: async () => { calls.push("discard"); return true; },
			showBackup: () => { calls.push("backup"); },
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

	it("offers replacing a combined file as the step to take, since it keeps every setting", async () => {
		const confirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		const classes: string[] = [];
		ConfirmModal.prototype.confirm = function (this: ConfirmModal) {
			classes.push((this as unknown as { confirmClass: string }).confirmClass);
			return Promise.resolve(true);
		};
		const h = unreadable("combined");
		try {
			await settle();
			const replace = h.buttons().find(button => button.textContent === en["saveStatus.replaceUnreadable"])!;
			assert.ok(replace.hasClass("mod-cta"), "not red: nothing is lost");
			assert.ok(!replace.hasClass("mod-warning"));
			const tryAgain = h.buttons().find(button => button.textContent === en["saveStatus.tryAgain"])!;
			assert.ok(!tryAgain.hasClass("mod-cta"), "one main button");
			replace.fire("click"); await settle(); await settle();
			assert.deepEqual(classes, ["mod-cta"], "and its confirmation is not a warning either");
			assert.deepEqual(h.calls, ["replace"]);
		} finally { h.dispose(); Object.defineProperty(ConfirmModal.prototype, "confirm", confirm); }
	});

	it("keeps a warning for every cause that loses what the file held", async () => {
		const confirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		const classes: string[] = [];
		ConfirmModal.prototype.confirm = function (this: ConfirmModal) {
			classes.push((this as unknown as { confirmClass: string }).confirmClass);
			return Promise.resolve(false);
		};
		try {
			for (const cause of ["empty", "merge-markers", "damaged", "invalid-entries"] as const) {
				const h = unreadable(cause);
				try {
					await settle();
					const replace = h.buttons().find(button => button.textContent === en["saveStatus.replaceUnreadable"])!;
					assert.ok(replace.hasClass("mod-warning"), cause);
					replace.fire("click"); await settle();
				} finally { h.dispose(); }
			}
			assert.deepEqual(classes, ["mod-warning", "mod-warning", "mod-warning", "mod-warning"]);
		} finally { Object.defineProperty(ConfirmModal.prototype, "confirm", confirm); }
	});

	it("does not replace a combined file that has since become another kind of broken", async () => {
		const confirm = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
		ConfirmModal.prototype.confirm = () => Promise.resolve(true);
		// First look: combined. The look after the yes: damaged.
		const h = unreadable("damaged", "unreadable", ["combined", "damaged"]);
		try {
			await settle();
			const replace = h.buttons().find(button => button.textContent === en["saveStatus.replaceUnreadable"])!;
			assert.ok(replace.hasClass("mod-cta"));
			replace.fire("click"); await settle(); await settle(); await settle();
			assert.deepEqual(h.calls, [], "the promise to keep everything no longer holds");
			// The banner looked again, and now says what the file is.
			assert.ok(h.container.textContent.includes(en["saveStatus.diagnosis.damaged"]!));
			assert.ok(h.buttons().find(button => button.textContent === en["saveStatus.replaceUnreadable"])!.hasClass("mod-warning"));
		} finally { h.dispose(); Object.defineProperty(ConfirmModal.prototype, "confirm", confirm); }
	});

	it("offers to discard an unreadable recovery copy, and the way to backups in every paused state", async () => {
		const h = unreadable("readable", "recovery-read");
		try {
			await settle();
			const labels = h.buttons().map(button => button.textContent);
			assert.ok(labels.includes(en["saveStatus.discardRecoveryCopy"]!));
			assert.ok(labels.includes(en["saveStatus.goToVersions"]!));
			h.buttons().find(button => button.textContent === en["saveStatus.goToVersions"])!.fire("click");
			assert.deepEqual(h.calls, ["backup"], "Go to version history navigates; it runs no recovery action");
		} finally { h.dispose(); }
	});
});
