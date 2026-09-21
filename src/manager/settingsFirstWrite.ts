/**
 * manager/settingsFirstWrite.ts — the second look a session takes before it
 * creates a `data.json` that was not there when it started.
 *
 * A launch that finds no settings file cannot tell which of two things happened,
 * and they want opposite treatment:
 *
 * - **A fresh install.** There is nothing to lose and everything to write. Any
 *   hesitation here means the user's first callout is not saved, which is its
 *   own kind of data loss and a far more common one.
 * - **A device this vault has only just reached.** The plugin folder syncs as
 *   files, not as a transaction, so `main.js` can be in place and running while
 *   `data.json` is still on its way. Writing here publishes the shipped
 *   defaults over settings that are seconds from arriving, and the sync client
 *   dutifully carries that back to every other device. This is issue #53.
 *
 * Nothing available at load time separates them: both read as `absent`, and on
 * a genuine first launch there is no device index to break the tie either. What
 * does separate them is *time* — the file shows up, or it does not. So the
 * question is deferred to the first save that actually has something to say,
 * and asked once, there.
 *
 * That the deferral is safe rests on the load leaving nothing to persist: see
 * `settingsBoot.loadSettingsInto`, which freezes the writer across an `absent`
 * load precisely so the ceremonial save it provokes is dropped rather than
 * queued up behind this check.
 */
import type { ExternalReloadHost } from "./settingsBoot";
import { readSettingsFile } from "./settingsFile";
import type { SettingsRead } from "./settingsFile";
import { warnSettingsUnreadable } from "./settingsNotices";

/** `settingsBoot.reloadFrom`, passed in so the dependency runs one way only. */
type ReloadFrom = (
	host: ExternalReloadHost,
	read: Extract<SettingsRead, { kind: "loaded" }>,
) => Promise<void>;

/**
 * Decide whether this session's first write may go ahead, and return `false` to
 * abandon it. Armed by `loadSettingsInto` via `SettingsWriter.guardFirstWrite`.
 *
 * - **Still nothing there.** A fresh install after all. Write.
 * - **A file arrived.** The user's real settings, landing late. Adopt it and
 *   abandon the write — publishing built-ins over it is the exact loss this
 *   module exists to prevent. Adopting also disarms the guard, so the save that
 *   the rebuild itself asks for goes through normally.
 * - **A file arrived that we cannot read.** The same verdict `loadSettingsInto`
 *   reaches for one: change nothing, all session.
 */
export async function confirmFirstWrite(
	host: ExternalReloadHost,
	reloadFrom: ReloadFrom,
): Promise<boolean> {
	const read = await readSettingsFile(host);
	if (read.kind === "absent") return true;

	if (read.kind === "unreadable") {
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
			"instead of overwriting it",
	);
	await reloadFrom(host, read);
	return false;
}
