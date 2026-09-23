import type { CalloutOccurrenceIndex } from "./CalloutOccurrenceIndex";
import { getVaultCalloutStatistics } from "../utils/vaultCalloutStats";

export interface OccurrenceMetrics {
	readonly totalCount: number;
	readonly typeCount: number;
	readonly fileCount: number;
	readonly scannedFileCount: number;
}

const cached = new WeakMap<CalloutOccurrenceIndex, { dataRevision: number; metrics: OccurrenceMetrics }>();

/** Vault-wide metrics stay independent of the selected definition and format. */
export function getOccurrenceMetrics(index: CalloutOccurrenceIndex): OccurrenceMetrics {
	const previous = cached.get(index);
	if (previous?.dataRevision === index.dataRevision) return previous.metrics;
	const stats = getVaultCalloutStatistics(index);
	const metrics = Object.freeze({
		totalCount: stats.totalCount,
		typeCount: stats.types.length,
		fileCount: stats.filesWithCallouts,
		scannedFileCount: stats.scannedFileCount ?? 0,
	});
	cached.set(index, { dataRevision: index.dataRevision, metrics });
	return metrics;
}
