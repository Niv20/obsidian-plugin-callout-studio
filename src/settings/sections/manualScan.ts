/**
 * settings/sections/manualScan.ts — Scan for callouts: the vault
 * scan the user starts from the settings.
 *
 * Who calls it. The Scan for callouts row on the My callout types page
 * (declarative/calloutPages.ts), which runs {@link runManualScan} and reads
 * {@link scanRunning} to say "Scanning…" while it runs.
 *
 * The main idea. One scan at a time per plugin: a second press while one runs,
 * or a press while saving is paused, does nothing. The rows are refreshed by
 * the registry's change round when the scan adds callouts, so nothing here
 * redraws the settings.
 *
 * The order on screen. "Scanning…" stays up while the notes are read, then
 * goes; only after that are the new callouts saved and drawn in the list, and
 * the result follows at once. Drawing hundreds of new rows holds the page for
 * most of a second: done while "Scanning…" was up, it left the brush standing
 * still, as if the scan had not started.
 */
import { t } from "../../i18n";
import type { SettingsTabPlugin } from "./types";
import { BEFORE_RESULT_MS, showNotice, workNotice } from "../../ui/mascot/mascotNotices";

/**
 * The least time "Scanning…" stays up, in milliseconds: long enough to see the
 * brush move, short enough that a quick scan does not drag.
 *
 * The wait is deliberate, even though it holds the user up when the scan could
 * have finished sooner. A scan that ends in a blink looks like nothing
 * happened: people read an instant result as shallow or untrustworthy, and
 * read visible work as proof the app really looked. That is the "labor
 * illusion" (Buell & Norton, 2011): users rated systems that showed their
 * effort, with a longer wait and a view of the steps, as more valuable than
 * ones returning the same result at once. Adar, Tan & Teevan (2013) describe
 * the same thing as "benevolent deception": a response faster than the user's
 * mental model of the task (roughly under 100 ms for something that feels
 * heavy) can cause doubt, not delight. The wait is only a floor, never an
 * addition: a scan that takes longer than this is not delayed any further.
 */
const SCAN_MIN_MS = 2000;

/**
 * The plugins whose scan is running now. A WeakSet: it holds no plugin alive,
 * and an unloaded plugin's entry goes with it.
 */
const running = new WeakSet<SettingsTabPlugin>();

/** Whether a scan started from the settings is running now. */
export function scanRunning(plugin: SettingsTabPlugin): boolean {
	return running.has(plugin);
}

/**
 * Scan the vault for callout types, unless a scan is already running or
 * saving is paused, and say how many were added. The scan is marked as
 * running before the first wait, so a caller that draws the page right after
 * calling this already sees it running.
 *
 * The scan counts as running until the result is shown, not only while the
 * vault is read: "Scanning…" stays up long enough for the mascot to be seen
 * painting, then goes; after a pause the new callouts are saved and drawn, and
 * the result follows. A second press in between would put two scans' notices
 * on top of each other.
 */
export async function runManualScan(plugin: SettingsTabPlugin): Promise<void> {
	if (running.has(plugin) || plugin.settingsWriter.isFrozen) return;
	running.add(plugin);
	// The mascot paints beside "Scanning…" for as long as the notes are read,
	// and for a moment at least, however fast that is.
	const work = workNotice(t("manualDiscovery.scanning"), { minMs: SCAN_MIN_MS, gapMs: BEFORE_RESULT_MS });
	// What to tell the user, held back until "Scanning…" is gone.
	let tellResult: () => void;
	try {
		// Let "Scanning…" be drawn and the brush start moving before the scan takes the page.
		await work.painted();
		// Once the notes are read, "Scanning…" goes before anything is saved or
		// drawn (see the header). `done()` called again below changes nothing.
		const added = await plugin.runVaultScan(() => work.done());
		// New callouts are worth a celebration; finding none is still a job done.
		tellResult = () =>
			showNotice(added > 0 ? "celebrate" : "upToDate", t("settings.rescanComplete", { count: String(added) }));
	} catch (error) {
		console.error("[callout-studio] manual discovery failed", error);
		tellResult = () => showNotice("problem", t("manualDiscovery.failed"));
	}
	try {
		await work.done();
		tellResult();
	} finally {
		running.delete(plugin);
	}
}
