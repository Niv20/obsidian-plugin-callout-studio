import type { App, Editor, TFile } from "obsidian";
import type { CalloutRenderRole } from "../types";
import { openOccurrenceEditors } from "./editorOccurrenceSources";
import { queryOccurrences } from "./occurrenceQuery";
import { scanCalloutOccurrencesAsync, yieldOccurrenceScan } from "./scanCalloutOccurrences";
import type {
	CalloutOccurrence, CalloutOccurrenceQuery, OccurrenceIndexSnapshot,
	OccurrenceIndexStatus, OccurrenceScanFailure,
} from "./occurrenceTypes";

interface FileSnapshot {
	file: TFile;
	path: string;
	mtime: number | undefined;
	size: number | undefined;
	epoch: number;
	version: number;
	content?: string;
}

interface FileOccurrences extends FileSnapshot {
	occurrences: readonly CalloutOccurrence[];
}

/** A lazy note index with live editor snapshots. Observing source never discovers or saves a definition. */
export class CalloutOccurrenceIndex {
	status: OccurrenceIndexStatus = "idle";
	revision = 0;
	/** Query data changes only; typing/progress can reuse rendered results. */
	dataRevision = 0;
	/** Changes to source, distinct from scan progress notifications. */
	changeRevision = 0;
	failures: readonly OccurrenceScanFailure[] = [];
	markdownFileCount = 0;
	private readonly recentEditors = new Map<TFile, Editor>();
	private sourceEditors = new Map<TFile, Editor>();
	private editorSources = new Map<TFile, string>();
	private records = new Map<string, FileOccurrences>();
	private byIdentity = new Map<string, CalloutOccurrence[]>();
	private lookupDirty = false;
	private readonly listeners = new Set<() => void>();
	private readonly versions = new Map<string, number>();
	private epoch = 0;
	private running: Promise<void> | null = null;

	constructor(private readonly app: App) {}

	get scannedFileCount(): number { return this.records.size; }

	getSnapshot(): OccurrenceIndexSnapshot {
		return {
			status: this.status, revision: this.revision, dataRevision: this.dataRevision, failures: this.failures,
			markdownFileCount: this.markdownFileCount, scannedFileCount: this.scannedFileCount,
		};
	}

	query(ids?: readonly string[], role?: CalloutRenderRole): CalloutOccurrenceQuery {
		if (this.lookupDirty) this.rebuildLookup();
		return queryOccurrences(this.byIdentity, ids, role);
	}

	subscribe(listener: () => void): () => void {
		if (this.status !== "disposed") this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}

	/** Events only invalidate; the next UI request performs reads. Folder paths work too. */
	invalidate(path?: string): void {
		if (this.status === "disposed") return;
		this.changeRevision++;
		this.dataRevision++;
		if (path === undefined || !path.toLowerCase().endsWith(".md")) {
			this.epoch++;
			this.records.clear();
		} else {
			this.versions.set(path, (this.versions.get(path) ?? 0) + 1);
			this.records.delete(path);
		}
		this.byIdentity.clear();
		this.lookupDirty = true;
		if (this.status !== "idle") this.status = "stale";
		this.notify();
	}

	trackEditorChange(file: TFile, editor: Editor): void {
		if (this.status === "disposed") return;
		this.recentEditors.set(file, editor);
		this.invalidateEditor(file.path);
	}

	/** Retain the previous display while typing, but cancel obsolete parsing immediately. */
	invalidateEditor(path: string): void {
		if (this.status === "disposed") return;
		this.changeRevision++;
		this.versions.set(path, (this.versions.get(path) ?? 0) + 1);
		if (this.status !== "idle") this.status = "stale";
		this.notify();
	}

	/** Closing/switching an editor can replace a live buffer with saved source. */
	editorsChanged(): void {
		if (this.status === "disposed") return;
		const next = openOccurrenceEditors(this.app, this.recentEditors);
		let changed = false;
		for (const file of new Set([...this.sourceEditors.keys(), ...next.keys()])) {
			if (this.sourceEditors.get(file) === next.get(file)) continue;
			changed = true;
			this.versions.set(file.path, (this.versions.get(file.path) ?? 0) + 1);
		}
		this.sourceEditors = next;
		if (!changed || this.status === "idle") return;
		this.changeRevision++;
		this.status = "stale";
		this.notify();
	}

	/** Concurrent requests share one pass. A stale/partial pass retries only on another request. */
	ensureFresh(): Promise<void> {
		if (this.status === "disposed") return Promise.resolve();
		if (this.running) return this.running;
		this.running = Promise.resolve().then(() => this.scan()).finally(() => { this.running = null; });
		return this.running;
	}

	dispose(): void {
		if (this.status === "disposed") return;
		this.epoch++;
		this.status = "disposed";
		this.dataRevision++;
		this.recentEditors.clear();
		this.sourceEditors.clear();
		this.records.clear();
		this.editorSources.clear();
		this.byIdentity.clear();
		this.lookupDirty = false;
		this.failures = [];
		this.versions.clear();
		this.notify();
		this.listeners.clear();
	}

	private capture(file: TFile): FileSnapshot {
		const path = file.path;
		return { file, path, mtime: file.stat?.mtime, size: file.stat?.size,
			epoch: this.epoch, version: this.versions.get(path) ?? 0, content: this.editorSources.get(file) };
	}

	private current(entry: FileSnapshot): boolean {
		return this.status !== "disposed" && entry.epoch === this.epoch &&
			entry.version === (this.versions.get(entry.path) ?? 0) && entry.file.path === entry.path &&
			entry.file.stat?.mtime === entry.mtime && entry.file.stat?.size === entry.size &&
			(typeof this.app.vault.getAbstractFileByPath !== "function" ||
				this.app.vault.getAbstractFileByPath(entry.path) === entry.file);
	}

	private synchronizeEditors(): void {
		this.sourceEditors = openOccurrenceEditors(this.app, this.recentEditors);
		const next = new Map([...this.sourceEditors].map(([file, editor]) => [file, editor.getValue()]));
		for (const file of new Set([...this.editorSources.keys(), ...next.keys()])) {
			if (this.editorSources.get(file) !== next.get(file)) {
				this.versions.set(file.path, (this.versions.get(file.path) ?? 0) + 1);
			}
		}
		this.editorSources = next;
	}

	private async scan(): Promise<void> {
		if (this.status === "disposed") return;
		const next = new Map<string, FileOccurrences>();
		const failures: OccurrenceScanFailure[] = [];
		const failedSnapshots = new Map<string, FileSnapshot>();
		let changed = false;
		try {
			this.synchronizeEditors();
			const files = this.app.vault.getMarkdownFiles().map((file) => this.capture(file));
			this.markdownFileCount = files.length;
			if (this.status === "ready" && files.length === this.records.size && files.every((entry) => {
				const cached = this.records.get(entry.path);
				return cached?.file === entry.file && this.current(cached);
			})) return;
			this.status = "loading";
			this.notify();
			let budgetStart = Date.now();
			for (const [position, entry] of files.entries()) {
				if (this.isDisposed()) return;
				if (!this.current(entry)) { changed = true; continue; }
				const cached = this.records.get(entry.path);
				if (cached?.file === entry.file && this.current(cached)) next.set(entry.path, cached);
				else {
					try {
						const content = entry.content ?? await this.app.vault.cachedRead(entry.file);
						if (!this.current(entry)) { changed = true; continue; }
						const occurrences = await scanCalloutOccurrencesAsync(entry.path, content, () => this.current(entry));
						if (occurrences) next.set(entry.path, { ...entry, occurrences });
						else changed = true;
					} catch (error) {
						if (!this.current(entry)) changed = true;
						else {
							failures.push({ path: entry.path, message: error instanceof Error ? error.message : String(error) });
							failedSnapshots.set(entry.path, entry);
						}
					}
				}
				if (position % 32 === 31 || (position >= 3 && Date.now() - budgetStart >= 8)) {
					await yieldOccurrenceScan();
					budgetStart = Date.now();
				}
			}
			if (this.isDisposed()) return;
			const live = new Map(this.app.vault.getMarkdownFiles().map((file) => [file.path, file]));
			this.markdownFileCount = live.size;
			for (const [path, entry] of next) {
				if (live.get(path) !== entry.file || !this.current(entry)) {
					next.delete(path);
					changed = true;
				}
			}
			// A later event can obsolete an earlier read failure too. Mark it stale
			// so the event-driven follow-up reads the new source instead of keeping
			// a permanent "partial" result for a changed or deleted file.
			for (let position = failures.length - 1; position >= 0; position--) {
				const failure = failures[position]!;
				const entry = failedSnapshots.get(failure.path);
				if (entry && (live.get(entry.path) !== entry.file || !this.current(entry))) {
					failures.splice(position, 1);
					changed = true;
				}
			}
			// Added/replaced files must not turn an otherwise successful old snapshot into "ready".
			const failedPaths = new Set(failures.map((failure) => failure.path));
			for (const path of live.keys()) {
				if (!next.has(path) && !failedPaths.has(path)) changed = true;
			}
			// A canceled update keeps its previous visible rows until replacement.
			// Explicit deletion/invalidation has already removed those records.
			if (changed) for (const [path, previous] of this.records) {
				if (!next.has(path) && !failedPaths.has(path) && live.get(path) === previous.file) next.set(path, previous);
			}
		} catch (error) {
			failures.push({ path: "", message: error instanceof Error ? error.message : String(error) });
		}
		if (this.isDisposed()) return;
		this.records = next;
		this.dataRevision++;
		this.failures = failures;
		this.byIdentity.clear();
		this.lookupDirty = true;
		this.status = changed ? "stale" : failures.length ? "partial" : "ready";
		this.notify();
	}

	private isDisposed(): boolean { return this.status === "disposed"; }

	private rebuildLookup(): void {
		this.lookupDirty = false;
		this.byIdentity.clear();
		for (const entry of this.records.values()) {
			for (const occurrence of entry.occurrences) {
				const group = this.byIdentity.get(occurrence.identity) ?? [];
				group.push(occurrence);
				this.byIdentity.set(occurrence.identity, group);
			}
		}
	}

	private notify(): void {
		this.revision++;
		for (const listener of this.listeners) {
			try { listener(); }
			catch (error) { console.warn("[callout-studio] occurrence subscriber failed", error); }
		}
	}
}

const indexes = new WeakMap<App, CalloutOccurrenceIndex>();

export function getCalloutOccurrenceIndex(app: App): CalloutOccurrenceIndex {
	let index = indexes.get(app);
	if (!index || index.status === "disposed") {
		index = new CalloutOccurrenceIndex(app);
		indexes.set(app, index);
	}
	return index;
}
