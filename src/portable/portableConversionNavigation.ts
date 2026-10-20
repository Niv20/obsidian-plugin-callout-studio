import type { App, EventRef, MarkdownView, WorkspaceLeaf } from "obsidian";
import { SidebarActiveFile } from "../ui/sidebarActiveFile";
import { SidebarCursorSync } from "../ui/sidebarCursorSync";
import { navigateToSidebarFile, navigateToSidebarResult, type SidebarSourceRange } from "../ui/sidebarNavigation";
import { revealSidebarCard } from "../ui/sidebarResults";
import { iterateContentFingerprint } from "../usage/contentFingerprint";
import type { PortableCalloutConversionPlan } from "../utils/portableCalloutVault";
import type { PortableCalloutLinkChange } from "../utils/portableCalloutPlan";
import { PORTABLE_PAGE_SIZE } from "./portableConversionFrame";
import { portableConversionRows, renderPortableConversionRows, type PortableConversionRow } from "./portableConversionRows";
import { portableRowAtCursor } from "./portableRowAtCursor";

/** Repeated lines require the original document; only a unique unchanged line can move. */
export async function resolvePortableSourcePosition(
	change: Pick<PortableCalloutLinkChange, "before" | "line" | "contentFingerprint"> & {
		sourceLine?: string; from?: number; to?: number;
	},
	content: string, isCurrent: () => boolean = () => true,
): Promise<SidebarSourceRange | null> {
	const hash = iterateContentFingerprint(content);
	let fingerprint = hash.next();
	while (!fingerprint.done) {
		await new Promise<void>(resolve => window.setTimeout(resolve, 0));
		if (!isCurrent()) return null;
		fingerprint = hash.next();
	}
	const lines = content.split("\n");
	const source = change.sourceLine ?? change.before;
	const from = change.from ?? 0, to = change.to ?? source.length;
	if (from < 0 || to > source.length || from >= to || source.slice(from, to) !== change.before) return null;
	const matches: number[] = [];
	for (let line = 0; line < lines.length; line++) {
		if (lines[line]!.replace(/\r$/, "") === source) matches.push(line);
		if (line > 0 && line % 512 === 0) {
			await new Promise<void>(resolve => window.setTimeout(resolve, 0));
			if (!isCurrent()) return null;
		}
	}
	const line = fingerprint.value === change.contentFingerprint && matches.includes(change.line - 1)
		? change.line - 1 : matches.length === 1 ? matches[0]! : -1;
	return isCurrent() && line >= 0 ? { from: { line, ch: from }, to: { line, ch: to } } : null;
}

/**
 * Both sidebars share note tracking, file groups, source-editor navigation and
 * following the caret: the card under it is marked, as in Find callouts.
 */
export class PortableConversionNavigation {
	private readonly activeFile: SidebarActiveFile;
	private readonly cursor: SidebarCursorSync;
	private rows: PortableConversionRow[] = [];
	/** Drawn cards only, by note: what the caret can be matched against. */
	private drawn = new Map<string, PortableConversionRow[]>();
	private current?: string;
	private editingId?: string;
	/** The opening result or file holds the mark; its note switch must not hand it to the caret. */
	private navigating?: number;
	private opened = false;
	private generation = 0;
	private root?: HTMLElement;
	private limit = PORTABLE_PAGE_SIZE;
	private ready = false;
	private failed = false;
	constructor(private readonly app: App, register: (ref: EventRef) => void,
		private readonly render: () => void, private readonly refresh: () => void,
		expandTo: (limit: number) => void, private readonly scroller: () => HTMLElement | null,
		private readonly origin?: WorkspaceLeaf) {
		this.activeFile = new SidebarActiveFile(app, register, path => {
			if (this.rows.find(row => row.id === this.current)?.path !== path) this.mark(undefined);
			if (this.navigating === undefined) this.cursor.release();
			if (this.opened) this.activeFile.sync(this.rows, this.limit, this.ready ? "ready" : "loading", this.failed);
		}, expandTo, PORTABLE_PAGE_SIZE);
		this.cursor = new SidebarCursorSync(() => this.activeFile.currentView(), view => this.followCaret(view));
	}
	open(): void { this.opened = true; this.activeFile.open(); this.cursor.open(); }
	close(): void { this.opened = false; this.invalidate(); this.cursor.close(); this.clearCurrent(); this.activeFile.close(); this.root = undefined; }
	invalidate(): void { this.generation++; }
	renderRows(root: HTMLElement, plan: PortableCalloutConversionPlan | undefined, limit: number, disabled: boolean, editingId?: string, resetEnabled = false): void {
		this.root = root;
		this.limit = limit;
		this.editingId = editingId;
		this.rows = portableConversionRows(plan);
		this.drawn = new Map();
		for (const row of this.rows.slice(0, limit)) this.drawn.set(row.path, [...this.drawn.get(row.path) ?? [], row]);
		if (!this.rows.some(row => row.id === this.current)) this.current = undefined;
		this.activeFile.clearSections();
		renderPortableConversionRows(root, plan, this.rows, limit, disabled, this.current,
			(path, section) => this.activeFile.addSection(path, section), editingId, resetEnabled);
	}
	sync(ready: boolean, failed: boolean): void {
		this.ready = ready; this.failed = failed;
		this.activeFile.sync(this.rows, this.limit, ready ? "ready" : "loading", failed);
		// New or moved cards: the caret may sit in a different one now.
		this.cursor.schedule();
	}
	async navigate(id: string | undefined, newTab: boolean): Promise<void> {
		const row = this.rows.find(item => item.id === id);
		if (!row || !this.opened) return;
		const generation = this.begin(row.path);
		const isCurrent = (): boolean => this.opened && generation === this.generation;
		let opened = false, current = false;
		let landedIn: (() => void) | undefined;
		try { opened = await navigateToSidebarResult(this.app, row.path,
			(content, stillOpen) => resolvePortableSourcePosition(row.change, content, stillOpen),
			{ newTab, isCurrent, origin: this.origin,
				onSelected: (editor) => { landedIn = () => this.cursor.landedIn(editor); } }); }
		finally { current = this.end(generation, row.path); }
		if (!current) return;
		if (!opened) { this.cursor.release(); this.refresh(); return; }
		this.activeFile.openedResult(row.path);
		this.current = row.id;
		if (landedIn) landedIn(); else this.cursor.release();
		this.render();
	}
	async navigateFile(path: string | undefined, newTab: boolean): Promise<void> {
		if (!path || !this.opened || !this.rows.some(row => row.path === path)) return;
		const generation = this.begin(path);
		const isCurrent = (): boolean => this.opened && generation === this.generation;
		let opened = false, current = false;
		try { opened = await navigateToSidebarFile(this.app, path, { newTab, isCurrent, origin: this.origin }); }
		finally { current = this.end(generation, path); }
		if (!current) return;
		if (opened) { this.clearCurrent(); this.activeFile.openedResult(path); }
		this.cursor.release();
	}
	/** Unmark the current card, as when a replacement draft takes over the highlight. */
	clearCurrent(): void { this.mark(undefined); }
	/** Hold the mark for a result or file while it opens. */
	private begin(path: string): number {
		const generation = ++this.generation;
		this.navigating = generation;
		this.cursor.hold();
		this.activeFile.beginResultNavigation(path);
		return generation;
	}
	/**
	 * Whether the opening still counts. One overtaken by a rescan or a closed
	 * view, rather than by the next opening, hands the mark back to the caret.
	 */
	private end(generation: number, path: string): boolean {
		const current = this.opened && generation === this.generation;
		if (generation === this.generation) this.activeFile.endResultNavigation(path);
		if (this.navigating !== generation) return current;
		this.navigating = undefined;
		if (!current && this.opened) this.cursor.release();
		return current;
	}
	private followCaret(view: MarkdownView | null): void {
		const path = view?.file?.path;
		// An open replacement draft wears the same highlight; no second card joins it.
		const row = view && path && this.editingId === undefined
			? portableRowAtCursor(view.editor, view.editor.getCursor("head"), this.drawn.get(path) ?? []) : null;
		if (row?.id === this.current) return;
		const card = this.mark(row?.id);
		if (card) revealSidebarCard(this.scroller(), card);
	}
	/** Move the mark to one card, or none, and return that card; only cards whose mark changes are written. */
	private mark(id: string | undefined): HTMLElement | undefined {
		this.current = id;
		let marked: HTMLElement | undefined;
		for (const card of Array.from(this.root?.querySelectorAll<HTMLElement>(".cs-portable-change-body") ?? [])) {
			const on = id !== undefined && card.dataset.rowId === id;
			if (on) marked = card;
			if ((card.getAttribute("aria-current") === "true") !== on) card.setAttribute("aria-current", String(on));
		}
		return marked;
	}
}
