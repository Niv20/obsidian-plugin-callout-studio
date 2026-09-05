/**
 * manager/reloadQueue.ts — when a `data.json` somebody else wrote gets adopted,
 * and what happens to one that could not be adopted yet.
 *
 * `adoptExternalSettings` is reachable from three places that know nothing
 * about each other — Obsidian's config watcher, the foreground check on a
 * phone, and the retry that runs when a modal hands the registry back — and it
 * rebuilds the whole registry. Two properties have to hold across all three,
 * and neither was structural before this class:
 *
 * ## One adoption at a time
 *
 * `onExternalSettingsChange` is `async`, and one of its callers does not await
 * it. Two overlapping runs interleave their `registry.load()` calls around the
 * awaits inside them — clearing the map twice, merging two files' rows into one
 * another, and publishing whichever half-built state the shared `hold()`
 * happens to release. The file that loses is not the older one; it is whichever
 * finished first. Serializing costs nothing: a second change arriving mid-flight
 * has to be re-read anyway.
 *
 * ## A deferred adoption is not a dropped one
 *
 * A reload is refused while a modal owns the registry — rebuilding under the
 * callout editor would change the row being edited. The refusal is recorded and
 * retried later, and *later* used to mean exactly one thing: `pruneSuspended`
 * going false. That flag is only half of what `registryIsOwned` asks about; the
 * other half is `registry.hasPreviewDefinition()`. Today the two always move
 * together, by the convention `settings/previewOwnership.ts` documents and the
 * callout editor follows — but a latch whose only release depends on two call
 * sites keeping their order is a latch that will eventually stick, and a stuck
 * one means the device silently stops adopting settings for the rest of the
 * session. So both seams release it, and the release re-asks
 * `registryIsOwned` rather than trusting the caller's reason for calling.
 */
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

	constructor(private readonly host: ReloadQueueHost) {}

	/**
	 * Adopt whatever is on disk now, one run at a time.
	 *
	 * A caller arriving mid-flight joins the run already going rather than
	 * starting a second one, and rather than queueing a third behind it: the
	 * run it joins re-reads the file when it gets there, so it necessarily sees
	 * everything that had landed by then.
	 */
	async run(): Promise<void> {
		if (this.inFlight) {
			await this.inFlight;
			return;
		}
		this.inFlight = this.adopt().finally(() => {
			this.inFlight = null;
		});
		await this.inFlight;
	}

	/**
	 * A modal may have just handed the registry back — retry a refused reload.
	 *
	 * Safe to call from anywhere and as often as anything likes: it does
	 * nothing unless an adoption is actually waiting, and it asks
	 * `registryIsOwned` itself rather than believing the caller.
	 */
	release(): void {
		if (!this.pending || registryIsOwned(this.host)) return;
		void this.run();
	}

	/** Whether an adoption is waiting for a modal to close. */
	get isPending(): boolean {
		return this.pending;
	}

	private async adopt(): Promise<void> {
		this.pending = await adoptExternalSettings(this.host);
	}
}
