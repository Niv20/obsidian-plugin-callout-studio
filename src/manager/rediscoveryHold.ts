/**
 * manager/rediscoveryHold.ts — what automatic discovery is held back from.
 *
 * Discovery's job is to notice `[!something]` in a note and give it a row. Two
 * situations make that the wrong thing to do, and both are "the row's absence
 * is deliberate, and the notes have not caught up yet":
 *
 * - **An explicit delete, seconds ago.** Deleting a callout rewrites its vault
 *   usages with `vault.modify`, but an open editor's CodeMirror buffer catches
 *   up with that asynchronously — and `SettingsTab.display()`, which the delete
 *   calls synchronously on the very next line, scans exactly those buffers for
 *   unknown ids. Without the hold the row is re-created one tick after it was
 *   removed, arriving back as a fresh *uncustomized* fallback row: the user
 *   sees their customized row survive the delete with its styling reset.
 *
 *   Deliberately time-bounded rather than permanent. It answers a race, not a
 *   policy — an id the user genuinely writes again later deserves its row back,
 *   and that is discovery's whole job.
 *
 * - **A callout type the active theme stopped supplying.** That one *is* a
 *   policy and so has no expiry; it lives in the DEVICE-LOCAL store — which
 *   theme is active is a property of this machine, not of the vault — and is
 *   explained in `theme/retiredThemeIds.ts`.
 *
 * Both are dropped by {@link RediscoveryHold.clear}, which a user-requested
 * vault scan calls: the user asking for these rows outranks either reason.
 *
 * Both are also keyed by `calloutIdentity` — one key per callout, never one per
 * spelling. Keying by the space-preserving form made `a b` and `a-b` two
 * separate holds, so deleting a row and then opening a note that spelled it the
 * other way handed the row straight back: the exact resurrection above, one
 * spelling out of reach. Callers still pass every form the row owned
 * (`CalloutRegistry.vaultIdFormsFor`), which costs nothing and keeps the hold
 * right for an alias that is not a dash/space variant of the id.
 */
import { calloutIdentity } from "../utils/calloutId";
import { isRetiredThemeId } from "./theme/retiredThemeIds";
import type { RetiredThemeIdHolder } from "./DeviceLocalStore";

/**
 * How long an explicit delete keeps discovery from re-creating the row it just
 * removed. Only has to outlast the open editors catching up with the vault
 * writes the delete made.
 */
const SUPPRESS_MS = 5000;

export class RediscoveryHold {
	/** Ids an explicit delete just removed → when their hold expires. */
	private readonly deleted = new Map<string, number>();

	constructor(private readonly retired: RetiredThemeIdHolder) {}

	/**
	 * Hold these ids back for the next few seconds. Pass every id form the
	 * deleted row owned (`CalloutRegistry.vaultIdFormsFor`), or a leftover
	 * `[!my-id]` spelling would just create the row back under the dash form.
	 */
	suppress(ids: string[]): void {
		const until = Date.now() + SUPPRESS_MS;
		for (const id of ids) {
			const normalized = calloutIdentity(id);
			if (normalized) this.deleted.set(normalized, until);
		}
	}

	/** Drop every hold, of both kinds. */
	clear(): void {
		this.deleted.clear();
		this.retired.retiredThemeIds = [];
	}

	/** Whether automatic discovery must not create a row for this id. */
	holds(id: string): boolean {
		if (isRetiredThemeId(this.retired.retiredThemeIds, id)) return true;
		const normalized = calloutIdentity(id);
		const until = this.deleted.get(normalized);
		if (until === undefined) return false;
		if (Date.now() < until) return true;
		// Expired. Dropped on read, so the map needs no timer of its own.
		this.deleted.delete(normalized);
		return false;
	}
}
