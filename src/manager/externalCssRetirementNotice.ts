import { Notice } from "obsidian";
import { t } from "../i18n";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import type { SettingsWriter } from "./SettingsWriter";

interface RetirementHost {
	registry: CalloutRegistry;
	settingsWriter: SettingsWriter;
	localState: Pick<DeviceLocalStore, "hasPendingExternalCssNotice" | "queueExternalCssNotice" | "markExternalCssNoticeSeen">;
	register(cleanup: () => void): void;
}

/**
 * Observe before settings load; release the notice after locale/render startup
 * and layout readiness. A held save resolves before persistence, so neither
 * `load()` nor an awaited save request is enough to announce completion.
 */
export function trackExternalCssRetirement(host: RetirementHost): () => void {
	let ready = false;
	let disposed = false;
	const check = () => {
		const writer = host.settingsWriter;
		if (disposed || writer.isDestroyed || writer.isFrozen || writer.status.reason) return;
		if (host.registry.hasExternalCssRetirement) {
			// Remember affected-user evidence BEFORE the awaited migration write.
			// If its adapter replacement lands after unload, the next launch can
			// still announce it. Pending evidence is not a success notification.
			host.localState.queueExternalCssNotice();
		}
		if (!host.registry.hasExternalCssRetirement && !host.localState.hasPendingExternalCssNotice) return;
		// Old raw adoption fails this equality; held, failed or blocked save
		// requests cannot announce success. A clean snapshot from another
		// device also proves the migration completed for pending local evidence.
		if (!writer.matchesLastWrite(JSON.stringify(host.registry.toSaveData()), true)) return;
		host.registry.acknowledgeExternalCssRetirement();
		if (!ready || !host.localState.hasPendingExternalCssNotice) return;
		new Notice(t("notice.externalCssRetired"), 12000);
		host.localState.markExternalCssNoticeSeen();
	};
	const unsubscribe = host.settingsWriter.status.subscribe(check);
	host.register(() => { disposed = true; unsubscribe(); });
	return () => { ready = true; check(); };
}
