/**
 * utils/vaultCalloutStats.ts — The read-only vault usage report.
 *
 * Aggregates the shared read-only occurrence index by source identity and role.
 * The same snapshot backs navigation and menu counts.
 *
 * Kept apart from `vaultCalloutScanner.ts`, whose remaining job is the *writers*
 * (bulk id/title replacement, plain-text conversion, fold-marker normalization).
 * Both still tokenize through `editor/calloutTokens`, which is what makes the
 * numbers reported here and the rewrites agree about which occurrences are real.
 */
import type { App } from "obsidian";
import { normalizeCalloutId } from "./calloutId";
import { getCalloutOccurrenceIndex } from "../usage/occurrenceService";
import type { CalloutOccurrenceIndex } from "../usage/CalloutOccurrenceIndex";
import type { CalloutRenderRole } from "../types";

/**
 * How many occurrences of a callout are written in each role. Every counter
 * here is incremented from the same place `totalCount` is, so the three always
 * sum to it — a breakdown that could disagree with the total it sits next to
 * would be worse than no breakdown at all.
 */
export type VaultCalloutRoleCounts = Record<CalloutRenderRole, number>;

const emptyRoleCounts = (): VaultCalloutRoleCounts => ({
	regular: 0,
	heading: 0,
	inline: 0,
});

export interface VaultCalloutTypeStatistics {
	id: string;
	fileCount: number;
	totalCount: number;
	roles: VaultCalloutRoleCounts;
}

export interface VaultCalloutStatistics {
	markdownFileCount: number;
	scannedFileCount?: number;
	filesWithCallouts: number;
	totalCount: number;
	/** The per-role sums across every type, for the report's summary band. */
	roleTotals: VaultCalloutRoleCounts;
	types: VaultCalloutTypeStatistics[];
	/** Incomplete snapshots must never be presented as exact vault totals. */
	incomplete?: boolean;
	failedFileCount?: number;
}

export async function scanVaultCalloutStatistics(
	app: App,
): Promise<VaultCalloutStatistics> {
	const index = getCalloutOccurrenceIndex(app);
	await index.ensureFresh();
	return getVaultCalloutStatistics(index);
}

/** Synchronous aggregation lets reactive UI reuse the current index snapshot. */
export function getVaultCalloutStatistics(index: CalloutOccurrenceIndex): VaultCalloutStatistics {
	const result = index.query();
	const byId = new Map<string, VaultCalloutTypeStatistics>();
	const filesById = new Map<string, Set<string>>();
	for (const occurrence of result.occurrences) {
		const key = occurrence.identity;
		let entry = byId.get(key);
		if (!entry) {
			entry = { id: normalizeCalloutId(occurrence.rawId), fileCount: 0,
				totalCount: 0, roles: emptyRoleCounts() };
			byId.set(key, entry);
			filesById.set(key, new Set());
		}
		entry.totalCount++;
		entry.roles[occurrence.role]++;
		filesById.get(key)?.add(occurrence.path);
		entry.fileCount = filesById.get(key)?.size ?? 0;
	}
	return {
		markdownFileCount: index.markdownFileCount,
		scannedFileCount: index.scannedFileCount,
		filesWithCallouts: result.fileCount,
		totalCount: result.totalCount,
		roleTotals: result.roles,
		types: Array.from(byId.values()).sort(
			(a, b) => b.totalCount - a.totalCount || a.id.localeCompare(b.id),
		),
		incomplete: index.status !== "ready",
		failedFileCount: index.failures.length,
	};
}
