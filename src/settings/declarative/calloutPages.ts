/**
 * settings/declarative/calloutPages.ts — the user's own callouts as the
 * declarative settings draw them: the My callout types page and its Scan row.
 * Also the one callout row every list of callouts uses, the built-in and
 * theme pages included.
 *
 * Who calls it. The settings tab, for the main page's first box; and
 * calloutListPage.ts, for its rows.
 *
 * The main idea.
 * - My callout types is one of Obsidian's lists: its own search field, a +
 *   that opens the editor for a new callout, a grey row while there is none,
 *   and below it a box with Scan for callouts. The rows are in the settings
 *   search, found by name or by any of the callout's ids. (The main page has
 *   no Add new callout of its own: the + of this list is how one is added.)
 * - Each row is drawn by `drawCalloutRow` (sections/CalloutRowRenderer.ts),
 *   with its ✎ and ⋮.
 * - A search that finds nothing shows one more row, hidden the rest of the
 *   time, that says so with the brush mascot (noMatchesRow.ts).
 * - While saving is paused the rows stay as they are; only ✎ is dimmed (it
 *   says why when pressed). ⋮ still opens, so Find callouts works, and the
 *   menu's own changes refuse with a reason. + and Scan say why too.
 */
import type { Setting, SettingDefinition } from "obsidian";
import { getLocale, t } from "../../i18n";
import { emptyListState } from "../../ui/mascot/mascotPlaces";
import type { CalloutDefinition } from "../../types";
import { calloutMatchesQuery } from "../../utils/calloutSearch";
import { getSortedCalloutIds, sortCalloutsByDisplayName } from "../../utils/sorting";
import { CalloutEditor } from "../CalloutEditor";
import { openCalloutEditorFor } from "../openCalloutEditor";
import { openBuiltInRowMenu, openRowMenu } from "../sections/CalloutRowActions";
import { drawCalloutRow, type RowRendererHandlers } from "../sections/CalloutRowRenderer";
import { runManualScan, scanRunning } from "../sections/manualScan";
import { partitionCallouts, type RowKind } from "../sections/rowOwnership";
import { NoMatchesRow } from "./noMatchesRow";
import { refuseWhilePaused } from "./pausedGuards";
import { countValue, pausedReason } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsAction, CsGroup, CsList, CsPage, CsRender, TreeContext } from "./types";

/** The ids of the callout pages, their boxes and rows: they key them, and name them in a page path. */
export const CALLOUT_PAGES = {
	mine: "callouts-mine",
	mineList: "callouts-mine-list",
	mineListEmpty: "callouts-mine-list-empty",
	scanBox: "callouts-scan",
	scanRow: "scan-callouts",
	noMatches: "callouts-mine-no-matches",
} as const;

/** The count at the end of a callout page's row: "12 callouts", "1 callout". */
export function calloutCount(count: number): string {
	return countValue(count, { one: "settings.calloutCountOne", many: "settings.calloutCount" });
}

/* ---- One callout row ---- */

/** What a callout row's ✎ and ⋮ do on the declarative pages. */
export function calloutRowHandlers(ctx: TreeContext): RowRendererHandlers {
	return {
		onEdit: (def) => { void editCallout(ctx, def); },
		editBlockedReason: () => pausedReason(ctx.plugin.settingsWriter),
		onOpenBuiltInMenu: (trigger, def) => { void openBuiltInRowMenu(ctx, trigger, def); },
		onOpenUserMenu: (trigger, def) => { void openRowMenu(ctx, trigger, def); },
	};
}

/**
 * Open the editor for `def` (it saves the callout itself), then draw the
 * settings again.
 */
async function editCallout(ctx: TreeContext, def: CalloutDefinition): Promise<void> {
	await openCalloutEditorFor(ctx.plugin, def);
	ctx.redraw();
}

/** A callout row's id: its key, and the name a jump to it uses. */
export function calloutRowId(def: CalloutDefinition): string {
	return `callout-${def.id}`;
}

/**
 * One callout as a row Obsidian keys, names and finds: keyed by the callout's
 * id, named by its display name, and with every id it answers to as `aliases`,
 * so the settings search (and a list's own search) find it by any of them.
 * The row registers itself, so the settings can jump to it (a duplicate, say).
 */
export function calloutRow(
	ctx: TreeContext,
	def: CalloutDefinition,
	kind: RowKind,
	handlers: RowRendererHandlers,
): CsRender {
	const id = calloutRowId(def);
	return {
		id,
		name: def.displayName,
		aliases: getSortedCalloutIds(def, getLocale()),
		render: guardRender(def.displayName, (setting) => {
			const undoRow = drawCalloutRow(ctx, setting, def, kind, handlers);
			const unregister = ctx.rows.register(id, setting.settingEl);
			return () => {
				undoRow();
				unregister();
			};
		}),
	};
}

/**
 * Take the reader to `def`'s row in My callout types, for a callout just
 * made (a duplicate lands there, even one of a theme's callouts). The row
 * may only be drawn on the next update; the jump waits for it.
 */
export function revealCalloutRow(ctx: TreeContext, def: CalloutDefinition): void {
	ctx.jumpTo(calloutRowId(def), false, [CALLOUT_PAGES.mine]);
}

/**
 * A list's own search: a row matches when the query is in its name or in one
 * of its ids (`aliases`). It reads nothing but the row it is given, because
 * Obsidian keeps the `match` of a box's first draw and calls it with the
 * newest rows.
 */
export function rowMatchesQuery(row: SettingDefinition, query: string): boolean {
	const lowerQuery = query.trim().toLowerCase();
	return [row.name, ...(row.aliases ?? [])].some((text) => text.toLowerCase().includes(lowerQuery));
}

/**
 * My callout types' search, for every row of the list. A callout's row matches
 * as {@link rowMatchesQuery} says. The "nothing matches" row is the odd one
 * out: it matches exactly when something is searched for and no callout
 * does, which shows it and only then.
 *
 * Unlike {@link rowMatchesQuery} this reads the live callouts, because the
 * "nothing matches" row has no words of its own to compare with. (`ctx` is the
 * same for the life of the settings, so the stale `match` Obsidian keeps from
 * the first draw still sees the callouts as they are now.)
 */
function matchesSearch(ctx: TreeContext, row: SettingDefinition, query: string): boolean {
	if (!isNoMatchesRow(row)) return rowMatchesQuery(row, query);
	const lowerQuery = query.trim().toLowerCase();
	if (lowerQuery === "") return false;
	return !partitionCallouts(ctx).own.some((def) => calloutMatchesQuery(def, lowerQuery));
}

/**
 * Whether `row` is the "nothing matches" row. (Obsidian's typings leave out
 * the `id` the plugin gives its rows, types.ts; the `in` check is what lets
 * TypeScript read it safely.)
 */
function isNoMatchesRow(row: SettingDefinition): boolean {
	return "id" in row && row.id === CALLOUT_PAGES.noMatches;
}

/* ---- My callout types ---- */

/** The row that opens My callout types, with how many there are at its end. */
export function myCalloutsPage(ctx: TreeContext): CsPage {
	const own = sortCalloutsByDisplayName(partitionCallouts(ctx).own, getLocale());
	return {
		type: "page",
		id: CALLOUT_PAGES.mine,
		name: t("settings.myCalloutTypes"),
		displayValue: calloutCount(own.length),
		items: [myCalloutsList(ctx, own), scanBox(ctx)],
	};
}

/**
 * The user's own callouts, A→Z, with a search field, a + and an empty row.
 *
 * Obsidian makes a list's search field once, when it first draws the box, and
 * only if the box has rows then; a later draw that finds the box under the same
 * key updates it in place and never adds one. So the list has a key of its own
 * (`id`) while it is empty: the first callout (a scan finding it, say) or the
 * last one going makes a new box, with the search field or without it.
 */
function myCalloutsList(ctx: TreeContext, own: readonly CalloutDefinition[]): CsList {
	const handlers = calloutRowHandlers(ctx);
	return {
		type: "list",
		id: own.length > 0 ? CALLOUT_PAGES.mineList : CALLOUT_PAGES.mineListEmpty,
		search: { placeholder: t("settings.searchCallouts"), match: (row, query) => matchesSearch(ctx, row, query) },
		// The grey row while there is none, with the brush mascot over it (ui/mascot/mascotPlaces.ts).
		emptyState: emptyListState(t("settings.noCalloutsNow"), t("settings.addNewCallout")),
		addItem: { name: t("settings.addNewCallout"), action: addNewCallout(ctx) },
		items: [
			...own.map((def) => calloutRow(ctx, def, "user", handlers)),
			// Only while there is something to search: an empty list shows its grey row instead.
			...(own.length > 0 ? [noMatchesRow()] : []),
		],
	};
}

/**
 * The last row of the list: what the list says while a search finds nothing.
 * It has no name, so nothing in the settings search can find it, and it is
 * hidden (`visible: false`) until the list's search shows it (`matchesSearch`).
 */
function noMatchesRow(): CsRender {
	return {
		id: CALLOUT_PAGES.noMatches,
		name: "",
		visible: false,
		render: guardRender("no matches", drawNoMatchesRow),
	};
}

/**
 * Draw the "nothing matches" row: its words and mascot follow what the list's
 * search field says. Obsidian shows or hides the row when the query changes,
 * and its handler runs before ours, so the row is shown exactly when nothing
 * matches by the time we look at it.
 *
 * @returns What takes the row down again (a redraw runs it before drawing anew).
 */
function drawNoMatchesRow(setting: Setting): () => void {
	const row = new NoMatchesRow(setting);
	const field = setting.settingEl.closest(".setting-group")
		?.querySelector<HTMLInputElement>(".setting-group-search input") ?? null;
	const onInput = (): void => {
		if (setting.settingEl.style.display === "none") {
			row.hide();
			return;
		}
		row.show(field?.value.trim() ?? "");
		row.typed();
	};
	field?.addEventListener("input", onInput);
	return () => {
		field?.removeEventListener("input", onInput);
		row.dispose();
	};
}

/** The box under the list: Scan for callouts. */
function scanBox(ctx: TreeContext): CsGroup {
	return { type: "group", id: CALLOUT_PAGES.scanBox, items: [scanRow(ctx)] };
}

/** Scan for callouts, as a row the whole of which is the button. "Scanning…" while it runs. */
function scanRow(ctx: TreeContext): CsAction {
	return {
		id: CALLOUT_PAGES.scanRow,
		name: t(scanRunning(ctx.plugin) ? "manualDiscovery.scanning" : "settings.rescanVaultHintAction"),
		desc: t("settings.rescanVaultDesc"),
		action: refuseWhilePaused(ctx.plugin.settingsWriter, () => { void scanAndRedraw(ctx); }),
	};
}

/**
 * Scan, drawing the settings again when the scan starts (the row then says
 * "Scanning…") and when it ends. `runManualScan` marks the scan as running
 * before it first waits, so the first redraw already sees it.
 */
async function scanAndRedraw(ctx: TreeContext): Promise<void> {
	const scan = runManualScan(ctx.plugin);
	ctx.redraw();
	await scan;
	ctx.redraw();
}

/* ---- The list's + ---- */

/** Open the editor for a new callout, then draw again; refused while saving is paused. */
function addNewCallout(ctx: TreeContext): () => void {
	return refuseWhilePaused(ctx.plugin.settingsWriter, () => { void createCallout(ctx); });
}

async function createCallout(ctx: TreeContext): Promise<void> {
	await new CalloutEditor(ctx.plugin).openAndWait();
	ctx.redraw();
}
