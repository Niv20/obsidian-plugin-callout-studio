import { Notice, type App, type Plugin } from "obsidian";
import { t } from "../i18n";
import { PORTABLE_CONVERSION_VIEW, PortableConversionView } from "./PortableConversionView";

const registeredViews = new WeakSet<Plugin>();

export function registerPortableConversionView(plugin: Plugin): void {
	plugin.registerView(PORTABLE_CONVERSION_VIEW, (leaf) => new PortableConversionView(leaf));
	registeredViews.add(plugin);
}

export function refreshPortableConversionViewLocale(plugin: Plugin): void {
	if (!registeredViews.has(plugin)) return;
	for (const leaf of plugin.app.workspace.getLeavesOfType(PORTABLE_CONVERSION_VIEW)) {
		if (leaf.view instanceof PortableConversionView) leaf.view.refreshLabels();
	}
}

export async function openPortableConversionFromSettings(app: App): Promise<void> {
	const settings = app.setting as (App["setting"] & { close?: () => void }) | undefined;
	let closed = false;
	try {
		if (typeof settings?.close === "function") { settings.close(); closed = true; }
	} catch { /* Optional host seam: the public sidebar still opens. */ }
	try {
		const leaf = await app.workspace.ensureSideLeaf(PORTABLE_CONVERSION_VIEW, "right", { active: true, reveal: true });
		await leaf.loadIfDeferred();
		await app.workspace.revealLeaf(leaf);
		if (!closed) new Notice(t("portable.closeSettings"));
	} catch { new Notice(t("portable.openFailed")); }
}
