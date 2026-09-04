/**
 * manager/staleWriteGuard.ts — "is `data.json` still the file this session read?"
 *
 * The last question asked before a write lands, and the only defence a device
 * has against destroying settings a sync client delivered while it was not
 * looking.
 *
 * `SaveGuard` cannot answer it. Its baseline records what *we* last wrote or
 * adopted, and the failure it structurally cannot see is somebody else
 * replacing the file in between: our payload is then a snapshot of a registry
 * built from settings that are now stale, and writing it destroys everything
 * the other device did — silently, and in a form the sync client faithfully
 * carries everywhere else.
 *
 * Obsidian's `onExternalSettingsChange` is meant to catch that first, and on a
 * desktop it usually does. It cannot be relied on:
 *
 * - the config-folder watcher behind it is **desktop only** — the mobile
 *   adapter has no `fs.watch`, so a phone reads `data.json` at `onload` and
 *   never hears about it again;
 * - its gate is `_lastDataModifiedTime < stat.mtime`, strictly, and Syncthing
 *   preserves the *source* file's mtime.
 *
 * So on a phone the sequence is simply: launch, read the file, sit in the
 * background while another device rewrites it, come back, change one colour —
 * and the whole settings file is replaced by a two-hour-old snapshot. That is
 * issue #53, and nothing in the freeze/absent machinery touches it, because
 * every read on that path succeeded.
 *
 * ## Why the report is deferred
 *
 * Handing the divergence back inline would deadlock. Adopting rebuilds the
 * registry, a rebuild asks for saves of its own, and `SettingsWriter.hold()`
 * releases with an `await save()` — which, seeing a write in flight, returns a
 * follow-up chained on the very pass awaiting the callback. A closed promise
 * cycle, on exactly the path the check exists for. A macrotask breaks it: by
 * the time the callback runs the pass has returned and the writer is idle.
 * This is the same reasoning that keeps the check from being a `SettingsWriter`
 * pre-write hook at all; see internals-docs/07.
 *
 * Its own module for the reason the rest of `manager/` is: `SettingsWriter`
 * owns coalescing, holding and freezing, and this is a fourth policy with its
 * own failure mode and its own test.
 */

/** What the check needs from the plugin. Both optional — see {@link StaleWriteGuard}. */
export interface StaleWriteHost {
	/**
	 * What `data.json` holds **right now**, normalized exactly the way
	 * `SaveGuard.adopt` wants it, or `null` when there is no readable file.
	 */
	readCurrent?(): Promise<string | null>;
	/**
	 * A write was abandoned because the file on disk is not the one this
	 * session adopted. Called on a later task, never inside the write pass.
	 */
	onStaleWrite?(): void;
}

/** The baseline the incoming file is measured against — `SaveGuard`, in practice. */
export interface WriteBaseline {
	matches(json: string): boolean;
}

export class StaleWriteGuard {
	/**
	 * Whether the current divergence has already been handed on. A stale file
	 * provokes a save from every listener that was going to write, and one
	 * adoption answers all of them.
	 */
	private reported = false;

	constructor(private readonly host: StaleWriteHost) {}

	/**
	 * Whether this host can be checked at all.
	 *
	 * Exposed so `SettingsWriter` can skip {@link blocks} without awaiting it.
	 * That is not a micro-optimization: `runPass` calls `host.write` on its
	 * first synchronous stretch, and callers depend on the write having been
	 * *started* by the time `save()` returns to them. An `await` in front of it
	 * — even one resolving immediately — pushes that to the next microtask and
	 * changes the ordering every existing caller was written against. A host
	 * with nothing to check keeps the exact behaviour it had before this
	 * module existed.
	 */
	get enabled(): boolean {
		return this.host.readCurrent !== undefined;
	}

	/**
	 * Whether this write must be abandoned, reporting the divergence if so.
	 *
	 * Three answers mean "go ahead", and all three are an *absence of
	 * evidence* rather than evidence of absence — this check may only ever
	 * stop a write, never cause one:
	 *
	 * - no `readCurrent`, i.e. a host that is not a plugin. Answered without
	 *   awaiting anything, so a caller that cannot be checked keeps the exact
	 *   task ordering it had before this existed.
	 * - a read that threw. The safety net must not break the operation it was
	 *   only watching.
	 * - no readable file at all. That is `SettingsWriter.freeze()`'s business,
	 *   and refusing here would stop a genuine fresh install ever creating one.
	 *
	 * A baseline of `null` against a file that exists is the failure in its
	 * starkest form — we are about to overwrite a file this session has never
	 * read — and `matches` reports it as a mismatch, which is correct.
	 */
	async blocks(baseline: WriteBaseline): Promise<boolean> {
		if (!this.host.readCurrent) return false;
		let onDisk: string | null;
		try {
			onDisk = await this.host.readCurrent();
		} catch {
			return false;
		}
		if (onDisk === null || baseline.matches(onDisk)) return false;
		this.report();
		return true;
	}

	/** Arm the next divergence again. Called by the write that lands. */
	clear(): void {
		this.reported = false;
	}

	private report(): void {
		if (!this.host.onStaleWrite || this.reported) return;
		this.reported = true;
		window.setTimeout(() => {
			this.host.onStaleWrite?.();
		}, 0);
	}
}
