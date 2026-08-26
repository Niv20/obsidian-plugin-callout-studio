/**
 * utils/vaultCalloutStats.ts — The read-only vault usage report.
 *
 * One pass over every markdown file, counting callout occurrences per type and
 * per render role. Feeds VaultCalloutStatisticsModal and nothing else.
 *
 * Kept apart from `vaultCalloutScanner.ts`, whose remaining job is the *writers*
 * (bulk id/title replacement, plain-text conversion, fold-marker normalization).
 * Both still tokenize through `editor/calloutTokens`, which is what makes the
 * numbers reported here and the rewrites agree about which occurrences are real.
 */
import type { App } from "obsidian";
import { calloutIdentity, normalizeCalloutId } from "./calloutId";
import { forEachCalloutToken } from "../editor/calloutTokens";
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
	filesWithCallouts: number;
	totalCount: number;
	/** The per-role sums across every type, for the report's summary band. */
	roleTotals: VaultCalloutRoleCounts;
	types: VaultCalloutTypeStatistics[];
}

export async function scanVaultCalloutStatistics(
	app: App,
): Promise<VaultCalloutStatistics> {
	const files = app.vault.getMarkdownFiles();
	const byId = new Map<string, VaultCalloutTypeStatistics>();
	const roleTotals = emptyRoleCounts();
	let filesWithCallouts = 0;
	let totalCount = 0;

	for (const file of files) {
		const content = await app.vault.cachedRead(file);
		const seenInFile = new Set<string>();

		// `role` is handed to us by the tokenizer already — the three roles are
		// one grammar, walked once, so no second pass is needed to split them.
		forEachCalloutToken(content, (rawId, role) => {
			const spelling = normalizeCalloutId(rawId);
			if (!spelling) return;
			// Keyed by identity so the report has ONE row per callout: a vault
			// that writes both `[!banner icon]` and `[!banner-icon]` is using one
			// callout twice, since Obsidian renders both the same way, and two
			// rows splitting the count between them would describe a vault that
			// does not exist.
			const key = calloutIdentity(spelling);

			let entry = byId.get(key);
			if (!entry) {
				entry = {
					// The row still SHOWS the first spelling seen, not the
					// canonical key: the report describes what is written in the
					// notes, and dasherizing `banner icon` on screen would name a
					// callout the user never typed. `resolveStatsRows` resolves
					// through the registry ladder, which reads either spelling.
					id: spelling,
					fileCount: 0,
					totalCount: 0,
					roles: emptyRoleCounts(),
				};
				byId.set(key, entry);
			}
			entry.totalCount++;
			entry.roles[role]++;
			totalCount++;
			roleTotals[role]++;
			seenInFile.add(key);
		});

		if (seenInFile.size > 0) {
			filesWithCallouts++;
			for (const id of seenInFile) {
				const entry = byId.get(id);
				if (entry) entry.fileCount++;
			}
		}
	}

	const types = Array.from(byId.values()).sort(
		(a, b) => b.totalCount - a.totalCount || a.id.localeCompare(b.id),
	);

	return {
		markdownFileCount: files.length,
		filesWithCallouts,
		totalCount,
		roleTotals,
		types,
	};
}
