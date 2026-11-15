import { rememberMissingSettingsDisplay } from "./missingSettingsRecovery";
import { SettingsPersistenceError } from "./settingsSaveStatus";
import { reportSettingsSaveFailure } from "./settingsSaveReporter";
import { isFromNewerBuild } from "./foreignFields";
import type { PluginData } from "../types";
import { recoverSettingsAtBoot, recoveryDisplay } from "./settingsRecovery";
import { readSettledSettingsFile, sameRead } from "./settingsSettledRead";
import { warnSettingsUnreadable } from "./settingsNotices";
import { watchForLateSettings } from "./settingsLateArrival";
import { applySettingsRead } from "./settingsAdopt";
import { hasSafeSettingsFileShape } from "./settingsFileShape";
import type { ExternalReloadHost } from "./settingsAdopt";
import { pruneSettingsBackups } from "./settingsBackup";
import { PRIMARY_IO_TIMEOUT_MS, readSettingsFile, type SettingsRead } from "./settingsFile";
import { withTimeout } from "../utils/withTimeout";

export interface SettingsBootResult {
	isFreshInstall: boolean;
	/**
	 * Launch owes the settings file one more look, which `runLaunchSequence`
	 * takes once the layout is ready.
	 *
	 * A launch that ends with a file loaded and saving not paused owes it,
	 * however it read the file. Obsidian starts watching the configuration
	 * folder only after every community plugin has loaded, so a file that is
	 * replaced after launch's last read and before then is reported to no one.
	 * For a launch that took its first read without the settling window (see
	 * {@link atRest}) it is also the second read the window would have made.
	 *
	 * A provisional fresh install owes the pause it skipped instead.
	 */
	confirmLater?: true;
}

/** Launch's one read of the device's recovery copy; a failure is thrown to each asker. */
type RecoveryCopy = () => Promise<Partial<PluginData> | null>;

/**
 * Whether launch may take its first read as it stands, without the settling
 * window of `readSettledSettingsFile`. That window is 150 ms every launch
 * spent waiting inside `onload`, with Obsidian waiting behind it.
 *
 * The window is there so a sync snapshot is seen twice before it is adopted,
 * and two launches bring nothing to adopt:
 *
 * - **The file is what this device last accepted.** Its recovery copy is that
 *   state, kept outside the synced folder, so the first of the two matching
 *   observations was made when the last session saved. A file caught midway
 *   through being replaced cannot equal it.
 * - **No file, and no sign there ever was one.** That launch is only
 *   provisionally fresh: the writer stays frozen until `confirmFreshInstall`
 *   has read again, settling, at layout-ready, after the pause skipped here.
 *
 * Everything else settles as it always did: a file this device has not seen,
 * one from a later build, a missing file where one is expected, unreadable
 * content, and recovery storage that does not answer (which the caller's own
 * read then reports).
 */
async function atRest(host: ExternalReloadHost, first: SettingsRead, recoveryCopy: RecoveryCopy): Promise<boolean> {
	const writer = host.settingsWriter;
	if (first.kind === "unreadable") return false;
	if (first.kind === "absent" && host.localState.hasInitialized) return false;
	if (first.kind === "loaded" && (!writer.hasCheckpoint || isFromNewerBuild(first.data))) return false;
	let copy: Partial<PluginData> | null = null;
	if (writer.hasCheckpoint) {
		try {
			copy = await recoveryCopy();
		} catch {
			return false;
		}
	}
	if (first.kind === "absent") return copy === null;
	return copy !== null && sameRead(first, { kind: "loaded", data: copy, json: JSON.stringify(copy) });
}

/** Cleanup is best effort; an offline provider must not prevent startup. */
async function pruneAtBoot(host: ExternalReloadHost): Promise<void> {
	let finished = false;
	try {
		await withTimeout(
			Promise.all([
				pruneSettingsBackups(host, new Set(), () => finished || host.settingsWriter.isDestroyed),
				host.settingsWriter.pruneHistory(),
			]),
			PRIMARY_IO_TIMEOUT_MS,
			() => new Error("Settings retention did not respond"),
		);
	} catch (error) {
		console.debug("[callout-studio] could not finish settings retention", error);
	} finally {
		finished = true;
	}
}

export async function loadSettingsInto(host: ExternalReloadHost): Promise<SettingsBootResult> {
	// Finish retention before adoption can start a protected backup batch.
	// Also runs for paused/missing settings: upgrading requires no new save.
	if (host.settingsWriter.isDestroyed) return { isFreshInstall: false };
	await pruneAtBoot(host);
	if (host.settingsWriter.isDestroyed) return { isFreshInstall: false };
	const isCancelled = () => host.settingsWriter.isDestroyed;
	let copy: Promise<Partial<PluginData> | null> | undefined;
	const recoveryCopy: RecoveryCopy = () =>
		(copy ??= host.settingsWriter.recoveryCopy() as Promise<Partial<PluginData> | null>);
	const first = await readSettingsFile(host);
	if (isCancelled()) return { isFreshInstall: false };
	const resting = await atRest(host, first, recoveryCopy);
	if (isCancelled()) return { isFreshInstall: false };
	// Not at rest: the same reads, the same pauses, as before the shortcut existed.
	const read = resting ? first : await readSettledSettingsFile(host, { initial: first, isCancelled });
	if (isCancelled()) return { isFreshInstall: false };

	if (read.kind === "unreadable") {
		host.settingsWriter.freeze(read.newer ? "newer-version" : "unreadable");
		console.error(
			"[callout-studio] data.json exists but could not be read; " + "settings will not be written this session",
		);
		warnSettingsUnreadable(host.settingsWriter);

		await applySettingsRead(
			host,
			host.settingsWriter.hasCheckpoint ? await recoveryDisplay(host) : { kind: "absent" },
		);

		if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	let missingRecovery: Partial<PluginData> | null = null;
	if (read.kind === "absent" && host.settingsWriter.hasCheckpoint) {
		try {
			missingRecovery = await recoveryCopy();
		} catch (error) {
			host.settingsWriter.freeze("recovery-read");
			reportSettingsSaveFailure(host.settingsWriter, error);
			await applySettingsRead(host, { kind: "absent" });
			rememberMissingSettingsDisplay(host);
			watchForLateSettings(host);
			return { isFreshInstall: false };
		}
		if (host.settingsWriter.isDestroyed) return { isFreshInstall: false };
	}
	if (read.kind === "absent" && (host.localState.hasInitialized || missingRecovery)) {
		host.settingsWriter.freeze("missing");
		console.error(
			"[callout-studio] data.json is missing on a device that has run " +
				"before; settings will not be written this session",
		);
		if (isFromNewerBuild(missingRecovery)) {
			host.settingsWriter.freeze("newer-version");
			reportSettingsSaveFailure(host.settingsWriter);
		}

		// Display the durable copy without making it the baseline for a file
		// that is absent. Confirmed recreation preserves these definitions.
		const recoveryBaseline =
			missingRecovery && !isFromNewerBuild(missingRecovery) ? structuredClone(missingRecovery) : null;
		await host.settingsWriter.hold(async () => {
			// A later build's copy may not pass this build's gate; show built-ins then.
			host.registry.load(missingRecovery && hasSafeSettingsFileShape(missingRecovery) ? missingRecovery : null);
			if (recoveryBaseline) host.settingsWriter.seedRecovery(recoveryBaseline);
		});

		if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
		return { isFreshInstall: false };
	}

	if (read.kind === "absent") {
		// Provisional until layout-ready confirms a fresh install; quiet, since
		// a background save meeting it is not a lost change.
		host.settingsWriter.freeze("missing", false);
	}
	// At rest with a file means `atRest` found the recovery copy equal to it.
	const recovered =
		read.kind === "loaded" && host.settingsWriter.hasCheckpoint
			? await recoverSettingsAtBoot(host, read, recoveryCopy, resting)
			: read;
	try {
		await applySettingsRead(host, recovered, read.kind === "loaded" ? read.json : undefined);
	} catch (error) {
		// A failed migration flush must leave the loaded UI available to retry.
		if (!(error instanceof SettingsPersistenceError)) throw error;
		reportSettingsSaveFailure(host.settingsWriter, error);
	}

	if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
	const isFreshInstall = read.kind === "absent";
	// A fresh install owes only the pause it skipped, when it skipped one. A
	// loaded file owes a second look whether it was settled here or not: no
	// one reports a change that lands while the other plugins are loading. A
	// paused session is rechecked by its own means and owes nothing.
	const owed = isFreshInstall ? resting : !host.settingsWriter.isFrozen;
	return owed ? { isFreshInstall, confirmLater: true } : { isFreshInstall };
}

/**
 * {@link loadSettingsInto}, never throwing.
 *
 * An error it does not expect — a migration meeting data this build never
 * anticipated — used to escape `onload`, and the plugin then failed on every
 * launch with no settings tab to export or recover from. Instead: pause
 * saving, show the built-in callouts, and keep watching for a readable file.
 * The file on disk is untouched.
 */
export async function loadSettingsSafely(host: ExternalReloadHost): Promise<SettingsBootResult> {
	try {
		return await loadSettingsInto(host);
	} catch (error) {
		console.error("[callout-studio] settings could not be loaded; showing built-in callouts", error);
		host.settingsWriter.freeze("unreadable");
		try {
			host.registry.load(null);
		} catch (reset) {
			console.error("[callout-studio] could not reset the registry", reset);
		}
		reportSettingsSaveFailure(host.settingsWriter, error);
		if (!host.settingsWriter.isDestroyed) watchForLateSettings(host);
		return { isFreshInstall: false };
	}
}
