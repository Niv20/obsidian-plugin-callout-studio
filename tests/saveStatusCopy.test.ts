/**
 * The paused saving banner, read the way a worried reader reads it: calm
 * first, then what happened, then what to do — in two or three short
 * paragraphs, where it used to be one long one. And the promise that keeps it
 * honest, checked in every paused state: the words name only buttons the
 * reader can see, and claim only what is true of this state.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { en } from "../src/i18n/en";
import { rechecksWhilePaused } from "../src/manager/pausedRecheck";
import type { SettingsDiagnosis } from "../src/manager/settingsDiagnosis";
import { settingsSaveMessage } from "../src/manager/settingsSaveMessage";
import { SettingsSaveStatus, type SettingsSaveReason } from "../src/manager/settingsSaveStatus";
import { renderSaveStatusBanner, type SaveStatusActions } from "../src/settings/saveStatusBanner";
import { fakeDom } from "./support/fakeDom";

/** Every label a banner button can carry. */
const LABELS = [
	"saveStatus.restoreSettings", "saveStatus.createSettingsFile", "saveStatus.checkAgain", "saveStatus.tryAgain",
	"saveStatus.replaceUnreadable", "saveStatus.discardRecoveryCopy", "saveStatus.goToBackups",
].map((key) => en[key]!);

const FROZEN: readonly SettingsSaveReason[] = ["missing", "unreadable", "recovery-read", "newer-version"];
/** What can go wrong on top of a pause, including nothing. */
const FAILURES: readonly (SettingsSaveReason | null)[] = [
	null, "missing", "unreadable", "recovery-read", "backup", "write", "write-space", "changed", "sync-conflict",
];
const DIAGNOSES: readonly SettingsDiagnosis[] = [
	"unavailable", "empty", "merge-markers", "damaged", "combined", "invalid-entries", "readable",
];

const settle = () => new Promise((resolve) => setImmediate(resolve));

interface State {
	frozen: SettingsSaveReason;
	failure: SettingsSaveReason | null;
	/** The writer holds the user's own setup (`hasRecoveryState`). */
	kept: boolean;
	/** The settings page, with every action; otherwise the editor, with Retry only. */
	onSettingsPage: boolean;
	diagnosis: SettingsDiagnosis;
	/** The reader has pressed Check again once, and the file was still missing. */
	checked: boolean;
}

async function paused(state: State) {
	const status = new SettingsSaveStatus();
	const host = { app: {} as App, settingsWriter: {
		status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false, hasRecoveryState: state.kept,
	} };
	const actions: SaveStatusActions = state.onSettingsPage ? {
		retry: async () => false, startFresh: async () => true, diagnose: async () => state.diagnosis,
		replaceUnreadable: async () => true, discardRecoveryCopy: async () => true, showBackup: () => {}, pausedNote: true,
	} : { retry: async () => false };
	const container = fakeDom.document.createElement("div");
	const dispose = renderSaveStatusBanner(host, container as unknown as HTMLElement, actions);
	try {
		status.freeze(state.frozen);
		await settle();
		if (state.checked) {
			container.querySelectorAll("button").find((button) => button.textContent === en["saveStatus.checkAgain"])!.fire("click");
			await settle();
		}
		if (state.failure) status.fail(state.failure);
		await settle();
		const paragraphs = container.querySelectorAll(".cs-readonly-banner p").map((p) => p.textContent);
		const buttons = container.querySelectorAll("button").map((button) => button.textContent);
		return { paragraphs, prose: paragraphs.join(" "), buttons };
	} finally { dispose(); }
}

function* states(frozen: SettingsSaveReason): Generator<State> {
	for (const failure of FAILURES) {
		for (const kept of [true, false]) {
			for (const onSettingsPage of [true, false]) {
				for (const diagnosis of frozen === "unreadable" ? DIAGNOSES : DIAGNOSES.slice(0, 1)) {
					for (const checked of frozen === "missing" ? [false, true] : [false]) {
						yield { frozen, failure, kept, onSettingsPage, diagnosis, checked };
					}
				}
			}
		}
	}
}

describe("the paused saving banner's words", () => {
	for (const frozen of FROZEN) {
		it(`hold to their promises while paused for ${frozen}`, async () => {
			const broken: string[] = [];
			for (const state of states(frozen)) {
				const { paragraphs, prose, buttons } = await paused(state);
				const at = JSON.stringify(state);
				if (paragraphs.length < 2 || paragraphs.length > 3) broken.push(`${at}: ${paragraphs.length} paragraphs`);
				if (!paragraphs[0]?.startsWith(en["saveStatus.calm.opening"]!)) broken.push(`${at}: does not open calmly`);
				for (const label of LABELS) {
					if (prose.includes(label) && !buttons.includes(label)) broken.push(`${at}: names "${label}" but shows ${JSON.stringify(buttons)}`);
				}
				if (prose.includes(en["saveStatus.guide.backup"]!) && !buttons.includes(en["saveStatus.goToBackups"]!)) {
					broken.push(`${at}: points to backups without a way there`);
				}
				if (prose.includes(en["saveStatus.calm.kept"]!) !== state.kept) broken.push(`${at}: "still here" without a setup to show`);
				if (prose.includes("every minute") && !rechecksWhilePaused(frozen)) broken.push(`${at}: promises a recheck that never runs`);
				const page = prose.includes(en["saveStatus.calm.pausedPage"]!);
				if (page !== state.onSettingsPage) broken.push(`${at}: read-only page sentence on the wrong surface`);
			}
			assert.deepEqual(broken, []);
		});
	}

	it("reads, for the common case, as calm, what happened, and what to do", async () => {
		const { paragraphs, buttons } = await paused({
			frozen: "missing", failure: null, kept: true, onSettingsPage: true, diagnosis: "readable", checked: false,
		});
		assert.deepEqual(paragraphs, [
			"First of all, take a deep breath — everything is going to be okay. Your notes are safe, and your callouts are still here on this device. Callout Studio has only paused saving to protect your setup, so this page is read-only for now.",
			"Callout Studio can't find its settings file. This usually happens while your sync app is still downloading it, or after Callout Studio was removed on another device.",
			"Callout Studio checks again every minute while Obsidian is open, so this often fixes itself — or choose Check again to look right now. If your settings don't come back, choose Restore these settings to keep the callouts you see here. Once saving works again, you can also bring back an earlier version from the Backup section.",
		]);
		assert.deepEqual(buttons, ["Check again", "Restore these settings", "Go to backups"]);
	});

	it("gets more specific once a check has come back empty, and leads with restoring", async () => {
		const { paragraphs, buttons } = await paused({
			frozen: "missing", failure: null, kept: true, onSettingsPage: true, diagnosis: "readable", checked: true,
		});
		assert.equal(paragraphs[1], en["saveStatus.explain.stillMissing"]);
		assert.ok(paragraphs[2]!.startsWith(en["saveStatus.guide.restore"]!), "the next step comes first");
		assert.deepEqual(buttons, ["Restore these settings", "Check again", "Go to backups"]);
	});

	it("does not tell the reader to restore while the file that turned up cannot be read", async () => {
		const { prose } = await paused({
			frozen: "missing", failure: "unreadable", kept: true, onSettingsPage: true, diagnosis: "readable", checked: false,
		});
		assert.ok(prose.includes(en["saveStatus.explain.unreadable"]!));
		assert.ok(!prose.includes(en["saveStatus.guide.restore"]!));
	});

	it("names the cause of an unreadable file where it says what to do", async () => {
		const { paragraphs, buttons } = await paused({
			frozen: "unreadable", failure: null, kept: true, onSettingsPage: true, diagnosis: "combined", checked: false,
		});
		assert.equal(paragraphs[1], en["saveStatus.explain.unreadable"]);
		assert.ok(paragraphs[2]!.startsWith(en["saveStatus.diagnosis.combined"]!));
		assert.ok(buttons.includes(en["saveStatus.replaceUnreadable"]!));
	});

	it("sends the editor to the settings page for a missing file, and says nothing about a read-only page", async () => {
		const { prose, buttons } = await paused({
			frozen: "missing", failure: null, kept: true, onSettingsPage: false, diagnosis: "readable", checked: false,
		});
		assert.ok(prose.includes(en["saveStatus.recoverInSettings"]!));
		assert.ok(prose.includes(en["saveStatus.calm.paused"]!));
		assert.deepEqual(buttons, ["Check again"]);
	});

	it("keeps a one-off save failure to its single message", async () => {
		const status = new SettingsSaveStatus();
		const container = fakeDom.document.createElement("div");
		const dispose = renderSaveStatusBanner({ app: {} as App, settingsWriter: {
			status, get isFrozen() { return status.frozenReason !== null; }, isDestroyed: false,
		} }, container as unknown as HTMLElement, { retry: async () => false, pausedNote: true });
		try {
			status.fail("write");
			const paragraphs = container.querySelectorAll(".cs-readonly-banner p").map((p) => p.textContent);
			assert.deepEqual(paragraphs, [settingsSaveMessage("write")]);
		} finally { dispose(); }
	});
});
