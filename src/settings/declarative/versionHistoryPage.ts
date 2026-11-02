/**
 * settings/declarative/versionHistoryPage.ts — Version history, as a page of the
 * settings: every earlier setup Callout Studio can find, newest first, drawn as
 * a timeline, and a way back to each.
 *
 * Who calls it. The settings tab, for the row that opens it
 * ({@link versionHistoryRow}); the saving notice's Go to version history opens
 * the same page.
 *
 * Versions come from three places: this device's history (IndexedDB, survives
 * uninstall), the backups folder beside the settings file (synced), and stray
 * copies of the settings file a sync service left behind (`data 2.json` and the
 * like, which nothing else would ever mention). A setup kept in two places is
 * one row. Its title says why it was kept, and its summary compares it with now.
 *
 * The main idea of the layout. A rail runs down the page's start side, with a
 * dot on it for every version and the time it was saved to the side of the dot;
 * each local calendar day has its date as a heading on the rail, and each
 * version is a raised card beside it. It was a window until 2026-10-27, and for
 * a short time before that a box per day with no rail; the timeline is the look
 * it had before the 1.13 rewrite, and what styles.css draws.
 *
 * Restore replaces the current setup after confirmation and a verified backup.
 * The eye compares a snapshot with now. Delete removes every listed copy and
 * stays available while saving is paused.
 *
 * Obsidian never draws such a page again, so it draws its own list: when the
 * page opens, and after a delete or a restore. Leaving the page drops any answer
 * still on its way.
 */
import { Setting, SettingPage } from "obsidian";
import { t } from "../../i18n";
import type { RestoreOutcome, SetupDifference } from "../../manager/settingsRecoveryService";
import type { PluginData } from "../../types";
import type { SetupVersion } from "../../manager/setupVersions";
import { explainIfBlocked, paintBlocked } from "../../ui/blockedButton";
import type { MascotAnimationName } from "../../ui/mascot/mascotAnimations";
import { showNotice } from "../../ui/mascot/mascotNotices";
import { addMascot } from "../../ui/mascot/mascotPlaces";
import { appendLines } from "../../ui/textLines";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { blockedWhilePaused } from "../pausedGuard";
import { SettingsRecoveryDetailsModal } from "../SettingsRecoveryDetailsModal";
import {
	renderVersionMarker,
	renderVersionName,
	versionClock,
	versionDay,
	versionDayKey,
	versionName,
	versionTime,
} from "../versionRow";
import { observeVersionRowLayout } from "../versionRowLayout";
import type { CsPage, TreeContext } from "./types";

/** The page's id: it keys the row, and names the page in a page path. */
export const VERSION_HISTORY_PAGE = "earlier-versions";

const OUTCOMES: Record<Exclude<RestoreOutcome, "restored">, string> = {
	paused: "notice.blockedWhilePaused",
	invalid: "versions.restoreFailed",
	stale: "recovery.stale",
	backup: "versions.backupFailed",
	failed: "versions.restoreFailed",
};

/**
 * The row on the main page that opens the page. Shown only on a host that keeps
 * versions (a minimal host has no recovery service).
 */
export function versionHistoryRow(ctx: TreeContext): CsPage {
	return {
		type: "page",
		id: VERSION_HISTORY_PAGE,
		name: t("settings.versionHistory"),
		desc: t("settings.versionsDesc"),
		visible: () => ctx.plugin.recovery !== undefined,
		page: () => new VersionHistoryPage(ctx),
	};
}

export class VersionHistoryPage extends SettingPage {
	/** Bumped on every (re)load and when the page is left, so a late answer from an older load is dropped. */
	private generation = 0;
	/** Where the timeline goes; null while the page is not open. */
	private listEl: HTMLElement | null = null;
	/** Stops watching the rows' layout; null while there are no rows. */
	private stopObservingRows: (() => void) | null = null;

	constructor(private readonly ctx: TreeContext) {
		super();
	}

	/** Obsidian opened the page: draw its words, then find the versions. */
	display(): void {
		// A page opened a second time starts clean.
		this.hide();
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("cs-recovery-page");
		appendLines(containerEl.createEl("p", { cls: "setting-page-desc cs-recovery-intro" }), t("versions.intro"));
		if (this.ctx.plugin.settingsWriter.isFrozen) {
			containerEl.createEl("p", { text: t("versions.pausedHint"), cls: "cs-recovery-paused" });
		}
		this.listEl = containerEl.createDiv({ cls: "cs-recovery-list" });
		this.reload();
	}

	/** Obsidian left the page: nothing that is still on its way may draw. */
	hide(): void {
		this.generation++;
		this.stopObservingRows?.();
		this.stopObservingRows = null;
		this.listEl = null;
	}

	/** (Re)fetch every version and draw the timeline again; used after opening, a delete or a restore. */
	private reload(): void {
		const list = this.listEl;
		if (!list) return;
		this.stopObservingRows?.();
		this.stopObservingRows = null;
		this.renderStatus(list, t("versions.loading"));
		const generation = ++this.generation;
		const recovery = this.ctx.plugin.recovery;
		if (!recovery) {
			this.render(list, []);
			return;
		}
		void recovery.listVersions().then(
			(versions) => {
				if (generation === this.generation) this.render(list, versions);
			},
			(error: unknown) => {
				console.error("[callout-studio] versions could not be listed", error);
				if (generation === this.generation) this.render(list, []);
			},
		);
	}

	/**
	 * Replace the timeline with one quiet line, for "Loading…" and "No versions
	 * were found".
	 *
	 * @param mood For "No versions": the brush mascot over the words, holding this
	 *   animation's face while the page is open (ui/mascot/mascotPlaces.ts).
	 */
	private renderStatus(list: HTMLElement, text: string, mood?: MascotAnimationName): void {
		list.empty();
		const line = list.createEl("p", { text, cls: "cs-recovery-status" });
		if (!mood) return;
		// Held still: the page can stay open for long, so the face plays once and
		// then rests with no frames; it leaves with the line it is drawn in.
		const mascot = addMascot(line, "large", "start");
		if (mascot) line.addClass("cs-mascot-line");
		mascot?.hold(mood, "still");
	}

	/**
	 * Draw the versions: a heading on the rail for each local calendar day, and a
	 * card per version after it. The versions arrive newest first, so a day's
	 * heading comes before its first version; versions whose time is unknown
	 * come last and share one heading.
	 */
	private render(list: HTMLElement, versions: SetupVersion[]): void {
		if (versions.length === 0) {
			// Nothing has happened yet, so there is nothing to look back at: the mascot looks around.
			this.renderStatus(list, t("versions.empty"), "look");
			return;
		}
		list.empty();
		const rows = list.createDiv({ cls: "cs-recovery-rows" });
		let previousDay: string | null = null;
		const now = Date.now();
		// `!`: there are versions only when there is a recovery service. It reads the setup shown now once, for every row.
		const compare = this.ctx.plugin.recovery!.differences();
		for (const version of versions) {
			const day = versionDayKey(version.time);
			if (day !== previousDay) {
				rows.createEl("h3", { text: versionDay(version.time, now), cls: "cs-recovery-day" });
				previousDay = day;
			}
			this.renderRow(rows, version, compare);
		}
		this.stopObservingRows = observeVersionRowLayout(rows);
	}

	/**
	 * One version's card: its time and dot on the rail, its name, how it
	 * compares with now (`compare`), and its buttons.
	 */
	private renderRow(
		list: HTMLElement,
		version: SetupVersion,
		compare: (data: Partial<PluginData>) => SetupDifference,
	): void {
		// `!`: this page only lists versions when there is a recovery service.
		const recovery = this.ctx.plugin.recovery!;
		const row = new Setting(list);
		// `cs-row-inline` keeps the icons and Restore beside the name on a phone,
		// centred as on a computer, instead of on a full-width line of their own.
		row.settingEl.addClass("cs-recovery-row", "cs-row-inline");
		// The time stands left of the rail; the date is the day's heading. An
		// unknown time is left out rather than invented.
		if (version.time !== null) {
			row.settingEl.createEl("time", {
				text: versionClock(version.time),
				cls: "cs-recovery-time",
				attr: { datetime: new Date(version.time).toISOString() },
			});
		}
		renderVersionMarker(row.settingEl);
		renderVersionName(row.nameEl, version);
		const data = version.data;
		const difference = data ? compare(data) : null;
		this.renderSummary(row.descEl, difference);
		row.addExtraButton((button) =>
			button
				.setIcon("eye")
				.setTooltip(t("recovery.details.view"))
				.onClick(() =>
					new SettingsRecoveryDetailsModal(
						this.ctx.app,
						recovery.details(version.copies[0]!, version),
					).open(),
				),
		);
		row.addExtraButton((button) => {
			button
				.setIcon("trash-2")
				.setTooltip(t("recovery.delete"))
				.onClick(() => {
					void this.remove(version);
				});
			button.extraSettingsEl.addClass("cs-recovery-delete-btn");
		});
		if (!data || !difference) return;
		row.addButton((button) => {
			// Red, as it was before the 1.13 rewrite: restoring replaces the whole setup
			// on every synced device. Obsidian's red button is `setDestructive()`.
			button
				.setButtonText(t("recovery.restore"))
				.setDestructive()
				.onClick(() => {
					if (explainIfBlocked(this.restoreBlockedReason(difference.changed))) return;
					void this.restore(version, data, difference.changed);
				});
			paintBlocked(button.buttonEl, this.restoreBlockedReason(difference.changed));
			button.buttonEl.addClass("cs-recovery-restore-btn");
		});
	}

	/** What the version holds and how far it is from now; the counts share a line when the buttons wrap. */
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
	 * saving can pause, or resume, while this page is open.
	 */
	private restoreBlockedReason(changed: number): string | null {
		if (this.ctx.plugin.settingsWriter.isFrozen) return t("notice.blockedWhilePaused");
		return changed === 0 ? t("versions.restoreSame") : null;
	}

	private async restore(
		version: SetupVersion,
		data: NonNullable<SetupVersion["data"]>,
		count: number,
	): Promise<void> {
		const recovery = this.ctx.plugin.recovery;
		if (!recovery || blockedWhilePaused(this.ctx.plugin.settingsWriter)) return;
		const name = versionName(version),
			when = versionTime(version.time);
		const confirmed = await new ConfirmModal(
			this.ctx.app,
			t("versions.restoreTitle"),
			t("versions.restoreBody", { count }),
			t("recovery.restore"),
		)
			.withMascot(t("versions.subtitle", { name, when }))
			.confirm();
		if (!confirmed) return;
		const outcome = await recovery.restore(data);
		if (outcome === "restored") {
			showNotice("restored", t("versions.restored", { name, when }));
			// The setup just changed, so every row's comparison with "now" did too.
			this.reload();
			return;
		}
		showNotice("problem", t(OUTCOMES[outcome]));
	}

	private async remove(version: SetupVersion): Promise<void> {
		const recovery = this.ctx.plugin.recovery;
		if (!recovery) return;
		const name = versionName(version),
			when = versionTime(version.time);
		// A presentation category does not say whether deletion can propagate.
		const deletesFiles = version.copies.some((copy) => copy.kind !== "history" && copy.path !== null);
		const body = [
			t("versions.deleteAvailableBody"),
			deletesFiles ? t("versions.deleteSyncedFiles") : "",
			t("versions.deleteFinal"),
		]
			.filter(Boolean)
			.join("\n");
		const confirmed = await new ConfirmModal(this.ctx.app, t("versions.deleteTitle"), body, t("recovery.delete"))
			.withMascot(t("versions.subtitle", { name, when }))
			.confirm();
		if (!confirmed) return;
		if (!(await recovery.removeVersion(version))) {
			showNotice("warning", t("versions.deleteFailed"));
			this.reload();
			return;
		}
		showNotice("success", t("versions.deleted", { name, when }));
		this.reload();
	}
}
