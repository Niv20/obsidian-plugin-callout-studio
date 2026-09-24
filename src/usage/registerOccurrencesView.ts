import { Notice, type App, type Plugin } from "obsidian";
import { t } from "../i18n";
import type { CalloutRenderRole } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { CALLOUT_OCCURRENCES_VIEW, CalloutOccurrencesView } from "./CalloutOccurrencesView";

const registeredViews = new WeakSet<Plugin>();

export function registerOccurrencesView(plugin: Plugin & { registry: CalloutRegistry }): void {
	plugin.registerView(CALLOUT_OCCURRENCES_VIEW, (leaf) => new CalloutOccurrencesView(leaf, plugin.registry));
	registeredViews.add(plugin);
}

export function refreshOccurrencesViewLocale(plugin: Plugin): void {
	if (!registeredViews.has(plugin)) return;
	for (const leaf of plugin.app.workspace.getLeavesOfType(CALLOUT_OCCURRENCES_VIEW)) {
		if (leaf.view instanceof CalloutOccurrencesView) leaf.view.refreshLabels();
	}
}

/** Fallback selection can change artwork without changing registry rows or generated CSS. */
export function refreshOccurrencesViewAppearance(plugin: Plugin): void {
	if (!registeredViews.has(plugin)) return;
	for (const leaf of plugin.app.workspace.getLeavesOfType(CALLOUT_OCCURRENCES_VIEW)) {
		if (leaf.view instanceof CalloutOccurrencesView) leaf.view.refreshAppearance();
	}
}

export async function openCalloutOccurrences(
	app: App,
	ids?: readonly string[],
	role?: CalloutRenderRole,
): Promise<void> {
	try {
		const state = ids?.length ? { ids: [...ids], role } : { allTypes: true, role };
		const leaf = await app.workspace.ensureSideLeaf(CALLOUT_OCCURRENCES_VIEW, "right", {
			active: true,
			reveal: true,
			state,
		});
		await leaf.loadIfDeferred();
		// ensureSideLeaf can reuse a leaf: always apply the newly requested filter.
		await leaf.setViewState({
			type: CALLOUT_OCCURRENCES_VIEW,
			active: true,
			state,
		});
		await app.workspace.revealLeaf(leaf);
	} catch {
		new Notice(t("usage.openFailed"));
	}
}
