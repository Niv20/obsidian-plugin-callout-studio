/**
 * manager/SettingsWriter.ts — the one place `data.json` is written.
 *
 * `saveSettings()` used to be two lines: build a whole-registry snapshot, hand
 * it to `saveData`. Two properties of that were load bearing in the wrong
 * direction, and issue #41 is what they add up to on a synced vault.
 *
 * **Nothing serialized the writes.** Most callers are `void saveSettings()`,
 * so two of them could be in flight at once, each holding a snapshot taken at
 * a different moment, and the file was left to whichever finished last. The
 * codebase worked around that by ordering its listeners (`main.ts` subscribes
 * the custom-command sweep before the save listener so both snapshots match);
 * that ordering is no longer load bearing, because a queued pass here rebuilds
 * the payload at write time rather than replaying a stale one.
 *
 * **Nothing compared the payload.** See `utils/saveGuard.ts` for what that cost,
 * and for why an external change now *re-seeds* the baseline rather than
 * clearing it — clearing it is what turned a synced vault into two devices
 * rewriting `data.json` at each other without end.
 *
 * On top of the guard this class owns two policies of its own, both of which
 * exist so that a reload cannot publish something the user did not ask for:
 * {@link hold}, which collapses every save a whole reload provokes into one
 * pass that runs after it, and {@link freeze}, which takes the file off the
 * table entirely for a session that could not read it.
 *
 * Its own module, and structurally typed, so the policy can be tested without
 * a plugin: `build` is `registry.toSaveData()` and `write` is `plugin.saveData`.
 */
import { SaveGuard } from "../utils/saveGuard";

/** The two things the writer needs from the plugin. */
export interface SettingsWriterHost {
	/** A fresh whole-registry snapshot. Called at write time, never earlier. */
	build(): unknown;
	/** Obsidian's `Plugin.saveData`. */
	write(data: unknown): Promise<void>;
}

export class SettingsWriter {
	private readonly guard = new SaveGuard();
	/** The pass currently writing, or null when idle. */
	private inFlight: Promise<void> | null = null;
	/** Whether a save was asked for while `inFlight` was running. */
	private queued = false;
	/** The promise every caller that arrived during `inFlight` is waiting on. */
	private followUp: Promise<void> | null = null;
	/** Depth of nested {@link hold} calls; > 0 means saves are being collected. */
	private holdDepth = 0;
	/** Whether a save was asked for while held. */
	private heldRequest = false;
	/** @see freeze */
	private frozen = false;

	constructor(private readonly host: SettingsWriterHost) {}

	/**
	 * Persist the current settings, coalescing concurrent requests.
	 *
	 * A call made while a write is in flight does not start a second write and
	 * does not queue a third: it joins one follow-up pass that runs after the
	 * current one and builds its payload then. So any number of mutations
	 * during a write collapse into exactly one more write, carrying the final
	 * state rather than whichever snapshot happened to be taken last.
	 */
	save(): Promise<void> {
		// Nothing this session may reach the file — see freeze().
		if (this.frozen) return Promise.resolve();
		if (this.holdDepth > 0) {
			// Collapsed into the single pass hold() runs on release, which
			// builds its payload then, so no half-rebuilt intermediate state is
			// ever published. This resolves before that write lands; every
			// caller that can reach it is inside the body hold() is awaiting,
			// so none of them can observe the difference.
			this.heldRequest = true;
			return Promise.resolve();
		}
		if (this.inFlight === null) {
			this.inFlight = this.runPass().finally(() => {
				this.inFlight = null;
			});
			return this.inFlight;
		}
		this.queued = true;
		this.followUp ??= this.inFlight
			// A failed write must not cancel the follow-up: the state it was
			// going to persist is still unsaved either way.
			.catch(() => undefined)
			.then(() => {
				this.queued = false;
				this.followUp = null;
				return this.save();
			});
		return this.followUp;
	}

	/**
	 * Record the file someone else wrote, as we have just read it back, so a
	 * save that would merely reproduce it is suppressed.
	 *
	 * @see SaveGuard.adopt for what to pass and why it is not the raw file text
	 */
	adopt(json: string): void {
		this.guard.adopt(json);
	}

	/**
	 * Whether `json` is exactly what `data.json` is believed to hold — i.e.
	 * whether an incoming file is one of our own writes coming back.
	 *
	 * @see SaveGuard.matches
	 */
	matchesLastWrite(json: string): boolean {
		return this.guard.matches(json);
	}

	/**
	 * Run `body` with saves collected rather than performed, then perform at
	 * most one of them.
	 *
	 * A reload is not one mutation. It clears the callout map, re-seeds the
	 * built-ins, merges the incoming rows, restores this device's discovered
	 * rows, re-derives the theme's overlay and re-syncs the custom commands —
	 * and several of those steps ask for a save on their way past, each from a
	 * fire-and-forget `void saveSettings()`. Left alone, whichever won the race
	 * could publish an *intermediate* state: most sharply the window after the
	 * map was cleared and before the theme's rows were swept back, in which
	 * every theme-owned custom command looks orphaned.
	 *
	 * Holding makes "a reload writes at most once, and only what it settled on"
	 * a property of the code rather than of the order the listeners happen to
	 * run in. Re-entrant, and modelled on `CalloutRegistry.batch` — the same
	 * shape for the same reason, one level down.
	 */
	async hold<T>(body: () => Promise<T>): Promise<T> {
		this.holdDepth++;
		let completed = false;
		try {
			const result = await body();
			completed = true;
			return result;
		} finally {
			this.holdDepth--;
			if (this.holdDepth === 0) {
				const wanted = this.heldRequest;
				this.heldRequest = false;
				// Only flush a hold that ran to completion. A body that threw
				// may have left the registry half-rebuilt, and writing that
				// over the file it was being rebuilt from is the one outcome
				// worse than not writing at all.
				if (wanted && completed) await this.save();
			}
		}
	}

	/**
	 * Stop writing `data.json` for the rest of the session.
	 *
	 * For the one case where the file exists but could not be read: the
	 * in-memory registry is then built from nothing and describes none of the
	 * user's callouts, so every save it could produce would replace a file we
	 * failed to understand with one we know to be wrong. There is no recovering
	 * from that, and no undo — so the session goes read-only and the user is
	 * told to reload. See `manager/settingsFile.ts`.
	 */
	freeze(): void {
		this.frozen = true;
	}

	/**
	 * Lift a {@link freeze}, on the user's explicit say-so and nothing else.
	 *
	 * A freeze is a guess — a well-founded one, but a guess — that the file it
	 * could not find or read is coming back. When it is not coming back, because
	 * the user deleted `data.json` themselves to start over, that guess would
	 * otherwise stand for every launch from here on and quietly discard
	 * everything they did next. So the notice announcing a freeze carries the way
	 * out of it, and this is what that button calls. Nothing automatic reaches
	 * it; that is the whole point. See `manager/settingsNotices.ts`.
	 */
	thaw(): void {
		this.frozen = false;
	}

	/** Whether a save is currently in flight or queued behind one. */
	get busy(): boolean {
		return this.inFlight !== null || this.queued;
	}

	private async runPass(): Promise<void> {
		const data = this.host.build();
		const payload = this.guard.prepare(data);
		// Byte-identical to the last write that landed: skip the file event.
		if (payload === null) return;
		await this.host.write(data);
		// Only now — a throw above leaves the baseline where it was, so the
		// next attempt writes rather than being suppressed as a duplicate.
		this.guard.commit(payload);
	}
}
