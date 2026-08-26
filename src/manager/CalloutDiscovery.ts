/**
 * manager/CalloutDiscovery.ts — Vault scanning and auto-discovery of callouts.
 *
 * Watches for file-open and file-modify events and incrementally scans changed
 * files for unrecognized callout IDs, adding them as fallback rows in the
 * registry. Also runs debounced prune passes to remove auto-created rows that
 * are no longer used. Owned by main.ts; destroyed in onunload.
 * Depends on CalloutRegistry, vaultCalloutScanner utilities, and PluginSettings.
 */
import { Platform, TFile } from "obsidian";
import type { App, EventRef } from "obsidian";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { PluginSettings } from "../types";
import { normalizeCalloutId, obsidianCalloutAttrId } from "../utils/calloutId";
import { buildDiscoveredRow, fallbackSourceFor } from "./discoveredRow";
import { RediscoveryHold } from "./rediscoveryHold";
import { scanLineForCalloutTokens } from "../editor/calloutTokens";
import {
	scanFileForUnknownCallouts,
	scanVaultForUnknownCallouts,
	countCalloutUsagesMap,
} from "../utils/vaultCalloutScanner";

interface DiscoveryHost {
	app: App;
	registry: CalloutRegistry;
	settings: PluginSettings;
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
	/** When true, automatic prune passes are skipped (e.g. while the editor modal is open). */
	pruneSuspended = false;

	/** Pending per-file debounce timers for incremental callout scanning. */
	private readonly fileScanTimers: Map<string, number> = new Map();
	/** Debounce timer for {@link pruneUnused}. */
	private pruneTimer: number | undefined;
	/**
	 * Normalized ids of uncustomized fallback rows the last prune scan
	 * confirmed have zero usages anywhere in the vault. Kept in sync by
	 * {@link pruneUnused} and {@link addUnknownCalloutsAsFallback}; consulted
	 * by autocomplete so it can hide only *confirmed-gone* fallback rows
	 * instead of every unadopted one, without re-scanning the vault on every
	 * keystroke.
	 */
	private readonly zeroUsageFallbackIds = new Set<string>();

	/** Ids automatic discovery must leave alone — see {@link RediscoveryHold}. */
	private readonly hold: RediscoveryHold;

	constructor(private readonly host: DiscoveryHost) {
		this.hold = new RediscoveryHold(host.settings);
	}

	destroy(): void {
		for (const id of this.fileScanTimers.values()) {
			window.clearTimeout(id);
		}
		this.fileScanTimers.clear();
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
	isKnownZeroUsageFallback(id: string): boolean {
		return this.zeroUsageFallbackIds.has(normalizeCalloutId(id));
	}

	/** @see RediscoveryHold.suppress */
	suppressRediscovery(ids: string[]): void {
		this.hold.suppress(ids);
	}

	/** @see RediscoveryHold.clear */
	clearRediscoverySuppression(): void {
		this.hold.clear();
	}

	/**
	 * Build a Set of all callout IDs and aliases currently known to the
	 * registry.
	 *
	 * Each one is registered under both its own spelling and its `data-callout`
	 * attribute form, so a note that writes `[!a-b]` by hand does not count as
	 * unknown while `a b` is defined — Obsidian renders the two identically, so
	 * discovering a second row for the dash spelling would only produce a row
	 * that fights the first one over a single CSS rule.
	 */
	buildKnownIds(): Set<string> {
		const known = new Set<string>();
		const addBothForms = (id: string): void => {
			known.add(normalizeCalloutId(id));
			known.add(obsidianCalloutAttrId(id));
		};
		for (const def of this.host.registry.getAll()) {
			addBothForms(def.id);
			for (const a of def.aliases ?? []) addBothForms(a);
		}
		return known;
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
			this.host.settings.fallbackCalloutId,
		);
		// One notification for the whole batch. Each `add` below would otherwise
		// fire its own, and a single one costs a full stylesheet regeneration, a
		// document-wide icon repaint, an editor refresh in every leaf, a
		// data.json write and a `css-change` — which core answers by rebuilding
		// every open editor. A template carrying half a dozen unknown ids paid
		// all of that six times over, synchronously, and on mobile that reads as
		// the view jumping. The per-id guards inside the loop still see live
		// registry state, so nothing about WHICH rows get created changes.
		return this.host.registry.batch(() => {
			let added = 0;
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
					added++;
					// Being (re)discovered means it currently appears in file
					// content — any stale "confirmed zero usage" verdict from an
					// earlier scan no longer applies.
					this.zeroUsageFallbackIds.delete(normalizeCalloutId(id));
				}
			}
			return added;
		});
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
	 * Schedule a debounced prune of auto-created (`source: "fallback"`) rows
	 * that have never been customized and have zero vault usages.
	 */
	schedulePrune(delayMs = CalloutDiscovery.PRUNE_DELAY_MS): void {
		if (this.pruneSuspended) return;
		if (this.pruneTimer !== undefined) {
			window.clearTimeout(this.pruneTimer);
		}
		this.pruneTimer = window.setTimeout(() => {
			this.pruneTimer = undefined;
			void this.pruneUnused();
		}, delayMs);
	}

	/**
	 * Remove auto-created (`source: "fallback"`) callouts that the user has
	 * never edited and that no longer appear in any markdown file.
	 */
	async pruneUnused(): Promise<number> {
		if (this.pruneSuspended) return 0;
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
		const removed = this.host.registry.batch(() => {
			let count = 0;
			for (const { id } of candidates) {
				const normalized = normalizeCalloutId(id);
				const hasUsage = (formsById.get(id) ?? [id]).some((form) => {
					const stat = usage.get(normalizeCalloutId(form));
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
				if (this.host.registry.remove(id)) count++;
			}
			return count;
		});
		if (removed > 0) {
			await this.host.saveSettings();
			console.debug(
				"[CalloutStudio] pruned",
				removed,
				"unused fallback callout(s)",
			);
		}
		return removed;
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
		if (markFirstRun) {
			this.host.registry.settings.firstRunCompleted = true;
		}
		await this.host.saveSettings();
		this.host.refreshCallouts();
		return added;
	}

	/**
	 * Subscribe to vault/metadata events for incremental discovery of new
	 * callout IDs. Should be called inside `onLayoutReady`.
	 */
	registerIncrementalWatchers(): void {
		this.host.registerEvent(
			this.host.app.metadataCache.on("changed", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.scheduleFileScan(file);
				}
			}),
		);
		this.host.registerEvent(
			this.host.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.scheduleFileScan(file);
				}
			}),
		);
	}

	/**
	 * Debounced per-file incremental scan. Cheap: reads a single cached file
	 * and runs one regex.
	 */
	private scheduleFileScan(file: TFile): void {
		const path = file.path;
		const existing = this.fileScanTimers.get(path);
		if (existing !== undefined) window.clearTimeout(existing);
		const timerId = window.setTimeout(() => {
			this.fileScanTimers.delete(path);
			void this.scanFileNow(file);
		}, 300);
		this.fileScanTimers.set(path, timerId);
	}

	/**
	 * If the active editor is editing this file, return the (lowercased) ids
	 * of every callout token — regular, heading, or inline — on the cursor's
	 * line. While the cursor stays on the line those ids are "in progress"
	 * and must not be auto-created yet: doing so would feed a half-typed name
	 * straight back into the autocomplete dropdown. Discovery happens once
	 * the cursor leaves the line (treated as the user having committed it).
	 */
	private getActiveTypingCalloutIds(file: TFile): Set<string> | null {
		const active = this.host.app.workspace.activeEditor;
		if (!active?.editor || active.file !== file) return null;
		const editor = active.editor;
		const line = editor.getLine(editor.getCursor().line); // live buffer
		const ids = new Set<string>();
		// Token ids are normalized exactly like the vault scanner's, so
		// multi-word IDs with spaces match identically.
		for (const token of scanLineForCalloutTokens(line)) {
			const id = normalizeCalloutId(token.rawId);
			if (id) ids.add(id);
		}
		return ids.size > 0 ? ids : null;
	}

	private async scanFileNow(file: TFile): Promise<void> {
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
		// they commit them (Enter, move off the line, or switch files).
		const inProgress = this.getActiveTypingCalloutIds(file);
		if (inProgress) unknown = unknown.filter((id) => !inProgress.has(id));
		if (unknown.length === 0) {
			// Edit may have removed the last usage of a fallback row. Run
			// a prune so the settings list stays clean as the user types.
			this.schedulePrune();
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
			await this.host.saveSettings();
		}
		// Always schedule a prune pass: even if no new rows were added,
		// existing fallback rows may now be unused after this edit.
		this.schedulePrune();
	}
}
