import { MarkdownView, TFile, type App, type EventRef, type WorkspaceLeaf } from "obsidian";
import type { CalloutOccurrence, OccurrenceIndexStatus } from "./occurrenceTypes";

/** Tracks the document behind the sidebar and reveals its group in the current query. */
export class OccurrenceActiveFile {
	private file: TFile | null = null;
	private path: string | null = null;
	private pendingPath: string | null = null;
	private resultNavigationPath: string | null = null;
	private sections = new Map<string, HTMLElement>();
	private fileOpenRef: EventRef | null = null;
	private activeLeafRef: EventRef | null = null;

	constructor(
		private readonly app: App,
		private readonly register: (ref: EventRef) => void,
		private readonly onChange: (path: string | null) => void,
		private readonly expandTo: (limit: number) => void,
		private readonly pageSize: number,
	) {}

	open(): void {
		if (this.fileOpenRef) return;
		this.fileOpenRef = this.app.workspace.on("file-open", () => this.setFile(this.currentDocument()));
		this.activeLeafRef = this.app.workspace.on("active-leaf-change", (leaf) => this.onActiveLeafChange(leaf));
		this.register(this.fileOpenRef);
		this.register(this.activeLeafRef);
		// Opening the sidebar should show its filters, while still marking the
		// current note. Later editor changes may reveal their matching section.
		this.setFile(this.currentDocument(), false);
	}

	close(): void {
		if (this.fileOpenRef) this.app.workspace.offref(this.fileOpenRef);
		if (this.activeLeafRef) this.app.workspace.offref(this.activeLeafRef);
		this.fileOpenRef = null;
		this.activeLeafRef = null;
		this.file = null;
		this.path = null;
		this.pendingPath = null;
		this.resultNavigationPath = null;
		this.sections.clear();
	}

	clearSections(): void { this.sections.clear(); }
	addSection(path: string, section: HTMLElement): void { this.sections.set(path, section); }
	cancelReveal(): void { this.pendingPath = null; }
	beginResultNavigation(path: string): void {
		this.resultNavigationPath = path;
		this.cancelReveal();
	}
	endResultNavigation(path: string): void {
		if (this.resultNavigationPath !== path) return;
		const current = this.currentDocument();
		if (current?.path === path) this.setFile(current, false);
		this.resultNavigationPath = null;
	}

	/** A result navigation can precede Obsidian's file-open event; keep its card in place. */
	openedResult(path: string): void {
		this.cancelReveal();
		if (path === this.path) return;
		const file = this.app.vault.getAbstractFileByPath(path);
		this.file = file instanceof TFile ? file : null;
		this.path = path;
		this.onChange(this.path);
	}

	sync(results: readonly CalloutOccurrence[], limit: number, status: OccurrenceIndexStatus, failed: boolean): void {
		// Obsidian mutates TFile.path on rename; no tab-change event is required.
		if (this.file && this.file.path !== this.path) {
			this.path = this.file.path;
			this.pendingPath = this.path;
			this.onChange(this.path);
		}
		for (const [path, section] of this.sections) section.toggleClass("is-active-file", path === this.path);
		const path = this.pendingPath;
		if (!path) return;
		const at = results.findIndex((occurrence) => occurrence.path === path);
		if (at < 0) {
			if (status === "ready" || status === "partial" || failed) this.pendingPath = null;
			return;
		}
		if (at >= limit) {
			this.expandTo(Math.ceil((at + 1) / this.pageSize) * this.pageSize);
			return;
		}
		const section = this.sections.get(path);
		if (section) {
			section.scrollIntoView({ block: "start" });
			this.pendingPath = null;
		}
	}

	private currentDocument(): TFile | null {
		// A Markdown note can itself live in a sidebar. Keep the main workspace
		// as the document context even while that note or our filters have focus.
		const recent = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
		return recent?.view instanceof MarkdownView ? recent.view.file : null;
	}

	private onActiveLeafChange(leaf: WorkspaceLeaf | null): void {
		if (!leaf) { this.setFile(this.currentDocument()); return; }
		if (leaf.getRoot() !== this.app.workspace.rootSplit) return;
		this.setFile(leaf.view instanceof MarkdownView ? leaf.view.file : null);
	}

	private setFile(file: TFile | null, reveal = true): void {
		const markdown = file?.extension.toLowerCase() === "md" ? file : null;
		const path = markdown?.path ?? null;
		if (markdown === this.file && path === this.path) return;
		const changed = path !== this.path;
		this.file = markdown;
		this.path = path;
		if (changed) {
			this.pendingPath = reveal && path !== this.resultNavigationPath ? path : null;
			this.onChange(this.path);
		}
	}
}
