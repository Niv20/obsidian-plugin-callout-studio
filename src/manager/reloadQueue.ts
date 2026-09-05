import { adoptExternalSettings } from "./settingsAdopt";
import { registryIsOwned } from "./registryOwnership";
import type { ExternalReloadHost } from "./settingsAdopt";

/** What the queue drives. The plugin, structurally. */
export type ReloadQueueHost = ExternalReloadHost;

export class ReloadQueue {
	/** The adoption in flight, or null when idle. */
	private inFlight: Promise<void> | null = null;
	/** Whether an adoption was refused because a modal held the registry. */
	private pending = false;
	private requested = false;
	private destroyed = false;

	constructor(private readonly host: ReloadQueueHost) {}

	/**
	 * Adopt whatever is on disk now, one run at a time.
	 *
	 * A caller arriving mid-flight joins the current drain and requests another
	 * read afterwards, because its event may be newer than the in-flight read.
	 */
	async run(): Promise<void> {
		if (this.destroyed) return;
		this.requested = true;
		if (this.inFlight) return this.inFlight;
		this.inFlight = this.drain().finally(() => { this.inFlight = null; });
		return this.inFlight;
	}

	private async drain(): Promise<void> {
		do {
			this.requested = false;
			try {
				this.pending = await adoptExternalSettings(this.host);
			} catch (err) {
				this.pending = true;
				console.error("[callout-studio] could not reload external settings", err);
			}
		} while (this.requested && !this.destroyed);
	}

	/**
	 * A modal may have just handed the registry back — retry a refused reload.
	 *
	 * Safe to call from anywhere and as often as anything likes: it does
	 * nothing unless an adoption is actually waiting, and it asks
	 * `registryIsOwned` itself rather than believing the caller.
	 */
	release(): void {
		if (this.destroyed || !this.pending || registryIsOwned(this.host)) return;
		void this.run();
	}

	/** Whether an adoption is waiting for a modal to close. */
	get isPending(): boolean {
		return this.pending;
	}

	destroy(): void {
		this.destroyed = true;
		this.requested = false;
		this.pending = false;
	}

}
