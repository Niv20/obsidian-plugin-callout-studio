/**
 * manager/settingsBoot.ts — reading `data.json` into a live registry at launch.
 *
 * The startup half. `manager/settingsAdopt.ts` is the other one, and the body
 * they share — parse, rebuild, restore this device's discovered rows, flush
 * once if a load-time migration rewrote something — lives there, so that this
 * path can never become a shortened copy of that one. That drift is how a
 * reload quietly ends up skipping a migration.
 *
 * What is startup's alone is the verdict on a file it cannot use. There is no
 * earlier state to fall back on here, so the answer is not "keep what we have"
 * but "write nothing at all until we know more" — see `loadSettingsInto`.
 */
import { readSettingsFile } from "./settingsFile";
import { offerFreshStart, warnSettingsUnreadable } from "./settingsNotices";
import { watchForLateSettings } from "./settingsLateArrival";
import { applySettingsRead } from "./settingsAdopt";
import type { ExternalReloadHost } from "./settingsAdopt";

export interface SettingsBootResult {
	/**
	 * Nothing was on disk at all — a brand-new install, as opposed to a user
	 * who merely updated into this version. Drives where the welcome screen
	 * appears; see `settings/welcomeRouting.ts`.
	 *
	 * Deliberately **not** true for a file holding `{}`. That is a file somebody
	 * wrote, and a user whose `data.json` was emptied — by a half-finished sync,
	 * or by the very bug this module now guards against — must not be greeted as
	 * a new install and must not have `welcomeSeen` written back over whatever
	 * is about to arrive.
	 */
	isFreshInstall: boolean;
}

/**
 * Read `data.json`, rebuild the registry from it, restore this device's
 * discovered rows, and flush once if any of that changed what should be on disk.
 *
 * The startup path. What it does not share with the reload path is how it
 * handles a file it cannot use: at startup there is no earlier state to fall
 * back on, so the registry comes up holding only the shipped built-ins — and the
 * writer is **frozen**, because every save that registry could produce would
 * replace a file we failed to understand with one we know to be wrong. The user
 * is told, because they are about to notice their callouts missing and the one
 * thing they need to know is that the file itself is intact.
 *
 * A file that is *missing* gets the same treatment, but only on a device that
 * has run here before — see the `hasIndex` test below, and
 * `manager/settingsLateArrival.ts` for the first launch, where that test cannot
 * help and the question has to be asked again later.
 */
export async function loadSettingsInto(
	host: ExternalReloadHost,
): Promise<SettingsBootResult> {
	const read = await readSettingsFile(host);

	if (read.kind === "unreadable") {
		host.settingsWriter.freeze();
		console.error(
			"[callout-studio] data.json exists but could not be read; " +
				"settings will not be written this session",
		);
		warnSettingsUnreadable();
		// A file caught mid-write is finished moments later, and on a phone this
		// is the only thing that will notice: the config-folder watcher behind
		// `onExternalSettingsChange` is desktop-only, so the session would
		// otherwise show no callouts until the user thought to restart.
		watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	// No file — which is two entirely different events wearing one shape, and
	// the device's own storage is what tells them apart. `hasIndex` is false
	// only where this plugin has never completed a launch in this vault, because
	// every launch writes the discovery index back (see `discoveryIndexBoot`).
	// So a device that *has* an index and no `data.json` is not a fresh install:
	// its settings file has gone missing since it last ran, and the built-ins
	// the registry is about to come up with must not be written over whatever
	// took it away — a sync client mid-swap, most often. Issue #53.
	if (read.kind === "absent" && host.localState.hasIndex) {
		host.settingsWriter.freeze();
		console.error(
			"[callout-studio] data.json is missing on a device that has run " +
				"before; settings will not be written this session",
		);
		offerFreshStart(() => {
			host.settingsWriter.thaw();
			void host.saveSettings();
		});
		// The file may yet come back on its own, and adopting it is a far better
		// outcome than the user starting over.
		watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	// No file, and no index either, so this really may be a first launch — and a
	// first launch must be free to write, or the user's first callout is never
	// saved. It may equally be a device this vault has only just reached, whose
	// `data.json` is still in flight, and nothing available *now* separates the
	// two. What separates them is time, so the session is frozen *provisionally*
	// and `confirmFreshInstall` ends it at `onLayoutReady`. Guarding only the
	// write that creates the file is what shipped and why #53 stayed open: a
	// background icon fetch or a theme sweep reaches `saveSettings` unordered
	// against it and publishes the defaults first. A freeze is the only gate
	// that catches all of them — see internals-docs/07.
	if (read.kind === "absent") {
		host.settingsWriter.freeze();
	}
	await applySettingsRead(host, read);
	// Every launch watches, the healthy one included — see the docblock on
	// `watchForLateSettings` for why that is not belt-and-braces on mobile.
	watchForLateSettings(host);
	return { isFreshInstall: read.kind === "absent" };
}
