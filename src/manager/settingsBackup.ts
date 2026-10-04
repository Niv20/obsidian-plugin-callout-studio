/**
 * manager/settingsBackup.ts — a copy of the settings, taken just before they
 * could be lost.
 *
 * Issue #53 opens with a sentence worth keeping in view: *"I rely heavily on
 * the custom callouts and don't have a backup cause I never thought an issue
 * like this could have happened."* Everything else in this repo's sync work is
 * about making that loss impossible. This is the admission that a bug nobody
 * has found yet will eventually make it possible anyway, and that the
 * difference between an afternoon and a rewrite is whether a copy exists.
 *
 * Rules that keep it from becoming part of the problem it is guarding against:
 *
 * - **It runs before destruction, never on a schedule.** `data.json` lives in a
 *   synced folder, and so does this; a backup per launch would be a file event
 *   per launch on every device, which is precisely the churn `SaveGuard` and
 *   `WriteMemo` exist to remove. The callers are an adoption about to remove or
 *   replace this device's settings, missing-file restoration, Reset everything
 *   and every import.
 * - **A copy that is not verified does not count.** Every copy is read back
 *   and compared before a caller is told it exists, and failure is `null`, so
 *   the caller can refuse the destructive step it was protecting.
 * - **Each device tidies only its own copies.** The folder syncs, and in 2.14
 *   every device pruned every copy to one shared window of five: a busy phone
 *   evicted the copy a Mac had saved minutes earlier. Names now carry the
 *   device that wrote them and a hash of what they hold, so a device keeps its
 *   own ten newest copies, never deletes another's that is still in use,
 *   and never saves the same content twice.
 * - **What a copy is called lives beside it.** Why it was taken and any name
 *   someone gave it are in the per-device labels files of
 *   manager/versionLabels.ts, never in the copy: its name and content are
 *   what older builds read.
 *
 * The copies live beside `data.json` rather than somewhere private, which means
 * they sync too. That is deliberate: the device that still has the settings is
 * often not the device the user is holding when they notice.
 */
import { normalizePath } from "obsidian";
import type { App, DataAdapter, PluginManifest } from "obsidian";
import { canonical, content } from "./syncTree";
import { hash64 } from "./syncFingerprint";
import { forgetBackupReasons, recordBackupReason } from "./versionLabels";

/**
 * What was about to replace the settings when a backup was saved. Recorded
 * beside the backups (manager/versionLabels.ts) and shown as the version's
 * name until someone gives it one. Stored as written: a later build may add
 * reasons, and an earlier one shows those under its general name.
 */
export type BackupReason =
	/** Settings from another device would replace or remove some of this one's. */
	| "before-sync"
	/** Restoring a version from Version history. */
	| "before-restore"
	/** Reset everything. */
	| "before-reset"
	/** Any import: a Callout Studio file or another plugin's callouts. */
	| "before-import"
	/** Re-creating a missing settings file: the device recovery copy, kept first. */
	| "before-repair";

/** This device's newest copies, kept whatever their age. */
const KEEP_RECENT = 10;
/** Another device's copies are thinned only once it has saved none for this long. */
const IDLE_DEVICE_MS = 90 * 24 * 60 * 60 * 1000;

/** The name a device uses when it cannot remember one of its own. */
export const SHARED_DEVICE_ID = "device00";

const FOLDER = "backups";
/** `data-<time>-<device>-<content hash>.json`; sorts by time as text. */
const BACKUP_NAME = /^data-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-([a-z0-9]{8})-([a-f0-9]{16})\.json$/;

/** Copies named by 2.14 and earlier: `data-<time>[-<uuid>].json`. */
const LEGACY_NAME = /^data-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(?:-[\da-f-]{36})?\.json$/i;

/** A timed-out startup remove may still finish: never reuse that path. */
const pendingRemovals = new WeakMap<DataAdapter, Set<string>>();

/** What writing a backup needs from the plugin. */
export interface SettingsBackupHost {
	app: App;
	manifest: PluginManifest;
	/** Names this device in its copies. Without it, copies share one name. */
	localState?: { readonly deviceId?: string };
}

export interface SettingsBackupOptions {
	now?: Date;
	/**
	 * Every copy one operation relies on. An adoption can save several, and
	 * tidying after the last must not delete the first; each copy written or
	 * reused is added here and protected from the pruning of the others.
	 */
	batch?: Set<string>;
	/**
	 * Why the copy is taken, recorded for a new copy only: a reused one keeps
	 * the reason it was first saved for. Best effort, like every label.
	 */
	reason?: BackupReason;
}

interface BackupFile {
	path: string;
	time: number;
	device: string;
	hash: string;
}

/** The plugin's own folder. @see manager/settingsFile.ts for the same fallback. */
function backupDir(host: SettingsBackupHost): string {
	const base =
		host.manifest.dir ??
		`${host.app.vault.configDir}/plugins/${host.manifest.id}`;
	return normalizePath(`${base}/${FOLDER}`);
}

/** The folder the backups, and their labels, live in. */
export function settingsBackupDir(host: SettingsBackupHost): string {
	return backupDir(host);
}

function deviceOf(host: SettingsBackupHost): string {
	const id = host.localState?.deviceId;
	return id && /^[a-z0-9]{8}$/.test(id) ? id : SHARED_DEVICE_ID;
}

/**
 * The time part of a name. `:` is not usable in a file name on Windows, and
 * the name is what pruning sorts by, so the substitution is fixed-width.
 */
function stamp(now: Date): string {
	return now.toISOString().replace(/[:.]/g, "-");
}

function parse(path: string): BackupFile | null {
	const m = BACKUP_NAME.exec(path.slice(path.lastIndexOf("/") + 1));
	if (!m) return null;
	const time = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
	return Number.isFinite(time) ? { path, time, device: m[6]!, hash: m[7]! } : null;
}

/** The copies in the folder this module can name, newest first. */
async function listBackups(adapter: DataAdapter, dir: string): Promise<BackupFile[]> {
	const listing = await adapter.list(dir);
	return listing.files.map(parse).filter((file): file is BackupFile => file !== null)
		.sort((a, b) => (a.path < b.path ? 1 : a.path > b.path ? -1 : 0));
}

/** Whether the file at `path` holds exactly `body`. */
async function holds(adapter: DataAdapter, path: string, body: string): Promise<boolean> {
	try { return canonical(content(JSON.parse(await adapter.read(path)))) === body; }
	catch { return false; }
}

/**
 * Save `data` beside `data.json`, read it back, then tidy this device's copies.
 *
 * Content only: a copy is restored through Import, which records its own
 * history, and an envelope from another moment would make the copy fail
 * validation. When a verified copy of the same content already exists, that
 * copy is the answer and nothing is written.
 *
 * Returns the path of the verified copy, or `null` when none could be saved;
 * the caller must then refuse the step the copy was protecting.
 */
export async function writeSettingsBackup(
	host: SettingsBackupHost,
	data: unknown,
	options: SettingsBackupOptions = {},
): Promise<string | null> {
	let path: string;
	let dir: string;
	const device = deviceOf(host);
	try {
		// Capture before the first await: edits during mkdir/exists must not
		// mutate the recovery copy that the caller is counting on.
		const body = content(data);
		const json = JSON.stringify(body, undefined, 2);
		const expected = canonical(body);
		const hash = hash64(expected);
		let time = options.now ?? new Date();
		let name = `data-${stamp(time)}-${device}-${hash}.json`;
		dir = backupDir(host);
		const { adapter } = host.app.vault;
		if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
		let existing: BackupFile[] = [];
		try { existing = await listBackups(adapter, dir); }
		catch (err) { console.debug("[callout-studio] could not list settings backups", err); }
		for (const file of existing) {
			if (file.hash === hash && !pendingRemovals.get(adapter)?.has(file.path) && await holds(adapter, file.path, expected) &&
				!pendingRemovals.get(adapter)?.has(file.path)) {
				options.batch?.add(file.path);
				await pruneSettingsBackups(host, options.batch ?? new Set([file.path]));
				return file.path;
			}
		}
		path = normalizePath(`${dir}/${name}`);
		while (pendingRemovals.get(adapter)?.has(path)) {
			time = new Date(time.getTime() + 1);
			name = `data-${stamp(time)}-${device}-${hash}.json`;
			path = normalizePath(`${dir}/${name}`);
		}
		await adapter.write(path, json);
		if (!await holds(adapter, path, expected)) throw new Error("The backup does not read back as written");
	} catch (err) {
		console.error("[callout-studio] could not write a settings backup", err);
		return null;
	}
	options.batch?.add(path);
	if (options.reason) await recordBackupReason(host.app.vault.adapter, dir, device, path, options.reason);
	await pruneSettingsBackups(host, options.batch ?? new Set([path]));
	return path;
}

/**
 * Keep at most {@link KEEP_RECENT} copies from this device, newest first.
 * Protected copies take slots first; a larger in-flight batch may exceed the
 * cap until the next cleanup. Legacy copies share a separate ten-copy pool
 * because their names do not identify the device that wrote them.
 *
 * Another device's copies are left alone while it is in use; once it has saved
 * none for {@link IDLE_DEVICE_MS} (a reinstalled phone gets a new name), all
 * but its newest go. Only recognized automatic backup names are considered.
 * Run before startup adoption as well as after writes/reuse, so upgrades tidy
 * existing copies without needing a new backup. Failure never blocks loading
 * or saving. The cancellation callback stops further removals after unload.
 */
export async function pruneSettingsBackups(
	host: SettingsBackupHost, protectedPaths: ReadonlySet<string> = new Set(), isCancelled = () => false,
): Promise<void> {
	const { adapter } = host.app.vault;
	try {
		if (isCancelled()) return;
		const dir = backupDir(host);
		const files = await listSettingsBackups(host);
		if (files.length === 0 || isCancelled()) return;
		const device = deviceOf(host);
		const keep = new Set(protectedPaths);
		for (const owner of [device, null]) {
			const group = files.filter(file => file.device === owner);
			let count = group.filter(file => keep.has(file.path)).length;
			for (const file of group) {
				if (count >= KEEP_RECENT) break;
				if (!keep.has(file.path)) { keep.add(file.path); count++; }
			}
		}
		const newestMine = files.find(file => file.device === device)?.time;
		const newestOf = new Map<string, number>();
		for (const file of files) {
			if (file.device !== null && file.device !== device && !newestOf.has(file.device)) { newestOf.set(file.device, file.time); keep.add(file.path); }
		}
		const removed: string[] = [];
		for (const file of files) {
			if (isCancelled()) break;
			if (keep.has(file.path)) continue;
			const idle = newestMine !== undefined && file.device !== null && file.device !== device &&
				newestMine - (newestOf.get(file.device) ?? newestMine) > IDLE_DEVICE_MS;
			if (file.device !== null && file.device !== device && !idle) continue;
			let pending = pendingRemovals.get(adapter);
			if (!pending) { pending = new Set(); pendingRemovals.set(adapter, pending); }
			if (pending.has(file.path)) continue;
			pending.add(file.path);
			try { await adapter.remove(file.path); }
			finally { pending.delete(file.path); }
			if (file.device === device) removed.push(file.path);
		}
		// Only this device's own reasons: another device's file is its own to tidy.
		if (removed.length > 0) await forgetBackupReasons(adapter, dir, device, removed);
	} catch (err) {
		console.debug("[callout-studio] could not prune settings backups", err);
	}
}

/** A copy the recovery window can offer. `device` is null for 2.14's names. */
export interface SettingsBackupEntry {
	path: string;
	time: number;
	device: string | null;
}

/** Every copy in the folder this module or 2.14 named, newest first. */
export async function listSettingsBackups(host: SettingsBackupHost): Promise<SettingsBackupEntry[]> {
	const dir = backupDir(host);
	const { adapter } = host.app.vault;
	if (!(await adapter.exists(dir))) return [];
	const entries: SettingsBackupEntry[] = [];
	for (const path of (await adapter.list(dir)).files) {
		if (path.slice(0, path.lastIndexOf("/")) !== dir) continue;
		const named = parse(path);
		if (named) { entries.push({ path, time: named.time, device: named.device }); continue; }
		const m = LEGACY_NAME.exec(path.slice(path.lastIndexOf("/") + 1));
		const time = m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`) : NaN;
		if (Number.isFinite(time)) entries.push({ path, time, device: null });
	}
	return entries.sort((a, b) => b.time - a.time || (a.path < b.path ? 1 : a.path > b.path ? -1 : 0));
}

/** This device's name as its backup files carry it. */
export function backupDeviceOf(host: SettingsBackupHost): string {
	return deviceOf(host);
}

/**
 * Keep `text` exactly as it is: the bytes of a settings file about to be
 * replaced because it cannot be read, or of a recovery copy about to be
 * discarded. Verified byte for byte, and never pruned — {@link BACKUP_NAME}
 * does not match the name — so what was replaced can always be inspected.
 */
export async function writeRawSettingsCopy(
	host: SettingsBackupHost,
	label: "unreadable" | "recovery-copy",
	text: string,
	now: Date = new Date(),
): Promise<string | null> {
	try {
		const dir = backupDir(host);
		const { adapter } = host.app.vault;
		if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
		const hash = hash64(text);
		try {
			for (const file of (await adapter.list(dir)).files) {
				const name = file.slice(file.lastIndexOf("/") + 1);
				if (name.startsWith(`${label}-`) && name.endsWith(`-${hash}.txt`) && await adapter.read(file) === text) return file;
			}
		} catch (err) { console.debug("[callout-studio] could not list settings backups", err); }
		const path = normalizePath(`${dir}/${label}-${stamp(now)}-${hash}.txt`);
		await adapter.write(path, text);
		if (await adapter.read(path) !== text) throw new Error("The copy does not read back as written");
		return path;
	} catch (err) {
		console.error("[callout-studio] could not save an exact copy of the settings", err);
		return null;
	}
}
