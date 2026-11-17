/**
 * webPanel/registerWebPanel.ts — puts the Publish to the web panel in
 * Obsidian: registers it as a view, and opens it.
 *
 * Who calls it. `main.ts` registers the view; the settings' Website row
 * (`settings/declarative/mainPageGroups.ts`) and the **Publish to the web**
 * command (`editor/commands.ts`, through `main.ts`) open it.
 *
 * The main idea. The panel is opened on demand and only so: it is for setting
 * a site up, which happens once, so it gets no ribbon icon and no tab of its
 * own that is always there. It opens in the right sidebar, where a tab of it
 * that is already open is brought forward rather than doubled. Closing the tab
 * is all it takes to be rid of it, and a tab that was left open is closed
 * when Obsidian next starts (`ui/initializeSidebarTabs.ts`).
 *
 * The settings are a window over the workspace, so opening the panel from
 * them closes them first: the panel is where the user goes next. Closing them
 * leans on a part of Obsidian that is not in its public API; where it is
 * missing, the panel still opens and a notice says to close the settings.
 */
import { type App, type Plugin } from "obsidian";
import { t } from "../i18n";
import { showNotice } from "../ui/mascot/mascotNotices";
import { WEB_PANEL_VIEW } from "./viewType";
import { WebPanelView, type WebPanelHost } from "./WebPanelView";

const registeredViews = new WeakSet<Plugin>();

export function registerWebPanel(plugin: Plugin & WebPanelHost): void {
	plugin.registerView(WEB_PANEL_VIEW, (leaf) => new WebPanelView(leaf, plugin));
	registeredViews.add(plugin);
}

/** A language arrived or was picked: an open panel says everything again in it. */
export function refreshWebPanelLocale(plugin: Plugin): void {
	if (!registeredViews.has(plugin)) return;
	for (const leaf of plugin.app.workspace.getLeavesOfType(WEB_PANEL_VIEW)) {
		if (leaf.view instanceof WebPanelView) leaf.view.refreshLabels();
	}
}

/** Open the panel in the right sidebar, closing the settings if they are open. Never throws. */
export async function openWebPanel(app: App): Promise<void> {
	const settings = app.setting as (App["setting"] & { close?: () => void }) | undefined;
	let closed = false;
	try {
		if (typeof settings?.close === "function") {
			settings.close();
			closed = true;
		}
	} catch {
		/* Optional host seam: the public sidebar still opens. */
	}
	try {
		const leaf = await app.workspace.ensureSideLeaf(WEB_PANEL_VIEW, "right", { active: true, reveal: true });
		await leaf.loadIfDeferred();
		await app.workspace.revealLeaf(leaf);
		if (!closed) showNotice("info", t("web.closeSettings"));
	} catch {
		showNotice("problem", t("web.openFailed"));
	}
}
