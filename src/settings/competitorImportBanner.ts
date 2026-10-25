/** First-install migration prompt shown beneath the settings title. */
import { setIcon, type App } from "obsidian";
import { getLocale, t } from "../i18n";
import type { SettingsContext } from "./sections/types";
import {
	isCompetitorImportBannerForced,
	shouldShowCompetitorImportBanner,
} from "./competitorImportState";

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
		competitor.pluginIds.some((pluginId) =>
			enabled.has(pluginId) &&
			(Boolean(manager.manifests?.[pluginId]) || Boolean(manager.plugins?.[pluginId])),
		),
	).map(({ id, name }) => ({ id, name }));
}

/** One placeholder carries a locale-aware list of every detected plugin. */
export function competitorImportMessage(
	competitors: readonly DetectedCompetitor[],
): string {
	if (competitors.length === 0) return "";
	const plugins = new Intl.ListFormat(getLocale(), {
		style: "long",
		type: "conjunction",
	}).format(competitors.map(({ name }) => name));
	return t("importBanner.message", {
		plugins,
	});
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

/** What the prompt's two buttons do. */
export interface CompetitorImportHandlers {
	/** Import: take the reader to the Import row. `fromKeyboard`: pressed with a key. */
	onImport(fromKeyboard: boolean): void;
	/** ✕: stop offering. */
	onDismiss(): void;
}

/**
 * Build the prompt into `parent`: the message naming the plugins, **Import**,
 * and ✕. The settings page shows it as a row (declarative/bannerRows.ts).
 */
export function buildCompetitorImportBanner(
	parent: HTMLElement,
	competitors: readonly DetectedCompetitor[],
	handlers: CompetitorImportHandlers,
): HTMLElement {
	const banner = parent.createDiv({
		cls: "cs-competitor-import-banner",
		attr: { role: "status" },
	});
	banner.createDiv({
		cls: "cs-competitor-import-banner-message",
		text: competitorImportMessage(competitors),
	});

	const importButton = banner.createEl("button", {
		cls: "mod-cta cs-competitor-import-banner-action",
		text: t("importBanner.action"),
	});
	// A click from Enter or Space carries no pointer detail; it shows the ring.
	importButton.addEventListener("click", (event) => { handlers.onImport(event.detail === 0); });

	const dismissButton = banner.createEl("button", {
		cls: "clickable-icon cs-competitor-import-banner-dismiss",
		attr: { "aria-label": t("importBanner.dismiss") },
	});
	setIcon(dismissButton, "x");
	dismissButton.addEventListener("click", () => handlers.onDismiss());
	return banner;
}
