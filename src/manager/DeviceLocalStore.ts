/**
 * manager/DeviceLocalStore.ts — the state that must NOT travel between devices.
 *
 * `data.json` syncs, and everything in it is treated as the user's
 * configuration. Some of what lives there is not configuration at all but an
 * **observation this machine made** — above all the set of callout ids
 * automatic discovery has seen written in the vault. Persisting an observation
 * as configuration is what made issue #41 possible: a second device opened a
 * synced note, discovered an id it had never heard of, wrote its own
 * fallback-styled record for it, and the sync client was suddenly reconciling
 * two devices that had both modified the settings file seconds apart.
 *
 * The fix is not to stop remembering — a discovered row must survive a restart
 * without re-reading every note in the vault — but to remember it **somewhere
 * that cannot conflict**. `localStorage` is the only store that qualifies: it
 * is per device, so two devices can never disagree about it in a file, and it
 * is a cache of a vault-derived fact, so both devices reach the same answer on
 * their own from notes that *do* sync. Losing it costs one background scan.
 *
 * The same key convention as `StartupStyleCache`, and for the same reason:
 * `App.loadLocalStorage` needs Obsidian 1.8.7 while `minAppVersion` is lower.
 *
 * Only ids are kept, never a style. What a discovered callout looks like is
 * resolved from the current fallback at load time by `buildDiscoveredRow` —
 * the same function discovery itself uses — so the two can never drift, and a
 * fallback the user changes on one device does not have to be re-synced onto
 * every placeholder row.
 */
import type { App } from "obsidian";
import type { CalloutListsFoldState } from "../types";
import { calloutIdentity, mergeDashSpaceVariants } from "../utils/calloutId";
import { WriteMemo } from "../utils/writeMemo";
import {
	recordRetiredThemeIds,
	sanitizeRetiredThemeIds,
} from "./theme/retiredThemeIds";

const LOCAL_STORAGE_KEY = "callout-studio-local";

/** Everything this device knows and no other device should be told. */
export interface DeviceLocalState {
	v: 1;
	/**
	 * Callout ids automatic discovery has seen in this vault's notes, in the
	 * space-preserving `normalizeCalloutId` spelling the scanner produces —
	 * deduped by `calloutIdentity`, so `a b` and `a-b` are one entry.
	 */
	discovered: string[];
	/**
	 * Whether the one-time post-install vault scan has run **on this device**.
	 *
	 * It used to live in `data.json` and therefore synced, which made it a
	 * claim about a vault rather than about a machine — so a second device
	 * inherited "already scanned" without ever having scanned, and importing a
	 * profile where it was `true` suppressed that device's own first run
	 * permanently. Here it means what it says, and it doubles as the answer to
	 * "does this device have an index yet": a machine whose storage was cleared
	 * runs the first-run flow again, with its size threshold and its consent
	 * modal, and comes out of it with a rebuilt index.
	 */
	firstRunCompleted: boolean;
	/**
	 * Callout ids the active theme used to supply and no longer does.
	 *
	 * Per device for the reason the whole list is: which theme is active is a
	 * property of *this* machine — a phone routinely runs a different one — so
	 * a synced copy had two devices rewriting the same array in the same file
	 * from opposite answers. It also stops meaning anything on a device that
	 * never ran the theme that retired the id.
	 *
	 * Ids are held in `calloutIdentity` form; see `theme/retiredThemeIds.ts`
	 * for the policy and the cap.
	 */
	retiredThemeIds: string[];
	/**
	 * Whether each of the settings tab's four collapsible sections is expanded.
	 *
	 * Pure per-device UI state, and it used to live in `data.json`: folding a
	 * section away rewrote the synced settings file, which on a synced vault is
	 * a file event for the sync client to reconcile. What is folded on a phone
	 * has nothing to say to a desktop.
	 */
	listsExpanded: CalloutListsFoldState;
}

const EMPTY: DeviceLocalState = {
	v: 1,
	discovered: [],
	firstRunCompleted: false,
	retiredThemeIds: [],
	listsExpanded: { theme: true, user: true, builtin: true, palettes: true },
};

/**
 * The one field `RediscoveryHold` and the theme sweep read and write, named so
 * they can take the store without taking all of it.
 */
export interface RetiredThemeIdHolder {
	retiredThemeIds: string[];
}

export class DeviceLocalStore {
	private state: DeviceLocalState;
	/**
	 * Whether this device has an index — read back at construction, or written
	 * since. Not `readonly`: the startup pass writes one on the launch that
	 * migrates a vault over, and that launch must not also count as "never
	 * indexed here".
	 */
	private indexed: boolean;
	/**
	 * What the stored blob is believed to hold — dedupes the writes discovery
	 * repeats. See utils/writeMemo.ts for why it only moves after a write
	 * lands, and why reading a store back counts as learning the same thing.
	 */
	private readonly memo = new WriteMemo();

	constructor(private readonly app: App) {
		const raw = this.read();
		this.indexed = raw !== null;
		this.state = raw ?? structuredClone(EMPTY);
		// Seed the memo from what is already stored, so the startup pass
		// re-asserting an unchanged index costs no write at all.
		if (raw !== null) this.memo.adopt(JSON.stringify(this.state));
	}

	/**
	 * True when this device has a discovery index of its own.
	 *
	 * `false` means "never scanned here, or storage was cleared" — which is not
	 * the same as "scanned and found nothing", and is what the startup recovery
	 * pass keys on. Without the distinction, a vault that genuinely uses no
	 * custom callouts would re-scan on every single launch.
	 */
	get hasIndex(): boolean {
		return this.indexed;
	}

	/** The ids to rebuild fallback rows from, in insertion order. */
	get discovered(): readonly string[] {
		return this.state.discovered;
	}

	/** @see DeviceLocalState.retiredThemeIds */
	get retiredThemeIds(): string[] {
		return this.state.retiredThemeIds;
	}
	set retiredThemeIds(ids: string[]) {
		this.state = { ...this.state, retiredThemeIds: ids };
		this.persist();
	}

	/** @see DeviceLocalState.listsExpanded */
	isExpanded(kind: keyof CalloutListsFoldState): boolean {
		return this.state.listsExpanded[kind];
	}

	/** Remember a section the user folded away, or opened again. */
	setExpanded(kind: keyof CalloutListsFoldState, expanded: boolean): void {
		if (this.state.listsExpanded[kind] === expanded) return;
		this.state = {
			...this.state,
			listsExpanded: { ...this.state.listsExpanded, [kind]: expanded },
		};
		this.persist();
	}

	/** @see DeviceLocalState.firstRunCompleted */
	get firstRunCompleted(): boolean {
		return this.state.firstRunCompleted;
	}

	/** Record that this device has completed its post-install scan. */
	completeFirstRun(): void {
		if (this.state.firstRunCompleted) return;
		this.state = { ...this.state, firstRunCompleted: true };
		this.persist();
	}

	/**
	 * Carry a pre-move `data.json` retirement list over, once. Unioned rather
	 * than replaced: this device may already have retired ids of its own.
	 */
	adoptLegacyRetiredThemeIds(ids: unknown): void {
		const incoming = sanitizeRetiredThemeIds(ids);
		if (incoming.length === 0) return;
		this.retiredThemeIds = recordRetiredThemeIds(
			this.state.retiredThemeIds,
			incoming,
		);
	}

	/**
	 * Carry a pre-move `data.json` value over, once. Only ever raises the flag:
	 * a vault that had scanned before must not be made to scan again, and a
	 * device that has already scanned must not be un-scanned by a settings file
	 * written before that.
	 */
	adoptLegacyFirstRun(completed: boolean | undefined): void {
		if (completed === true) this.completeFirstRun();
	}

	/** Add ids to the index. Existing spellings win; unknown ones are appended. */
	remember(ids: readonly string[]): void {
		if (ids.length === 0) return;
		this.setDiscovered([...this.state.discovered, ...ids]);
	}

	/** Drop ids from the index — a prune, or an explicit delete. */
	forget(ids: readonly string[]): void {
		if (ids.length === 0) return;
		const gone = new Set(ids.map((id) => calloutIdentity(id)));
		this.setDiscovered(
			this.state.discovered.filter((id) => !gone.has(calloutIdentity(id))),
		);
	}

	/**
	 * Replace the index outright — what a user-requested whole-vault scan
	 * produces, which is authoritative about this vault in a way no incremental
	 * pass is.
	 */
	replace(ids: readonly string[]): void {
		this.setDiscovered(ids);
	}

	private setDiscovered(ids: readonly string[]): void {
		this.state = { ...this.state, discovered: mergeDashSpaceVariants([...ids]) };
		this.persist();
	}

	/**
	 * Vault-scoped key, mirroring `App.loadLocalStorage`'s `${appId}-${key}`.
	 * @see StartupStyleCache
	 */
	private scopedKey(): string {
		const appId = (this.app as App & { appId?: string }).appId;
		return `${appId ?? this.app.vault.getName()}-${LOCAL_STORAGE_KEY}`;
	}

	private read(): DeviceLocalState | null {
		try {
			const raw = window.localStorage.getItem(this.scopedKey());
			if (!raw) return null;
			const parsed = JSON.parse(raw) as Partial<DeviceLocalState>;
			// Anything unrecognised reads as absent rather than as empty: a blob
			// this build cannot understand is not evidence that nothing was ever
			// discovered here, and treating it as such would hide every row until
			// the user found the scan button.
			if (parsed?.v !== 1 || !Array.isArray(parsed.discovered)) return null;
			return {
				v: 1,
				discovered: mergeDashSpaceVariants(
					parsed.discovered.filter(
						(id): id is string => typeof id === "string",
					),
				),
				firstRunCompleted: parsed.firstRunCompleted === true,
				retiredThemeIds: sanitizeRetiredThemeIds(parsed.retiredThemeIds),
				// Field by field: a blob written before this section existed has
				// no `listsExpanded` at all, and every section must fall back to
				// expanded on its own rather than the whole object doing so.
				listsExpanded: {
					theme: parsed.listsExpanded?.theme !== false,
					user: parsed.listsExpanded?.user !== false,
					builtin: parsed.listsExpanded?.builtin !== false,
					palettes: parsed.listsExpanded?.palettes !== false,
				},
			};
		} catch {
			// Corrupt JSON, or storage unavailable (private window, quota rules).
			return null;
		}
	}

	private persist(): void {
		const json = JSON.stringify(this.state);
		if (this.memo.prepare(json) === null) return;
		try {
			window.localStorage.setItem(this.scopedKey(), json);
			// Only after the write landed — a refused write must be retried, not
			// remembered as a success. See utils/writeMemo.ts.
			this.memo.commit(json);
			this.indexed = true;
		} catch {
			// Storage full or unavailable. The rows are already in the registry
			// for this session; only the next launch's fast restore is lost.
		}
	}
}
