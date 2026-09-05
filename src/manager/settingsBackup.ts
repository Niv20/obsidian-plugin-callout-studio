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
 * Two rules keep it from becoming part of the problem it is guarding against:
 *
 * - **It runs before destruction, never on a schedule.** `data.json` lives in a
 *   synced folder, and so does this; a backup per launch would be a file event
 *   per launch on every device, which is precisely the churn `SaveGuard` and
 *   `WriteMemo` exist to remove. Today there is one caller — an adoption about
 *   to remove or replace this device's callout definitions.
 * - **Failure is explicit.** Write errors are reported as `null`, so the caller
 *   can defer destructive adoption until a recovery copy can be saved.
 *
 * The copies live beside `data.json` rather than somewhere private, which means
 * they sync too. That is deliberate: the device that still has the settings is
 * often not the device the user is holding when they notice.
 */
import { normalizePath } from "obsidian";
import type { App, PluginManifest } from "obsidian";

/** How many copies to keep. Enough to step back past a bad sync, not an archive. */
const KEEP = 5;

const FOLDER = "backups";
const PREFIX = "data-";
const SUFFIX = ".json";
// Accept this writer's current and legacy names, never a user's data-notes.json.
const BACKUP_NAME = /^data-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-[\da-f-]{36})?\.json$/i;

/** What writing a backup needs from the plugin. */
export interface SettingsBackupHost {
	app: App;
	manifest: PluginManifest;
}

/** The plugin's own folder. @see manager/settingsFile.ts for the same fallback. */
function backupDir(host: SettingsBackupHost): string {
	const base =
		host.manifest.dir ??
		`${host.app.vault.configDir}/plugins/${host.manifest.id}`;
	return normalizePath(`${base}/${FOLDER}`);
}

/**
 * A file name that sorts chronologically as text.
 *
 * `:` is not usable in a file name on Windows, and the resulting name is what
 * {@link prune} sorts by — so the substitution has to keep the ordering, which
 * a fixed-width replacement does.
 */
function stamp(now: Date): string {
	return `${PREFIX}${now.toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}${SUFFIX}`;
}

/**
 * Write `data` beside `data.json` and drop all but the newest {@link KEEP}.
 *
 * Returns the path written, or `null` when the backup could not be saved. The
 * caller must defer adoption that would remove or replace local definitions
 * when no recovery copy was written.
 */
export async function writeSettingsBackup(
	host: SettingsBackupHost,
	data: unknown,
	now: Date = new Date(),
): Promise<string | null> {
	let path: string;
	try {
		const dir = backupDir(host);
		path = normalizePath(`${dir}/${stamp(now)}`);
		const { adapter } = host.app.vault;
		// Capture before the first await: edits during mkdir/exists must not
		// mutate the recovery copy that the caller is counting on.
		const json = JSON.stringify(data, undefined, 2);
		if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
		await adapter.write(path, json);
		await prune(host, dir, path);
	} catch (err) {
		console.error("[callout-studio] could not write a settings backup", err);
		return null;
	}
	return path;
}

/**
 * Keep the newest {@link KEEP} copies.
 *
 * Only files this module named are considered, so nothing else a user or
 * another tool put in the folder is ever deleted. Failures are swallowed for
 * the same reason as above: the backup has already been written, and tidying is
 * the part nobody is depending on.
 */
async function prune(host: SettingsBackupHost, dir: string, protectedPath: string): Promise<void> {
	const { adapter } = host.app.vault;
	try {
		const listing = await adapter.list(dir);
		const mine = listing.files
			.filter((file) => {
				const name = file.slice(file.lastIndexOf("/") + 1);
				return BACKUP_NAME.test(name);
			})
			.sort();
		// Devices can disagree about the clock. Never immediately delete the
		// copy whose successful creation is allowing destructive adoption.
		const removable = mine.filter(file => file !== protectedPath);
		for (const file of removable.slice(0, Math.max(0, mine.length - KEEP))) {
			await adapter.remove(file);
		}
	} catch (err) {
		console.debug("[callout-studio] could not prune settings backups", err);
	}
}
