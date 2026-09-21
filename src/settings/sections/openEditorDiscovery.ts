/**
 * settings/sections/openEditorDiscovery.ts — callout ids the registry has no row
 * for, in the notes that happen to be open.
 *
 * A cheap counterpart to the whole-vault pass in `CalloutDiscovery`: opening the
 * settings tab is the moment a reader is most likely to be looking for a callout
 * they have just written, so the notes already in front of them are read once,
 * here, rather than waiting for a scheduled scan to come round.
 *
 * Deliberately does **not** save. Opening a settings tab is not a settings
 * change, and writing `data.json` for one is exactly the loop that issue #41 was
 * — see `manager/discoveredRowPersistence.ts` for where a discovered id does go.
 */
import { MarkdownView } from "obsidian";
import type { App } from "obsidian";
import { scanStringForUnknownCallouts } from "../../utils/vaultCalloutScanner";
import { mergeDashSpaceVariants } from "../../utils/calloutId";
import { buildKnownCalloutIds } from "../../manager/knownCalloutIds";
import type { SettingsTabPlugin } from "./types";

export function scanOpenEditorsForUnknownCallouts(
	app: App,
	plugin: SettingsTabPlugin,
): void {
	if (!plugin.settings.autoDiscoverCallouts) return;
	// The shared set, not a second one built here — see knownCalloutIds.ts.
	const known = buildKnownCalloutIds(plugin.registry);
	const seen = new Set<string>();
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) continue;
		const content = view.editor.getValue();
		if (!content) continue;
		for (const id of scanStringForUnknownCallouts(content, known)) {
			seen.add(id);
		}
	}
	if (seen.size === 0) return;
	// Folded again across leaves: `[!a b]` in one open note and `[!a-b]` in
	// another arrive here as two entries, as they do in a vault scan.
	const added = plugin.addUnknownCalloutsAsFallback(
		mergeDashSpaceVariants(Array.from(seen)),
	);
	// No saveSettings() — see the note above.
	if (added > 0) plugin.refreshCallouts();
}
