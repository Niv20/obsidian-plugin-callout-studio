/**
 * manager/versionLabels.ts — what the vault remembers about the versions kept
 * in it: why each backup was saved.
 *
 * This does not fit in the backup itself. Older builds parse a backup's file name,
 * so it cannot grow a part, and an extra key in its content is an unknown
 * field the registry keeps, which would ride along into every restore. So the
 * labels live beside the backups, one small file per device,
 * `labels-<device>.json`, for the same reason the backups carry their device
 * in their names: a file two devices write is a file a sync service turns into
 * a conflict copy. A device writes only its own file and reads every device's.
 *
 * Reasons are keyed by backup file name. Only the device that wrote a backup
 * knows why, and the file name already says which device that was.
 *
 * A label is never a reason to refuse anything: reading tolerates a missing or
 * damaged file, and a failed write resolves to `false`.
 */
import { normalizePath } from "obsidian";
import type { DataAdapter } from "obsidian";

/** One device's labels, or every device's merged. */
export interface VersionLabels {
	/** By backup file name: why that backup was saved. */
	reasons: Map<string, string>;
}

const LABELS_NAME = /^labels-([a-z0-9]{8})\.json$/;
/** Backups are `data-….json`; see manager/settingsBackup.ts. */
const BACKUP_FILE = /^data-[\w.-]+\.json$/;

function emptyLabels(): VersionLabels {
	return { reasons: new Map() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function baseName(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

/** A labels file's valid entries. Anything malformed is skipped, never thrown. */
function parseLabels(text: string): VersionLabels {
	const labels = emptyLabels();
	let raw: unknown;
	try { raw = JSON.parse(text); } catch { return labels; }
	if (!isRecord(raw)) return labels;
	if (isRecord(raw.reasons)) {
		for (const [file, reason] of Object.entries(raw.reasons)) {
			if (BACKUP_FILE.test(file) && typeof reason === "string") labels.reasons.set(file, reason);
		}
	}
	return labels;
}

/** Sorted keys, so an unchanged file is written byte for byte the same. */
function serialize(labels: VersionLabels): string {
	const sorted = <T>(map: Map<string, T>) => Object.fromEntries([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
	return JSON.stringify({ reasons: sorted(labels.reasons) }, undefined, 2);
}

/** Every device's labels in `dir`, merged. Empty when there are none or they cannot be read. */
export async function readVersionLabels(adapter: DataAdapter, dir: string): Promise<VersionLabels> {
	const merged = emptyLabels();
	let paths: string[];
	try {
		if (!await adapter.exists(dir)) return merged;
		paths = (await adapter.list(dir)).files;
	} catch (error) {
		console.debug("[callout-studio] could not list version labels", error);
		return merged;
	}
	for (const path of paths) {
		if (!path.startsWith(`${dir}/`) || !LABELS_NAME.test(baseName(path))) continue;
		let labels: VersionLabels;
		try { labels = parseLabels(await adapter.read(path)); } catch { continue; }
		for (const [file, reason] of labels.reasons) merged.reasons.set(file, reason);
	}
	return merged;
}

/** One write at a time per file, so two changes in a row both land. */
const queues = new Map<string, Promise<unknown>>();

/**
 * Change this device's labels file: read it, let `change` edit it, write it
 * back when `change` says something changed. Resolves to whether the change
 * is on disk; never rejects.
 */
function updateOwnLabels(
	adapter: DataAdapter, dir: string, device: string, change: (own: VersionLabels) => boolean,
): Promise<boolean> {
	const path = normalizePath(`${dir}/labels-${device}.json`);
	const task = (queues.get(path) ?? Promise.resolve()).then(async () => {
		if (!await adapter.exists(dir)) await adapter.mkdir(dir);
		// A read that fails throws and writes nothing, so a file that is only
		// unavailable is never replaced by a near-empty one. A damaged file is:
		// what it held is lost either way.
		const own = await adapter.exists(path) ? parseLabels(await adapter.read(path)) : emptyLabels();
		if (change(own)) await adapter.write(path, serialize(own));
		return true;
	});
	queues.set(path, task.catch(() => undefined));
	return task.catch((error: unknown) => {
		console.error("[callout-studio] could not save version labels", error);
		return false;
	});
}

/** Remember why this device saved the backup at `path`. */
export function recordBackupReason(
	adapter: DataAdapter, dir: string, device: string, path: string, reason: string,
): Promise<boolean> {
	const file = baseName(path);
	return updateOwnLabels(adapter, dir, device, own => {
		if (!BACKUP_FILE.test(file) || own.reasons.get(file) === reason) return false;
		own.reasons.set(file, reason);
		return true;
	});
}

/** Drop the reasons this device recorded for backups that are gone. */
export function forgetBackupReasons(
	adapter: DataAdapter, dir: string, device: string, paths: readonly string[],
): Promise<boolean> {
	return updateOwnLabels(adapter, dir, device, own => {
		let changed = false;
		for (const path of paths) changed = own.reasons.delete(baseName(path)) || changed;
		return changed;
	});
}
