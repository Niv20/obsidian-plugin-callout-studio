import { Notice } from "obsidian";
import { SettingsPersistenceError, type SettingsSaveStatus } from "./settingsSaveStatus";
import { settingsSaveMessage } from "./settingsSaveMessage";

interface SaveFeedbackHost {
	status?: SettingsSaveStatus;
	isDestroyed?: boolean;
}
interface Report { notice: Notice; message: string; at: number; unsubscribe?: () => void }
const reports = new WeakMap<SaveFeedbackHost, Report>();

/** All layers of the same save share one notice, including deferred guards. */
export function reportSettingsSaveFailure(host: SaveFeedbackHost, error?: unknown, message?: string): void {
	if (host.isDestroyed) return;
	message ??= settingsSaveMessage(error instanceof SettingsPersistenceError ? error.reason : error === undefined ? host.status?.reason : null);
	const previous = reports.get(host);
	if (previous?.message === message && Date.now() - previous.at < 10000) return;
	clearSettingsSaveFailure(host);
	const report: Report = { notice: new Notice(message, 10000), message, at: Date.now() };
	reports.set(host, report);
	report.unsubscribe = host.status?.subscribe(() => {
		if (!host.status?.reason) clearSettingsSaveFailure(host);
	});
}

export function clearSettingsSaveFailure(host: SaveFeedbackHost): void {
	const previous = reports.get(host);
	if (!previous) return;
	reports.delete(host);
	previous.unsubscribe?.();
	previous.notice.hide();
}
