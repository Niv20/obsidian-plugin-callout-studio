import { Notice } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { CalloutEditorPlugin } from "./types";
import { persistEditorSettings } from "./persistEditorSettings";
import type { CalloutVaultSavePlan } from "./calloutVaultSavePlan";

/** Owns a single Save attempt, including its durable write and failure state. */
export class EditorSaveSession {
	busy = false;
	private pendingVaultChanges: CalloutVaultSavePlan | null = null;

	/** Store before awaiting: a failed write or partial rewrite remains retryable. */
	async applyVaultChanges(host: CalloutEditorPlugin, plan: CalloutVaultSavePlan): Promise<void> {
		this.pendingVaultChanges = plan;
		await this.resumeVaultChanges(host);
	}

	private async resumeVaultChanges(host: CalloutEditorPlugin): Promise<void> {
		if (!this.pendingVaultChanges) return;
		if (!await persistEditorSettings(host)) throw new Error("Callout must be saved before rewriting notes");
		await this.pendingVaultChanges();
		this.pendingVaultChanges = null;
	}

	async run(
		host: CalloutEditorPlugin,
		apply: () => Promise<CalloutDefinition | null>,
		onBusyChange: () => void,
	): Promise<CalloutDefinition | null> {
		if (this.busy) return null;
		if (host.settingsWriter.isFrozen || host.settingsWriter.isDestroyed) {
			new Notice(t("editor.saveFailed"), 10000);
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
				throw new Error("Current callout settings were not persisted");
			}
			return def;
		} catch (error) {
			console.error("[Callout Studio] callout save failed", error);
			new Notice(t("editor.saveFailed"), 10000);
			return null;
		} finally {
			this.busy = false;
			onBusyChange();
		}
	}
}
