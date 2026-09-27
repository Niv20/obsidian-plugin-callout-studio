/**
 * settings/SettingsRecoveryModal.ts — every earlier setup Callout Studio can
 * find, and a way back to each.
 *
 * Three places keep one: this device's history (IndexedDB, survives uninstall),
 * the backups folder beside the settings file (synced), and stray copies of the
 * settings file a sync service left behind (`data 2.json` and the like, which
 * nothing else would ever mention). Each row says how far it is from what is
 * shown now. **Restore** replaces the current setup, after a confirmation and a
 * verified backup; **Export copy** downloads it as a Callout Studio backup,
 * which works even while saving is paused.
 */
import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import { getLocale, t } from "../i18n";
import type { RecoverySource, RecoverySourceKind, RestoreOutcome, SettingsRecoveryService } from "../manager/settingsRecoveryService";
import type { SettingsWriter } from "../manager/SettingsWriter";
import { ConfirmModal } from "../utils/ConfirmModal";
import { downloadText } from "../utils/downloadText";
import { applyModalChrome } from "./modalChrome";
import { blockedWhilePaused } from "./pausedGuard";

export interface RecoveryModalPlugin {
	recovery?: SettingsRecoveryService;
	settingsWriter: Pick<SettingsWriter, "isFrozen">;
}

const SECTIONS: readonly [RecoverySourceKind, string][] = [
	["history", "recovery.sectionHistory"],
	["backup", "recovery.sectionBackups"],
	["copy", "recovery.sectionCopies"],
];

const ORIGINS: Record<NonNullable<RecoverySource["origin"]>, string> = {
	"this-device": "recovery.originThisDevice",
	"other-device": "recovery.originOtherDevice",
	"older-version": "recovery.originOlderVersion",
};

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
			contentEl.createEl("p", { text: t("recovery.pausedHint"), cls: "cs-recovery-paused" });
		}
		const list = contentEl.createDiv({ cls: "cs-recovery-list" });
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

	onClose(): void {
		this.generation++;
		this.contentEl.empty();
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
			new Setting(list).setName(t(heading)).setHeading();
			for (const source of group) this.renderRow(list, source);
		}
	}

	private renderRow(list: HTMLElement, source: RecoverySource): void {
		const recovery = this.plugin.recovery!;
		const label = when(source);
		const origin = source.origin && t(ORIGINS[source.origin]);
		const row = new Setting(list).setName(label);
		const data = source.data;
		if (!data) {
			row.setDesc([origin, t("recovery.unreadable")].filter(Boolean).join(" · "));
			return;
		}
		const difference = recovery.difference(data);
		const summary = difference.changed === 0
			? t("recovery.same")
			: t("recovery.summary", { callouts: difference.callouts, count: difference.changed });
		row.setDesc([origin, summary].filter(Boolean).join(" · "));
		row.addButton(button => button
			.setButtonText(t("recovery.export"))
			.onClick(() => {
				const stamp = source.time === null ? "copy" : new Date(source.time).toISOString().slice(0, 10);
				downloadText(recovery.exportJson(data), `callout-studio-${stamp}.json`);
			}));
		row.addButton(button => {
			button.setButtonText(t("recovery.restore")).setWarning()
				.onClick(() => { void this.restore(data, label, difference.changed); });
			button.setDisabled(this.plugin.settingsWriter.isFrozen || difference.changed === 0);
		});
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
}
