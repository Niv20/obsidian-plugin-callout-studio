/**
 * manager/settingsLateArrival.ts — the second look a fresh install takes before
 * it creates the `data.json` it did not find.
 *
 * A launch that finds no settings file cannot tell which of two things it is
 * looking at, and they want opposite treatment:
 *
 * - **A genuine fresh install.** Nothing to lose, everything to write. Any
 *   hesitation here means the user's first callout is not saved, which is its
 *   own data loss and a far more common one.
 * - **A device a synced vault has only just reached.** The plugin folder syncs
 *   as files, not as a transaction, so `main.js` can be in place and running
 *   while `data.json` is still on its way. Creating one here publishes the
 *   shipped defaults over settings that are seconds from arriving, and the sync
 *   client carries that back to every other device. That is issue #53, and on
 *   mobile nothing catches it afterwards: Obsidian's config-folder watcher is
 *   desktop-only, so `onExternalSettingsChange` never fires to put it right.
 *
 * Nothing available at load time separates the two — both read as `absent`, and
 * a first launch has no device index to break the tie either. What separates
 * them is *time*: the file turns up, or it does not. So the question is asked
 * once, at the latest moment it is still worth asking.
 *
 * That moment is `settings/welcomeRouting.ts`. The `welcomeSeen` flag is the
 * first thing a fresh install writes, which makes it the last point at which
 * finding a file still rescues the user's settings instead of replacing them —
 * and it runs from `onLayoutReady`, well after `onload`, which is time a sync
 * client can use.
 *
 * Deliberately **not** wired into `SettingsWriter` as a pre-write hook, which
 * is the other obvious home for it. Adopting a file rebuilds the registry, a
 * rebuild asks for saves of its own, and those saves would then be queueing
 * behind the very write pass that was waiting on the check. At a seam between
 * writes there is no such knot to tie.
 */
import type { ExternalReloadHost } from "./settingsBoot";
import { reloadFrom } from "./settingsBoot";
import { readSettingsFile } from "./settingsFile";
import { warnSettingsUnreadable } from "./settingsNotices";

/**
 * Whether this is still the fresh install that startup took it for.
 *
 * `false` means the caller must not go on to write: either a settings file has
 * turned up and been adopted, or one has turned up that cannot be read and the
 * session has gone read-only.
 */
export async function stillFreshInstall(
	host: ExternalReloadHost,
): Promise<boolean> {
	const read = await readSettingsFile(host);
	if (read.kind === "absent") return true;

	if (read.kind === "unreadable") {
		// The verdict startup reaches for one, for the same reason: a file we
		// cannot read is not a file we may replace.
		host.settingsWriter.freeze();
		console.error(
			"[callout-studio] data.json appeared but could not be read; " +
				"settings will not be written this session",
		);
		warnSettingsUnreadable();
		return false;
	}

	console.warn(
		"[callout-studio] data.json arrived after startup; adopting it " +
			"instead of creating one",
	);
	await reloadFrom(host, read);
	return false;
}
