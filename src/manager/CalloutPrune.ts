/**
 * manager/CalloutPrune.ts — taking back the rows nothing references any more.
 *
 * The other half of what `CalloutDiscovery` used to be, and genuinely a
 * different job: discovery answers "is there an id here I have no row for",
 * one file at a time and cheaply; the prune answers "is there a row here no
 * file mentions", which can only be settled by reading the WHOLE vault. They
 * were one class because they share a subject, not because they share work.
 *
 * Everything expensive about this plugin's background behaviour is in this
 * file, and two rules keep it bearable:
 *
 * - **The delay is tuned for the pass, not for how responsive it feels.** A
 *   prune reads every markdown file through `cachedRead` and tokenizes it, on
 *   the main thread. A short debounce puts that squarely where the user stops
 *   typing and looks at the screen, which on a phone reads as the editor
 *   freezing. Nothing about it is urgent.
 * - **A row somebody claimed is never a candidate.** `customized`, a stand-down
 *   (`externalStyle` or theme ownership), and a custom command built for the
 *   row are each a deliberate claim — and the same three claims decide what
 *   `data.json` persists, which is not a coincidence: a row the prune refuses
 *   to delete is a row the file has to keep. See discoveredRowPersistence.ts.
 */
import { Platform } from "obsidian";
import type { App } from "obsidian";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { PluginSettings } from "../types";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { calloutIdentity } from "../utils/calloutId";
import { countCalloutUsagesMap } from "../utils/vaultCalloutScanner";

/** What the prune needs from the plugin — the same host `CalloutDiscovery` has. */
export interface PruneHost {
	app: App;
	registry: CalloutRegistry;
	settings: PluginSettings;
	localState: DeviceLocalStore;
	saveSettings(): Promise<void>;
}

export class CalloutPrune {
	/** When true, automatic prune passes are skipped (e.g. while the editor modal is open). */
	suspended = false;

	/** Debounce timer for {@link pruneUnused}. */
	private pruneTimer: number | undefined;
	/**
	 * Canonical ids ({@link calloutIdentity}) of uncustomized fallback rows the
	 * last prune scan confirmed have zero usages anywhere in the vault — one key
	 * per callout, never one per spelling. Kept in sync by {@link pruneUnused}
	 * and by discovery re-creating a row; consulted by autocomplete so it can
	 * hide only *confirmed-gone* fallback rows instead of every unadopted one,
	 * without re-scanning the vault on every keystroke.
	 */
	private readonly zeroUsageFallbackIds = new Set<string>();

	constructor(private readonly host: PruneHost) {}

	destroy(): void {
		if (this.pruneTimer !== undefined) {
			window.clearTimeout(this.pruneTimer);
			this.pruneTimer = undefined;
		}
	}

	/**
	 * True if `id` is an uncustomized fallback callout that the last prune
	 * scan confirmed has zero usages anywhere in the vault. Ids that were
	 * never scanned (just typed, or scanned but still in use) are NOT
	 * considered zero-usage — callers should treat "unknown" as "might be
	 * real" rather than excluding it.
	 */
	isKnownZeroUsage(id: string): boolean {
		return this.zeroUsageFallbackIds.has(calloutIdentity(id));
	}

	/** A (re)discovered id currently appears in file content, so any stale
	 * "confirmed zero usage" verdict from an earlier scan no longer applies. */
	clearZeroUsage(id: string): void {
		this.zeroUsageFallbackIds.delete(calloutIdentity(id));
	}

	/**
	 * How long a prune waits after the last edit that asked for one.
	 *
	 * A prune reads EVERY markdown file in the vault through `cachedRead` and
	 * tokenizes it, on the main thread. The debounce collapses bursts, so the
	 * real pattern is one whole-vault pass shortly after the user stops typing
	 * — i.e. at the exact moment they stop and look at the screen. On a phone,
	 * with a few thousand notes, that reads as the editor freezing.
	 *
	 * Pushing the touch delay well past the interaction window is the whole
	 * fix: nothing about the pass is urgent, and the only user-visible effect
	 * of waiting is that an orphaned auto-created row lingers in the settings
	 * list a few seconds longer before it disappears.
	 */
	private static readonly PRUNE_DELAY_MS = Platform.isMobile ? 10000 : 1500;

	/**
	 * The shortest gap between two automatic passes.
	 *
	 * The debounce above collapses a *burst*, which is why continuous typing
	 * costs one pass. What it cannot collapse is the pattern the debounce
	 * itself creates: type, pause, type, pause — every pause longer than the
	 * delay buys another whole-vault read. A floor under the gap is what turns
	 * "a full scan every couple of seconds while drafting" into one every ten,
	 * and nothing about the pass is urgent enough to object.
	 *
	 * An explicit `schedulePrune(0)` is exempt: those come from a user standing
	 * in front of the list they are about to look at — opening the settings tab,
	 * closing the callout editor — and are the moments the list has to be right.
	 */
	private static readonly PRUNE_MIN_INTERVAL_MS = 10000;

	/** When the last completed pass finished, or 0 before the first. */
	private lastPruneAt = 0;

	/**
	 * Schedule a debounced prune of auto-created (`source: "fallback"`) rows
	 * that have never been customized and have zero vault usages.
	 */
	schedulePrune(delayMs = CalloutPrune.PRUNE_DELAY_MS): void {
		if (this.suspended) return;
		if (this.pruneTimer !== undefined) {
			window.clearTimeout(this.pruneTimer);
		}
		this.pruneTimer = window.setTimeout(() => {
			this.pruneTimer = undefined;
			void this.pruneUnused();
		}, this.throttled(delayMs));
	}

	/** `delayMs`, pushed out so automatic passes keep their minimum gap. */
	private throttled(delayMs: number): number {
		if (delayMs === 0) return 0;
		const since = Date.now() - this.lastPruneAt;
		const owed = CalloutPrune.PRUNE_MIN_INTERVAL_MS - since;
		return Math.max(delayMs, owed);
	}

	/**
	 * Remove auto-created (`source: "fallback"`) callouts that the user has
	 * never edited and that no longer appear in any markdown file.
	 */
	async pruneUnused(): Promise<number> {
		if (this.suspended) return 0;
		// Any chosen style mode is as sticky as `customized`, for a sharper
		// reason: pruning takes the setting with it and the id falls back under
		// `generateFallbackCSS`'s `!important` catch-all, so a callout handed to
		// the theme would silently start being repainted once it left the vault.
		const candidates = this.host.registry
			.getUserDefined()
			.filter(
				(d) =>
					d.source === "fallback" &&
					d.customized !== true &&
					!this.host.registry.standsDown(d),
			);
		if (candidates.length === 0) return 0;

		// A row owns every spelling that renders as it does, so one written in
		// the vault only as `[!a-b]` must not read as zero-usage and be pruned
		// out from under itself. See CalloutRegistry.vaultIdFormsFor.
		const formsById = new Map(
			candidates.map((d) => [d.id, this.host.registry.vaultIdFormsFor(d)]),
		);

		let usage: Map<string, { fileCount: number; totalCount: number }>;
		try {
			usage = await countCalloutUsagesMap(
				this.host.app,
				Array.from(formsById.values()).flat(),
			);
		} catch (e) {
			console.debug("[CalloutStudio] prune usage scan failed", e);
			return 0;
		}

		// Batched for the same reason the discovery adds are: one `onChange` per
		// removed row means one full stylesheet regeneration, icon repaint,
		// editor refresh and `css-change` per row.
		const dropped: string[] = [];
		const removed = this.host.registry.batch(() => {
			let count = 0;
			for (const { id } of candidates) {
				const normalized = calloutIdentity(id);
				const hasUsage = (formsById.get(id) ?? [id]).some((form) => {
						// countCalloutUsagesMap keys by identity, so read it back
					// with the same function.
					const stat = usage.get(calloutIdentity(form));
					return stat !== undefined && stat.fileCount > 0;
				});
				if (hasUsage) {
					this.zeroUsageFallbackIds.delete(normalized);
					continue;
				}
				this.zeroUsageFallbackIds.add(normalized);
				const def = this.host.registry.get(id);
				if (!def) continue;
				// Re-check: another flow (e.g. settings edit) may have
				// customized this row while the scan was in flight.
				// Through the registry, not the raw field — they disagreed here.
				if (
					def.source !== "fallback" ||
					def.customized === true ||
					this.host.registry.standsDown(def)
				)
					continue;
				// A command the user built for this row is a deliberate claim
				// on it, the same as customizing it. Pruning here would delete
				// that command — and the hotkey bound to it — the moment the
				// last note using the callout went away.
				if (
					this.host.settings.customCommands.some(
						(command) => command.calloutId === id,
					)
				)
					continue;
				if (this.host.registry.remove(id)) {
					count++;
					dropped.push(id);
				}
			}
			return count;
		});
		this.lastPruneAt = Date.now();
		// The index has to lose them too, or the next launch rebuilds the very
		// rows this pass just decided nothing references any more.
		this.host.localState.forget(dropped);
		if (removed > 0) {
			// Not for the rows themselves — data.json never held them. This
			// covers the settings a prune can touch, `cleanupUnusedIconSvgs`
			// among them.
			await this.host.saveSettings();
			console.debug(
				"[CalloutStudio] pruned",
				removed,
				"unused fallback callout(s)",
			);
		}
		return removed;
	}
}
