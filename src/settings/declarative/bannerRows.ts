/**
 * settings/declarative/bannerRows.ts — the notices at the top of the settings
 * page: "Saving is paused" (or "Saving failed"), the offer to import from
 * another callout plugin, and the offer to set up the website export.
 *
 * Who calls it. The settings tab, when it builds its tree; the box this
 * returns comes first on the main page.
 *
 * The main idea.
 * - Each notice is a render row of one box without a heading, and the box
 *   hides itself while no notice shows (a box whose rows are all hidden is
 *   hidden by Obsidian).
 * - **One offer at a time.** The website offer waits while saving needs
 *   attention (a problem comes before an invitation) and while the import
 *   offer is up (callouts are brought in before they are published); see
 *   {@link webOfferShows}. And one offer names every service the vault points
 *   at, in one sentence, rather than a notice for each.
 * - They keep the plugin's own markup and look (`.cs-readonly-banner`,
 *   `.cs-competitor-import-banner`), not a real Obsidian callout: the plugin
 *   styles every `.callout[data-callout]` on screen, so a callout box would
 *   wear the user's own [!warning] look (native-look plan, review M4).
 * - "Saving is paused" is a part that survives redraws (persistentParts.ts):
 *   while one of its actions runs, its buttons stay disabled, and a redraw in
 *   the middle must not enable them again and let a second restore start.
 * - A button that leads to a row (Import, Show me, Go to version history)
 *   jumps there with `ctx.jumpTo`. Neither offer opens anything itself: the
 *   row it scrolls to and flashes is where that thing lives, and the next
 *   time the reader will know where to look.
 */
import { t } from "../../i18n";
import { markWebOfferHandled, webServicesToOffer } from "../../manager/web/webOffer";
import { recoveryActionsOf, renderSaveStatusBanner } from "../saveStatusBanner";
import { competitorImportMessage, competitorsToOffer } from "../competitorImportBanner";
import { markCompetitorImportBannerHandled } from "../competitorImportState";
import { buildOfferBanner, nameList } from "../offerBanner";
import { canOpenSettingsPage } from "./jumpToRow";
import { MAIN_PAGE_ROWS } from "./mainPageGroups";
import type { PersistentPart } from "./persistentParts";
import { guardRender } from "./safeTree";
import type { CsGroup, CsRender, TreeContext } from "./types";
import { serviceName } from "../../webPanel/webPanelCopy";

/** The name the saving notice is kept under in the parts store. */
const SAVING_NOTICE = "saving-notice";

/** The box of notices: the saving notice first, then the offers. */
export function bannersGroup(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: "banners",
		cls: "cs-banners",
		items: [savingNoticeRow(ctx), importOfferRow(ctx), webOfferRow(ctx)],
	};
}

/**
 * Whether saving needs the user's attention: paused, or a save that failed.
 * (`?.`: a minimal host's writer has no status to report.)
 */
export function savingNeedsAttention(writer: TreeContext["plugin"]["settingsWriter"]): boolean {
	return writer.isFrozen || Boolean(writer.status?.reason);
}

/** "Saving is paused": the notice, its explanation and its way back. */
function savingNoticeRow(ctx: TreeContext): CsRender {
	return {
		id: "saving-notice",
		// No name: the notice has its own title, and a notice is not a search result.
		name: "",
		searchable: false,
		visible: () => savingNeedsAttention(ctx.plugin.settingsWriter),
		render: guardRender("saving notice", (setting) => {
			setting.setClass("cs-banner-row");
			ctx.parts.mount(SAVING_NOTICE, setting.settingEl, () => buildSavingNotice(ctx));
			return () => ctx.parts.releaseLater(SAVING_NOTICE);
		}),
	};
}

/**
 * Build the notice once (renderSaveStatusBanner redraws itself whenever the
 * saving status changes), with Go to version history opening its page. Where
 * Obsidian cannot open a page from code (1.13.x) the button is left out: the
 * page is one row away on this very page.
 */
function buildSavingNotice(ctx: TreeContext): PersistentPart {
	const el = createDiv();
	const hasHistory = ctx.plugin.recovery !== undefined;
	const dispose = renderSaveStatusBanner(ctx.plugin, el, {
		...recoveryActionsOf(ctx.plugin),
		showBackup:
			hasHistory && canOpenSettingsPage(ctx.app)
				? (fromKeyboard) =>
						ctx.jumpTo(MAIN_PAGE_ROWS.earlierVersions, fromKeyboard, [MAIN_PAGE_ROWS.earlierVersions])
				: undefined,
	});
	return { el, dispose };
}

/** The offer to import from Callout Manager or Admonition, when one is in use. */
function importOfferRow(ctx: TreeContext): CsRender {
	return {
		id: "import-offer",
		name: "",
		searchable: false,
		visible: () => competitorsToOffer(ctx.app, ctx.plugin).length > 0,
		render: guardRender("import offer", (setting) => {
			setting.setClass("cs-banner-row");
			const competitors = competitorsToOffer(ctx.app, ctx.plugin);
			if (competitors.length === 0) return;
			const message = competitorImportMessage(competitors);
			const offer = buildOfferBanner(setting.settingEl, message, t("importBanner.action"), {
				onAction: (fromKeyboard) => ctx.jumpTo(MAIN_PAGE_ROWS.importCallouts, fromKeyboard),
				onDismiss: () => {
					// Stops offering at once (the saving happens in the background),
					// so the redraw that follows hides the row.
					void markCompetitorImportBannerHandled(ctx.plugin);
					ctx.redraw();
				},
			});
			// The offer sits outside the row's controls, which a redraw empties,
			// so the row's cleanup takes it away before the next draw.
			return () => offer.remove();
		}),
	};
}

/**
 * Whether the website offer shows now: there is a service to name, and no
 * other notice is asking for something (see the module header).
 */
export function webOfferShows(ctx: TreeContext): boolean {
	return (
		!savingNeedsAttention(ctx.plugin.settingsWriter) &&
		competitorsToOffer(ctx.app, ctx.plugin).length === 0 &&
		webServicesToOffer(ctx.plugin).length > 0
	);
}

/**
 * The offer to set up the website export, when the vault looks published
 * (manager/web/webOffer.ts). **Show me** scrolls to the Publish to the web row
 * and flashes it, as the import offer does with its row; opening the panel
 * from that row is what ends the offer. ✕ ends it too, for every service it
 * names.
 */
function webOfferRow(ctx: TreeContext): CsRender {
	return {
		id: "web-offer",
		name: "",
		searchable: false,
		visible: () => webOfferShows(ctx),
		render: guardRender("website offer", (setting) => {
			setting.setClass("cs-banner-row");
			if (!webOfferShows(ctx)) return;
			const services = webServicesToOffer(ctx.plugin);
			const message = t("webOffer.message", { services: nameList(services.map(serviceName)) });
			const offer = buildOfferBanner(setting.settingEl, message, t("webOffer.action"), {
				onAction: (fromKeyboard) => ctx.jumpTo(MAIN_PAGE_ROWS.website, fromKeyboard),
				onDismiss: () => {
					markWebOfferHandled(ctx.plugin, services);
					ctx.redraw();
				},
			});
			return () => offer.remove();
		}),
	};
}
