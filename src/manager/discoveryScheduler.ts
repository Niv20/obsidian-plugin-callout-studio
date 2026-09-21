/**
 * manager/discoveryScheduler.ts — which files automatic discovery looks at, and
 * what makes it look.
 *
 * The same split as `CalloutPrune`, and for the same reason: *when* to scan is
 * a different question from what a scan does, with its own failure modes and
 * its own tests. Every one of those failure modes lives here.
 *
 * ## Opening a note is a trigger, and used not to be
 *
 * Discovery ran on `metadataCache.on("changed")` and `vault.on("create")` —
 * both of which mean *the file was written*. Merely opening a note that already
 * contained an unknown callout produced no event at all, so the row appeared
 * only once the user typed into that note (which is why pasting a callout
 * worked and opening one did not), or when the settings tab happened to run its
 * own open-buffer sweep.
 *
 * That sweep could not stand in for a trigger, because it reads
 * `getLeavesOfType("markdown")` and a leaf holds exactly one *visible* note:
 * opening five notes in one tab and then opening settings discovered the fifth
 * and nothing else — the other four had already been replaced in the only leaf
 * that ever existed. `workspace.on("file-open")` is what makes each of the five
 * its own scan, and the registry is what accumulates them.
 *
 * ## Why an open is not free, and how it is made free anyway
 *
 * A note is opened far more often than it is edited — every tab switch is one —
 * and each scan is a `cachedRead` plus a tokenizer pass. {@link markScanned} is
 * the price of admission for the new trigger: a file already scanned at exactly
 * its current `mtime` cannot have gained a callout since, so re-opening it
 * queues nothing at all.
 *
 * Only opens are deduped. The write paths are left alone deliberately — they
 * are also what schedules the prune, and a memo hit would quietly skip that
 * too.
 */
import { TFile } from "obsidian";
import type { App, EventRef, WorkspaceLeaf } from "obsidian";

/**
 * Why a file was queued.
 *
 * It survives into the scan because it decides one thing there: an edit can
 * have removed the last usage of a row and so is followed by a prune, while an
 * open cannot have removed anything and is not. Without the distinction the new
 * trigger would have put a whole-vault read behind every tab switch.
 */
export type ScanReason = "change" | "open";

/** What the scheduler needs from the plugin. */
export interface SchedulerHost {
	app: App;
	registerEvent(eventRef: EventRef): void;
}

/** The two things the scheduler asks of its owner. */
export interface SchedulerOptions {
	/** Run one scan of `file`. */
	scan(file: TFile, reason: ScanReason): void;
	/**
	 * Whether automatic discovery is switched on right now.
	 *
	 * Asked per queue rather than around the registration, so an inert listener
	 * costs nothing and the toggle takes effect immediately in both directions.
	 */
	enabled(): boolean;
}

/**
 * How many `path → mtime` pairs the open-dedupe memo keeps.
 *
 * It exists to make bouncing between the notes you are working in free, and
 * that is a handful of files rather than a vault's worth. The cap is what stops
 * a long session walking thousands of notes from holding an entry for every one
 * of them — including every note deleted since.
 */
export const SCAN_MEMO_MAX_ENTRIES = 500;

/** The per-file debounce, long enough to outlast a keystroke burst. */
const FILE_SCAN_DELAY_MS = 300;

/** A queued scan: its timer, and why it was queued. */
interface PendingScan {
	id: number;
	reason: ScanReason;
}

export class DiscoveryScheduler {
	/** Pending per-file debounce timers, keyed by path. */
	private readonly timers = new Map<string, PendingScan>();

	/**
	 * `path` → the `mtime` at which a scan of it last ran out of things to
	 * find. Insertion order is recency order, which is what eviction reads.
	 */
	private readonly scanned = new Map<string, number>();

	constructor(
		private readonly host: SchedulerHost,
		private readonly opts: SchedulerOptions,
	) {}

	/**
	 * Subscribe to everything that can bring an unknown callout into view, and
	 * sweep the notes already on screen.
	 *
	 * The sweep is not belt-and-braces. This runs from `onLayoutReady`, which is
	 * *after* the workspace has restored the previous session's tabs — so those
	 * notes' `file-open` events have already been and gone, and without a
	 * catch-up a restored tab is the one note discovery never looks at. Each
	 * swept file goes through the same debounce and the same memo as any other,
	 * so the catch-up costs one cached read per open note, once.
	 */
	registerTriggers(): void {
		const { app } = this.host;
		this.host.registerEvent(
			app.metadataCache.on("changed", (file) => {
				this.queueIfMarkdown(file, "change");
			}),
		);
		this.host.registerEvent(
			app.vault.on("create", (file) => {
				this.queueIfMarkdown(file, "change");
			}),
		);
		this.host.registerEvent(
			app.workspace.on("file-open", (file) => {
				this.queueIfMarkdown(file, "open");
			}),
		);
		for (const leaf of app.workspace.getLeavesOfType("markdown")) {
			this.queueIfMarkdown(this.leafFile(leaf), "open");
		}
	}

	/**
	 * The note a leaf is showing, whether or not its view has been loaded.
	 *
	 * A tab restored from the last session but not yet activated is a **deferred
	 * view** in Obsidian 1.7.2+: it reports as a markdown leaf but carries no
	 * `file`, so reading `view.file` alone skips exactly the tabs the catch-up
	 * exists for. `getViewState()` answers for those — it is serialized state,
	 * which a deferred leaf has by definition — and the path is resolved back to
	 * a handle so the scan gets the same object every other trigger passes.
	 */
	private leafFile(leaf: WorkspaceLeaf): unknown {
		const loaded = (leaf.view as { file?: unknown }).file;
		if (loaded !== undefined) return loaded;
		const state = leaf.getViewState().state as { file?: unknown } | undefined;
		return typeof state?.file === "string"
			? this.host.app.vault.getAbstractFileByPath(state.file)
			: undefined;
	}

	private queueIfMarkdown(file: unknown, reason: ScanReason): void {
		if (file instanceof TFile && file.extension === "md") {
			this.schedule(file, reason);
		}
	}

	/**
	 * Queue a debounced scan of one file.
	 *
	 * A memo hit is dropped here rather than inside the timer, because the point
	 * is for a re-open to cost *nothing* and a queued timer is already a cost
	 * paid on every tab switch.
	 *
	 * When a scan is already queued for the path, `"change"` wins over `"open"`
	 * however the two arrive. Otherwise a note opened within the debounce of
	 * having been written would lose the prune that write is owed.
	 */
	schedule(file: TFile, reason: ScanReason = "change"): void {
		if (!this.opts.enabled()) return;
		const path = file.path;
		const pending = this.timers.get(path);
		if (reason === "open" && pending === undefined && this.isFresh(file)) {
			return;
		}
		if (pending !== undefined) window.clearTimeout(pending.id);
		const effective: ScanReason =
			pending?.reason === "change" ? "change" : reason;
		const id = window.setTimeout(() => {
			this.timers.delete(path);
			this.opts.scan(file, effective);
		}, FILE_SCAN_DELAY_MS);
		this.timers.set(path, { id, reason: effective });
	}

	/** True when `file` has already been scanned at exactly its current mtime. */
	private isFresh(file: TFile): boolean {
		return this.scanned.get(file.path) === file.stat.mtime;
	}

	/**
	 * Record that a scan of `file` finished with nothing left to find at this
	 * `mtime`, so a later *open* of it can be skipped.
	 *
	 * Deleted before it is set so the entry moves to the back of the map: the
	 * eviction below reads insertion order as recency, and a note re-opened
	 * every few minutes must not age out ahead of one opened once.
	 */
	markScanned(file: TFile): void {
		this.scanned.delete(file.path);
		this.scanned.set(file.path, file.stat.mtime);
		if (this.scanned.size > SCAN_MEMO_MAX_ENTRIES) {
			// One entry is added per call, so it can only ever be over by one.
			const [oldest] = this.scanned.keys();
			if (oldest !== undefined) this.scanned.delete(oldest);
		}
	}

	/**
	 * Forget every memo entry.
	 *
	 * Deleting a row suppresses its rediscovery for five seconds and no longer;
	 * afterwards the note still naming it is meant to bring it back. Left
	 * memoized, the open that would have done so is the one open that queues
	 * nothing, and a deletion the user made reads as permanent — which is the
	 * one thing `RediscoveryHold` is careful not to be.
	 */
	forgetScanned(): void {
		this.scanned.clear();
	}

	destroy(): void {
		for (const { id } of this.timers.values()) window.clearTimeout(id);
		this.timers.clear();
	}
}
