/**
 * manager/settingsAdopt.ts — taking on a `data.json` somebody else wrote.
 *
 * The mid-session half of `manager/settingsBoot.ts`. Reading the file at
 * startup and adopting one that arrives later share a body — the registry has
 * to be rebuilt the same way both times, or a reload quietly skips a migration
 * — but they are different questions with different failure modes, and the
 * shared body is small enough to state once and hand to both.
 *
 * What lives here is the second question: something other than us rewrote the
 * settings file, and this session has to end up holding what it says without
 * writing anything back at it. Three rules, all of them issue #41:
 *
 * - **A file we could not read changes nothing.** Never mistake it for an
 *   empty one.
 * - **What we read becomes the write guard's baseline.** A save that would
 *   merely reproduce the file we just adopted is then suppressed, which is what
 *   stops two devices rewriting it at each other.
 * - **A whole adoption writes at most once**, via `SettingsWriter.hold`, so no
 *   half-rebuilt intermediate state is ever published.
 *
 * Its own module also breaks a cycle: `settingsLateArrival` needs `reloadFrom`
 * and `settingsBoot` needs `watchForLateSettings`, so the two imported each
 * other for as long as both lived in one file.
 */
import type { PluginData } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { SettingsWriter } from "./SettingsWriter";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import { bootDiscoveryIndex } from "./discoveryIndexBoot";
import { readSettingsFile } from "./settingsFile";
import { registryIsOwned } from "./registryOwnership";
import type { SettingsFileHost, SettingsRead } from "./settingsFile";

/** What rebuilding a registry from a settings file needs from the plugin. */
export interface SettingsBootHost extends SettingsFileHost {
	registry: CalloutRegistry;
	localState: DeviceLocalStore;
	settingsWriter: SettingsWriter;
	saveSettings(): Promise<void>;
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
export async function applySettingsRead(
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
	if (registryIsOwned(host)) return true;

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
 *
 * **Adopting is what ends a freeze.** A freeze is the guess that a file we
 * could not read or find is coming back; arriving with that file in hand is the
 * guess being answered, and the baseline seeded below then describes what is on
 * disk, so saving is safe again. Without this, a session that recovered went on
 * *looking* right — the callouts come back and repaint — while silently
 * discarding every edit the user made for the rest of it.
 *
 * It thaws **before** the hold, not after: `applySettingsRead`'s convergence
 * flush runs inside that hold, and a writer still frozen at that moment would
 * drop the load-time migration on the very path that just recovered.
 */
export async function reloadFrom(
	host: ExternalReloadHost,
	read: Extract<SettingsRead, { kind: "loaded" }>,
): Promise<void> {
	host.settingsWriter.thaw();
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
