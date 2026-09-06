import { canonicalIconValue } from "../../icons/lucideId";
import { reportSettingsSaveFailure, clearSettingsSaveFailure } from "../../manager/settingsSaveReporter";
import { SettingsPersistenceError } from "../../manager/settingsSaveStatus";
import { en } from "../../i18n/en";
import { canonical } from "../../manager/syncTree";
import type { PluginData } from "../../types";
import { Notice } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { CalloutEditorPlugin } from "./types";
import { persistEditorSettings } from "./persistEditorSettings";
import type { CalloutVaultSavePlan } from "./calloutVaultSavePlan";

class NoteUpdateError extends Error {}

/** Owns a single Save attempt, including its durable write and failure state. */
export class EditorSaveSession {
	busy = false;
	private pendingVaultChanges: CalloutVaultSavePlan | null = null;
	private pendingRow: { id: string; json: string } | null = null;

	/** Store before awaiting: a failed write or partial rewrite remains retryable. */
	async applyVaultChanges(host: CalloutEditorPlugin, plan: CalloutVaultSavePlan, definition?: CalloutDefinition): Promise<void> {
		this.pendingVaultChanges = plan;
		this.pendingRow = definition ? { id: definition.id, json: this.rowSnapshot(host.registry.toSaveData(), definition.id) } : null;
		await this.resumeVaultChanges(host);
	}

	private rowSnapshot(data: Partial<PluginData>, id: string): string {
		const row = data.callouts?.find(row => row.id === id);
		return row ? canonical({ ...row, icon: { ...row.icon, value: canonicalIconValue(row.icon) } }) : "";
	}

	/** An explicit recovery action can release sync while keeping the form open. */
	async recover(host: CalloutEditorPlugin, onBusyChange: () => void): Promise<boolean> {
		if (this.busy || host.settingsWriter.isDestroyed || !host.retrySettingsRecovery) return false;
		this.busy = true;
		try {
			onBusyChange();
			const recovered = await host.retrySettingsRecovery({ editor: true, canApply: data =>
				!this.pendingRow || this.rowSnapshot(data, this.pendingRow.id) === this.pendingRow.json });
			if (recovered) new Notice(t("saveStatus.reviewDraft"), 10000);
			return recovered;
		} finally { this.busy = false; onBusyChange(); }
	}

	private async resumeVaultChanges(host: CalloutEditorPlugin): Promise<void> {
		if (!this.pendingVaultChanges) return;
		if (this.pendingRow && this.rowSnapshot(host.registry.toSaveData(), this.pendingRow.id) !== this.pendingRow.json) {
			host.settingsWriter.status?.fail("sync-conflict");
			throw new SettingsPersistenceError("sync-conflict", "Pending note updates need the saved callout definition");
		}
		if (!await persistEditorSettings(host)) throw new SettingsPersistenceError(host.settingsWriter.status?.reason ?? "changed", "Callout must be saved before rewriting notes");
		try { await this.pendingVaultChanges(); }
		catch (error) { console.error("[callout-studio] note updates failed", error); throw new NoteUpdateError(en["saveStatus.notesFailed"]); }
		this.pendingVaultChanges = null;
		this.pendingRow = null;
	}

	async run(
		host: CalloutEditorPlugin,
		apply: () => Promise<CalloutDefinition | null>,
		onBusyChange: () => void,
	): Promise<CalloutDefinition | null> {
		if (this.busy) return null;
		if (host.settingsWriter.isFrozen || host.settingsWriter.isDestroyed) {
			reportSettingsSaveFailure(host.settingsWriter);
			return null;
		}
		this.busy = true;
		try {
			onBusyChange();
			// A failed A→B pass must finish before the form may request B→C.
			await this.resumeVaultChanges(host);
			const def = await apply();
			if (!def) return null;
			if (!await persistEditorSettings(host)) {
				throw new SettingsPersistenceError(host.settingsWriter.status?.reason ?? "changed", "Current callout settings were not persisted");
			}
			clearSettingsSaveFailure(host.settingsWriter);
			return def;
		} catch (error) {
			console.error("[Callout Studio] callout save failed", error);
			reportSettingsSaveFailure(host.settingsWriter, error, error instanceof NoteUpdateError ? error.message : undefined);
			return null;
		} finally {
			this.busy = false;
			onBusyChange();
		}
	}
}
