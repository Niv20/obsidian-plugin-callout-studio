/**
 * First-install migration prompt shown beneath the settings title: which
 * plugins to name, and the sentence. It is drawn by settings/offerBanner.ts.
 */
import type { App } from "obsidian";
import { t } from "../i18n";
import { nameList } from "./offerBanner";
import type { SettingsContext } from "./sections/types";
import { isCompetitorImportBannerForced, shouldShowCompetitorImportBanner } from "./competitorImportState";

export interface DetectedCompetitor {
	id: "callout-manager" | "admonition";
	name: string;
}

type PluginManager = {
	enabledPlugins?: Set<string>;
	manifests?: Record<string, unknown>;
	plugins?: Record<string, unknown>;
};

type AppWithPluginManager = App & { plugins?: PluginManager };

const COMPETITORS: readonly (DetectedCompetitor & { pluginIds: readonly string[] })[] = [
	{
		id: "callout-manager",
		name: "Callout Manager",
		pluginIds: ["callout-manager"],
	},
	{
		id: "admonition",
		name: "Admonition",
		// Current releases use `obsidian-admonition`; accept the short id as
		// well so a fork or older manifest cannot make the onboarding lie.
		pluginIds: ["obsidian-admonition", "admonition"],
	},
];

/** Enabled implies configured; the manifest/instance check proves installed. */
export function detectEnabledCompetitors(app: App): DetectedCompetitor[] {
	const manager = (app as AppWithPluginManager).plugins;
	const enabled = manager?.enabledPlugins;
	if (!enabled) return [];

	return COMPETITORS.filter((competitor) =>
		competitor.pluginIds.some(
			(pluginId) =>
				enabled.has(pluginId) &&
				(Boolean(manager.manifests?.[pluginId]) || Boolean(manager.plugins?.[pluginId])),
		),
	).map(({ id, name }) => ({ id, name }));
}

/** One placeholder carries a locale-aware list of every detected plugin. */
export function competitorImportMessage(competitors: readonly DetectedCompetitor[]): string {
	if (competitors.length === 0) return "";
	return t("importBanner.message", { plugins: nameList(competitors.map(({ name }) => name)) });
}

/**
 * The plugins whose callouts to offer importing now: none unless the prompt is
 * armed (or forced from the developer protocol), then the enabled ones, or all
 * of them when forced with none enabled.
 */
export function competitorsToOffer(app: App, plugin: SettingsContext["plugin"]): DetectedCompetitor[] {
	if (!shouldShowCompetitorImportBanner(plugin)) return [];
	const competitors = detectEnabledCompetitors(app);
	if (competitors.length === 0 && isCompetitorImportBannerForced(plugin)) {
		return COMPETITORS.map(({ id, name }) => ({ id, name }));
	}
	return competitors;
}
