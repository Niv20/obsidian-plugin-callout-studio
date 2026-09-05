/**
 * manager/CalloutDiscovery.ts — noticing callout ids the registry has no row for.
 *
 * Scans the ONE file it is handed, through a cached read and one tokenizer
 * pass. *Which* file, and what made it worth looking at, is `DiscoveryScheduler`
 * — including the `file-open` trigger, without which merely opening a note
 * containing an unknown callout discovered nothing at all.
 *
 * What it does with what it finds is the part issue #41 changed. A row for an
 * unclaimed id is not written to `data.json` any more; its id goes to the
 * device-local index instead (`DeviceLocalStore`), so opening a synced note no
 * longer edits the settings file on a second device. See
 * `discoveredRowPersistence.ts` for the rule and `discoveryIndexBoot.ts` for
 * how the rows come back at startup.
 *
 * The opposite question — which rows nothing references any more — is a
 * whole-vault read and lives in `CalloutPrune`, which this class owns and
 * forwards to. Owned by main.ts; destroyed in onunload.
 */
import type { App, EventRef, TFile } from "obsidian";
import type { CalloutRegistry } from "./CalloutRegistry";
import { activeTypingCalloutIds } from "../editor/activeTypingIds";
import { buildDiscoveredRow, fallbackSourceFor } from "./discoveredRow";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { syncIndexFromRegistry } from "./discoveryIndexBoot";
import { buildKnownCalloutIds } from "./knownCalloutIds";
import { RediscoveryHold } from "./rediscoveryHold";
import { CalloutPrune } from "./CalloutPrune";
import { DiscoveryScheduler, type ScanReason } from "./discoveryScheduler";
import {
	scanFileForUnknownCallouts,
	scanVaultForUnknownCallouts,
} from "../utils/vaultCalloutScanner";

interface DiscoveryHost {
	app: App;
	/** Settings are read off THIS, never held as a field — `registry.load()`
	 * replaces `registry.settings` on every adoption. See internals-docs/07. */
	registry: CalloutRegistry;
	/** Where a discovered id is remembered, since `data.json` no longer holds it. */
	localState: DeviceLocalStore;
	saveSettings(): Promise<void>;
	refreshCallouts(): void;
	registerEvent(eventRef: EventRef): void;
}

/**
 * Coordinates vault discovery of unrecognized callout IDs, debounced
 * pruning of unused auto-created rows, and incremental rescans on file
 * changes. Owns its own timers and is destroyed via {@link destroy}.
 */
export class CalloutDiscovery {
	/** Ids automatic discovery must leave alone — see {@link RediscoveryHold}. */
	private readonly hold: RediscoveryHold;

	/** The whole-vault half — see {@link CalloutPrune}. */
	private readonly prune: CalloutPrune;

	/** Which files get looked at, and when — see {@link DiscoveryScheduler}. */
	private readonly scheduler: DiscoveryScheduler;

	constructor(private readonly host: DiscoveryHost) {
		this.hold = new RediscoveryHold(host.localState);
		this.prune = new CalloutPrune(host);
		this.scheduler = new DiscoveryScheduler(host, {
			scan: (file, reason) => {
				void this.scanFileNow(file, reason);
			},
			enabled: () => host.registry.settings.autoDiscoverCallouts,
		});
	}

	/** When true, automatic prune passes are skipped (e.g. while the editor modal is open). */
	get pruneSuspended(): boolean {
		return this.prune.suspended;
	}
	set pruneSuspended(value: boolean) {
		this.prune.suspended = value;
	}

	/** @see CalloutPrune.schedulePrune */
	schedulePrune(delayMs?: number): void {
		this.prune.schedulePrune(delayMs);
	}

	/** @see CalloutPrune.pruneUnused */
	pruneUnused(): Promise<number> {
		return this.prune.pruneUnused();
	}

	destroy(): void {
		this.scheduler.destroy();
		this.prune.destroy();
	}

	/**
	 * True if `id` is an uncustomized fallback callout that the last prune
	 * scan confirmed has zero usages anywhere in the vault. Ids that were
	 * never scanned (just typed, or scanned but still in use) are NOT
	 * considered zero-usage — callers should treat "unknown" as "might be
	 * real" rather than excluding it.
	 */
	isKnownZeroUsageFallback(id: string): boolean {
		return this.prune.isKnownZeroUsage(id);
	}

	/**
	 * @see RediscoveryHold.suppress
	 *
	 * Also drops the ids from the index, and that half is not housekeeping: the
	 * hold lasts five seconds, the index is read on every launch. Left in, a row
	 * the user deleted would be rebuilt on the next open — the same
	 * resurrection the hold exists to prevent, made permanent.
	 *
	 * The scan memo goes too, for the mirror-image reason: the hold lasts five
	 * seconds *and is then meant to lapse*, and a memoized note is one the next
	 * open would not re-read. See {@link DiscoveryScheduler.forgetScanned}.
	 */
	suppressRediscovery(ids: string[]): void {
		this.hold.suppress(ids);
		this.host.localState.forget(ids);
		this.scheduler.forgetScanned();
	}

	/** @see RediscoveryHold.clear */
	clearRediscoverySuppression(): void {
		this.hold.clear();
	}

	/** @see buildKnownCalloutIds — the one implementation. */
	buildKnownIds(): Set<string> {
		return buildKnownCalloutIds(this.host.registry);
	}

	/**
	 * Re-style all uncustomized `source: "fallback"` rows to mirror the
	 * current fallback callout's icon and colors.
	 */
	restyleUncustomizedFallbackRows(): number {
		return this.host.registry.restyleUncustomizedFallbackRows();
	}

	/**
	 * Add the given unknown callout IDs to the registry as fallback-source rows
	 * that mirror the current fallback style.
	 */
	addUnknownCalloutsAsFallback(unknownIds: string[]): number {
		if (unknownIds.length === 0) return 0;
		const fallback = fallbackSourceFor(
			this.host.registry,
			this.host.registry.settings.fallbackCalloutId,
		);
		// One notification for the whole batch. Each `add` below would otherwise
		// fire its own, and a single one costs a full stylesheet regeneration, a
		// document-wide icon repaint, an editor refresh in every leaf, a
		// data.json write and a `css-change` — which core answers by rebuilding
		// every open editor. A template carrying half a dozen unknown ids paid
		// all of that six times over, synchronously, and on mobile that reads as
		// the view jumping. The per-id guards inside the loop still see live
		// registry state, so nothing about WHICH rows get created changes.
		const accepted: string[] = [];
		const added = this.host.registry.batch(() => {
			let count = 0;
			for (const id of unknownIds) {
				if (this.host.registry.get(id)) continue;
				// An id the user just deleted. Placed with the other per-id
				// guards on purpose: this one spot covers the incremental file
				// scan, the settings tab's open-editor scan and the first-run
				// modal alike.
				if (this.hold.holds(id)) continue;
				// Also skip a spelling an existing callout already owns through
				// its `data-callout` form. buildKnownIds keeps the discovery
				// paths from reaching here at all; this covers the first-run
				// scan modal, which hands a user-approved list straight in.
				if (this.host.registry.findAttrIdConflict(id, null)) continue;
				// What a fallback row inherits from the fallback callout, and
				// what it deliberately does not, is decided in one place — see
				// discoveredRow.ts.
				if (this.host.registry.add(buildDiscoveredRow(id, fallback))) {
					count++;
					accepted.push(id);
					// Being (re)discovered means it currently appears in file
					// content — any stale "confirmed zero usage" verdict from an
					// earlier scan no longer applies.
					this.prune.clearZeroUsage(id);
				}
			}
			return count;
		});
		// The row itself is never written to data.json; its id is what survives
		// a restart. See manager/discoveredRowPersistence.ts.
		this.host.localState.remember(accepted);
		return added;
	}

	/**
	 * Scan the vault for callout IDs that are not in the registry and add
	 * them as fallback-source rows that mirror the current fallback style.
	 */
	async runVaultScan(markFirstRun = false): Promise<number> {
		// The user asked for this scan, so nothing may be held back from it.
		this.clearRediscoverySuppression();
		const known = this.buildKnownIds();
		const unknown = await scanVaultForUnknownCallouts(this.host.app, known);
		const added = this.addUnknownCalloutsAsFallback(unknown);
		// A scan of the whole vault is the authoritative answer about it, so the
		// index is re-derived rather than added to — this is what drops an id
		// whose row is gone for a reason no incremental pass saw.
		syncIndexFromRegistry(this.host.registry, this.host.localState);
		if (markFirstRun) {
			this.host.localState.completeFirstRun();
		}
		if (added > 0) await this.host.saveSettings();
		this.host.refreshCallouts();
		return added;
	}

	/**
	 * Subscribe to the events that surface an unknown callout — a write, a
	 * creation, or a note being opened — and sweep the notes already on screen.
	 * Should be called inside `onLayoutReady`. See {@link DiscoveryScheduler}.
	 */
	registerIncrementalWatchers(): void {
		this.scheduler.registerTriggers();
	}

	/**
	 * Queue the debounced per-file scan. Cheap: reads a single cached file and
	 * runs one regex.
	 */
	private scheduleFileScan(file: TFile, reason: ScanReason = "change"): void {
		this.scheduler.schedule(file, reason);
	}

	private async scanFileNow(
		file: TFile,
		reason: ScanReason = "change",
	): Promise<void> {
		if (this.host.app.vault.getAbstractFileByPath(file.path) !== file)
			return;
		const known = this.buildKnownIds();
		let unknown: string[];
		try {
			unknown = await scanFileForUnknownCallouts(
				this.host.app,
				file,
				known,
			);
		} catch (e) {
			console.debug("[CalloutStudio] file scan failed", file.path, e);
			return;
		}
		// Skip tokens the user is actively typing — they get discovered once
		// they commit them (Enter, move off the line, or switch files). Asked
		// on the write path ONLY, which is load-bearing: see the docblock on
		// editor/activeTypingIds.ts for what asking on an open threw away.
		const inProgress =
			reason === "change"
				? activeTypingCalloutIds(this.host.app, file)
				: null;
		const withheld =
			inProgress !== null && unknown.some((id) => inProgress.has(id));
		if (inProgress) unknown = unknown.filter((id) => !inProgress.has(id));
		// Only a scan that reached the end of the file has settled it. One that
		// held a half-typed id back has not, and memoizing it would make the
		// open that commits that id the one open which never looks.
		if (!withheld) this.scheduler.markScanned(file);
		if (unknown.length === 0) {
			// Edit may have removed the last usage of a fallback row. Run
			// a prune so the settings list stays clean as the user types.
			this.pruneAfter(reason);
			return;
		}
		const added = this.addUnknownCalloutsAsFallback(unknown);
		if (added > 0) {
			console.debug(
				"[CalloutStudio] auto-added callouts from",
				file.path,
				unknown,
			);
			// No refreshCallouts() here: the batch's single onChange already
			// injected (which itself ends in refreshAllCalloutEditors), so a
			// second pass would only regenerate identical CSS.
			//
			// And no saveSettings() either, which is the point of the whole
			// change: opening a note must not edit the settings file. The ids
			// went to the device-local index inside the call above, and
			// `data.json` has nothing to say about them.
		}
		// Always schedule a prune pass: even if no new rows were added,
		// existing fallback rows may now be unused after this edit.
		this.pruneAfter(reason);
	}

	/**
	 * The prune that follows a scan — but only when the scan followed a write.
	 *
	 * A prune reads every markdown file in the vault, and the question it
	 * answers is "did that edit remove the last usage of a row". An *open*
	 * removes nothing, and notes are opened far more often than they are
	 * edited, so pruning after one would have put a whole-vault pass behind
	 * every tab switch. The settings tab and startup still ask for their own.
	 */
	private pruneAfter(reason: ScanReason): void {
		if (reason === "change") this.schedulePrune();
	}
}
