import type { App, EventRef } from "obsidian";
import { SidebarActiveFile } from "../ui/sidebarActiveFile";
import { navigateToSidebarFile, navigateToSidebarResult, type SidebarSourceRange } from "../ui/sidebarNavigation";
import { SidebarSourceSelection } from "../ui/sidebarSelection";
import { iterateContentFingerprint } from "../usage/contentFingerprint";
import type { PortableCalloutConversionPlan } from "../utils/portableCalloutVault";
import type { PortableCalloutLinkChange } from "../utils/portableCalloutPlan";
import { PORTABLE_PAGE_SIZE } from "./portableConversionFrame";
import { portableConversionRows, renderPortableConversionRows, type PortableConversionRow } from "./portableConversionRows";

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

/** Both sidebars share note tracking, file groups and source-editor navigation. */
export class PortableConversionNavigation {
	private readonly activeFile: SidebarActiveFile;
	private readonly sourceSelection = new SidebarSourceSelection();
	private rows: PortableConversionRow[] = [];
	private current?: string;
	private opened = false;
	private generation = 0;
	private navigating = false;
	private root?: HTMLElement;
	private limit = PORTABLE_PAGE_SIZE;
	private ready = false;
	private failed = false;
	constructor(private readonly app: App, register: (ref: EventRef) => void,
		private readonly render: () => void, private readonly refresh: () => void,
		expandTo: (limit: number) => void) {
		this.activeFile = new SidebarActiveFile(app, register, path => {
			if (this.rows.find(row => row.id === this.current)?.path !== path) {
				this.clearCurrent();
			}
			if (this.opened) this.activeFile.sync(this.rows, this.limit, this.ready ? "ready" : "loading", this.failed);
		}, expandTo, PORTABLE_PAGE_SIZE);
	}
	open(): void { this.opened = true; this.activeFile.open(); }
	close(): void { this.opened = false; this.invalidate(); this.clearCurrent(); this.activeFile.close(); this.root = undefined; }
	invalidate(): void { this.generation++; }
	renderRows(root: HTMLElement, plan: PortableCalloutConversionPlan | undefined, limit: number, disabled: boolean): void {
		this.root = root;
		this.limit = limit;
		this.rows = portableConversionRows(plan);
		if (!this.rows.some(row => row.id === this.current)) this.clearCurrent();
		this.activeFile.clearSections();
		renderPortableConversionRows(root, plan, this.rows, limit, disabled, this.current,
			(path, section) => this.activeFile.addSection(path, section));
	}
	sync(ready: boolean, failed: boolean): void {
		this.ready = ready; this.failed = failed;
		this.activeFile.sync(this.rows, this.limit, ready ? "ready" : "loading", failed);
	}
	async navigate(id: string | undefined, newTab: boolean): Promise<void> {
		const row = this.rows.find(item => item.id === id);
		if (!row || !this.opened || this.navigating) return;
		this.navigating = true;
		const generation = this.generation;
		const isCurrent = (): boolean => this.opened && generation === this.generation;
		this.activeFile.beginResultNavigation(row.path);
		let opened = false;
		let trackSelection: (() => void) | undefined;
		try { opened = await navigateToSidebarResult(this.app, row.path,
			(content, stillOpen) => resolvePortableSourcePosition(row.change, content, stillOpen), newTab, isCurrent,
			(editor, range) => { trackSelection = () => this.sourceSelection.watch(editor, range, () => this.clearCurrent()); }); }
		finally { this.activeFile.endResultNavigation(row.path); this.navigating = false; }
		if (!isCurrent()) return;
		if (opened) { this.activeFile.openedResult(row.path); this.current = row.id; trackSelection?.(); this.render(); }
		else this.refresh();
	}
	async navigateFile(path: string | undefined, newTab: boolean): Promise<void> {
		if (!path || !this.opened || this.navigating || !this.rows.some(row => row.path === path)) return;
		this.navigating = true;
		const generation = this.generation;
		const isCurrent = (): boolean => this.opened && generation === this.generation;
		this.activeFile.beginResultNavigation(path);
		try {
			if (await navigateToSidebarFile(this.app, path, newTab, isCurrent) && isCurrent()) {
				this.clearCurrent();
				this.activeFile.openedResult(path);
			}
		} finally { this.activeFile.endResultNavigation(path); this.navigating = false; }
	}
	private clearCurrent(): void {
		this.current = undefined;
		this.sourceSelection.clear();
		for (const card of Array.from(this.root?.querySelectorAll('[aria-current="true"]') ?? [])) card.setAttribute("aria-current", "false");
	}
}
