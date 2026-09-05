/**
 * Recheck initially missing settings before enabling a fresh session, and keep
 * checking on foreground for settings that synchronize later (#53).
 *
 * Two absent reads cannot distinguish a new install from slow synchronization.
 * The welcome therefore creates no settings file. A first deliberate edit still
 * passes the writer's disk freshness check. A previously initialized device
 * stays frozen while its settings are missing; only actual adoption (or an
 * explicit fresh-start decision) can release that protection.
 */
import type { ExternalReloadHost } from "./settingsAdopt";
import { reloadFrom } from "./settingsAdopt";
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
 * Recheck a launch whose boot reported `isFreshInstall`. An absent file enables
 * real edits, a loaded file is adopted, and an unreadable file remains protected.
 * Nothing here writes defaults or marks the installation initialized.
 *
 * Never call for a missing file on a previously used device: its frozen state
 * looks identical, but absence is precisely why that device must not write.
 */
export async function confirmFreshInstall(
	host: ExternalReloadHost,
): Promise<boolean> {
	if (!host.settingsWriter.isFrozen) return false;

	let stillFresh: boolean;
	try {
		stillFresh = await stillFreshInstall(host);
	} catch (err) {
		// The failed operation may have been adopting a file that JUST arrived.
		// An exception is never evidence that no file exists; keep it protected
		// and let the ordinary foreground/external-change path retry recovery.
		console.error(
			"[callout-studio] could not confirm a fresh install; " +
				"settings remain protected",
			err,
		);
		host.settingsWriter.freeze();
		warnSettingsUnreadable();
		stillFresh = false;
	}

	if (stillFresh) host.settingsWriter.thaw();
	return stillFresh;
}

/**
 * Watch for a `data.json` this session has not seen, and adopt it whenever one
 * lands.
 *
 * Registered by `loadSettingsInto` for **every** launch, and the "every" is the
 * point. It began as a rescue for the three launches that came up without
 * usable settings — file missing, missing on a device that has run before,
 * present but unreadable — on the reasoning that a healthy launch has nothing
 * to wait for. That reasoning is wrong the moment the session outlives the
 * read: Obsidian's config-folder watcher is **desktop-only**, so a phone whose
 * launch went perfectly reads `data.json` once, at `onload`, and never hears
 * about it again. Another device rewrites the file, the phone knows nothing,
 * and the next local edit serializes a launch-time registry over it. That is
 * issue #53, and no amount of care at boot reaches it.
 *
 * So this is the mobile counterpart of `onExternalSettingsChange`, not a
 * recovery path. `stillFreshInstall` covers the launch window, the writer checks actual saves,
 * and this picks up remote updates without waiting for a local edit.
 *
 * Returning to the app is the signal, because that is when a sync client has
 * most likely just run. The steady state costs one small read per foreground
 * and stops at `matchesLastWrite`.
 *
 * **It never retires.** An adoption is not the end of the story — the device
 * goes on being a device with no watcher, and the very next file it is sent
 * would be missed the same way. The only thing an adoption ends is a freeze.
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
	if (!host.registerDomEvent || host.settingsWriter.isDestroyed) return;

	// The MAIN document, deliberately, rather than `activeDocument` — which is
	// whichever window had focus at the instant this ran. Bind to a popout and
	// the watcher dies with it, and a popout's visibility says nothing about
	// whether the app was in the background anyway.
	const doc = document;
	/** True while a check is in flight, so two foregrounds cannot interleave. */
	let checking = false;

	host.registerDomEvent(doc, "visibilitychange", () => {
		// Only skip when we positively know the app is going away: the event
		// fires for both directions, and coming back is the half worth acting
		// on. Anything other than a definite "hidden" is worth a look.
		if (checking || doc.visibilityState === "hidden") return;
		void adoptIfArrived();
	});

	async function adoptIfArrived(): Promise<void> {
		checking = true;
		try {
			const read = await readSettingsFile(host);
			// Still nothing, or still not readable. Quietly wait for the next
			// time the user comes back — this fires on every foreground, so
			// anything said here would be said hundreds of times.
			if (read.kind !== "loaded") return;

			// Our own writing coming back. The ordinary case on a healthy
			// session, and the reason the steady state is nearly free.
			if (host.settingsWriter.matchesLastWrite(read.json)) return;

			// The real plugin queues even an editor-owned update, so closing
			// the editor can retry it. Minimal hosts retry on the next foreground.
			if (registryIsOwned(host) && !host.onExternalSettingsChange) return;

			// `reloadFrom` thaws — see its docblock. Adopting is the one thing
			// that ends a freeze, and it is reached only with the real file in
			// hand.
			if (host.onExternalSettingsChange) await host.onExternalSettingsChange();
			else await reloadFrom(host, read);
		} catch (err) {
			console.error("[callout-studio] could not refresh settings on foreground", err);
		} finally {
			// In a finally, so a read or a rebuild that threw costs one check
			// rather than the rest of the session's.
			checking = false;
		}
	}
}
