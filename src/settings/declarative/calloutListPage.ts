/**
 * settings/declarative/calloutListPage.ts — the Built-in callouts and Callouts
 * from your theme pages, which the plugin draws itself.
 *
 * Who calls it. The settings tab, for the two rows that open these pages
 * ({@link builtInCalloutsPage}, {@link themeCalloutsPage}).
 *
 * The main idea. Both pages are *lazy*: their row gives Obsidian a factory
 * (`page: () => new CalloutListPage(…)`) instead of a list of rows, and
 * Obsidian lets the page draw itself and leaves its rows out of the settings
 * search. That is the point (finding GAP-15): a search for "note" or "info"
 * should find Obsidian's own settings, not thirteen built-in callouts. Marking
 * the rows `searchable: false` would not do, because that also takes them out
 * of the page's own search field.
 *
 * The page is drawn the way Obsidian draws its own list pages: a description
 * (`p.setting-page-desc`, the theme page only), then one of Obsidian's boxes
 * holding the same callout rows as My callout types (calloutPages.ts), with a
 * search field of its own above them.
 * Obsidian never draws such a page again, so while it is open the page listens
 * for what changes its rows (the same signals as the settings tab) and draws
 * them again itself, through its own `TreeUpdater`, which also waits while a
 * menu is open. Only the rows are drawn again: the search field keeps its text
 * and its focus. Leaving the page stops it all.
 */
import { Setting, SettingGroup, SettingPage, type App } from "obsidian";
import { getLocale, t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import { calloutMatchesQuery } from "../../utils/calloutSearch";
import { sortCalloutsByDisplayName } from "../../utils/sorting";
import { isRowMenuActive } from "../sections/calloutRowMenu";
import { calloutListsSignature, freshPaging } from "../sections/calloutListsSignature";
import { drawCalloutRow } from "../sections/CalloutRowRenderer";
import { activeThemeLabel, partitionCallouts } from "../sections/rowOwnership";
import { subscribeSettingsTab } from "../sections/tabSubscriptions";
import { calloutCount, calloutRowHandlers } from "./calloutPages";
import { interactionInProgress, nextFrameOrSoon, TreeUpdater, type Scheduler } from "./treeUpdater";
import type { CsPage, TreeContext } from "./types";

/** The ids of the two pages: they key them, and name them in a page path. */
export const CALLOUT_LIST_PAGES = { builtIn: "callouts-builtin", theme: "callouts-theme" } as const;

/** Which of the two lists a page shows. */
export type LazyListKind = "builtin" | "theme";

/** The row that opens Built-in callouts, with how many there are at its end. */
export function builtInCalloutsPage(ctx: TreeContext): CsPage {
	return {
		type: "page",
		id: CALLOUT_LIST_PAGES.builtIn,
		name: t("settings.builtInCallouts"),
		displayValue: calloutCount(calloutsOf(ctx, "builtin").length),
		page: () => new CalloutListPage(ctx, "builtin"),
	};
}

/**
 * The row that opens Callouts from your theme. Shown only while the theme
 * styles a callout; the switch below it on the main page (generalRows.ts)
 * stays for the case where the switch itself took them away.
 */
export function themeCalloutsPage(ctx: TreeContext): CsPage {
	return {
		type: "page",
		id: CALLOUT_LIST_PAGES.theme,
		name: t("settings.themeCalloutsHeading"),
		displayValue: calloutCount(calloutsOf(ctx, "theme").length),
		visible: () => calloutsOf(ctx, "theme").length > 0,
		page: () => new CalloutListPage(ctx, "theme"),
	};
}

/** The callouts of `kind`'s list now, A→Z. */
function calloutsOf(ctx: TreeContext, kind: LazyListKind): CalloutDefinition[] {
	const { fromTheme, builtIn } = partitionCallouts(ctx);
	return sortCalloutsByDisplayName(kind === "theme" ? fromTheme : builtIn, getLocale());
}

/** One row on the page, with the callout it shows (for the search field). */
interface DrawnRow {
	def: CalloutDefinition;
	setting: Setting;
}

/** A page of callouts the plugin draws itself: Built-in callouts, or the theme's. */
export class CalloutListPage extends SettingPage {
	/** The box of rows; null until the page is displayed. */
	private list: SettingGroup | null = null;
	/** The theme page's description (it names the theme, which can change); null on Built-in. */
	private intro: HTMLElement | null = null;
	/** The rows on screen. */
	private rows: DrawnRow[] = [];
	/** What undoes each row's drawing (the icon and the right-click listener). */
	private rowCleanups: (() => void)[] = [];
	/** What the search field holds. */
	private query = "";
	/** Stops listening for changes; null while the page is not open. */
	private stopListening: (() => void) | null = null;
	private readonly updater: TreeUpdater;

	/**
	 * @param schedule How to wait before drawing again; tests pass one that
	 *   runs when they say so. By default the next frame of the page's window.
	 */
	constructor(
		private readonly ctx: TreeContext,
		private readonly kind: LazyListKind,
		schedule?: Scheduler,
	) {
		super();
		this.updater = new TreeUpdater({
			signature: () => this.signature(),
			update: () => this.drawRows(),
			isBusy: () => interactionInProgress(this.containerEl.ownerDocument) || isRowMenuActive(this.ctx.app),
			schedule: schedule ?? nextFrameOrSoon(() => this.containerEl),
		});
	}

	/** Obsidian opened the page: draw it, and start listening for changes. */
	display(): void {
		// A page opened a second time starts clean.
		this.hide();
		this.containerEl.empty();
		this.query = "";
		if (this.kind === "theme") this.intro = this.containerEl.createEl("p", { cls: "setting-page-desc" });
		this.list = new SettingGroup(this.containerEl).addClass("mod-list");
		// As Obsidian does for a box: a search field only if there are rows to search.
		if (calloutsOf(this.ctx, this.kind).length > 0) {
			this.list.addSearch((search) => {
				search.setPlaceholder(t("settings.searchCallouts")).onChange((query) => {
					this.query = query;
					this.applySearch();
				});
			});
		}
		this.drawRows();
		this.updater.markDrawn();
		this.stopListening = subscribeSettingsTab(this.ctx.app, this.ctx.plugin, (force) => this.updater.request(force));
	}

	/** Obsidian left the page: stop listening, and undo the rows. */
	hide(): void {
		this.stopListening?.();
		this.stopListening = null;
		this.updater.dispose();
		this.clearRows();
	}

	/** Draw the rows again from the callouts now; the search field stays as it is. */
	private drawRows(): void {
		const list = this.list;
		if (!list) return;
		this.clearRows();
		list.listEl.empty();
		const defs = calloutsOf(this.ctx, this.kind);
		this.updateIntro(defs.length > 0);
		// Each row is a `Setting` made in the box, which is what the box's own
		// `addSetting` does.
		if (defs.length === 0) {
			new Setting(list.listEl).setName(emptyText(this.ctx.app, this.kind)).setClass("mod-empty-state");
			return;
		}
		const handlers = calloutRowHandlers(this.ctx);
		for (const def of defs) {
			const setting = new Setting(list.listEl);
			this.rowCleanups.push(drawCalloutRow(this.ctx, setting, def, this.kind, handlers));
			this.rows.push({ def, setting });
		}
		this.applySearch();
	}

	/** The description names the active theme, and goes when there are no rows to describe. */
	private updateIntro(hasRows: boolean): void {
		if (!this.intro) return;
		this.intro.setText(t("settings.themeCalloutsDesc", { theme: activeThemeLabel(this.ctx.app) }));
		this.intro.toggle(hasRows);
	}

	/** Show only the rows whose name or one of whose ids holds the query. */
	private applySearch(): void {
		const lowerQuery = this.query.trim().toLowerCase();
		for (const row of this.rows) {
			row.setting.settingEl.toggle(calloutMatchesQuery(row.def, lowerQuery));
		}
	}

	private clearRows(): void {
		for (const undo of this.rowCleanups) undo();
		this.rowCleanups = [];
		this.rows = [];
	}

	/**
	 * Everything the rows show, as one string, so a change that would draw
	 * the same rows is skipped (the settings tab's own signature, which reads
	 * all three lists: more than this page needs, never less).
	 */
	private signature(): string {
		const { fromTheme, own, builtIn } = partitionCallouts(this.ctx);
		return calloutListsSignature(this.ctx, freshPaging(), activeThemeLabel(this.ctx.app), getLocale(), {
			theme: fromTheme,
			user: own,
			builtin: builtIn,
		});
	}
}

/** What the page says while it has no rows. */
function emptyText(app: App, kind: LazyListKind): string {
	const theme = activeThemeLabel(app);
	return kind === "builtin"
		? t("settings.builtInAllThemeStyled", { theme })
		: t("settings.themeCalloutsEmpty", { theme });
}
