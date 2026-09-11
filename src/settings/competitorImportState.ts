/** Session eligibility plus the durable completion state for the import prompt. */
import type { SettingsTabPlugin } from "./sections/types";

// A WeakSet gives the automatic welcome route a session-only signal without
// adding onboarding policy to the plugin lifecycle class or keeping it alive.
const armedPlugins = new WeakSet<SettingsTabPlugin>();
const forcedPlugins = new WeakSet<SettingsTabPlugin>();

export function armCompetitorImportBanner(plugin: SettingsTabPlugin): void {
	armedPlugins.add(plugin);
}

export function shouldShowCompetitorImportBanner(
	plugin: SettingsTabPlugin,
): boolean {
	return forcedPlugins.has(plugin) || (
		armedPlugins.has(plugin) &&
		plugin.registry.settings.competitorImportBannerHandled !== true
	);
}

/** Explicit preview bypass used only by the private Obsidian URI. */
export function forceCompetitorImportBanner(plugin: SettingsTabPlugin): void {
	forcedPlugins.add(plugin);
}

export function isCompetitorImportBannerForced(
	plugin: SettingsTabPlugin,
): boolean {
	return forcedPlugins.has(plugin);
}

/** Shared by explicit dismissal and every successfully applied import. */
export async function markCompetitorImportBannerHandled(
	plugin: SettingsTabPlugin,
): Promise<void> {
	armedPlugins.delete(plugin);
	forcedPlugins.delete(plugin);
	if (plugin.registry.settings.competitorImportBannerHandled === true) return;
	plugin.registry.settings.competitorImportBannerHandled = true;
	await plugin.saveSettings();
}
