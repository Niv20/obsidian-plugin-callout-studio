/**
 * settings/declarative/jumpToRow.ts — taking the reader to a row of the
 * settings: its page opened, the row scrolled to the middle and flashed, the
 * way Obsidian shows a settings search result.
 *
 * Who calls it. The settings tab, as the tree's `jumpTo` (types.ts): the
 * import offer's Import, the saving notice's Go to version history, and a
 * callout just duplicated.
 *
 * The main idea.
 * - The page is opened by Obsidian's own navigation,
 *   `app.setting.openPagePath(tabId, pagePath)`. It is not in Obsidian's
 *   typings, so it is checked for: without it (Obsidian 1.13.x; it arrived in
 *   1.14) the reader stays on the page that is open, and the row is shown if
 *   it is there.
 * - The row's element comes from the row registry (rowRegistry.ts): a row the
 *   plugin jumps to registers its element while it is drawn. The row may not
 *   be drawn yet (a page that slides in, a callout that was only just made),
 *   so the jump looks at once, as Obsidian does, and then on the next few
 *   frames.
 * - The flash is Obsidian's: the row wears `is-flashing` for 750 ms, which
 *   app.css highlights. After a press from the keyboard the focus moves to the
 *   row too, as Obsidian does when a keyboard is in use.
 */
import type { App } from "obsidian";
import type { RowRegistry } from "./rowRegistry";
import type { Scheduler } from "./treeUpdater";

/** What a jump needs from the settings tab. */
export interface JumpHost {
	app: App;
	/** The settings tab's id, which is the plugin's id. */
	tabId: string;
	rows: RowRegistry;
	/** How to wait for the next try (a frame); tests pass their own. */
	schedule: Scheduler;
}

/** How many more frames a jump waits for its row to be drawn: about half a second. */
const MAX_WAITS = 30;

/** How long a row flashes, as long as Obsidian's own flash. */
const FLASH_MS = 750;

/**
 * Open the page at `pagePath` (page ids from the tab; empty for the tab's own
 * page), then scroll row `rowId` to the middle and flash it.
 *
 * @param fromKeyboard The jump was asked for with a key, so the focus follows it.
 */
export function jumpToRow(host: JumpHost, rowId: string, pagePath: readonly string[], fromKeyboard: boolean): void {
	openSettingsPage(host.app, host.tabId, pagePath);
	revealWhenDrawn(host, rowId, fromKeyboard, MAX_WAITS);
}

/**
 * Whether this Obsidian can open a page of the settings from code
 * (`openPagePath`, which arrived in 1.14). Where it cannot, a button that only
 * takes the reader to a page has nothing to do, and is better not shown.
 */
export function canOpenSettingsPage(app: App): boolean {
	return typeof (app.setting as App["setting"] | undefined)?.openPagePath === "function";
}

/** Open the tab on the page at `pagePath`, if this Obsidian can. */
function openSettingsPage(app: App, tabId: string, pagePath: readonly string[]): void {
	const setting = app.setting as App["setting"] | undefined;
	if (typeof setting?.openPagePath !== "function") return;
	try {
		setting.openPagePath(tabId, [...pagePath]);
	} catch (error) {
		console.warn("Callout Studio: could not open the settings page.", error);
	}
}

/** Show the row as soon as it is on the page, looking again for `waitsLeft` frames. */
function revealWhenDrawn(host: JumpHost, rowId: string, fromKeyboard: boolean, waitsLeft: number): void {
	const rowEl = host.rows.get(rowId);
	if (rowEl) {
		revealRow(rowEl, fromKeyboard);
		return;
	}
	if (waitsLeft === 0) return;
	host.schedule(() => revealWhenDrawn(host, rowId, fromKeyboard, waitsLeft - 1));
}

/** Scroll `rowEl` to the middle of its page and flash it; move the focus to it after a key press. */
function revealRow(rowEl: HTMLElement, fromKeyboard: boolean): void {
	rowEl.scrollIntoView({ block: "center" });
	// A settings row can take the focus (Obsidian gives it `tabindex="-1"`).
	if (fromKeyboard) rowEl.focus();
	rowEl.addClass("is-flashing");
	// The row's own window: the settings can be a window of their own (1.14).
	const view = rowEl.ownerDocument.defaultView ?? window;
	view.setTimeout(() => rowEl.removeClass("is-flashing"), FLASH_MS);
}
