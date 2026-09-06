import { tryAdoptExternalSettings } from "./settingsAdopt";
import { registryIsOwned } from "./registryOwnership";
import type { ExternalReloadHost } from "./settingsAdopt";

/** What the queue drives. The plugin, structurally. */
export type ReloadQueueHost = ExternalReloadHost;

/** Deferred scheduling returns its cancellation hook, including on mobile. */
export type ReloadRetryScheduler = (callback: () => void, delayMs: number) => () => void;

const RETRY_DELAYS = [250, 750, 2000];
const scheduleRetry: ReloadRetryScheduler = (callback, delayMs) => {
	const timer = window.setTimeout(callback, delayMs);
	return () => window.clearTimeout(timer);
};

export class ReloadQueue {
	/** The adoption in flight, or null when idle. */
	private inFlight: Promise<void> | null = null;
	/** An unavailable file, an owner, or a conflict can defer adoption. */
	private pending = false;
	private requested = false;
	private destroyed = false;
	private unavailable = false;
	private retryAttempt = 0;
	private cancelRetry: (() => void) | null = null;

	constructor(
		private readonly host: ReloadQueueHost,
		private readonly schedule: ReloadRetryScheduler = scheduleRetry,
	) {}

	/**
	 * Adopt whatever is on disk now, one run at a time.
	 *
	 * A caller arriving mid-flight joins the current drain and requests another
	 * read afterwards, because its event may be newer than the in-flight read.
	 */
	async run(): Promise<void> {
		if (this.destroyed) return;
		this.retryAttempt = 0;
		this.clearRetry();
		return this.request();
	}

	private request(): Promise<void> {
		this.requested = true;
		if (this.inFlight) return this.inFlight;
		this.inFlight = this.drain().then(() => {
			this.inFlight = null;
			// A release can arrive after the drain's last check but before this
			// promise settles. It still owes the caller a fresh read.
			if (this.requested && !this.destroyed) return this.request();
			this.retryUnavailable();
			return undefined;
		});
		return this.inFlight;
	}

	private async drain(): Promise<void> {
		do {
			this.requested = false;
			try {
				const result = await tryAdoptExternalSettings(this.host);
				if (this.destroyed) return;
				this.pending = result !== "applied";
				this.unavailable = result === "unavailable";
			} catch (err) {
				if (this.destroyed) return;
				this.pending = true;
				this.unavailable = false;
				console.error("[callout-studio] could not reload external settings", err);
			}
		} while (this.requested && !this.destroyed);
	}

	/**
	 * A modal may have just handed the registry back — retry a refused reload.
	 *
	 * Safe to call from anywhere and as often as anything likes: it does
	 * nothing unless an adoption is waiting or in flight, and it asks
	 * `registryIsOwned` itself rather than believing the caller.
	 */
	release(): void {
		if (this.destroyed || registryIsOwned(this.host)) return;
		// A save can finish during the recovery backup, before drain() knows
		// the adoption was refused. Remember that wakeup too.
		if (!this.pending && !this.inFlight) return;
		void this.run();
	}

	private retryUnavailable(): void {
		if (this.destroyed || !this.pending || !this.unavailable || registryIsOwned(this.host)) return;
		const delay = RETRY_DELAYS[this.retryAttempt];
		if (delay === undefined) return;
		this.retryAttempt++;
		this.cancelRetry = this.schedule(() => {
			this.cancelRetry = null;
			if (!this.destroyed) void this.request();
		}, delay);
	}

	private clearRetry(): void {
		this.cancelRetry?.();
		this.cancelRetry = null;
	}

	/** Whether an adoption still needs a successful read or an ownership release. */
	get isPending(): boolean {
		return this.pending;
	}

	destroy(): void {
		this.destroyed = true;
		this.requested = false;
		this.pending = false;
		this.clearRetry();
	}

}
