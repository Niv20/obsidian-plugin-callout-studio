import { setIcon, type App } from "obsidian";
import { t } from "../i18n";
import { en } from "../i18n/en";
import { reportSettingsSaveFailure } from "../manager/settingsSaveReporter";
import { settingsSaveMessage } from "../manager/settingsSaveMessage";
import { confirmFreshStart } from "../manager/settingsNotices";
import type { SettingsDiagnosis } from "../manager/settingsDiagnosis";
import type { SettingsWriter } from "../manager/SettingsWriter";
import { ConfirmModal } from "../utils/ConfirmModal";
import { diagnosisKey, pausedCopy, type PausedButtons } from "./saveStatusCopy";

interface SaveStatusHost {
	app: App;
	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed"> & Partial<Pick<SettingsWriter, "status" | "hasRecoveryState">>;
}

export interface SaveStatusActions {
	retry?: () => Promise<boolean>;
	startFresh?: () => Promise<boolean>;
	/** Why an unreadable file cannot be used; see manager/settingsDiagnosis.ts. */
	diagnose?: () => Promise<SettingsDiagnosis>;
	replaceUnreadable?: () => Promise<boolean>;
	discardRecoveryCopy?: () => Promise<boolean>;
	/**
	 * **Go to backups**: takes the reader to Backup › Earlier setups on the
	 * same page. It opens and restores nothing itself — restoring an earlier
	 * setup waits until saving works again, and the words above say so.
	 * `fromKeyboard` says the button was pressed with a key, which decides
	 * whether the row it lands on shows a focus ring.
	 */
	showBackup?: (fromKeyboard: boolean) => void;
	/** The settings page is read-only while paused; say so there. */
	pausedNote?: boolean;
}

/** Causes the file cannot recover from by waiting, so replacing it is offered. */
const REPLACEABLE: ReadonlySet<SettingsDiagnosis> = new Set(["empty", "merge-markers", "damaged", "combined", "invalid-entries"]);

/**
 * Ask, and run `action` only on a yes. Every one of these replaces something,
 * so the yes is a warning unless `keeps` says the replacement loses nothing.
 */
async function confirmed(app: App, title: string, body: string, label: string, action: () => Promise<boolean>, keeps = false): Promise<boolean> {
	return await new ConfirmModal(app, t(title), t(body), t(label), undefined, keeps ? "mod-cta" : "mod-warning").confirm() ? action() : false;
}

/** Updates just the banner, preserving the settings page's scroll and form. */
export function renderSaveStatusBanner(host: SaveStatusHost, container: HTMLElement, actions: SaveStatusActions): () => void {
	const slot = container.createDiv();
	let active = true, busy = false, stillMissing = false;
	/**
	 * A manual check has found the file missing during this missing episode.
	 * Unlike `stillMissing`, which only colours the message right after a check,
	 * this stays set, so the next step it promotes — restoring — does not fall
	 * back to "check again" while an action runs or after a cancelled dialog.
	 */
	let checkedMissing = false;
	let diagnosis: SettingsDiagnosis | null = null, diagnosing = false, diagnosed = false;
	const render = () => {
		if (!active) return;
		slot.empty();
		const status = host.settingsWriter.status;
		const missing = status?.frozenReason === "missing";
		if (!missing) { stillMissing = false; checkedMissing = false; }
		const unreadable = status?.reason === "unreadable";
		if (!unreadable) { diagnosis = null; diagnosed = false; }
		else if (actions.diagnose && !diagnosed && !diagnosing) {
			diagnosing = true;
			void actions.diagnose().then(found => { diagnosis = found; }, () => { diagnosis = null; })
				.finally(() => { diagnosing = false; diagnosed = true; render(); });
		}
		if (!status?.reason && !host.settingsWriter.isFrozen && !busy) return;
		const banner = slot.createDiv({ cls: "cs-readonly-banner", attr: { role: "status" } });
		// A heading before the prose: the title is the one line everybody reads.
		// Paused and failed are different states — a frozen session is not saving
		// at all, a write failure lost one save — so the title says which rather
		// than picking one word for both.
		const header = banner.createDiv({ cls: "cs-readonly-banner-header" });
		setIcon(header.createSpan({ cls: "cs-readonly-banner-icon" }), "alert-triangle");
		const frozen = host.settingsWriter.isFrozen || !!status?.frozenReason;
		header.createDiv({ cls: "cs-readonly-banner-title", text: t(frozen ? "saveStatus.titlePaused" : "saveStatus.titleFailed") });

		// Every button this state offers, decided once. The buttons below and the
		// words above are drawn from the same answers, so the words cannot name a
		// button that is not there. @see saveStatusCopy.ts
		const replaceable = status?.frozenReason === "unreadable" && diagnosis !== null && REPLACEABLE.has(diagnosis);
		const restorable = missing && !!actions.startFresh;
		const buttons: PausedButtons = {
			restore: restorable ? (host.settingsWriter.hasRecoveryState ? "restore" : "create") : null,
			retry: !!actions.retry,
			// Guided: for a missing file the first step is to look again, and
			// only once a look has come back empty is restoring the main button.
			checkFirst: restorable && !!actions.retry && !checkedMissing,
			replace: replaceable && !!actions.replaceUnreadable,
			discard: status?.frozenReason === "recovery-read" && !!actions.discardRecoveryCopy,
			backup: !!actions.showBackup,
		};

		if (frozen && status?.reason) {
			for (const text of pausedCopy({
				reason: status.reason,
				frozenReason: status.frozenReason,
				onSettingsPage: !!actions.pausedNote,
				kept: !!host.settingsWriter.hasRecoveryState,
				stillMissing: stillMissing && status.reason === "missing",
				diagnosis: unreadable ? diagnosis : null,
				busy,
				buttons,
			})) banner.createEl("p", { text });
		} else {
			banner.createEl("p", { text: busy ? t("saveStatus.working") :
				status?.reason ? settingsSaveMessage(status.reason) : t("settings.readOnly") });
			const detail = !busy && unreadable ? diagnosisKey(diagnosis) : undefined;
			if (detail) banner.createEl("p", { text: t(detail), cls: "cs-readonly-banner-detail" });
		}

		const actionsEl = banner.createDiv({ cls: "cs-readonly-banner-actions" });
		const run = async (action: () => Promise<boolean>, checking = false) => {
			if (busy || host.settingsWriter.isDestroyed) return;
			busy = true; stillMissing = false; render();
			try {
				if (!await action() && !host.settingsWriter.status?.reason) reportSettingsSaveFailure(host.settingsWriter, undefined, en["saveStatus.retryFailed"]);
			} catch (error) {
				console.error("[callout-studio] saving recovery action failed", error);
				reportSettingsSaveFailure(host.settingsWriter, error);
			} finally {
				busy = false;
				stillMissing = checking && host.settingsWriter.status?.reason === "missing";
				checkedMissing ||= stillMissing;
				// The file may be a different kind of broken now; look again.
				diagnosed = false;
				render();
			}
		};
		const addRestore = () => {
			const recovered = buttons.restore === "restore";
			const restore = actionsEl.createEl("button", {
				text: t(recovered ? "saveStatus.restoreSettings" : "saveStatus.createSettingsFile"),
				// Main once checking is no longer the first step. Creating a file
				// from what is shown never is: that may be only the built-ins.
				cls: recovered && !buttons.checkFirst ? "mod-cta" : "",
			});
			restore.disabled = busy;
			restore.addEventListener("click", () => { void run(() => confirmFreshStart(host.app, null, actions.startFresh!, recovered)); });
		};
		if (buttons.restore && !buttons.checkFirst) addRestore();
		if (buttons.replace) {
			// A file a sync service combined still holds every setting, and
			// replacing it keeps them all: the step to take, not a warning. Every
			// other cause loses what the file held (an exact copy is kept first).
			const keeps = diagnosis === "combined";
			const replace = actionsEl.createEl("button", { text: t("saveStatus.replaceUnreadable"), cls: keeps ? "mod-cta" : "mod-warning" });
			replace.disabled = busy;
			const body = keeps ? "confirm.replaceUnreadableSalvage" : "confirm.replaceUnreadable";
			// Keeping everything was promised, so look once more after the yes: a
			// file that has since become another kind of broken is not replaced,
			// and the banner diagnoses it again and says what it is now.
			const replaceNow = keeps && actions.diagnose
				? async () => ["combined", "readable"].includes(await actions.diagnose!()) && actions.replaceUnreadable!()
				: actions.replaceUnreadable!;
			replace.addEventListener("click", () => {
				void run(() => confirmed(host.app, "confirm.titleReplaceUnreadable", body, "saveStatus.replaceUnreadable", replaceNow, keeps));
			});
		}
		if (buttons.discard) {
			const discard = actionsEl.createEl("button", { text: t("saveStatus.discardRecoveryCopy"), cls: "mod-warning" });
			discard.disabled = busy;
			discard.addEventListener("click", () => {
				void run(() => confirmed(host.app, "confirm.titleDiscardRecoveryCopy", "confirm.discardRecoveryCopy",
					"saveStatus.discardRecoveryCopy", actions.discardRecoveryCopy!));
			});
		}
		if (actions.retry) {
			const retry = actionsEl.createEl("button", {
				text: t(missing ? "saveStatus.checkAgain" : "saveStatus.tryAgain"),
				cls: buttons.checkFirst || !(missing || replaceable) ? "mod-cta" : "",
			});
			retry.disabled = busy;
			retry.addEventListener("click", () => { void run(actions.retry!, true); });
		}
		if (buttons.restore && buttons.checkFirst) addRestore();
		if (actions.showBackup) {
			const backup = actionsEl.createEl("button", { text: t("saveStatus.goToVersions") });
			backup.disabled = busy;
			// A click from Enter or Space carries no pointer detail.
			backup.addEventListener("click", (event) => { actions.showBackup!(event.detail === 0); });
		}
	};
	const unsubscribe = host.settingsWriter.status?.subscribe(render);
	render();
	return () => { active = false; unsubscribe?.(); };
}
