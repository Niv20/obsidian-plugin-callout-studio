import { t } from "../i18n";
import type { CalloutOccurrence } from "./occurrenceTypes";
import { occurrenceButton, occurrenceRoleLabel } from "./occurrencesViewFrame";

const occurrenceKey = (item: CalloutOccurrence): string =>
	JSON.stringify([item.path, item.contentFingerprint, item.line, item.from, item.to, item.identity, item.role]);

/** Owns card identity, selection and focus independently of their changing list offsets. */
export class OccurrenceResults {
	private selected: CalloutOccurrence | null = null;
	private rows = new Map<string, HTMLButtonElement>();
	private occurrences = new WeakMap<HTMLElement, CalloutOccurrence>();
	private countedResults: readonly CalloutOccurrence[] | null = null;
	private fileCounts = new Map<string, number>();
	private previous: { results: readonly CalloutOccurrence[]; limit: number; empty: boolean } | null = null;

	constructor(private readonly pageSize: number) {}

	clear(): void {
		this.rows.clear();
		this.occurrences = new WeakMap();
		this.previous = null;
		this.countedResults = null;
		this.fileCounts.clear();
	}

	getOccurrence(button: HTMLElement): CalloutOccurrence | undefined { return this.occurrences.get(button); }

	select(occurrence: CalloutOccurrence | null): void {
		this.selected = occurrence;
		const selectedKey = occurrence && occurrenceKey(occurrence);
		for (const [key, row] of this.rows) row.setAttribute("aria-current", String(key === selectedKey));
	}

	setActiveFile(path: string | null): void {
		if (this.selected && this.selected.path !== path) this.select(null);
	}

	render(content: HTMLElement, results: readonly CalloutOccurrence[], limit: number, complete: boolean,
		onSection: (path: string, section: HTMLElement) => void, clearSections: () => void): void {
		const empty = complete && results.length === 0;
		if (this.previous?.results === results && this.previous.limit === limit && this.previous.empty === empty) return;
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
		this.occurrences = new WeakMap();
		this.previous = { results, limit, empty };
		content.empty();
		clearSections();
		if (empty) content.createEl("p", { text: t("usage.empty") });
		renderOccurrenceResults(content, results, limit, this.fileCounts, onSection, (occurrence, row) => {
			this.rows.set(occurrenceKey(occurrence), row);
			this.occurrences.set(row, occurrence);
		});
		const remaining = results.length - limit;
		const more = remaining > 0 ? occurrenceButton(content, "more", t("usage.more", { count: Math.min(this.pageSize, remaining) })) : null;
		this.select(this.selected);
		const restoreFocus = focusedOccurrence ? this.rows.get(occurrenceKey(focusedOccurrence)) : focusMore ? more : null;
		restoreFocus?.focus({ preventScroll: true });
	}
}

/** Draw the visible page while reporting each file section for active-file sync. */
function renderOccurrenceResults(
	content: HTMLElement,
	results: readonly CalloutOccurrence[],
	limit: number,
	fileCounts: ReadonlyMap<string, number>,
	onSection: (path: string, section: HTMLElement) => void,
	onRow: (occurrence: CalloutOccurrence, row: HTMLButtonElement) => void,
): void {
	let path = "";
	let group: HTMLElement | null = null;
	for (const [offset, occurrence] of results.slice(0, limit).entries()) {
		if (occurrence.path !== path || !group) {
			path = occurrence.path;
			group = content.createEl("section", { cls: "cs-occurrences-file" });
			onSection(path, group);
			group.createEl("h3", { text: t("usage.fileCount", { path, count: fileCounts.get(path) ?? 0 }) });
		}
		const row = occurrenceButton(group, "result", "");
		row.addClass("cs-occurrences-result");
		row.dataset.result = String(offset);
		onRow(occurrence, row);
		row.createSpan({ cls: "cs-occurrences-location", text: t("usage.location", { line: occurrence.line + 1, role: occurrenceRoleLabel(occurrence.role) }) });
		const excerpt = row.createSpan({ cls: "cs-occurrences-excerpt" });
		if (occurrence.role === "regular" && occurrence.excerpt.includes("\n")) {
			excerpt.addClass("cs-occurrences-excerpt-split");
			for (const line of occurrence.excerpt.split("\n", 2)) excerpt.createSpan({ cls: "cs-occurrences-excerpt-line", text: line });
		} else excerpt.setText(occurrence.excerpt);
	}
}
