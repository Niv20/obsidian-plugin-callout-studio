import { SaveGuard } from "../utils/saveGuard";
import { StaleWriteGuard, type StaleWriteHost } from "./staleWriteGuard";

export interface SettingsWriterHost extends StaleWriteHost {

	build(): unknown;

	write(data: unknown): Promise<void>;

	onFrozenSave?(): void;
}

export class SettingsWriter {
	private readonly guard = new SaveGuard();

	private inFlight: Promise<void> | null = null;

	private queued = false;

	private followUp: Promise<void> | null = null;

	private holdDepth = 0;

	private heldRequest = false;

	private frozen = false;

	private frozenNotified = false;

	private readonly stale: StaleWriteGuard;
	private revision = 0;
	private destroyed = false;

	constructor(private readonly host: SettingsWriterHost) {
		this.stale = new StaleWriteGuard(host);
	}

	save(): Promise<void> {
		if (this.destroyed) return Promise.resolve();
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

	adopt(json: string): void {
		this.guard.adopt(json);
		this.revision++;
		this.stale.clear();
	}

	matchesLastWrite(json: string): boolean {
		return this.guard.matches(json);
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

	freeze(): void {
		this.frozen = true;
		this.revision++;
		this.frozenNotified = false;
	}

	thaw(): void {
		this.frozen = false;
	}

	get busy(): boolean {
		return this.inFlight !== null || this.queued;
	}

	get isFrozen(): boolean {
		return this.frozen;
	}

	get isDestroyed(): boolean { return this.destroyed; }

	/** A started adapter write cannot be cancelled, but no later pass may run. */
	destroy(): void {
		this.destroyed = true;
		this.revision++;
		this.stale.destroy();
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
		const payload = this.guard.prepare(data);
		if (this.stale.enabled && await this.stale.blocks(this.guard)) return false;
		if (this.frozen || this.destroyed || revision !== this.revision || !isCurrent()) return false;
		if (payload !== null) {
			await this.host.write(data);
			this.guard.commit(payload);
			this.stale.clear();
		}
		if (this.destroyed) return false;
		publish();
		return true;
	}

	private async runPass(): Promise<void> {
		const revision = this.revision;
		const data = structuredClone(this.host.build());
		const payload = this.guard.prepare(data);
		// Byte-identical to the last write that landed: skip the file event.
		if (payload === null) return;
		// Asked after the guard, never before: a save that changes nothing
		// needs no file read to prove it is harmless. Short-circuited rather
		// than awaited-and-ignored when there is nothing to check — see
		// StaleWriteGuard.enabled.
		if (this.stale.enabled && (await this.stale.blocks(this.guard))) {
			return;
		}
		if (this.frozen || this.destroyed || revision !== this.revision) return;
		await this.host.write(data);
		// Only now — a throw above leaves the baseline where it was, so the
		// next attempt writes rather than being suppressed as a duplicate.
		this.guard.commit(payload);
		this.stale.clear();
	}
}
