/**
 * ui/sidebarResults.ts — one note's results in the Find callouts and Review
 * conversion sidebars, drawn the way Obsidian's Search pane draws a file.
 *
 *   ▾ Projects/Launch plan                        2   ← the file's title row
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
 *
 * The title row holds two controls: the fold triangle, which folds the file's
 * results away, and the file's name, which opens the note. They are separate,
 * as Obsidian's own tree has a fold triangle apart from the name, so each can
 * be reached with Tab and says what it does. The triangle is Obsidian's own
 * (`.collapse-icon`), which turns the right way in a right-to-left window by
 * itself, since Obsidian reads the window's direction (`--direction`) when it
 * turns it: folded points right, or left in a right-to-left window.
 */
import { setIcon } from "obsidian";
import { t } from "../i18n";
import { scrollToReveal } from "./scrollToReveal";
import type { SidebarFold } from "./sidebarFold";
import { unparkGroupOf } from "./sidebarParking";

/** Air kept between a revealed row and the edge of the list. */
const ROW_REVEAL_GAP_PX = 8;

/** Obsidian's fold triangle: it points down, and Obsidian turns it for a folded row. */
const FOLD_ICON = "right-triangle";

/** Makes each note's name element an id of its own, so its fold button can be named by it. */
let groupCounter = 0;

/** What `createSidebarFileGroup` hands back: the group, its title row and its box. */
export interface SidebarFileGroup {
	/** The whole group, `section.tree-item.search-result`; its `data-path` is the note's path. */
	section: HTMLElement;
	/** The title row (the fold button and the note's name); it wears the active note's fill. */
	head: HTMLElement;
	/** The note's name, a button that opens the note (`data-action="file"`). */
	link: HTMLButtonElement;
	/** The box the caller adds its result rows to. */
	matches: HTMLElement;
}

/**
 * Draw one note's group: its title row, then the empty box for its results.
 * A folded note starts with its box hidden (styles.css, `is-collapsed`).
 *
 * @param host Where the group goes.
 * @param options The note's `path`, how many results it has (`count`), an
 *   extra class for the group (`cls`), and the sidebar's memory of which
 *   notes are folded (`fold`), which the fold button also writes to.
 */
export function createSidebarFileGroup(host: HTMLElement, options: {
	path: string;
	count: number;
	cls?: string;
	fold: SidebarFold;
}): SidebarFileGroup {
	const folded = options.fold.isFolded(options.path);
	const section = host.createEl("section", { cls: "cs-sidebar-file tree-item search-result" });
	if (options.cls) section.addClass(options.cls);
	section.toggleClass("is-collapsed", folded);
	section.dataset.path = options.path;

	// Obsidian's tree row: its hover, its active fill, its spacing.
	const head = section.createDiv({ cls: "cs-sidebar-file-head tree-item-self search-result-file-title is-clickable" });

	// The fold control is named by the note it folds, which the screen reader
	// then reads with "expanded" or "collapsed". (Not an `aria-label`: that
	// would also show as a tooltip over the triangle, which Obsidian's own
	// triangles do not have.) A bare div, as Obsidian's triangles are, so no
	// button paint has to be undone; it takes a Tab stop and Enter or Space
	// itself, as the icon buttons of ui/sidebarFrame.ts do.
	groupCounter++;
	const nameId = `cs-sidebar-file-name-${groupCounter}`;
	const fold = head.createDiv({
		cls: "cs-sidebar-fold tree-item-icon collapse-icon",
		attr: { role: "button", tabindex: "0", "aria-expanded": String(!folded), "aria-labelledby": nameId },
	});
	fold.toggleClass("is-collapsed", folded);
	setIcon(fold, FOLD_ICON);

	// A real button, so Tab, Enter and Space need nothing of ours; styles.css
	// takes the button's paint off, so the tree row's shows through.
	const link = head.createEl("button", {
		cls: "cs-sidebar-file-link",
		attr: { type: "button", "data-action": "file", "data-path": options.path },
	});
	// The path without its `.md`, as a note is named everywhere else.
	link.createDiv({ cls: "tree-item-inner" })
		.createSpan({ cls: "cs-sidebar-file-name", text: options.path.replace(/\.md$/i, ""), attr: { id: nameId } });
	// A space between the name and the count, so the button reads "a 105"
	// rather than "a105". (A space alone between two flex items is not drawn.)
	link.appendText(" ");
	// The faint count at the row's end, as the Search pane counts a file's matches.
	link.createDiv({ cls: "tree-item-flair-outer" })
		.createSpan({ cls: "tree-item-flair", text: String(options.count) });

	const matches = section.createDiv({ cls: "search-result-file-matches cs-sidebar-matches" });

	// Folding changes only this group, in place: nothing is drawn again, so
	// nothing flickers and the list keeps its scroll.
	const toggle = (): void => {
		const nowFolded = options.fold.toggle(options.path);
		section.toggleClass("is-collapsed", nowFolded);
		fold.toggleClass("is-collapsed", nowFolded);
		fold.setAttribute("aria-expanded", String(!nowFolded));
	};
	fold.addEventListener("click", toggle);
	fold.addEventListener("keydown", (evt) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Claimed, so Space does not also scroll the pane.
		evt.preventDefault();
		toggle();
	});
	return { section, head, link, matches };
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
 * focus never moves. A row inside a folded note is not on screen at all, so
 * the note's title row is shown instead: the mark is there to find, and the
 * user's fold is left as it is.
 */
export function revealSidebarCard(scroller: HTMLElement | null, row: HTMLElement): void {
	// A hidden sidebar tab lays out at zero height; there is nothing to scroll.
	if (!scroller || scroller.clientHeight === 0) return;
	// A group far from the screen is parked (ui/sidebarParking.ts) and its rows
	// have no box to measure until it is drawn again.
	unparkGroupOf(row);
	const folded = row.closest<HTMLElement>(".cs-sidebar-file.is-collapsed");
	scrollToReveal(scroller, folded?.querySelector<HTMLElement>(".cs-sidebar-file-head") ?? row, ROW_REVEAL_GAP_PX, 0);
}
