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
 * - **The welcome never creates a settings file.** A second absent read still
 *   cannot prove another device's settings are not arriving later. Remember
 *   the greeting in memory; a subsequent deliberate settings edit persists it
 *   with the actual change. A no-edit restart may show the welcome again, which
 *   is preferable to publishing defaults over a slowly arriving file (#53).
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
 * `manager/launchSequence.ts` rechecks the settings file immediately before
 * reaching this point. Showing or dismissing the preview is never a save.
 */
export async function maybeShowWelcomeOnLaunch(
	plugin: WelcomeHost,
	isFreshInstall: boolean,
): Promise<void> {
	if (plugin.settings.welcomeSeen || !isFreshInstall) return;
	plugin.settings.welcomeSeen = true;
	await new WelcomeModal(plugin).prompt();
}
