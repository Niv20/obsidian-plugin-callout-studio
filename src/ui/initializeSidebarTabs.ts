import type { App } from "obsidian";
import { PORTABLE_CONVERSION_VIEW } from "../portable/PortableConversionView";
import { ensureOccurrencesSidebarTab } from "../usage/registerOccurrencesView";

/** Keep only the browsing tab in the startup sidebar, including restored layouts. */
export async function initializeSidebarTabs(app: App): Promise<void> {
	app.workspace.detachLeavesOfType(PORTABLE_CONVERSION_VIEW);
	await ensureOccurrencesSidebarTab(app);
}
