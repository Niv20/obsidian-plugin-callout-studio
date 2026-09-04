/**
 * settings/welcomeRouting.ts — who sees the welcome screen, and when.
 *
 * Not lifecycle, which is why it is not in `main.ts`: this is a policy about
 * one modal, and it has exactly two rules worth keeping in one place.
 *
 * - **Only a brand-new install is greeted.** A user who merely updated into
 *   this version already has a `data.json`, and a splash screen on an upgrade
 *   reads as the plugin having reset itself. `isFreshInstall` is computed once,
 *   in `onload`, from the data that was just loaded.
 * - **The flag is persisted before the modal opens**, so a startup interrupted
 *   while the screen is up (a crash, a reload) does not show it again on the
 *   next launch. That write is also the first one a fresh install makes — and
 *   it is safe to make here only because `isFreshInstall` now arrives already
 *   confirmed. `manager/settingsLateArrival.ts`'s `confirmFreshInstall` has
 *   re-read the folder immediately before this runs, and the session was frozen
 *   until it did; this file used to make that check itself, which guarded this
 *   one write while every background save went around it. Issue #53.
 *
 * `openWelcome()` on the plugin is the deliberate bypass — the protocol handler
 * and the DevTools console reach the screen through it regardless of the flag.
 */
import { WelcomeModal } from "./WelcomeModal";
import type { ExternalReloadHost } from "../manager/settingsAdopt";
import type { SettingsTabPlugin } from "./sections/types";

/** What the routing needs beyond what `WelcomeModal` itself takes. */
type WelcomeHost = SettingsTabPlugin &
	ExternalReloadHost & {
		saveSettings(): Promise<void>;
	};

/**
 * Show the welcome screen if this launch is the one that should show it.
 *
 * `isFreshInstall` arrives already confirmed — `manager/launchSequence.ts` asks
 * `confirmFreshInstall` immediately before this, and awaits this before
 * first-run discovery so the splash never stacks on the large-vault scan modal.
 */
export async function maybeShowWelcomeOnLaunch(
	plugin: WelcomeHost,
	isFreshInstall: boolean,
): Promise<void> {
	if (plugin.settings.welcomeSeen || !isFreshInstall) return;
	plugin.settings.welcomeSeen = true;
	await plugin.saveSettings();
	await new WelcomeModal(plugin).prompt();
}
