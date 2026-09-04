/**
 * manager/settingsBoot.ts — reading `data.json` into a live registry.
 *
 * Two callers ask the identical question and must not answer it differently:
 * `onload`, and `onExternalSettingsChange` when another device's settings file
 * arrives mid-session. Both need the file parsed, the registry rebuilt, the
 * discovered rows put back from the device-local index, and a single write-back
 * when a load-time migration rewrote something — in that order, before anything
 * renders.
 *
 * Keeping it here rather than in `main.ts` is what stops the reload path from
 * being a shortened copy of the startup path, which is how a reload quietly
 * ends up skipping a migration.
 *
 * Both paths share three rules that only matter on a synced vault, and all
 * three are issue #41 (see `utils/saveGuard.ts` and `manager/settingsFile.ts`):
 *
 * - **A file we could not read changes nothing.** Never mistake it for an empty
 *   one.
 * - **What we read becomes the write guard's baseline.** A save that would
 *   merely reproduce the file we just adopted is then suppressed, which is what
 *   stops two devices rewriting it at each other.
 * - **A whole load writes at most once**, via `SettingsWriter.hold`, so no
 *   half-rebuilt intermediate state is ever published.
 */
import type { PluginData } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { bootDiscoveryIndex } from "./discoveryIndexBoot";
import { readSettingsFile } from "./settingsFile";
import { offerFreshStart, warnSettingsUnreadable } from "./settingsNotices";
import { watchForLateSettings } from "./settingsLateArrival";
import type { SettingsFileHost, SettingsRead } from "./settingsFile";

/** What the load needs from the plugin. */
export interface SettingsBootHost extends SettingsFileHost {
	registry: CalloutRegistry;
	localState: DeviceLocalStore;
	settingsWriter: SettingsWriter;
	saveSettings(): Promise<void>;
}

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
 * Rebuild the registry from a read that produced something usable, and flush
 * once if the load changed what should be on disk.
 *
 * Shared by both callers so neither can drift from the other. Held, so every
 * save the rebuild provokes — `restoreDiscoveredRows` alone always fires one on
 * a device that has discovered anything — collapses into the single pass that
 * runs when the outermost hold releases. Re-entrant: the reload path wraps a
 * wider hold around this one, and the flush then happens once, at the end of
 * the whole adoption.
 */
async function applySettingsRead(
	host: SettingsBootHost,
	read: Extract<SettingsRead, { kind: "absent" | "loaded" }>,
): Promise<void> {
	const savedData: Partial<PluginData> | null =
		read.kind === "loaded" ? read.data : null;

	// Before the load, not after. The baseline has to describe what is on
	// **disk**, so that the convergence flush below still sees a difference and
	// writes; seeding it from the post-load `toSaveData()` would claim the file
	// already says what we are about to correct, and suppress the correction.
	if (read.kind === "loaded") host.settingsWriter.adopt(read.json);

	await host.settingsWriter.hold(async () => {
		host.registry.load(savedData);

		// Before the first inject, so the restored rows are in the sheet from
		// the start — exactly as theme rows are.
		const index = bootDiscoveryIndex(
			host.registry,
			host.localState,
			savedData,
		);

		// A load-time migration that rewrote definitions is flushed right away,
		// so the cleaned-up list survives the next reload rather than waiting on
		// whatever incidental save happens to come first. `converged` is the
		// same need for the discovered rows the file should stop carrying.
		if (host.registry.needsSaveAfterLoad() || index.converged) {
			await host.saveSettings();
		}
	});
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
	// two. What separates them is time: see `manager/settingsLateArrival.ts`,
	// which asks again at the last moment before a file would be created, and
	// keeps watching for the rest of the session.
	if (read.kind === "absent") watchForLateSettings(host);
	await applySettingsRead(host, read);
	return { isFreshInstall: read.kind === "absent" };
}

/** What adopting an external change needs on top of {@link SettingsBootHost}. */
export interface ExternalReloadHost extends SettingsBootHost {
	/** True exactly while the callout editor owns the registry. */
	pruneSuspended: boolean;
	/** @see registerThemeRowSync */
	resyncThemeRows(): void;
	customCommands: { syncAll(): void };
	refreshCallouts(): void;
	settingsTab?: { containerEl: { isConnected: boolean }; display(): void };
	/**
	 * Obsidian's `Plugin.registerDomEvent`, so a launch that found no settings
	 * can keep watching for them — see `manager/settingsLateArrival.ts`.
	 * Optional because a test harness is not a plugin.
	 */
	registerDomEvent?: (
		el: Document,
		type: "visibilitychange",
		callback: () => void,
	) => void;
}

/**
 * Adopt a `data.json` that something other than us rewrote — a sync client
 * landing another device's settings, most often.
 *
 * Returns whether the adoption was **deferred**. A reload rebuilds the whole
 * registry, so running one while the callout editor is open would change or
 * remove the row being edited underneath the user. The caller holds the answer
 * and calls again when the modal closes.
 *
 * Three things have to happen that no ordinary load needs:
 *
 * - **Our own write coming back is recognised and skipped.** Obsidian re-fires
 *   the hook for saves we make ourselves: `Plugin._onConfigFileChange` assigns
 *   `_lastDataModifiedTime = <the mtime it read before awaiting us>` *after*
 *   this returns, rolling back the stamp `saveData` set during it. Comparing the
 *   incoming file against the write guard's baseline settles that in a string
 *   compare, instead of a full rebuild, CSS regeneration and repaint per save.
 * - **The guard's baseline is re-seeded**, in `applySettingsRead`. It used to be
 *   *cleared* here, on the reasoning that a baseline describing our own last
 *   write is a lie once someone else has written the file. True, and the wrong
 *   remedy: we have just read that file, so the baseline can be corrected rather
 *   than discarded. Clearing it meant the reload's own `onChange` wrote the file
 *   straight back at the device that sent it, and that device did the same in
 *   return — the unbounded exchange that is the second half of issue #41.
 * - **The theme's overlay rows are re-derived.** `CalloutRegistry.load()`
 *   clears the callout map and those rows live in it; they are deliberately
 *   never persisted, so only a re-sweep brings them back — otherwise every
 *   theme-provided callout silently disappears until the next `css-change`, and
 *   `customCommands.syncAll()` below, running against a registry that is missing
 *   them, deletes the user's commands for those callouts and saves the deletion.
 */
export async function adoptExternalSettings(
	host: ExternalReloadHost,
): Promise<boolean> {
	if (host.pruneSuspended || host.registry.hasPreviewDefinition()) return true;

	const read = await readSettingsFile(host);

	// Nothing usable arrived. Both cases keep the state we have and stay
	// pending, because both are transient far more often than they are meant:
	// `unreadable` is a file mid-write, and `absent` is the gap a sync client
	// leaves while it renames the local copy aside to make room for the remote
	// one. Adopting either would mean wiping every callout to answer a question
	// nobody asked. A retry costs nothing — the write that follows fires the
	// hook again.
	if (read.kind !== "loaded") {
		console.warn(
			`[callout-studio] ignoring an external data.json change: ${read.kind}`,
		);
		return true;
	}

	// Our own write, arriving back through the watcher.
	if (host.settingsWriter.matchesLastWrite(read.json)) return false;

	await reloadFrom(host, read);
	return false;
}

/**
 * Rebuild everything from a `data.json` somebody else wrote, and repaint.
 *
 * Shared by the two paths that can meet one mid-session: the watcher-driven
 * {@link adoptExternalSettings} on desktop, and `settingsLateArrival`'s
 * `stillFreshInstall` on a device where the file simply arrived late. Held as a
 * whole, so the rebuild publishes at most one write and never an intermediate
 * state.
 */
export async function reloadFrom(
	host: ExternalReloadHost,
	read: Extract<SettingsRead, { kind: "loaded" }>,
): Promise<void> {
	await host.settingsWriter.hold(async () => {
		await applySettingsRead(host, read);
		host.resyncThemeRows();
		// A command may point at a callout the incoming file does not define, or
		// at one it has just introduced. After the theme sweep above, never
		// before it — see the third bullet.
		host.customCommands.syncAll();
	});

	host.refreshCallouts();
	if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
}
