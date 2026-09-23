import { Notice, type App, type Plugin } from "obsidian";
import { t } from "../i18n";
import type { CalloutRenderRole } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { CALLOUT_OCCURRENCES_VIEW, CalloutOccurrencesView } from "./CalloutOccurrencesView";

const commandNames = new WeakMap<Plugin, string>();

export function registerOccurrencesView(plugin: Plugin & { registry: CalloutRegistry }): void {
	plugin.registerView(CALLOUT_OCCURRENCES_VIEW, (leaf) => new CalloutOccurrencesView(leaf, plugin.registry));
	registerOccurrencesCommand(plugin);
}

function registerOccurrencesCommand(plugin: Plugin): void {
	const name = t("usage.title");
	if (commandNames.get(plugin) !== name) {
		if (commandNames.has(plugin)) plugin.removeCommand("show-callout-occurrences");
		plugin.addCommand({
			id: "show-callout-occurrences", name,
			callback: () => { void openCalloutOccurrences(plugin.app); },
		});
		commandNames.set(plugin, name);
	}
}

export function refreshOccurrencesViewLocale(plugin: Plugin): void {
	// Locale preparation can complete before this feature's lifecycle registration.
	if (!commandNames.has(plugin)) return;
	registerOccurrencesCommand(plugin);
	for (const leaf of plugin.app.workspace.getLeavesOfType(CALLOUT_OCCURRENCES_VIEW)) {
		if (leaf.view instanceof CalloutOccurrencesView) leaf.view.refreshLabels();
	}
}

export async function openCalloutOccurrences(
	app: App,
	ids?: readonly string[],
	role?: CalloutRenderRole,
): Promise<void> {
	try {
		const leaf = await app.workspace.ensureSideLeaf(CALLOUT_OCCURRENCES_VIEW, "right", {
			active: true,
			reveal: true,
			state: { ids: ids ? [...ids] : undefined, role },
		});
		await leaf.loadIfDeferred();
		// ensureSideLeaf can reuse a leaf: always apply the newly requested filter.
		await leaf.setViewState({
			type: CALLOUT_OCCURRENCES_VIEW,
			active: true,
			state: { ids: ids ? [...ids] : undefined, role },
		});
		await app.workspace.revealLeaf(leaf);
	} catch {
		new Notice(t("usage.openFailed"));
	}
}
