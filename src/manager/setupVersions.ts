/**
 * manager/setupVersions.ts — every earlier setup, as one timeline of versions.
 *
 * The same setup is often kept in more than one place. This device records
 * each state it accepts (device history), a backup goes to the vault just
 * before something replaces the setup, and a sync service can leave a copy of
 * the settings file behind. The backup taken before an import holds the setup
 * that the history recorded when it was saved, so listing every copy shows
 * most versions twice.
 *
 * Copies are one version when restoring either would give the same settings:
 * their normalized content is identical, compared by hash. Never because their
 * times are close: the backup Restore takes of the setup it replaces is
 * milliseconds from the history entry of the setup it restores, and those are
 * the two versions someone most needs told apart. A copy that cannot be read
 * is never merged. There is nothing to compare, and it is still worth showing.
 */
import type { PluginData } from "../types";
import type { RecoverySource, RecoverySourceKind } from "./settingsRecoveryService";
import { hash64 } from "./syncFingerprint";
import { canonical } from "./syncTree";

/** Why one copy was kept, and where it lives: the two pick its automatic name. */
export interface VersionReason {
	kind: RecoverySourceKind;
	/** As recorded; null when nothing was. */
	reason: string | null;
}

export interface SetupVersion {
	/** One version per key in a listing: its content's hash, or the unreadable copy itself. */
	key: string;
	/** Every copy of it, newest first; at least one. */
	copies: RecoverySource[];
	/** The newest copy's time; null when no copy has one. */
	time: number | null;
	/** What its automatic name says: the newest copy that recorded a reason, else the newest copy. */
	reason: VersionReason;
	/** The settings it holds; null when it cannot be read. */
	data: Partial<PluginData> | null;
}

/** Presentation only; the underlying copies retain their storage kinds. */
export type VersionCategory = "automatic" | "sync-copy";

/** A plugin-created copy takes precedence even when a newer sync copy exists. */
export function versionCategory(version: SetupVersion): VersionCategory {
	return version.copies.some(copy => copy.kind === "history" || copy.kind === "backup")
		? "automatic" : "sync-copy";
}

/** Where a kind of copy sits when two copies were saved at the same moment. */
const KIND_ORDER: Readonly<Record<RecoverySourceKind, number>> = { history: 0, backup: 1, copy: 2 };

/** Newest first; a copy without a time last, in a fixed order. */
function newestFirst(a: { time: number | null; kind: RecoverySourceKind; tie: string }, b: typeof a): number {
	if (a.time !== b.time) return a.time === null ? 1 : b.time === null ? -1 : b.time - a.time;
	return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0);
}

function order(source: RecoverySource) {
	return { time: source.time, kind: source.kind, tie: source.path ?? source.historyHash ?? "" };
}

/** The key copies of one version share. */
function keyOf(source: RecoverySource, index: number): string {
	if (source.data) return `content:${hash64(canonical(source.data))}`;
	return `unreadable:${source.kind}:${source.path ?? source.historyHash ?? index}`;
}

function versionOf(key: string, copies: RecoverySource[]): SetupVersion {
	copies.sort((a, b) => newestFirst(order(a), order(b)));
	const newest = copies[0]!;
	const explained = copies.find(copy => copy.reason) ?? newest;
	return {
		key,
		copies,
		time: newest.time,
		reason: { kind: explained.kind, reason: explained.reason ?? null },
		data: copies.find(copy => copy.data)?.data ?? null,
	};
}

/** One version per distinct setup, newest first. */
export function mergeVersions(sources: readonly RecoverySource[]): SetupVersion[] {
	const groups = new Map<string, RecoverySource[]>();
	sources.forEach((source, index) => {
		const key = keyOf(source, index);
		const group = groups.get(key);
		if (group) group.push(source);
		else groups.set(key, [source]);
	});
	return [...groups].map(([key, copies]) => versionOf(key, copies))
		.sort((a, b) => newestFirst(
			{ time: a.time, kind: a.copies[0]!.kind, tie: a.key },
			{ time: b.time, kind: b.copies[0]!.kind, tie: b.key },
		));
}

/** Underlying storage kinds, independent of the version's presentation category. */
export function versionPlaces(version: SetupVersion): RecoverySourceKind[] {
	const kinds = new Set(version.copies.map(copy => copy.kind));
	return (Object.keys(KIND_ORDER) as RecoverySourceKind[]).filter(kind => kinds.has(kind));
}
