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
 * The page is drawn the way Obsidian draws its own list pages: one of
 * Obsidian's boxes holding the same callout rows as My callout types (calloutPages.ts), with a
 * search field of its own above them. A search that finds nothing says so,
 * with the brush mascot (noMatchesRow.ts).
 *
 * The theme's page starts with the switch that turns the theme's callout
 * styles off (themeStylesSwitch.ts). While it is off the theme names no callout
 * the plugin can see, so the page is the switch alone (no box, no empty-state
 * line), and the row that opens it says "Off" where the count would be.
 *
 * Obsidian never draws such a page again, so while it is open the page listens
 * for what changes its rows (the same signals as the settings tab) and draws
 * them again itself, through its own `TreeUpdater`, which also waits while a
 * menu is open. Only the rows are drawn again: the search field keeps its text
 * and its focus. Leaving the page stops it all.
 */
import { Setting, SettingGroup, SettingPage } from "obsidian";
import { getLocale, t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import { calloutMatchesQuery } from "../../utils/calloutSearch";
import { sortCalloutsByDisplayName } from "../../utils/sorting";
import { isRowMenuActive } from "../sections/calloutRowMenu";
import { calloutListsSignature } from "../sections/calloutListsSignature";
import { drawCalloutRow } from "../sections/CalloutRowRenderer";
import { activeThemeLabel, partitionCallouts, themeStylesSwitchedOff } from "../sections/rowOwnership";
import { subscribeSettingsTab } from "../sections/tabSubscriptions";
import { calloutCount, calloutRowHandlers } from "./calloutPages";
import { NoMatchesRow } from "./noMatchesRow";
import { ThemeStylesSwitch } from "./themeStylesSwitch";
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
 * The row that opens Callouts from your theme. Shown while the theme styles a
 * callout, and while the switch on the page itself is off: that switch took
 * the callouts away, and the page must stay reachable to bring them back. Its
 * value is the count, or "Off" while the switch is off.
 *
 * (`displayValue` and `visible` are asked again at every draw of the main
 * page, so they follow the switch after it is flipped.)
 */
export function themeCalloutsPage(ctx: TreeContext): CsPage {
	return {
		type: "page",
		id: CALLOUT_LIST_PAGES.theme,
		name: t("settings.themeCalloutsHeading"),
		// The same word the version comparison uses for a setting that is off.
		displayValue: () => (themeStylesSwitchedOff(ctx)
			? t("recovery.details.value.off")
			: calloutCount(calloutsOf(ctx, "theme").length)),
		visible: () => calloutsOf(ctx, "theme").length > 0 || themeStylesSwitchedOff(ctx),
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
	/** The search field above the rows (in the box only while there are rows to search); null until displayed. */
	private searchEl: HTMLElement | null = null;
	/** The theme page's switch; null on Built-in. */
	private readonly stylesSwitch: ThemeStylesSwitch | null;
	/** The rows on screen. */
	private rows: DrawnRow[] = [];
	/** The row that says "nothing matches" (hidden until a search finds nothing). */
	private noMatches: NoMatchesRow | null = null;
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
		this.stylesSwitch = kind === "theme" ? new ThemeStylesSwitch(ctx) : null;
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
		// The theme's page opens with its switch, then its list.
		this.stylesSwitch?.draw(this.containerEl);
		this.list = new SettingGroup(this.containerEl).addClass("mod-list");
		this.list.addSearch((search) => {
			// The field and the box around it, which are hidden together.
			this.searchEl = search.inputEl.closest<HTMLElement>(".setting-group-search") ?? search.inputEl.parentElement;
			search.setPlaceholder(t("settings.searchCallouts")).onChange((query) => {
				this.query = query;
				this.applySearch();
				// After the list is filtered, so the mascot is already where it belongs.
				this.noMatches?.typed();
			});
		});
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
		this.stylesSwitch?.dispose();
	}

	/** Draw the rows again from the callouts now; the search field stays as it is. */
	private drawRows(): void {
		const list = this.list;
		if (!list) return;
		this.clearRows();
		list.listEl.empty();
		this.stylesSwitch?.sync();
		const defs = calloutsOf(this.ctx, this.kind);
		this.showSearch(defs.length > 0);
		// While the switch is off the page is the switch alone: no box, no line about it.
		const switchedOff = this.kind === "theme" && themeStylesSwitchedOff(this.ctx);
		list.listEl.toggle(!switchedOff);
		if (switchedOff) return;
		// Each row is a `Setting` made in the box, which is what the box's own
		// `addSetting` does.
		if (defs.length === 0) {
			new Setting(list.listEl).setName(emptyText(this.ctx, this.kind)).setClass("mod-empty-state");
			return;
		}
		const handlers = calloutRowHandlers(this.ctx);
		for (const def of defs) {
			const setting = new Setting(list.listEl);
			this.rowCleanups.push(drawCalloutRow(this.ctx, setting, def, this.kind, handlers));
			this.rows.push({ def, setting });
		}
		// Last in the box, hidden until a search finds nothing.
		this.noMatches = new NoMatchesRow(new Setting(list.listEl));
		this.noMatches.el.hide();
		this.applySearch();
	}

	/**
	 * As Obsidian does for a box, the search field is in the box only while
	 * there are rows to search. The same field (with its listeners and its
	 * text) is taken out and put back, never just hidden: Obsidian squares
	 * the top corners of the rows' box under a search field that is in the
	 * page, hidden or not (`.setting-group-search:not(:empty) + .setting-items`).
	 */
	private showSearch(show: boolean): void {
		const search = this.searchEl;
		const rowsBox = this.list?.listEl;
		const box = rowsBox?.parentElement;
		if (!search || !rowsBox || !box) return;
		if (!show) search.remove();
		else if (!search.isConnected) box.insertBefore(search, rowsBox);
	}

	/**
	 * Show only the rows whose name or one of whose ids holds the query, and,
	 * when there are none, the row that says so.
	 */
	private applySearch(): void {
		const lowerQuery = this.query.trim().toLowerCase();
		let matching = 0;
		for (const row of this.rows) {
			const matches = calloutMatchesQuery(row.def, lowerQuery);
			row.setting.settingEl.toggle(matches);
			if (matches) matching++;
		}
		const none = lowerQuery !== "" && matching === 0;
		const noMatches = this.noMatches;
		if (!noMatches) return;
		noMatches.el.toggle(none);
		if (none) noMatches.show(this.query.trim());
		else noMatches.hide();
	}

	private clearRows(): void {
		for (const undo of this.rowCleanups) undo();
		this.rowCleanups = [];
		this.rows = [];
		this.noMatches?.dispose();
		this.noMatches = null;
	}

	/**
	 * Everything the rows show, as one string, so a change that would draw
	 * the same rows is skipped (the settings tab's own signature, which reads
	 * all three lists: more than this page needs, never less). The theme page
	 * also shows its switch, which follows the setting and the paused state.
	 */
	private signature(): string {
		const { fromTheme, own, builtIn } = partitionCallouts(this.ctx);
		return JSON.stringify([
			calloutListsSignature(this.ctx, activeThemeLabel(this.ctx.app), getLocale(), {
				theme: fromTheme,
				user: own,
				builtin: builtIn,
			}),
			this.ctx.plugin.settings.themeCalloutStyles.enabled,
			this.ctx.plugin.settingsWriter.isFrozen,
		]);
	}
}

/** What the page says while it has no rows. */
function emptyText(ctx: TreeContext, kind: LazyListKind): string {
	const theme = activeThemeLabel(ctx.app);
	if (kind === "builtin") return t("settings.builtInAllThemeStyled", { theme });
	return t("settings.themeCalloutsEmpty", { theme });
}
