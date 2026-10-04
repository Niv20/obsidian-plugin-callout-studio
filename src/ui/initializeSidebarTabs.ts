import type { App } from "obsidian";
import type { DeviceLocalStore } from "../manager/DeviceLocalStore";
import type { PluginSettings } from "../types";
import { PORTABLE_CONVERSION_VIEW } from "../portable/PortableConversionView";
import { CALLOUT_OCCURRENCES_VIEW } from "../usage/CalloutOccurrencesView";
import { ensureOccurrencesSidebarTab } from "../usage/registerOccurrencesView";

interface SidebarStartupHost {
	app: App;
	settings: Pick<PluginSettings, "welcomeSeen">;
	localState: Pick<DeviceLocalStore, "hasSeenWelcome" | "hasOfferedOccurrencesTab" | "markOccurrencesTabOffered">;
}

/** Offer browsing once; subsequent launches leave its presence to the workspace. */
export async function initializeSidebarTabs(
	{ app, settings, localState }: SidebarStartupHost,
	isFreshInstall: boolean,
): Promise<void> {
	app.workspace.detachLeavesOfType(PORTABLE_CONVERSION_VIEW);
	// Untouched older installs can still lack data.json. Their welcome markers
	// distinguish them from a new install without imposing a tab during upgrade.
	if (!isFreshInstall || settings.welcomeSeen || localState.hasSeenWelcome || localState.hasOfferedOccurrencesTab) return;
	// Record before the async creation, including when it fails. If storage is
	// unavailable, skip the automatic offer rather than repeating it on reload.
	if (!localState.markOccurrencesTabOffered()) return;
	// A restored or manually opened leaf may live outside the right sidebar.
	if (app.workspace.getLeavesOfType(CALLOUT_OCCURRENCES_VIEW).length > 0) return;
	await ensureOccurrencesSidebarTab(app);
}
