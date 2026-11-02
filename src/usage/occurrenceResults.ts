import type { MarkdownView } from "obsidian";
import { t } from "../i18n";
import { SidebarFold } from "../ui/sidebarFold";
import { createSidebarFileGroup, renderSidebarLocation, revealSidebarCard } from "../ui/sidebarResults";
import { canLoadOnScroll, LOAD_MORE_SENTINEL } from "../ui/loadOnScroll";
import { occurrenceAtCursor, type OccurrencesByLine } from "./occurrenceAtCursor";
import type { CalloutOccurrence } from "./occurrenceTypes";
import { occurrenceButton, occurrenceRoleLabel } from "./occurrencesViewFrame";
import { NO_RESULTS_MOOD } from "../ui/mascot/mascotAnimations";
import { KeptMascot } from "../ui/mascot/mascotPlaces";

const occurrenceKey = (item: CalloutOccurrence): string =>
	JSON.stringify([item.path, item.contentFingerprint, item.line, item.from, item.to, item.identity, item.role]);
const NO_LINES: OccurrencesByLine = new Map();

/** Owns card identity, selection and focus independently of their changing list offsets. */
export class OccurrenceResults {
	private selected: CalloutOccurrence | null = null;
	private currentRow: HTMLButtonElement | null = null;
	private rows = new Map<string, HTMLButtonElement>();
	/** Drawn cards only, by note and line: what the caret can be matched against. */
	private byPath = new Map<string, Map<number, CalloutOccurrence[]>>();
	private occurrences = new WeakMap<HTMLElement, CalloutOccurrence>();
	private countedResults: readonly CalloutOccurrence[] | null = null;
	private fileCounts = new Map<string, number>();
	private previous: { results: readonly CalloutOccurrence[]; limit: number; empty: boolean } | null = null;
	/**
	 * The empty marker the list ends in while more results are left to draw,
	 * for the view's `LoadOnScroll` to watch; null when everything is drawn,
	 * or when the window cannot watch it (then the list ends in a button).
	 */
	sentinel: HTMLElement | null = null;
	/**
	 * The brush mascot over "No matching callouts were found", kept while the
	 * list is drawn again. It looks around twice when the list turns empty, then
	 * keeps the face of a search that found nothing, like every other search.
	 */
	private readonly emptyMascot = new KeptMascot("medium");
	/**
	 * Which notes' results are folded away. Every redraw of the list draws them
	 * folded again; the view clears it when a new search starts.
	 */
	readonly fold = new SidebarFold();

	constructor(private readonly pageSize: number) {}

	clear(): void {
		this.emptyMascot.detach();
		this.rows.clear();
		this.byPath.clear();
		this.currentRow = null;
		this.occurrences = new WeakMap();
		this.previous = null;
		this.countedResults = null;
		this.fileCounts.clear();
		this.sentinel = null;
	}

	getOccurrence(button: HTMLElement): CalloutOccurrence | undefined {
		return this.occurrences.get(button);
	}

	linesOf(path: string): OccurrencesByLine {
		return this.byPath.get(path) ?? NO_LINES;
	}

	/** Marks one card current. Only the card losing the mark and the one gaining it are written. */
	select(occurrence: CalloutOccurrence | null): void {
		this.selected = occurrence;
		const row = (occurrence && this.rows.get(occurrenceKey(occurrence))) ?? null;
		if (this.currentRow && this.currentRow !== row) this.currentRow.setAttribute("aria-current", "false");
		row?.setAttribute("aria-current", "true");
		this.currentRow = row;
	}

	/**
	 * The caret moved: mark its card, or none. The list scrolls only when that
	 * card is out of sight, and only as far as it takes; focus never moves.
	 */
	follow(occurrence: CalloutOccurrence | null, scroller: HTMLElement | null): void {
		const key = occurrence && occurrenceKey(occurrence);
		if (key === (this.selected && occurrenceKey(this.selected))) return;
		this.select(occurrence);
		if (this.currentRow) revealSidebarCard(scroller, this.currentRow);
	}

	/** Follow the caret of `view`: mark the drawn card it sits in, or none. */
	followCaret(view: MarkdownView | null, scroller: HTMLElement | null): void {
		const path = view?.file?.path;
		this.follow(
			view && path ? occurrenceAtCursor(view.editor, view.editor.getCursor("head"), this.linesOf(path)) : null,
			scroller,
		);
	}

	setActiveFile(path: string | null): void {
		if (this.selected && this.selected.path !== path) this.select(null);
	}

	/** Draws the list; returns whether it was drawn again (it is not when nothing changed). */
	render(
		content: HTMLElement,
		results: readonly CalloutOccurrence[],
		limit: number,
		complete: boolean,
		onSection: (path: string, section: HTMLElement) => void,
		clearSections: () => void,
	): boolean {
		const empty = complete && results.length === 0;
		if (this.previous?.results === results && this.previous.limit === limit && this.previous.empty === empty)
			return false;
		const wasEmpty = this.previous?.empty === true;
		const focused = content.ownerDocument.activeElement as HTMLElement | null;
		const focusedOccurrence = focused && this.occurrences.get(focused);
		const focusMore = focused && content.contains(focused) && focused.dataset.action === "more";
		if (this.countedResults !== results) {
			this.countedResults = results;
			this.fileCounts.clear();
			const selectedKey = this.selected && occurrenceKey(this.selected);
			let selectionExists = false;
			for (const occurrence of results) {
				this.fileCounts.set(occurrence.path, (this.fileCounts.get(occurrence.path) ?? 0) + 1);
				if (selectedKey && selectedKey === occurrenceKey(occurrence)) selectionExists = true;
			}
			if (!selectionExists) this.selected = null;
		}
		this.rows.clear();
		this.byPath.clear();
		this.currentRow = null;
		this.occurrences = new WeakMap();
		this.previous = { results, limit, empty };
		content.empty();
		clearSections();
		// Nothing found: the line goes in the middle of the pane's height (styles.css).
		content.toggleClass("cs-sidebar-empty", empty);
		// Nothing found: a quiet line, as Obsidian's Search says "No matches found".
		if (empty) this.drawEmpty(content.createDiv({ cls: "search-empty-state", text: t("usage.empty") }), wasEmpty);
		else this.emptyMascot.detach();
		renderOccurrenceResults(content, results, limit, this.fileCounts, this.fold, onSection, (occurrence, row) => {
			this.rows.set(occurrenceKey(occurrence), row);
			this.occurrences.set(row, occurrence);
			const lines = this.byPath.get(occurrence.path) ?? new Map<number, CalloutOccurrence[]>();
			this.byPath.set(occurrence.path, lines);
			lines.set(occurrence.line, [...(lines.get(occurrence.line) ?? []), occurrence]);
		});
		// More to draw: an empty marker the view loads the next page at as it
		// scrolls into reach (finding S10-07), or, where the window cannot watch
		// it, the old button.
		const remaining = results.length - limit;
		const watchable = canLoadOnScroll(content.ownerDocument);
		this.sentinel =
			remaining > 0 && watchable
				? content.createDiv({ cls: LOAD_MORE_SENTINEL, attr: { "aria-hidden": "true" } })
				: null;
		const more =
			remaining > 0 && !watchable
				? occurrenceButton(content, "more", t("usage.more", { count: Math.min(this.pageSize, remaining) }))
				: null;
		this.select(this.selected);
		const restoreFocus = focusedOccurrence
			? this.rows.get(occurrenceKey(focusedOccurrence))
			: focusMore
				? more
				: null;
		restoreFocus?.focus({ preventScroll: true });
		return true;
	}

	/**
	 * Put the mascot over the empty line. It keeps the face of a search that
	 * found nothing for as long as the list stays empty. When the list has only
	 * just turned empty it first looks around twice for what is not there;
	 * `lookTwice` hands over to that face itself, so the mascot is never the
	 * plain icon in between.
	 */
	private drawEmpty(line: HTMLElement, wasEmpty: boolean): void {
		if (!this.emptyMascot.attach(line, "start")) return;
		line.addClass("cs-mascot-line");
		this.emptyMascot.setMood(NO_RESULTS_MOOD);
		if (wasEmpty) return;
		void this.emptyMascot.play("lookTwice");
	}
}

/** Draw the visible page while reporting each file section for active-file sync. */
function renderOccurrenceResults(
	content: HTMLElement,
	results: readonly CalloutOccurrence[],
	limit: number,
	fileCounts: ReadonlyMap<string, number>,
	fold: SidebarFold,
	onSection: (path: string, section: HTMLElement) => void,
	onRow: (occurrence: CalloutOccurrence, row: HTMLButtonElement) => void,
): void {
	let path = "";
	let group: HTMLElement | null = null;
	for (const [offset, occurrence] of results.slice(0, limit).entries()) {
		if (occurrence.path !== path || !group) {
			path = occurrence.path;
			const file = createSidebarFileGroup(content, {
				path,
				count: fileCounts.get(path) ?? 0,
				cls: "cs-occurrences-file",
				fold,
			});
			group = file.matches;
			onSection(path, file.section);
		}
		// A row of the file's box, as a match is in Obsidian's Search pane: the
		// whole row is the button that jumps to the callout.
		const row = occurrenceButton(group, "result", "");
		row.addClass("search-result-file-match", "cs-occurrences-result", "cs-sidebar-result");
		row.dataset.result = String(offset);
		onRow(occurrence, row);
		renderSidebarLocation(row, {
			line: occurrence.line + 1,
			role: occurrenceRoleLabel(occurrence.role),
			cls: "cs-occurrences-location",
		});
		const excerpt = row.createSpan({ cls: "cs-occurrences-excerpt" });
		if (occurrence.role === "regular" && occurrence.excerpt.includes("\n")) {
			excerpt.addClass("cs-occurrences-excerpt-split");
			for (const line of occurrence.excerpt.split("\n", 2))
				excerpt.createSpan({ cls: "cs-occurrences-excerpt-line", text: line });
		} else excerpt.setText(occurrence.excerpt);
	}
}
