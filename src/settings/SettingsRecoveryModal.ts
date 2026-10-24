/**
 * settings/SettingsRecoveryModal.ts — Version history: every earlier setup
 * Callout Studio can find, newest first, and a way back to each.
 *
 * Who calls it. The Version history button in the settings
 * (sections/DataManagementSection.ts).
 *
 * Versions come from three places: this device's history (IndexedDB, survives
 * uninstall), the backups folder beside the settings file (synced), and stray
 * copies of the settings file a sync service left behind (`data 2.json` and
 * the like, which nothing else would ever mention). A setup kept in two places
 * is one row. Its title says why it was kept, and its summary compares it with
 * now.
 *
 * The main idea of the layout (finding S9-05). Each local calendar day is one
 * of Obsidian's setting groups: the date as the group's heading, then one
 * rounded box with a thin line between its rows, as Obsidian's own settings
 * draw a group. Each version is a row in its day's box, starting with the time
 * it was saved. It used to be a timeline: a rail down the side, a dot per
 * version and the times in a column of their own.
 *
 * Restore replaces the current setup after confirmation and a verified backup.
 * The eye compares a snapshot with now. Delete removes every listed copy and
 * stays available while saving is paused.
 */
import { Modal, Notice, SettingGroup } from "obsidian";
import type { Setting } from "obsidian";
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
import { renderVersionName, versionClock, versionDay, versionDayKey, versionName, versionTime } from "./versionRow";

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
	/** Bumped on every (re)load and on close, so a late answer from an older load is dropped. */
	private generation = 0;
	/** Where the day groups go; null once the window is closed. */
	private listEl: HTMLElement | null = null;

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
		this.listEl = null;
		this.contentEl.empty();
		removeModalChrome(this);
	}

	/** (Re)fetch every version and redraw the list; used after opening or a delete. */
	private reload(): void {
		const list = this.listEl;
		if (!list) return;
		this.renderStatus(list, t("versions.loading"));
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

	/**
	 * Replace the list with one quiet row in a box of its own, for "Loading…"
	 * and "No earlier versions": Obsidian's empty-state row (`mod-empty-state`),
	 * the way its Hotkeys page says "No results found".
	 */
	private renderStatus(list: HTMLElement, text: string): void {
		list.empty();
		new SettingGroup(list).addClass("mod-list").addSetting(row => {
			row.setName(text);
			row.settingEl.addClass("mod-empty-state", "cs-recovery-status");
		});
	}

	/**
	 * Draw the versions: one group per local calendar day, its date as the
	 * heading, and a row per version in the group's box. The versions arrive
	 * newest first, so a day's group is opened by the first of its versions;
	 * versions whose time is unknown come last and share one group.
	 */
	private render(list: HTMLElement, versions: SetupVersion[]): void {
		if (versions.length === 0) {
			this.renderStatus(list, t("versions.empty"));
			return;
		}
		list.empty();
		const now = Date.now();
		let group: SettingGroup | null = null;
		let previousDay: string | null = null;
		for (const version of versions) {
			const day = versionDayKey(version.time);
			if (!group || day !== previousDay) {
				// `mod-list` is Obsidian's list layout: rows a little tighter,
				// and still on one line on a phone.
				group = new SettingGroup(list)
					.setHeading(versionDay(version.time, now))
					.addClass("mod-list", "cs-recovery-day");
				previousDay = day;
			}
			// After the `if`, TypeScript knows `group` is set: either it was
			// already, or the line above just made it.
			group.addSetting(row => this.renderRow(row, version));
		}
	}

	/** One version's row: its time and name, how it compares with now, and its buttons. */
	private renderRow(row: Setting, version: SetupVersion): void {
		// `!`: this window only lists versions when there is a recovery service.
		const recovery = this.plugin.recovery!;
		row.settingEl.addClass("cs-recovery-row");
		// The time starts the row; the date is the group's heading. An unknown
		// time is left out rather than invented.
		if (version.time !== null) {
			row.nameEl.createEl("time", {
				text: versionClock(version.time), cls: "cs-recovery-time",
				attr: { datetime: new Date(version.time).toISOString() },
			});
		}
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
			// A plain button (finding S9-04): the red belongs to the question
			// that follows, not to every row of the list.
			button.setButtonText(t("recovery.restore"))
				.onClick(() => {
					if (explainIfBlocked(this.restoreBlockedReason(difference.changed))) return;
					void this.restore(version, data, difference.changed);
				});
			paintBlocked(button.buttonEl, this.restoreBlockedReason(difference.changed));
			button.buttonEl.addClass("cs-recovery-restore-btn");
		});
	}

	/** What the version holds and how far it is from now, a line each. */
	private renderSummary(descEl: HTMLElement, difference: { callouts: number; changed: number } | null): void {
		let lines: string[];
		if (!difference) lines = [t("recovery.unreadable")];
		else if (difference.changed === 0) lines = [t("recovery.same")];
		else lines = [
			t("recovery.summaryCallouts", { callouts: difference.callouts }),
			t("recovery.summaryChanges", { count: difference.changed }),
		];
		for (const text of lines) descEl.createDiv({ text, cls: "cs-recovery-summary-part" });
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
