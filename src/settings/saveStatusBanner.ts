import { setIcon, type App } from "obsidian";
import { t } from "../i18n";
import { en } from "../i18n/en";
import { reportSettingsSaveFailure } from "../manager/settingsSaveReporter";
import { settingsSaveMessage } from "../manager/settingsSaveMessage";
import { confirmFreshStart } from "../manager/settingsNotices";
import type { SettingsWriter } from "../manager/SettingsWriter";

interface SaveStatusHost {
	app: App;
	settingsWriter: Pick<SettingsWriter, "isFrozen" | "isDestroyed"> & Partial<Pick<SettingsWriter, "status" | "hasRecoveryState">>;
}

/** Updates just the banner, preserving the settings page's scroll and form. */
export function renderSaveStatusBanner(host: SaveStatusHost, container: HTMLElement, actions: {
	retry?: () => Promise<boolean>;
	startFresh?: () => Promise<boolean>;
}): () => void {
	const slot = container.createDiv();
	let active = true, busy = false, stillMissing = false;
	const render = () => {
		if (!active) return;
		slot.empty();
		const status = host.settingsWriter.status;
		const missing = status?.frozenReason === "missing";
		if (!missing) stillMissing = false;
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
			stillMissing && status?.reason === "missing" ? t("saveStatus.stillMissing") :
			status?.reason ? settingsSaveMessage(status.reason) : t("settings.readOnly") });
		if (missing && !actions.startFresh) banner.createEl("p", { text: t("saveStatus.recoverInSettings") });
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
		if (actions.retry) {
			const retry = actionsEl.createEl("button", { text: t(missing ? "saveStatus.checkAgain" : "saveStatus.retry"), cls: missing ? "" : "mod-cta" });
			retry.disabled = busy;
			retry.addEventListener("click", () => { void run(actions.retry!, true); });
		}
	};
	const unsubscribe = host.settingsWriter.status?.subscribe(render);
	render();
	return () => { active = false; unsubscribe?.(); };
}
