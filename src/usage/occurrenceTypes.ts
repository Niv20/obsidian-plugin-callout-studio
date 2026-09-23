import type { CalloutRenderRole } from "../types";

/** Markdown source coordinates (live editor buffer when open); independent of any registered definition. */
export interface CalloutOccurrence {
	readonly path: string;
	readonly rawId: string;
	readonly identity: string;
	readonly role: CalloutRenderRole;
	/** Zero-based line and UTF-16 columns; `to` is just past the closing bracket. */
	readonly line: number;
	readonly from: number;
	readonly to: number;
	readonly lineText: string;
	readonly excerpt: string;
	/** Whole source snapshot, with CRLF normalized to match the editor buffer. */
	readonly contentFingerprint: string;
}

export type OccurrenceRoleCounts = Record<CalloutRenderRole, number>;

export interface CalloutOccurrenceQuery {
	occurrences: readonly CalloutOccurrence[];
	totalCount: number;
	fileCount: number;
	roles: OccurrenceRoleCounts;
}

export type OccurrenceIndexStatus = "idle" | "loading" | "ready" | "partial" | "stale" | "disposed";

export interface OccurrenceScanFailure {
	readonly path: string;
	readonly message: string;
}

export interface OccurrenceIndexSnapshot {
	readonly status: OccurrenceIndexStatus;
	readonly revision: number;
	readonly dataRevision: number;
	readonly failures: readonly OccurrenceScanFailure[];
	readonly markdownFileCount: number;
	readonly scannedFileCount: number;
}
