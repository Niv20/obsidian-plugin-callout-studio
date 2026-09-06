import type { SettingsCheckpointStore } from "./settingsCheckpoint";
import { canonical, content } from "./syncTree";
import { SettingsSync } from "./settingsSync";
import { SaveGuard } from "../utils/saveGuard";
import { StaleWriteGuard, type StaleWriteHost } from "./staleWriteGuard";

export interface SettingsWriterHost extends StaleWriteHost {

	mergeConcurrent?: boolean;
	checkpoint?: SettingsCheckpointStore;

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
	private readonly sync: SettingsSync | null;
	private persistedContent: string | null = null;
	private revision = 0;
	private destroyed = false;

	constructor(private readonly host: SettingsWriterHost) {
		this.stale = new StaleWriteGuard(host);
		this.sync = host.mergeConcurrent ? new SettingsSync() : null;
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

	adopt(json: string, diskJson = json): void {
		this.sync?.adopt(JSON.parse(json));
		this.guard.adopt(diskJson);
		if (this.sync) this.persistedContent = canonical(content(JSON.parse(diskJson)));
		this.revision++;
		this.stale.clear();
	}

	matchesLastWrite(json: string, contentOnly = false): boolean {
		return contentOnly && this.sync ? this.persistedContent === canonical(content(JSON.parse(json))) : this.guard.matches(json);
	}

	get hasCheckpoint(): boolean { return this.host.checkpoint !== undefined; }
	get mergesConcurrent(): boolean { return this.sync !== null; }

	async recoveryCopy(): Promise<unknown> {
		return await this.host.checkpoint?.read() ?? null;
	}

	async remember(data: unknown): Promise<void> { await this.host.checkpoint?.write(data); }

	recover(incoming: unknown, saved: unknown): unknown {
		if (!this.sync) return incoming;
		const recovering = new SettingsSync();
		recovering.adopt(saved);
		return recovering.merge(incoming, saved);
	}

	mergeExternal(incoming: unknown, local: unknown, conflicts: unknown[] = []): unknown {
		let merged = this.sync?.merge(incoming, local) ?? incoming;
		if (!this.sync) return merged;
		const joining = new SettingsSync();
		for (const conflict of conflicts) {
			joining.adopt(merged);
			merged = joining.merge(conflict, merged);
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
		data = this.sync?.prepare(data) ?? data;
		const payload = this.guard.prepare(data);
		if (this.stale.enabled && await this.stale.blocks(this.guard)) return false;
		if (this.frozen || this.destroyed || revision !== this.revision || !isCurrent()) return false;
		if (payload !== null) {
			if (this.host.checkpoint) {
				// A staged candidate is not an accepted edit until its final
				// cancellation check passes. Preflight storage with current state.
				const accepted = structuredClone(this.host.build());
				await this.remember(this.sync?.prepare(accepted) ?? accepted);
			}
			if (this.frozen || this.destroyed || revision !== this.revision || !isCurrent()) return false;
			if (this.host.checkpoint && this.stale.enabled && await this.stale.blocks(this.guard)) return false;
			if (this.frozen || this.destroyed || revision !== this.revision || !isCurrent()) return false;
			await this.host.write(data);
			this.guard.commit(payload);
			this.sync?.adopt(data);
			if (this.sync) this.persistedContent = canonical(content(data));
			this.stale.clear();
		}
		if (this.destroyed) return false;
		publish();
		// Publish the successful file write even if this final checkpoint fails.
		if (payload !== null && this.host.checkpoint) await this.remember(data);
		return true;
	}

	private async runPass(): Promise<void> {
		const revision = this.revision;
		let data = structuredClone(this.host.build());
		data = this.sync?.prepare(data) ?? data;
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
		if (this.host.checkpoint) await this.remember(data);
		if (this.frozen || this.destroyed || revision !== this.revision) return;
		if (this.host.checkpoint && this.stale.enabled && await this.stale.blocks(this.guard)) return;
		if (this.frozen || this.destroyed || revision !== this.revision) return;
		await this.host.write(data);
		// Only now — a throw above leaves the baseline where it was, so the
		// next attempt writes rather than being suppressed as a duplicate.
		this.guard.commit(payload);
		this.sync?.adopt(data);
		if (this.sync) this.persistedContent = canonical(content(data));
		this.stale.clear();
	}
}
