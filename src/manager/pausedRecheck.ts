/**
 * manager/pausedRecheck.ts — keep looking while saving is paused.
 *
 * The reload queue retries an unavailable settings file three times within a
 * few seconds, then waits for the next file event or the next return to the
 * app. A phone left open on a paused session got neither: the file came back,
 * and nothing looked until the user left and returned. While saving is paused
 * because the settings file is missing or unreadable, this checks again once a
 * minute, and only while the app is on screen.
 */
import type { SettingsWriter } from "./SettingsWriter";
import type { SettingsSaveReason } from "./settingsSaveStatus";

export const PAUSED_RECHECK_MS = 60_000;

/**
 * The paused states this keeps looking in. The saving banner promises "checks
 * again every minute" only for these, so the promise and the timer share one
 * answer rather than two lists that could drift.
 */
export function rechecksWhilePaused(reason: SettingsSaveReason | null | undefined): boolean {
	return reason === "missing" || reason === "unreadable";
}

export interface PausedRecheckHost {
	settingsWriter: Pick<SettingsWriter, "isVisiblyPaused" | "isDestroyed" | "status">;
	onExternalSettingsChange(): Promise<void>;
	registerInterval(id: number): number;
}

/** One look: only while visibly paused for a missing or unreadable file, and on screen. */
export function recheckIfPaused(host: PausedRecheckHost, doc: Pick<Document, "visibilityState"> = document): void {
	const writer = host.settingsWriter;
	if (writer.isDestroyed || !writer.isVisiblyPaused || doc.visibilityState === "hidden") return;
	if (!rechecksWhilePaused(writer.status.frozenReason)) return;
	void host.onExternalSettingsChange().catch((error: unknown) => {
		console.error("[callout-studio] could not check the settings file again", error);
	});
}

export function registerPausedRecheck(host: PausedRecheckHost): void {
	host.registerInterval(window.setInterval(() => recheckIfPaused(host), PAUSED_RECHECK_MS));
}
