/**
 * manager/launchSequence.ts — what happens once the workspace is ready, in the
 * order it has to happen in.
 *
 * Three steps that look unrelated and are not, which is why they are one
 * function rather than three `onLayoutReady` callbacks:
 *
 * 1. **Settle whether this is a fresh install.** A launch that found no
 *    `data.json` has been frozen since `onload` — nothing at that moment
 *    separates a brand-new device from one a synced vault is still reaching, so
 *    the session writes nothing until the question is asked again here. This is
 *    the latest it can be left open without a genuine fresh install noticing,
 *    and answering it is what lets the session write at all.
 * 2. **The welcome screen**, which is the first thing a fresh install writes.
 *    It runs before first-run discovery so it never stacks on top of the
 *    large-vault consent modal.
 * 3. **First-run vault discovery**, once per *device* — which is also how a
 *    machine whose local index is missing rebuilds it. Afterwards there is only
 *    the prune of rows a previous session left orphaned.
 *
 * The ordering between 1 and 2 is the load-bearing one: `maybeShowWelcomeOnLaunch`
 * takes the answer as an argument and no longer re-reads anything itself, so a
 * caller that skipped the confirmation would greet a user whose vault is
 * already full of callouts *and* write the shipped defaults over the settings
 * that were arriving. That was issue #53.
 *
 * Lives here rather than in `main.ts` for the reason everything else does: that
 * file is lifecycle wiring, and this is a policy about three steps.
 */
import { runFirstRunDiscovery } from "./firstRunDiscovery";
import { confirmFreshInstall } from "./settingsLateArrival";
import { maybeShowWelcomeOnLaunch } from "../settings/welcomeRouting";
import type { SettingsBootResult } from "./settingsBoot";
import type CalloutStudioPlugin from "../main";

/** How long a launch waits before pruning rows an earlier session orphaned. */
const PRUNE_AFTER_LAUNCH_MS = 2000;

/**
 * Run the post-layout half of startup.
 *
 * The incremental discovery watchers are registered in a `finally`, so a step
 * that throws — a modal the user dismissed oddly, a read that failed — costs
 * that step and not the rest of the session's discovery.
 */
export async function runLaunchSequence(
	plugin: CalloutStudioPlugin,
	boot: SettingsBootResult,
): Promise<void> {
	try {
		// Only for the fresh-install freeze. The other one — a file missing on
		// a device that has run here before — must not be lifted by this; see
		// `confirmFreshInstall`'s warning.
		const freshInstall = boot.isFreshInstall
			? await confirmFreshInstall(plugin)
			: false;

		await maybeShowWelcomeOnLaunch(plugin, freshInstall);

		if (!plugin.localState.firstRunCompleted) {
			await runFirstRunDiscovery(plugin);
		} else {
			plugin.discovery.schedulePrune(PRUNE_AFTER_LAUNCH_MS);
		}
	} finally {
		plugin.discovery.registerIncrementalWatchers();
	}
}
