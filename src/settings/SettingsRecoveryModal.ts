/**
 * settings/SettingsRecoveryModal.ts — every earlier setup Callout Studio can
 * find, and a way back to each.
 *
 * Three places keep one: this device's history (IndexedDB, survives uninstall),
 * the backups folder beside the settings file (synced), and stray copies of the
 * settings file a sync service left behind (`data 2.json` and the like, which
 * nothing else would ever mention). Each row says how far it is from what is
 * shown now. **Restore** replaces the current setup, after a confirmation and a
 * verified backup. **View details** inspects a snapshot of an entry's restore
 * effects without writing settings. **Delete** permanently forgets one entry —
 * independent of the writer, so it stays available while saving is paused.
 */
import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import { getLocale, t } from "../i18n";
import type { RecoverySource, RecoverySourceKind, RestoreOutcome, SettingsRecoveryService } from "../manager/settingsRecoveryService";
import type { SettingsWriter } from "../manager/SettingsWriter";
import { ConfirmModal } from "../utils/ConfirmModal";
import { explainIfBlocked, paintBlocked } from "../ui/blockedButton";
import { applyModalChrome } from "./modalChrome";
import { blockedWhilePaused } from "./pausedGuard";
import { SettingsRecoveryDetailsModal } from "./SettingsRecoveryDetailsModal";
import { attachSectionDisclosure } from "./sections/sectionDisclosure";
import { headingWithCount } from "../ui/headingCount";

export interface RecoveryModalPlugin {
	recovery?: SettingsRecoveryService;
	settingsWriter: Pick<SettingsWriter, "isFrozen">;
}

const SECTIONS: readonly [RecoverySourceKind, string][] = [
	["history", "recovery.sectionHistory"],
	["backup", "recovery.sectionBackups"],
	["copy", "recovery.sectionCopies"],
];

const OUTCOMES: Record<Exclude<RestoreOutcome, "restored">, string> = {
	paused: "notice.blockedWhilePaused",
	invalid: "recovery.failed",
	stale: "recovery.stale",
	backup: "recovery.backupFailed",
	failed: "recovery.failed",
};

function when(source: RecoverySource): string {
	if (source.time === null) return source.path?.slice(source.path.lastIndexOf("/") + 1) ?? "";
	try { return new Date(source.time).toLocaleString(getLocale()); }
	catch { return new Date(source.time).toLocaleString(); }
}

export class SettingsRecoveryModal extends Modal {
	private generation = 0;
	private listEl: HTMLElement | null = null;

	constructor(app: App, private readonly plugin: RecoveryModalPlugin) {
		super(app);
	}

	onOpen(): void {
		applyModalChrome(this);
		this.setTitle(t("recovery.title"));
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: t("recovery.intro"), cls: "cs-recovery-intro" });
		if (this.plugin.settingsWriter.isFrozen) {
			contentEl.createEl("p", { text: t("recovery.pausedViewHint"), cls: "cs-recovery-paused" });
		}
		this.listEl = contentEl.createDiv({ cls: "cs-recovery-list" });
		this.reload();
	}

	onClose(): void {
		this.generation++;
		this.listEl = null;
		this.contentEl.empty();
	}

	/** (Re)fetch every earlier setup and redraw the list; used after opening and after a delete. */
	private reload(): void {
		const list = this.listEl;
		if (!list) return;
		list.empty();
		list.createEl("p", { text: t("recovery.loading"), cls: "cs-recovery-status" });
		const generation = ++this.generation;
		const recovery = this.plugin.recovery;
		if (!recovery) { this.render(list, []); return; }
		void recovery.listSources().then(
			sources => { if (generation === this.generation) this.render(list, sources); },
			(error: unknown) => {
				console.error("[callout-studio] earlier setups could not be listed", error);
				if (generation === this.generation) this.render(list, []);
			},
		);
	}

	private render(list: HTMLElement, sources: RecoverySource[]): void {
		list.empty();
		if (sources.length === 0) {
			list.createEl("p", { text: t("recovery.empty"), cls: "cs-recovery-status" });
			return;
		}
		for (const [kind, heading] of SECTIONS) {
			const group = sources.filter(source => source.kind === kind);
			if (group.length === 0) continue;
			const section = list.createDiv({ cls: "cs-recovery-group" });
			const headingSetting = new Setting(section)
				.setName(headingWithCount(t(heading), group.length))
				.setHeading();
			const rows = section.createDiv({ cls: "cs-recovery-group-rows" });
			attachSectionDisclosure(headingSetting, rows);
			for (const source of group) this.renderRow(rows, source);
		}
	}

	private renderRow(list: HTMLElement, source: RecoverySource): void {
		const recovery = this.plugin.recovery!;
		const label = when(source);
		const row = new Setting(list).setName(label);
		// `cs-row-inline` keeps the icons and Restore beside the label on phone,
		// vertically centred like on desktop, instead of stacked onto a
		// full-width line of their own. See the class in styles.css.
		row.settingEl.addClass("callout-studio-row", "cs-recovery-row", "cs-row-inline");
		const data = source.data;
		const difference = data ? recovery.difference(data) : null;
		// A setup identical to the current one has nothing to show; an unreadable one still says so.
		if (!difference || difference.changed > 0) {
			row.addExtraButton(button => button
				.setIcon("eye")
				.setTooltip(t("recovery.details.view"))
				.onClick(() => new SettingsRecoveryDetailsModal(this.app, recovery.details(source)).open()));
		}
		row.addExtraButton(button => {
			button.setIcon("trash-2").setTooltip(t("recovery.delete"))
				.onClick(() => { void this.remove(source, label); });
			button.extraSettingsEl.addClass("cs-recovery-delete-btn");
		});
		if (!data || !difference) {
			row.setDesc(t("recovery.unreadable"));
			return;
		}
		if (difference.changed === 0) {
			row.setDesc(t("recovery.same"));
		} else {
			// Two independent clauses, not one combined string: on phone the
			// separator between them is hidden and each becomes its own line
			// (see the `.cs-recovery-summary-*` rules in styles.css).
			row.descEl.createSpan({ text: t("recovery.summaryCallouts", { callouts: difference.callouts }), cls: "cs-recovery-summary-part" });
			row.descEl.createSpan({ text: ", ", cls: "cs-recovery-summary-sep" });
			row.descEl.createSpan({ text: t("recovery.summaryChanges", { count: difference.changed }), cls: "cs-recovery-summary-part" });
		}
		row.addButton(button => {
			button.setButtonText(t("recovery.restore")).setWarning()
				.onClick(() => {
					if (explainIfBlocked(this.restoreBlockedReason(difference.changed))) return;
					void this.restore(data, label, difference.changed);
				});
			paintBlocked(button.buttonEl, this.restoreBlockedReason(difference.changed));
			button.buttonEl.addClass("cs-recovery-restore-btn");
		});
	}

	/**
	 * Why Restore cannot act on a row, or null: saving is paused (a restored
	 * setup could not be kept), or the row is already what is shown now. Dimmed
	 * rather than disabled, so pressing it says which. Read again at the press —
	 * saving can pause, or resume, while this window is open.
	 */
	private restoreBlockedReason(changed: number): string | null {
		if (this.plugin.settingsWriter.isFrozen) return t("notice.blockedWhilePaused");
		return changed === 0 ? t("recovery.restoreSame") : null;
	}

	private async restore(data: NonNullable<RecoverySource["data"]>, label: string, count: number): Promise<void> {
		const recovery = this.plugin.recovery;
		if (!recovery || blockedWhilePaused(this.plugin.settingsWriter)) return;
		const confirmed = await new ConfirmModal(
			this.app,
			t("recovery.confirmTitle"),
			t("recovery.confirmBody", { when: label, count }),
			t("recovery.restore"),
		).confirm();
		if (!confirmed) return;
		const outcome = await recovery.restore(data);
		if (outcome === "restored") {
			new Notice(t("recovery.restored", { when: label }));
			this.close();
			return;
		}
		new Notice(t(OUTCOMES[outcome]), 10000);
	}

	private async remove(source: RecoverySource, label: string): Promise<void> {
		const recovery = this.plugin.recovery;
		if (!recovery) return;
		const confirmed = await new ConfirmModal(
			this.app,
			t("recovery.deleteConfirmTitle"),
			t("recovery.deleteConfirmBody", { when: label }),
			t("recovery.delete"),
		).confirm();
		if (!confirmed) return;
		if (!await recovery.remove(source)) {
			new Notice(t("recovery.deleteFailed"), 10000);
			return;
		}
		new Notice(t("recovery.deleted", { when: label }));
		this.reload();
	}
}
