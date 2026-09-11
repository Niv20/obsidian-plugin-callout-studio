/** First-install migration prompt shown beneath the settings title. */
import { setIcon, type App } from "obsidian";
import { getLocale, t } from "../i18n";
import type { SettingsSectionContext } from "./sections/types";
import {
	isCompetitorImportBannerForced,
	markCompetitorImportBannerHandled,
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

type TargetHighlighter = { run: () => void; dispose: () => void };

function createTargetHighlighter(target: HTMLElement): TargetHighlighter {
	let observer: IntersectionObserver | null = null;
	let fallbackTimer: number | null = null;
	let classTimer: number | null = null;

	const stopWaiting = (): void => {
		observer?.disconnect();
		observer = null;
		if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
		fallbackTimer = null;
	};

	const highlight = (): void => {
		stopWaiting();
		target.classList.remove("cs-import-target-highlight");
		// Animate back to the row's real resting paint rather than to
		// `transparent`. Some themes give setting rows an opaque grey background;
		// ending on transparency and then removing the class made that grey appear
		// as a separate, abrupt final step.
		const restingStyle = window.getComputedStyle(target);
		target.style.setProperty(
			"--cs-import-target-rest-bg",
			restingStyle.backgroundColor,
		);
		target.style.setProperty(
			"--cs-import-target-rest-shadow",
			restingStyle.boxShadow,
		);
		// Restart the animation when the action is clicked more than once.
		void target.offsetWidth;
		target.classList.add("cs-import-target-highlight");
		if (classTimer !== null) window.clearTimeout(classTimer);
		classTimer = window.setTimeout(() => {
			target.classList.remove("cs-import-target-highlight");
			classTimer = null;
		}, 1600);
	};

	return {
		run: () => {
			stopWaiting();
			if (typeof IntersectionObserver !== "undefined") {
				observer = new IntersectionObserver((entries) => {
					if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.8)) {
						highlight();
					}
				}, { threshold: [0.8] });
				observer.observe(target);
			}
			// Older Obsidian/Electron builds get a conservative fallback after the
			// smooth scroll has had time to settle.
			fallbackTimer = window.setTimeout(highlight, 1000);
			target.scrollIntoView({ behavior: "smooth", block: "center" });
		},
		dispose: () => {
			stopWaiting();
			if (classTimer !== null) window.clearTimeout(classTimer);
			classTimer = null;
			target.classList.remove("cs-import-target-highlight");
		},
	};
}

export function renderCompetitorImportBanner(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
	importTargetEl: HTMLElement,
): void {
	if (!shouldShowCompetitorImportBanner(ctx.plugin)) return;
	let competitors = detectEnabledCompetitors(ctx.app);
	if (competitors.length === 0 && isCompetitorImportBannerForced(ctx.plugin)) {
		competitors = COMPETITORS.map(({ id, name }) => ({ id, name }));
	}
	if (competitors.length === 0) return;

	const highlighter = createTargetHighlighter(importTargetEl);
	ctx.registerDisposer(highlighter.dispose);

	const banner = containerEl.createDiv({
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
	importButton.addEventListener("click", highlighter.run);

	const dismissButton = banner.createEl("button", {
		cls: "clickable-icon cs-competitor-import-banner-dismiss",
		attr: { "aria-label": t("importBanner.dismiss") },
	});
	setIcon(dismissButton, "x");
	dismissButton.addEventListener("click", () => {
		banner.remove();
		void markCompetitorImportBannerHandled(ctx.plugin);
	});
}
