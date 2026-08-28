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
 * - **The flag is persisted before the modal opens**, synchronously ahead of
 *   any await, so a startup interrupted while the screen is up (a crash, a
 *   reload) does not show it again on the next launch.
 *
 * `openWelcome()` on the plugin is the deliberate bypass — the protocol handler
 * and the DevTools console reach the screen through it regardless of the flag.
 */
import { WelcomeModal } from "./WelcomeModal";
import type { SettingsTabPlugin } from "./sections/types";

/** What the routing needs beyond what `WelcomeModal` itself takes. */
type WelcomeHost = SettingsTabPlugin & {
	saveSettings(): Promise<void>;
};

/**
 * Show the welcome screen if this launch is the one that should show it.
 *
 * Awaited by `onLayoutReady` before first-run discovery, so the splash never
 * stacks on top of the large-vault scan modal.
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
