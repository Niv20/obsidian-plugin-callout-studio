/**
 * settings/iconpicker/IconGrid.ts — The paged, keyboard-navigable icon grid.
 *
 * Pack-agnostic: owns paging, selection, arrow keys and scrolling to a chosen
 * icon; callbacks draw cells and optional actions.
 *
 * Paging is per group: a large source in "All sources" cannot hide later
 * groups behind its "Load more" button. Collapsing a group hides its own
 * cells and button. A single-source panel has one segment.
 */
import { setIcon } from "obsidian";
import type { IconEntry } from "../../icons/types";

const GRID_PAGE_SIZE = 120;

/** Cap on paging-to-reveal, so a bad index can never spin the UI forever. */
const MAX_REVEAL_PAGES = 500;

export interface IconGridOptions {
	/** Draws one icon into its cell. */
	renderCell(cell: HTMLElement, entry: IconEntry): void;
	/** Optional sibling action, kept outside the selectable cell. */
	renderCellAction?(host: HTMLElement, entry: IconEntry): void;
	/** Whether this entry is the current selection (drives the highlight). */
	isSelected(entry: IconEntry): boolean;
	onSelect(entry: IconEntry, cell: HTMLElement): void;
	/** Tooltip / accessible name. */
	labelFor(entry: IconEntry): string;
	/**
	 * Extra class for this entry's cell (emoji sizing, Material font preview).
	 *
	 * Per entry rather than per grid, because the pooled "All sources" list mixes
	 * sources that need different cell treatments in one grid.
	 */
	cellClass?(entry: IconEntry): string | undefined;
	/**
	 * A heading to place before this entry, or undefined for no break.
	 *
	 * Called with the entry that precedes it, so the grid stays ignorant of what
	 * a group even is — the pooled list heads each run of entries from one
	 * source, and every other source returns nothing and gets a flat grid (one
	 * segment, no heading).
	 */
	groupLabelFor?(entry: IconEntry, previous: IconEntry | undefined): string | undefined;
	emptyText: string;
	/** Optional custom empty state for sources with richer guidance. */
	renderEmpty?(host: HTMLElement): void;
	loadMoreText: string;
}

/** One run of entries from a single group — or, for an ungrouped grid, all of them. */
interface GridSegment {
	readonly heading: string | undefined;
	readonly entries: IconEntry[];
	displayed: number;
	collapsed: boolean;
	headerEl: HTMLElement | null;
	loadMoreEl: HTMLElement | null;
	/** Parallel to `entries`, up to `displayed` — what collapsing has to hide. */
	cellEls: HTMLElement[];
}

export class IconGrid {
	private readonly gridEl: HTMLElement;
	private segments: GridSegment[] = [];

	constructor(
		parent: HTMLElement,
		private readonly options: IconGridOptions,
	) {
		this.gridEl = parent.createDiv("icon-picker-grid");
		this.gridEl.setAttribute("role", "grid");
		this.enableKeyNav();
	}

	/** Replace the contents, resetting paging and scroll. */
	setEntries(entries: readonly IconEntry[]): void {
		this.segments = this.partition(entries);
		this.gridEl.empty();
		this.gridEl.removeClass("is-loaded");
		for (const segment of this.segments) this.renderSegment(segment);
		this.gridEl.addClass("is-loaded");
		if (entries.length === 0) {
			const empty = this.gridEl.createDiv("icon-picker-empty");
			if (this.options.renderEmpty) this.options.renderEmpty(empty);
			else empty.setText(this.options.emptyText);
		}
	}

	/** Replace the grid with a message (download prompt, error, spinner). */
	showMessage(build: (host: HTMLElement) => void): void {
		this.segments = [];
		this.gridEl.empty();
		this.gridEl.addClass("is-loaded");
		build(this.gridEl.createDiv("icon-picker-notice"));
	}

	/**
	 * Re-run the cell renderer over what is already on screen, without
	 * rebuilding. Used when a control changes only the artwork — the emoji skin
	 * tone — so scroll position and loaded pages survive.
	 */
	repaintVisible(): void {
		const cells = Array.from(
			this.gridEl.querySelectorAll<HTMLElement>(".icon-picker-cell"),
		);
		// Cells are created in exactly this order — segment by segment, up to
		// each one's own `displayed` — so the same walk lines entries back up
		// with the cells that currently hold them, collapsed or not.
		const entries = this.segments.flatMap((s) => s.entries.slice(0, s.displayed));
		cells.forEach((cell, i) => {
			const entry = entries[i];
			if (!entry) return;
			cell.empty();
			this.options.renderCell(cell, entry);
		});
	}

	/** Move the highlight without rebuilding the grid. */
	markSelected(cell: HTMLElement): void {
		this.gridEl
			.querySelectorAll(".is-selected")
			.forEach((el) => el.removeClass("is-selected"));
		cell.addClass("is-selected");
	}

	/**
	 * Page in icons until the pre-selected one exists, then centre it. Centring
	 * (rather than nearest) keeps the cell clear of the sticky toolbar above.
	 *
	 * Only the segment that holds the selection has to page — the others are
	 * untouched, so revealing an icon far down the pooled list no longer means
	 * paging through everything ahead of it.
	 */
	revealSelected(): void {
		const segment = this.segments.find((s) =>
			s.entries.some((e) => this.options.isSelected(e)),
		);
		if (!segment) return;
		if (segment.collapsed) this.toggleSegment(segment);

		const target = segment.entries.findIndex((e) => this.options.isSelected(e));
		let guard = 0;
		while (segment.displayed <= target && guard++ < MAX_REVEAL_PAGES) {
			if (segment.displayed >= segment.entries.length) break;
			this.appendSegmentPage(segment);
		}
		this.syncLoadMore(segment);
		this.gridEl
			.querySelector<HTMLElement>(".icon-picker-cell.is-selected")
			?.scrollIntoView({ block: "center" });
	}

	/**
	 * Split the flat, already-sorted list into runs. Pooling preserves the run —
	 * the pooled index concatenates its members, and `filterIcons` ranks within
	 * a source rather than across the whole list — so a source change is exactly
	 * a group boundary, and no sorting is needed here to find one. A grid with
	 * no `groupLabelFor` produces one segment covering everything.
	 */
	private partition(entries: readonly IconEntry[]): GridSegment[] {
		const segments: GridSegment[] = [];
		let current: GridSegment | null = null;
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (!entry) continue;
			const heading = this.options.groupLabelFor?.(entry, entries[i - 1]);
			if (!current || heading !== undefined) {
				current = {
					heading,
					entries: [],
					displayed: 0,
					collapsed: false,
					headerEl: null,
					loadMoreEl: null,
					cellEls: [],
				};
				segments.push(current);
			}
			current.entries.push(entry);
		}
		return segments;
	}

	private renderSegment(segment: GridSegment): void {
		if (segment.heading !== undefined) {
			segment.headerEl = this.buildHeader(segment, segment.heading);
		}
		// Built before the first page so later cells have a stable anchor to
		// insert before — this segment's own end, not the whole grid's.
		segment.loadMoreEl = this.buildLoadMoreRow(segment);
		this.appendSegmentPage(segment);
		this.syncLoadMore(segment);
	}

	/**
	 * One group's heading in the pooled list, clickable to hide its own cells
	 * (and its own "Load more" with them). A source that floods the pool with
	 * hundreds of hits would otherwise push every other source below the fold.
	 */
	private buildHeader(segment: GridSegment, heading: string): HTMLElement {
		const header = this.gridEl.createDiv({
			cls: "icon-picker-group-header",
			attr: { role: "button", tabindex: "0", "aria-expanded": "true" },
		});
		const chevron = header.createSpan({ cls: "icon-picker-group-chevron" });
		setIcon(chevron, "chevron-right");
		header.createSpan({ cls: "icon-picker-group-text", text: heading });

		const toggle = () => this.toggleSegment(segment);
		header.addEventListener("click", toggle);
		header.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				toggle();
			}
		});
		return header;
	}

	private buildLoadMoreRow(segment: GridSegment): HTMLElement {
		const row = this.gridEl.createDiv("icon-picker-load-more");
		const btn = row.createEl("button", { text: this.options.loadMoreText });
		btn.addEventListener("click", () => {
			this.appendSegmentPage(segment);
			this.syncLoadMore(segment);
		});
		return row;
	}

	private appendSegmentPage(segment: GridSegment): void {
		const end = Math.min(segment.displayed + GRID_PAGE_SIZE, segment.entries.length);
		for (let i = segment.displayed; i < end; i++) {
			const entry = segment.entries[i];
			if (!entry) continue;

			const cellClass = this.options.cellClass?.(entry);
			const cellHost = this.options.renderCellAction
				? this.gridEl.createDiv("icon-picker-cell-wrap") : this.gridEl;
			const cell = cellHost.createDiv({
				cls:
					`icon-picker-cell${cellClass ? ` ${cellClass}` : ""}` +
					(segment.collapsed ? " is-group-collapsed" : ""),
				attr: {
					"aria-label": this.options.labelFor(entry),
					tabindex: "0",
					role: "button",
				},
			});
			// Keep this segment before its own "Load more" row.
			const item = cellHost === this.gridEl ? cell : cellHost;
			if (segment.loadMoreEl) this.gridEl.insertBefore(item, segment.loadMoreEl);
			segment.cellEls.push(cell);

			this.options.renderCell(cell, entry);
			if (cellHost !== this.gridEl) this.options.renderCellAction?.(cellHost, entry);
			if (this.options.isSelected(entry)) cell.addClass("is-selected");

			const select = () => {
				this.markSelected(cell);
				this.options.onSelect(entry, cell);
			};
			cell.addEventListener("click", select);
			cell.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					select();
				}
			});
		}
		segment.displayed = end;
	}

	private syncLoadMore(segment: GridSegment): void {
		const row = segment.loadMoreEl;
		if (!row) return;
		const hasMore = segment.displayed < segment.entries.length;
		if (hasMore && !segment.collapsed) row.show();
		else row.hide();
	}

	private toggleSegment(segment: GridSegment): void {
		segment.collapsed = !segment.collapsed;
		segment.headerEl?.toggleClass("is-collapsed", segment.collapsed);
		segment.headerEl?.setAttribute("aria-expanded", String(!segment.collapsed));
		for (const cell of segment.cellEls) {
			cell.toggleClass("is-group-collapsed", segment.collapsed);
		}
		this.syncLoadMore(segment);
	}

	/**
	 * Arrow-key movement. The column count is measured from the rendered cells
	 * rather than assumed, because the grid is responsive and its width depends
	 * on the modal size and the platform.
	 */
	private enableKeyNav(): void {
		this.gridEl.addEventListener("keydown", (e) => {
			const cells = Array.from(
				this.gridEl.querySelectorAll<HTMLElement>(
					".icon-picker-cell:not(.is-group-collapsed)",
				),
			);
			const current = activeDocument.activeElement as HTMLElement | null;
			const idx = current ? cells.indexOf(current) : -1;
			if (idx < 0) return;

			const cols = countColumns(cells);
			let next = -1;
			switch (e.key) {
				case "ArrowRight":
					next = idx + 1;
					break;
				case "ArrowLeft":
					next = idx - 1;
					break;
				case "ArrowDown":
					next = idx + cols;
					break;
				case "ArrowUp":
					next = idx - cols;
					break;
				default:
					return;
			}
			if (next >= 0 && next < cells.length) {
				e.preventDefault();
				cells[next]?.focus();
			}
		});
	}
}

/** Cells sharing the first row's top edge, i.e. the current column count. */
function countColumns(cells: readonly HTMLElement[]): number {
	const first = cells[0];
	if (!first || cells.length < 2) return 1;
	const top = first.getBoundingClientRect().top;
	const sameRow = cells.filter(
		(c) => Math.abs(c.getBoundingClientRect().top - top) < 2,
	);
	return Math.max(sameRow.length, 1);
}
