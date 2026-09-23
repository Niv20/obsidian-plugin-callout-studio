import { Notice, type App } from "obsidian";
import { t } from "../i18n";
import { openCalloutOccurrences } from "./registerOccurrencesView";

/**
 * Obsidian exposes no public close-settings API. Keep this optional host seam
 * isolated: unsupported hosts still open the public ItemView and explain how
 * to reach it. Only called for an explicit navigation action from Settings.
 */
export async function openOccurrencesFromSettings(app: App, ids: readonly string[]): Promise<void> {
	const settings = app.setting as (App["setting"] & { close?: () => void }) | undefined;
	let closed = false;
	try {
		if (typeof settings?.close === "function") { settings.close(); closed = true; }
	} catch { /* Host version may not support this optional method. */ }
	await openCalloutOccurrences(app, ids);
	if (!closed) new Notice(t("usage.closeSettings"));
}
