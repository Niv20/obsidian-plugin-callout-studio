/**
 * ui/sidebarResults.ts — one note's results in the Find callouts and Review
 * conversion sidebars, drawn the way Obsidian's Search pane draws a file.
 *
 *   Projects/Launch plan                          2   ← the file's title row
 *   ┌──────────────────────────────────────────────┐
 *   │ Line 1 · Heading                             │  ← one box, a row per
 *   │ # [!project] Launch plan                     │    result, thin lines
 *   ├──────────────────────────────────────────────┤    between them
 *   │ Line 3 · Block                               │
 *   │ > [!project] Scope                           │
 *   └──────────────────────────────────────────────┘
 *
 * Who calls it. usage/occurrenceResults.ts (Find callouts) and
 * portable/portableConversionRows.ts (Review conversion).
 *
 * The main idea (findings S10-03 and S10-04). Obsidian's classes do the
 * drawing: the group is `.tree-item.search-result`, its title row a
 * `.tree-item-self.search-result-file-title` with the count in a faint
 * `.tree-item-flair` at its end, and the results sit in one
 * `.search-result-file-matches` box, with a line between rows. Each caller
 * fills the box with its own rows. Until 2026-10-24 each result was a card of
 * its own, the cards stood in a two-column grid in a wide pane, and the file
 * heading was a grey band that stuck to the top of the list.
 */
import { t } from "../i18n";
import { scrollToReveal } from "./scrollToReveal";

/** Air kept between a revealed row and the edge of the list. */
const ROW_REVEAL_GAP_PX = 8;

/** What `createSidebarFileGroup` hands back: the group, its title row and its box. */
export interface SidebarFileGroup {
	/** The whole group, `section.tree-item.search-result`; its `data-path` is the note's path. */
	section: HTMLElement;
	/** The title row, a button that opens the note (`data-action="file"`). */
	title: HTMLButtonElement;
	/** The box the caller adds its result rows to. */
	matches: HTMLElement;
}

/**
 * Draw one note's group: its title row, then the empty box for its results.
 *
 * @param host Where the group goes.
 * @param options The note's `path`, how many results it has (`count`), and an
 *   extra class for the group (`cls`).
 */
export function createSidebarFileGroup(host: HTMLElement, options: {
	path: string;
	count: number;
	cls?: string;
}): SidebarFileGroup {
	const section = host.createEl("section", { cls: "cs-sidebar-file tree-item search-result" });
	if (options.cls) section.addClass(options.cls);
	section.dataset.path = options.path;

	// A real button, so Tab, Enter and Space need nothing of ours; it wears
	// Obsidian's tree-row classes, and styles.css takes the button paint off.
	const title = section.createEl("button", {
		cls: "cs-sidebar-file-link tree-item-self search-result-file-title is-clickable",
		attr: { type: "button", "data-action": "file", "data-path": options.path },
	});
	// The path without its `.md`, as a note is named everywhere else.
	title.createDiv({ cls: "tree-item-inner" })
		.createSpan({ cls: "cs-sidebar-file-name", text: options.path.replace(/\.md$/i, "") });
	// A space between the name and the count, so the button reads "a 105"
	// rather than "a105". (A space alone between two flex items is not drawn.)
	title.appendText(" ");
	// The faint count at the row's end, as the Search pane counts a file's matches.
	title.createDiv({ cls: "tree-item-flair-outer" })
		.createSpan({ cls: "tree-item-flair", text: String(options.count) });

	const matches = section.createDiv({ cls: "search-result-file-matches cs-sidebar-matches" });
	return { section, title, matches };
}

/** The file name belongs to its group; each row shows just its kind and line. */
export function renderSidebarLocation(host: HTMLElement, options: {
	role: string;
	/** One-based Markdown source line. */
	line: number;
	cls?: string;
}): HTMLElement {
	const location = host.createSpan({ cls: "cs-sidebar-location", text: t("usage.location", options) });
	if (options.cls) location.addClass(options.cls);
	return location;
}

/**
 * Scroll the list only as far as it takes to show a row the caret moved into;
 * focus never moves.
 */
export function revealSidebarCard(scroller: HTMLElement | null, row: HTMLElement): void {
	// A hidden sidebar tab lays out at zero height; there is nothing to scroll.
	if (!scroller || scroller.clientHeight === 0) return;
	scrollToReveal(scroller, row, ROW_REVEAL_GAP_PX, 0);
}
