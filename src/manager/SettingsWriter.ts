import { SettingsSaveStatus, SettingsPersistenceError, settingsWriteReason, type SettingsSaveReason } from "./settingsSaveStatus";
import type { SettingsCheckpointStore } from "./settingsCheckpoint";
import type { SettingsHistoryEntry, SettingsHistoryStore } from "./settingsHistory";
import { canonical, content } from "./syncTree";
import { SettingsSync, type GenesisSource } from "./settingsSync";
import { SaveGuard } from "../utils/saveGuard";
import { StaleWriteGuard, type StaleWriteHost } from "./staleWriteGuard";

export interface SettingsWriterHost extends StaleWriteHost {

	mergeConcurrent?: boolean;
	checkpoint?: SettingsCheckpointStore;
	/** Where every accepted state is recorded on this device; best effort. */
	history?: SettingsHistoryStore;
	/** The shipped defaults. First files diff against them; merges rescue from them. */
	genesis?: GenesisSource;

	build(): unknown;

	write(data: unknown): Promise<void>;

	onFrozenSave?(): void;
	/** The recovery copy fell behind the settings file; see rememberIfPossible(). */
	onCheckpointStale?(): void;
	/** Whether a payload says nothing beyond the shipped defaults. */
	isUntouched?(data: unknown): boolean;
}

export class SettingsWriter {
	readonly status = new SettingsSaveStatus();
	private readonly guard = new SaveGuard();

	private inFlight: Promise<void> | null = null;

	private queued = false;

	private followUp: Promise<void> | null = null;

	private holdDepth = 0;

	private heldRequest = false;

	private frozen = false;

	private frozenNotified = false;

	/** Frozen with `notify: false`: a new install's provisional pause, not news. */
	private quietFreeze = false;

	private readonly stale: StaleWriteGuard;
	private readonly sync: SettingsSync | null;
	private persistedContent: string | null = null;
	private recoveredState = false;
	private checkpointStale = false;
	/** Unloading: see close(). Looks destroyed to everyone else already. */
	private closing = false;
	private revision = 0;
	private destroyed = false;

	constructor(private readonly host: SettingsWriterHost) {
		this.stale = new StaleWriteGuard({ ...host, onBlocked: reason => {
			if (reason === "missing") this.protectMissingFile();
			else this.status.fail(reason);
			host.onBlocked?.(reason);
		} });
		this.sync = host.mergeConcurrent ? new SettingsSync(undefined, host.genesis) : null;
	}

	save(): Promise<void> {
		if (this.destroyed || this.closing) return Promise.resolve();
		// Nothing this session may reach the file — see freeze().
		if (this.frozen) {
			if (!this.frozenNotified) {
				this.frozenNotified = true;
				this.host.onFrozenSave?.();
			}
			return Promise.resolve();
		}
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

	adopt(json: string, diskJson = json): void {
		const data: unknown = JSON.parse(json);
		this.sync?.adopt(data);
		this.guard.adopt(diskJson);
		if (this.sync) this.persistedContent = canonical(content(JSON.parse(diskJson)));
		this.revision++;
		this.stale.clear();
		this.status.clear();
		this.recordAccepted(data);
	}

	/** Device history, never awaited: it must not slow or fail a save. */
	private recordAccepted(data: unknown): void {
		void this.host.history?.record(data);
	}

	matchesLastWrite(json: string, contentOnly = false): boolean {
		return contentOnly && this.sync ? this.persistedContent === canonical(content(JSON.parse(json))) : this.guard.matches(json);
	}

	/**
	 * Whether the settings file now holds `data`: a save's outcome rather than
	 * its promise, which also resolves when nothing was written. Callers that
	 * announce success ask this first.
	 */
	/** What the settings file held when this device last wrote or adopted it; null before then. */
	get lastSaved(): unknown {
		return this.persistedContent === null ? null : JSON.parse(this.persistedContent) as unknown;
	}

	persists(data: unknown): boolean {
		return !this.frozen && !this.destroyed && this.matchesLastWrite(JSON.stringify(data), true);
	}

	/** An unchanged file returning after a transient read failure is healthy again. */
	confirmUnchangedRead(json: string): void {
		if (this.frozen || !this.matchesLastWrite(json) ||
			!["missing", "unreadable", "changed"].includes(this.status.failure ?? "")) return;
		this.stale.clear(); this.status.clear();
	}

	get hasCheckpoint(): boolean { return this.host.checkpoint !== undefined; }
	get mergesConcurrent(): boolean { return this.sync !== null; }
	get hasRecoveryState(): boolean { return this.guard.hasBaseline || this.recoveredState; }

	/** A local recovery copy carries sync clocks, but is not a file baseline. */
	seedRecovery(data: unknown): void {
		this.sync?.adopt(data);
		this.recoveredState = true;
	}

	/** Runtime disappearance must offer the same recovery as missing-file boot. */
	protectMissingFile(): void {
		// A missing primary must not authorize replacing unreadable recovery
		// storage or a snapshot from a newer build.
		if (this.status.frozenReason === "newer-version") return;
		if (!this.frozen || (this.status.frozenReason !== "missing" && this.status.frozenReason !== "recovery-read")) this.freeze("missing");
		else this.status.fail("missing");
	}

	async recoveryCopy(): Promise<unknown> {
		try { return await this.host.checkpoint?.read() ?? null; }
		catch (error) { this.status.fail("recovery-read"); throw new SettingsPersistenceError("recovery-read", error); }
	}

	/** The recovery copy as stored, valid or not; `undefined` when the store cannot say. */
	async recoveryCopyRaw(): Promise<unknown> {
		return this.host.checkpoint?.readRaw ? await this.host.checkpoint.readRaw() : undefined;
	}

	/** This device's history of accepted states, newest first; empty without one. */
	historyEntries(): Promise<SettingsHistoryEntry[]> {
		return this.host.history?.list() ?? Promise.resolve([]);
	}

	async remember(data: unknown): Promise<void> {
		try { await this.host.checkpoint?.write(data); }
		catch (error) { this.status.fail("recovery-write"); throw new SettingsPersistenceError("recovery-write", error); }
	}

	/**
	 * Bring this device's recovery copy up to `data` when storage allows.
	 *
	 * Never a reason not to write the settings file. The copy is merged as one
	 * more replica, so a copy that lags only offers older stamps that lose;
	 * blocking on it turned every iOS storage hiccup into "nothing saves", with
	 * the edits left in memory for the next app kill to discard. A failure is
	 * reported once, logged, and retried by every later save until it succeeds.
	 */
	async rememberIfPossible(data: unknown): Promise<boolean> {
		if (!this.host.checkpoint) return true;
		try { await this.host.checkpoint.write(data); }
		catch (error) {
			console.warn("[callout-studio] the device recovery copy could not be updated", error);
			if (!this.checkpointStale) {
				this.checkpointStale = true;
				this.host.onCheckpointStale?.();
			}
			return false;
		}
		this.checkpointStale = false;
		return true;
	}

	private async write(data: unknown): Promise<void> {
		try { await this.host.write(data); }
		catch (error) {
			// An adapter can finish the replacement and then reject. Confirm the
			// exact payload before retrying, rather than treating our own file as sync.
			try {
				const current = await this.host.readCurrent?.();
				if (current != null && canonical(JSON.parse(current)) === canonical(data)) return;
			} catch { /* The original failure remains the useful diagnostic. */ }
			const reason = error instanceof SettingsPersistenceError ? error.reason : settingsWriteReason(error);
			this.status.fail(reason); throw new SettingsPersistenceError(reason, error);
		}
	}

	recover(incoming: unknown, saved: unknown): unknown {
		if (!this.sync) return incoming;
		const recovering = new SettingsSync(undefined, this.host.genesis);
		recovering.adopt(saved);
		return recovering.merge(incoming, saved);
	}

	/**
	 * `data` with sync history consistent with it, for storage outside the
	 * primary file. A registry snapshot carries no envelope of its own, and one
	 * without history would lose this device's deletion tombstones.
	 */
	stamped(data: unknown): unknown {
		return this.sync?.prepare(structuredClone(data)) ?? data;
	}

	mergeExternal(incoming: unknown, local: unknown, conflicts: unknown[] = []): unknown {
		let merged = this.sync?.merge(incoming, local) ?? incoming;
		if (!this.sync) return merged;
		const joining = new SettingsSync(undefined, this.host.genesis);
		for (const conflict of conflicts) {
			// An unstamped recovery copy is an older baseline, not a new
			// external edit. Reversing these operands lets that old copy undo
			// an incoming legacy file, including deleting its newly added rows.
			joining.adopt(conflict);
			merged = joining.merge(merged, conflict);
		}
		return merged;
	}

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
	 * Stop every write this session. `notify: false` is for the provisional
	 * freeze of a launch that may be fresh: a background save meeting it is not
	 * a lost change, and "the settings file is missing" is the wrong thing to
	 * tell someone who has never had one.
	 */
	freeze(reason: SettingsSaveReason = "unreadable", notify = true): void {
		this.frozen = true;
		this.quietFreeze = !notify;
		this.revision++;
		this.frozenNotified = !notify;
		this.status.freeze(reason);
	}

	thaw(): void {
		this.frozen = false;
		this.status.thaw();
	}

	get busy(): boolean {
		return this.inFlight !== null || this.queued;
	}

	get isFrozen(): boolean {
		return this.frozen;
	}

	/** Paused in a way the user must be able to see: every freeze but a new install's. */
	get isVisiblyPaused(): boolean {
		return this.frozen && !this.quietFreeze;
	}

	get isDestroyed(): boolean { return this.destroyed || this.closing; }

	/**
	 * Explicit restoration only. Keep the ordinary disk baseline and freeze
	 * intact until a physical write succeeds; a failed attempt grants no later
	 * background write permission. The temporary baseline requires absence,
	 * even when the returned file would equal our old baseline.
	 */
	restoreMissing(isCurrent: () => boolean, preserve: () => Promise<boolean>): Promise<boolean> {
		const absent = new SaveGuard();
		return this.replace("missing", isCurrent, preserve, async () => !await this.stale.blocks(absent));
	}

	/**
	 * Explicit replacement of a file that cannot be read, from what is displayed.
	 * `unchanged` must read the file's bytes again and compare them with the
	 * bytes the user decided about: a file that changed since, even to one that
	 * reads, goes back to ordinary adoption instead.
	 */
	replaceUnreadable(isCurrent: () => boolean, preserve: () => Promise<boolean>, unchanged: () => Promise<boolean>): Promise<boolean> {
		return this.replace("unreadable", isCurrent, preserve, unchanged);
	}

	private replace(
		reason: "missing" | "unreadable", isCurrent: () => boolean,
		preserve: () => Promise<boolean>, unchanged: () => Promise<boolean>,
	): Promise<boolean> {
		if (this.busy || this.holdDepth > 0 || this.destroyed || this.status.frozenReason !== reason) return Promise.resolve(false);
		const task = this.replacePass(reason, isCurrent, preserve, unchanged);
		this.inFlight = task.then(() => undefined).finally(() => { this.inFlight = null; });
		void this.inFlight.catch(() => undefined);
		return this.inFlight.then(() => task);
	}

	private async replacePass(
		reason: "missing" | "unreadable", isCurrent: () => boolean,
		preserve: () => Promise<boolean>, unchanged: () => Promise<boolean>,
	): Promise<boolean> {
		const revision = this.revision;
		const current = () => !this.destroyed && this.status.frozenReason === reason &&
			revision === this.revision && isCurrent();
		if (!current() || !this.stale.enabled) return false;
		let data = structuredClone(this.host.build());
		data = this.sync?.prepare(data) ?? data;
		// No baseline: always a payload, even one equal to the old file.
		const payload = new SaveGuard().prepare(data)!;
		if (!await unchanged() || !current()) return false;
		if (!await preserve() || !current()) return false;
		if (this.host.checkpoint) await this.rememberIfPossible(data);
		if (!current() || !await unchanged() || !current()) return false;
		await this.write(data);
		if (this.destroyed) return false;
		this.guard.commit(payload);
		this.sync?.adopt(data);
		if (this.sync) this.persistedContent = canonical(content(data));
		this.revision++;
		this.stale.clear();
		this.thaw();
		this.recordAccepted(data);
		return true;
	}

	/**
	 * Unload without dropping the last change. `onunload` cannot wait, and
	 * destroying at once cancelled the pass carrying a change made a moment
	 * before closing. Instead: refuse new saves and look destroyed to everyone
	 * else straight away, let a write already under way finish, write once more
	 * if the settings changed since, then destroy.
	 */
	close(): void {
		if (this.destroyed || this.closing) return;
		this.closing = true;
		const inFlight = this.inFlight;
		void (async () => {
			try { await inFlight; } catch { /* Its own caller reported it. */ }
			try { if (!this.frozen && this.holdDepth === 0) await this.runPass(); }
			catch (error) { console.warn("[callout-studio] the last settings change before closing was not saved", error); }
			this.destroy();
		})();
	}

	/** A started adapter write cannot be cancelled, but no later pass may run. */
	destroy(): void {
		this.destroyed = true;
		this.revision++;
		this.stale.destroy();
		this.status.destroy();
	}

	/** Save an isolated manual change and publish it only after persistence succeeds. */
	commit(data: unknown, isCurrent: () => boolean, publish: () => void): Promise<boolean> {
		if (this.busy || this.holdDepth > 0 || this.frozen || this.destroyed) return Promise.resolve(false);
		const task = this.commitPass(data, isCurrent, publish);
		this.inFlight = task.then(() => undefined).finally(() => { this.inFlight = null; });
		// The caller owns failures. Keep the internal serialization promise handled too.
		void this.inFlight.catch(() => undefined);
		return task;
	}

	private async commitPass(data: unknown, isCurrent: () => boolean, publish: () => void): Promise<boolean> {
		const revision = this.revision;
		data = this.sync?.prepare(data) ?? data;
		const payload = this.guard.prepare(data);
		if (this.stale.enabled && await this.stale.blocks(this.guard)) return false;
		if (this.frozen || this.destroyed || revision !== this.revision || !isCurrent()) return false;
		if (payload !== null) {
			if (this.host.checkpoint) {
				// A staged candidate is not an accepted edit until its final
				// cancellation check passes. Preflight storage with current state.
				const accepted = structuredClone(this.host.build());
				await this.rememberIfPossible(this.sync?.prepare(accepted) ?? accepted);
			}
			if (this.frozen || this.destroyed || revision !== this.revision || !isCurrent()) return false;
			if (this.host.checkpoint && this.stale.enabled && await this.stale.blocks(this.guard)) return false;
			if (this.frozen || this.destroyed || revision !== this.revision || !isCurrent()) return false;
			await this.write(data);
			this.guard.commit(payload);
			this.sync?.adopt(data);
			if (this.sync) this.persistedContent = canonical(content(data));
			this.stale.clear();
			this.status.clear();
			this.recordAccepted(data);
		}
		if (this.destroyed) return false;
		publish();
		// Published whether or not the recovery copy can follow it.
		if (payload !== null && this.host.checkpoint) await this.rememberIfPossible(data);
		return true;
	}

	private async runPass(): Promise<void> {
		const revision = this.revision;
		let data = structuredClone(this.host.build());
		data = this.sync?.prepare(data) ?? data;
		const payload = this.guard.prepare(data);
		// Byte-identical to the last write that landed: skip the file event.
		if (payload === null) {
			// A prior commit may have saved the primary file but failed its final
			// checkpoint. An unchanged Save must still retry that failed step.
			if (this.status.failure === "recovery-write") {
				await this.remember(data);
				this.status.clear();
			} else if (this.checkpointStale) await this.rememberIfPossible(data);
			return;
		}
		// A device that has never had a settings file creates one only for a
		// real edit. Onboarding flags, picker memory and derived artwork change
		// by themselves, and a file of shipped defaults written before the
		// synced one arrives would outrank everyone's settings.
		if (!this.guard.hasBaseline && !this.recoveredState && this.host.isUntouched?.(data)) return;
		// Asked after the guard, never before: a save that changes nothing
		// needs no file read to prove it is harmless. Short-circuited rather
		// than awaited-and-ignored when there is nothing to check — see
		// StaleWriteGuard.enabled.
		if (this.stale.enabled && (await this.stale.blocks(this.guard))) {
			return;
		}
		if (this.frozen || this.destroyed || revision !== this.revision) return;
		if (this.host.checkpoint) await this.rememberIfPossible(data);
		if (this.frozen || this.destroyed || revision !== this.revision) return;
		if (this.host.checkpoint && this.stale.enabled && await this.stale.blocks(this.guard)) return;
		if (this.frozen || this.destroyed || revision !== this.revision) return;
		await this.write(data);
		// Only now — a throw above leaves the baseline where it was, so the
		// next attempt writes rather than being suppressed as a duplicate.
		this.guard.commit(payload);
		this.sync?.adopt(data);
		if (this.sync) this.persistedContent = canonical(content(data));
		this.stale.clear();
		this.status.clear();
		this.recordAccepted(data);
	}
}
