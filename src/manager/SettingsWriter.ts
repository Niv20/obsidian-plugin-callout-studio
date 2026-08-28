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
 * **Nothing compared the payload.** See `utils/saveGuard.ts` for what that
 * cost and why the baseline has to be invalidated when someone else writes the
 * file.
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
	 * Forget what we last wrote — the file on disk is someone else's now.
	 *
	 * @see SaveGuard.invalidate
	 */
	invalidate(): void {
		this.guard.invalidate();
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
