/**
 * settings/SettingsRecoveryModal.ts — Version history: every earlier setup
 * Callout Studio can find, as one timeline, and a way back to each.
 *
 * Versions come from three places: this device's history (IndexedDB, survives
 * uninstall), the backups folder beside the settings file (synced), and stray
 * copies of the settings file a sync service left behind (`data 2.json` and
 * the like, which nothing else would ever mention). A setup kept in two places
 * is one row with one decorative timeline dot, newest first. Its title says
 * why it was kept, and its summary compares it with now.
 *
 * Restore replaces the current setup after confirmation and a verified backup.
 * View details compares a snapshot with now. Delete
 * removes every listed copy and stays available while saving is paused.
 */
import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import type { RestoreOutcome, SettingsRecoveryService } from "../manager/settingsRecoveryService";
import type { SettingsWriter } from "../manager/SettingsWriter";
import type { SetupVersion } from "../manager/setupVersions";
import { ConfirmModal } from "../utils/ConfirmModal";
import { explainIfBlocked, paintBlocked } from "../ui/blockedButton";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { blockedWhilePaused } from "./pausedGuard";
import { SettingsRecoveryDetailsModal } from "./SettingsRecoveryDetailsModal";
import { renderVersionMarker, renderVersionName, versionClock, versionDay, versionDayKey, versionName, versionTime } from "./versionRow";
import { observeVersionRowLayout } from "./versionRowLayout";

export interface RecoveryModalPlugin {
	recovery?: SettingsRecoveryService;
	settingsWriter: Pick<SettingsWriter, "isFrozen">;
}

const OUTCOMES: Record<Exclude<RestoreOutcome, "restored">, string> = {
	paused: "notice.blockedWhilePaused",
	invalid: "versions.restoreFailed",
	stale: "recovery.stale",
	backup: "versions.backupFailed",
	failed: "versions.restoreFailed",
};

/** Help text as it is written: one short sentence per line. */
function renderLines(parent: HTMLElement, text: string, cls: string): void {
	const paragraph = parent.createEl("p", { cls });
	text.split("\n").forEach((line, index) => {
		if (index > 0) paragraph.createEl("br");
		paragraph.appendText(line);
	});
}

export class SettingsRecoveryModal extends Modal {
	private generation = 0;
	private listEl: HTMLElement | null = null;
	private stopObservingRows: (() => void) | null = null;

	constructor(app: App, private readonly plugin: RecoveryModalPlugin) {
		super(app);
	}

	onOpen(): void {
		applyModalChrome(this);
		this.setTitle(t("versions.title"));
		const { contentEl } = this;
		contentEl.empty();
		renderLines(contentEl, t("versions.intro"), "cs-recovery-intro");
		if (this.plugin.settingsWriter.isFrozen) {
			contentEl.createEl("p", { text: t("versions.pausedHint"), cls: "cs-recovery-paused" });
		}
		this.listEl = contentEl.createDiv({ cls: "cs-recovery-list" });
		this.reload();
	}

	onClose(): void {
		this.generation++;
		this.stopObservingRows?.();
		this.stopObservingRows = null;
		this.listEl = null;
		this.contentEl.empty();
		removeModalChrome(this);
	}

	/** (Re)fetch every version and redraw the list; used after opening or a delete. */
	private reload(): void {
		const list = this.listEl;
		if (!list) return;
		this.stopObservingRows?.();
		this.stopObservingRows = null;
		list.empty();
		list.createEl("p", { text: t("versions.loading"), cls: "cs-recovery-status" });
		const generation = ++this.generation;
		const recovery = this.plugin.recovery;
		if (!recovery) { this.render(list, []); return; }
		void recovery.listVersions().then(
			versions => { if (generation === this.generation) this.render(list, versions); },
			(error: unknown) => {
				console.error("[callout-studio] versions could not be listed", error);
				if (generation === this.generation) this.render(list, []);
			},
		);
	}

	private render(list: HTMLElement, versions: SetupVersion[]): void {
		list.empty();
		if (versions.length === 0) {
			list.createEl("p", { text: t("versions.empty"), cls: "cs-recovery-status" });
			return;
		}
		const rows = list.createDiv({ cls: "cs-recovery-rows" });
		let previousDay: string | null = null;
		const now = Date.now();
		for (const version of versions) {
			const day = versionDayKey(version.time);
			if (day !== previousDay) {
				rows.createEl("h3", { text: versionDay(version.time, now), cls: "cs-recovery-day" });
				previousDay = day;
			}
			this.renderRow(rows, version);
		}
		this.stopObservingRows = observeVersionRowLayout(rows);
	}

	private renderRow(list: HTMLElement, version: SetupVersion): void {
		const recovery = this.plugin.recovery!;
		const row = new Setting(list);
		// `cs-row-inline` keeps the icons and Restore beside the name on phone,
		// vertically centred like on desktop, instead of stacked onto a
		// full-width line of their own. See the class in styles.css.
		row.settingEl.addClass("callout-studio-row", "cs-recovery-row", "cs-row-inline");
		if (version.time !== null) {
			row.settingEl.createEl("time", {
				text: versionClock(version.time), cls: "cs-recovery-time",
				attr: { datetime: new Date(version.time).toISOString() },
			});
		}
		renderVersionMarker(row.settingEl);
		renderVersionName(row.nameEl, version);
		const data = version.data;
		const difference = data ? recovery.difference(data) : null;
		this.renderSummary(row.descEl, difference);
		row.addExtraButton(button => button
			.setIcon("eye")
			.setTooltip(t("recovery.details.view"))
			.onClick(() => new SettingsRecoveryDetailsModal(this.app, recovery.details(version.copies[0]!, version)).open()));
		row.addExtraButton(button => {
			button.setIcon("trash-2").setTooltip(t("recovery.delete"))
				.onClick(() => { void this.remove(version); });
			button.extraSettingsEl.addClass("cs-recovery-delete-btn");
		});
		if (!data || !difference) return;
		row.addButton(button => {
			button.setButtonText(t("recovery.restore")).setWarning()
				.onClick(() => {
					if (explainIfBlocked(this.restoreBlockedReason(difference.changed))) return;
					void this.restore(version, data, difference.changed);
				});
			paintBlocked(button.buttonEl, this.restoreBlockedReason(difference.changed));
			button.buttonEl.addClass("cs-recovery-restore-btn");
		});
	}

	/** Counts share a line when the controls wrap; the time belongs to the rail. */
	private renderSummary(descEl: HTMLElement, difference: { callouts: number; changed: number } | null): void {
		const parts: string[] = [];
		if (!difference) parts.push(t("recovery.unreadable"));
		else if (difference.changed === 0) parts.push(t("recovery.same"));
		else {
			parts.push(t("recovery.summaryCallouts", { callouts: difference.callouts }));
			parts.push(t("recovery.summaryChanges", { count: difference.changed }));
		}
		const counts = difference && difference.changed > 0 ? parts.splice(-2) : [];
		for (const text of parts) descEl.createDiv({ text, cls: "cs-recovery-summary-part" });
		if (counts.length) {
			const group = descEl.createDiv({ cls: "cs-recovery-summary-counts" });
			for (const text of counts) group.createDiv({ text, cls: "cs-recovery-summary-part" });
		}
	}

	/**
	 * Why Restore cannot act on a row, or null: saving is paused (a restored
	 * setup could not be kept), or the row is already what is shown now. Dimmed
	 * rather than disabled, so pressing it says which. Read again at the press —
	 * saving can pause, or resume, while this window is open.
	 */
	private restoreBlockedReason(changed: number): string | null {
		if (this.plugin.settingsWriter.isFrozen) return t("notice.blockedWhilePaused");
		return changed === 0 ? t("versions.restoreSame") : null;
	}

	private async restore(version: SetupVersion, data: NonNullable<SetupVersion["data"]>, count: number): Promise<void> {
		const recovery = this.plugin.recovery;
		if (!recovery || blockedWhilePaused(this.plugin.settingsWriter)) return;
		const name = versionName(version), when = versionTime(version.time);
		const confirmed = await new ConfirmModal(
			this.app,
			t("versions.restoreTitle"),
			t("versions.restoreBody", { name, when, count }),
			t("recovery.restore"),
		).confirm();
		if (!confirmed) return;
		const outcome = await recovery.restore(data);
		if (outcome === "restored") {
			new Notice(t("versions.restored", { name, when }));
			this.close();
			return;
		}
		new Notice(t(OUTCOMES[outcome]), 10000);
	}

	private async remove(version: SetupVersion): Promise<void> {
		const recovery = this.plugin.recovery;
		if (!recovery) return;
		const name = versionName(version), when = versionTime(version.time);
		// A presentation category does not say whether deletion can propagate.
		const deletesFiles = version.copies.some(copy => copy.kind !== "history" && copy.path !== null);
		const body = [
			t("versions.deleteAvailableBody", { name, when }),
			deletesFiles ? t("versions.deleteSyncedFiles") : "",
			t("versions.deleteFinal"),
		].filter(Boolean).join("\n");
		const confirmed = await new ConfirmModal(this.app, t("versions.deleteTitle"), body, t("recovery.delete")).confirm();
		if (!confirmed) return;
		if (!await recovery.removeVersion(version)) {
			new Notice(t("versions.deleteFailed"), 10000);
			this.reload();
			return;
		}
		new Notice(t("versions.deleted", { name, when }));
		this.reload();
	}
}
