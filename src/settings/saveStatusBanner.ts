import { setIcon, type App } from "obsidian";
import { t } from "../i18n";
import { en } from "../i18n/en";
import { reportSettingsSaveFailure } from "../manager/settingsSaveReporter";
import { settingsSaveMessage } from "../manager/settingsSaveMessage";
import { confirmFreshStart } from "../manager/settingsNotices";
import type { SettingsDiagnosis } from "../manager/settingsDiagnosis";
import type { SettingsWriter } from "../manager/SettingsWriter";
import { ConfirmModal } from "../utils/ConfirmModal";

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
	openRecovery?: () => void;
	/** The settings page is read-only while paused; say so there. */
	pausedNote?: boolean;
}

const DIAGNOSES: Partial<Record<SettingsDiagnosis, string>> = {
	unavailable: "saveStatus.diagnosis.unavailable",
	empty: "saveStatus.diagnosis.empty",
	"merge-markers": "saveStatus.diagnosis.mergeMarkers",
	damaged: "saveStatus.diagnosis.damaged",
	combined: "saveStatus.diagnosis.combined",
	"invalid-entries": "saveStatus.diagnosis.invalidEntries",
};

/** Causes the file cannot recover from by waiting, so replacing it is offered. */
const REPLACEABLE: ReadonlySet<SettingsDiagnosis> = new Set(["empty", "merge-markers", "damaged", "combined", "invalid-entries"]);

/** Ask, and run `action` only on a yes. Every one of these replaces something. */
async function confirmed(app: App, title: string, body: string, label: string, action: () => Promise<boolean>): Promise<boolean> {
	return await new ConfirmModal(app, t(title), t(body), t(label)).confirm() ? action() : false;
}

/** Updates just the banner, preserving the settings page's scroll and form. */
export function renderSaveStatusBanner(host: SaveStatusHost, container: HTMLElement, actions: SaveStatusActions): () => void {
	const slot = container.createDiv();
	let active = true, busy = false, stillMissing = false;
	let diagnosis: SettingsDiagnosis | null = null, diagnosing = false, diagnosed = false;
	const render = () => {
		if (!active) return;
		slot.empty();
		const status = host.settingsWriter.status;
		const missing = status?.frozenReason === "missing";
		if (!missing) stillMissing = false;
		const unreadable = status?.reason === "unreadable";
		if (!unreadable) { diagnosis = null; diagnosed = false; }
		else if (actions.diagnose && !diagnosed && !diagnosing) {
			diagnosing = true;
			void actions.diagnose().then(found => { diagnosis = found; }, () => { diagnosis = null; })
				.finally(() => { diagnosing = false; diagnosed = true; render(); });
		}
		if (!status?.reason && !host.settingsWriter.isFrozen && !busy) return;
		const banner = slot.createDiv({ cls: "cs-readonly-banner", attr: { role: "status" } });
		// A heading before the prose: these messages are several sentences long,
		// and the first of them is the only part a user reads before deciding
		// whether to act. Paused and failed are different states — a frozen
		// session is not saving at all, a write failure lost one save — so the
		// title says which rather than picking one word for both.
		const header = banner.createDiv({ cls: "cs-readonly-banner-header" });
		setIcon(header.createSpan({ cls: "cs-readonly-banner-icon" }), "alert-triangle");
		const frozen = host.settingsWriter.isFrozen || !!status?.frozenReason;
		header.createDiv({ cls: "cs-readonly-banner-title", text: t(frozen ? "saveStatus.titlePaused" : "saveStatus.titleFailed") });
		banner.createEl("p", { text: busy ? t("saveStatus.retrying") :
			stillMissing && status?.reason === "missing" ? t("saveStatus.stillMissingAdvice") :
			status?.reason ? settingsSaveMessage(status.reason) : t("settings.readOnly") });
		const detail = !busy && unreadable && diagnosis ? DIAGNOSES[diagnosis] : undefined;
		if (detail) banner.createEl("p", { text: t(detail), cls: "cs-readonly-banner-detail" });
		if (missing && !actions.startFresh) banner.createEl("p", { text: t("saveStatus.recoverInSettings") });
		if (frozen && actions.pausedNote) banner.createEl("p", { text: t("saveStatus.readOnlyWhilePaused"), cls: "cs-readonly-banner-detail" });
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
				// The file may be a different kind of broken now; look again.
				diagnosed = false;
				render();
			}
		};
		if (missing && actions.startFresh) {
			const recovered = !!host.settingsWriter.hasRecoveryState;
			const restore = actionsEl.createEl("button", {
				text: t(recovered ? "saveStatus.restoreSettings" : "saveStatus.createSettingsFile"),
				cls: recovered ? "mod-cta" : "",
			});
			restore.disabled = busy;
			restore.addEventListener("click", () => { void run(() => confirmFreshStart(host.app, null, actions.startFresh!, recovered)); });
		}
		const replaceable = status?.frozenReason === "unreadable" && diagnosis !== null && REPLACEABLE.has(diagnosis);
		if (replaceable && actions.replaceUnreadable) {
			const replace = actionsEl.createEl("button", { text: t("saveStatus.replaceUnreadable"), cls: "mod-warning" });
			replace.disabled = busy;
			const body = diagnosis === "combined" ? "confirm.replaceUnreadableSalvage" : "confirm.replaceUnreadable";
			replace.addEventListener("click", () => {
				void run(() => confirmed(host.app, "confirm.titleReplaceUnreadable", body, "saveStatus.replaceUnreadable", actions.replaceUnreadable!));
			});
		}
		if (status?.frozenReason === "recovery-read" && actions.discardRecoveryCopy) {
			const discard = actionsEl.createEl("button", { text: t("saveStatus.discardRecoveryCopy"), cls: "mod-warning" });
			discard.disabled = busy;
			discard.addEventListener("click", () => {
				void run(() => confirmed(host.app, "confirm.titleDiscardRecoveryCopy", "confirm.discardRecoveryCopy",
					"saveStatus.discardRecoveryCopy", actions.discardRecoveryCopy!));
			});
		}
		if (actions.retry) {
			const retry = actionsEl.createEl("button", { text: t(missing ? "saveStatus.checkAgain" : "saveStatus.retry"), cls: missing || replaceable ? "" : "mod-cta" });
			retry.disabled = busy;
			retry.addEventListener("click", () => { void run(actions.retry!, true); });
		}
		if (actions.openRecovery) {
			const earlier = actionsEl.createEl("button", { text: t("saveStatus.openRecovery") });
			earlier.disabled = busy;
			earlier.addEventListener("click", () => { actions.openRecovery!(); });
		}
	};
	const unsubscribe = host.settingsWriter.status?.subscribe(render);
	render();
	return () => { active = false; unsubscribe?.(); };
}
