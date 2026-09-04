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
import { registryIsOwned } from "./registryOwnership";

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

/**
 * End the provisional freeze a fresh-install launch started with, and answer
 * whether this really is a fresh install.
 *
 * `loadSettingsInto` cannot tell a brand-new device from one a synced vault is
 * still reaching — both read as `absent`, and a first launch has no device index
 * to break the tie either. It resolves that by writing nothing at all until this
 * runs, at `onLayoutReady`, which is as long as the question can be left open
 * without a genuine fresh install noticing.
 *
 * Three outcomes, and only the first lets the session write:
 *
 * - **Still nothing there.** A real fresh install. Thaw, and let the welcome
 *   screen create the file exactly as it always has.
 * - **A file turned up.** `stillFreshInstall` adopts it through `reloadFrom`,
 *   which thaws on its own because it arrived holding the real settings.
 * - **A file turned up and cannot be read.** Stay frozen, and say so.
 *
 * Returns `false` without reading anything when the writer is no longer frozen,
 * which means a file was already adopted between `onload` and here — by the
 * foreground watcher, or on desktop by `onExternalSettingsChange`. That session
 * has its settings, so there is nothing to confirm and nobody to greet.
 *
 * > [!WARNING]
 * > Call this **only** for a launch whose boot reported `isFreshInstall`. The
 * > other freeze that reaches `onLayoutReady` — a file missing on a device that
 * > has run here before — looks identical from inside this function, and
 * > "still nothing there" is exactly what that device reports. Thawing it would
 * > write the built-ins over settings that have merely gone missing, which is
 * > the whole of what `loadSettingsInto`'s `hasIndex` test exists to prevent.
 */
export async function confirmFreshInstall(
	host: ExternalReloadHost,
): Promise<boolean> {
	if (!host.settingsWriter.isFrozen) return false;

	let stillFresh: boolean;
	try {
		stillFresh = await stillFreshInstall(host);
	} catch (err) {
		// Genuinely exceptional: `readSettingsFile` already turns an adapter
		// that will not answer into `unreadable` rather than throwing. But the
		// freeze this releases has no other way out, so a throw here would
		// leave a fresh install keeping nothing — this launch and, since no
		// file ever gets created, every launch after it. Between "might
		// overwrite a file that is probably not there" and "certainly discards
		// everything the user does", the first is the better bet.
		console.error(
			"[callout-studio] could not confirm a fresh install; " +
				"allowing this session to write",
			err,
		);
		stillFresh = true;
	}

	if (stillFresh) host.settingsWriter.thaw();
	return stillFresh;
}

/**
 * Keep looking for a `data.json` that startup did not find, and adopt it the
 * moment it lands.
 *
 * Registered by `loadSettingsInto` for every launch that came up without usable
 * settings: the frozen one, where a device that has run here before found its
 * file missing; the fresh-install one, where the file may simply not have
 * arrived yet; and the one that found a file it could not read, which is a
 * transfer still in progress far more often than it is corruption.
 *
 * `stillFreshInstall` covers the narrow window between `onload` and the first
 * write. This covers the rest of the session, which on mobile is otherwise
 * uncovered entirely: Obsidian's config-folder watcher is desktop-only, so a
 * phone that starts without settings never hears about them arriving and will
 * happily run all day describing callouts the user does not have.
 *
 * Returning to the app is the signal, because that is when a sync client has
 * most likely just run. It is a single small read, and it stops at the first
 * file it manages to adopt.
 *
 * **Adopting also thaws the writer**, in `reloadFrom`. A freeze is the guess
 * that the missing file is coming back; when it does come back there is nothing
 * left to guess about, and the baseline now describes the file on disk, so the
 * session can safely save again. Every automatic path to `thaw()` runs through
 * an adoption, and an adoption is reached only with the real file in hand —
 * never on a hunch.
 */
export function watchForLateSettings(host: ExternalReloadHost): void {
	// Absent on a test harness, and on any host that is not a real plugin.
	if (!host.registerDomEvent) return;

	let settled = false;
	host.registerDomEvent(activeDocument, "visibilitychange", () => {
		// Only skip when we positively know the app is going away: the event
		// fires for both directions, and coming back is the half worth acting
		// on. Anything other than a definite "hidden" is worth a look.
		if (settled || activeDocument.visibilityState === "hidden") return;
		void adoptIfArrived();
	});

	async function adoptIfArrived(): Promise<void> {
		const read = await readSettingsFile(host);
		// Still nothing, or still not readable. Quietly wait for the next time
		// the user comes back — this fires on every foreground, so anything
		// said here would be said hundreds of times.
		if (read.kind !== "loaded") return;

		// Our own writing. Nothing has landed *yet* — which is not the same as
		// nothing landing, so this must not retire the watcher. A fresh install
		// that created its own file is exactly the session still waiting on a
		// sync client, and Syncthing's floor is a ten-second scan delay with an
		// hourly rescan behind it. Marking this settled disarmed the only
		// mechanism a phone has, on the one path where it was still needed.
		if (host.settingsWriter.matchesLastWrite(read.json)) return;

		// The editor owns the registry right now; rebuilding under it would
		// change the row being edited. Try again next time.
		if (registryIsOwned(host)) return;

		settled = true;
		// `reloadFrom` thaws — see its docblock. Adopting is the one thing that
		// ends a freeze, and it is reached only with the real file in hand.
		await reloadFrom(host, read);
	}
}
