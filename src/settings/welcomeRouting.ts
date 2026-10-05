/**
 * settings/welcomeRouting.ts — who sees the welcome screen, and when.
 *
 * Not lifecycle, which is why it is not in `main.ts`: this is a policy about
 * one modal, with separate tutorial and first-install onboarding markers.
 *
 * - **Tutorials are offered once, including on upgrade.** The legacy welcome
 *   marker belongs to first-install onboarding, not to this new tutorial screen.
 *   A separate marker survives subsequent launches and version changes.
 * - **The welcome never creates a settings file.** A second absent read still
 *   cannot prove another device's settings are not arriving later. Remember
 *   the greeting in device-local storage immediately, while keeping the synced
 *   setting in memory until a deliberate settings edit persists it. This makes
 *   the welcome once-only without publishing defaults over a slowly arriving
 *   file (#53).
 * - **The import banner has its own lifetime.** Once first-install onboarding
 *   has made it eligible, every later launch arms it again until dismissal or
 *   a successful import persists `competitorImportBannerHandled` — or, on a
 *   device with no settings file to persist it in, records it device-locally.
 *
 * `openWelcome()` on the plugin is the deliberate bypass — the protocol handler
 * and the DevTools console reach the screen through it regardless of the flag.
 */
import { WelcomeModal } from "./WelcomeModal";
import type { ExternalReloadHost } from "../manager/settingsAdopt";
import type { SettingsTabPlugin } from "./sections/types";
import { armCompetitorImportBanner } from "./competitorImportState";

/** What the routing needs beyond what `WelcomeModal` itself takes. */
type WelcomeHost = SettingsTabPlugin &
	ExternalReloadHost & {
		saveSettings(): Promise<void>;
	};

/**
 * Show the welcome screen if this launch is the one that should show it.
 *
 * `manager/launchSequence.ts` rechecks the settings file immediately before
 * reaching this point. Showing or dismissing the tutorials is never a save.
 */
export async function maybeShowWelcomeOnLaunch(
	plugin: WelcomeHost,
	isFreshInstall: boolean,
): Promise<void> {
	if (plugin.settingsWriter.isDestroyed) return;
	const welcomeSeen =
		plugin.settings.welcomeSeen === true || plugin.localState.hasSeenWelcome;

	// Re-arm the separate import prompt on every launch after first-install
	// onboarding. Manually opening WelcomeModal never sets either marker, so it
	// still cannot opt an existing user into the banner.
	if (
		welcomeSeen &&
		plugin.settings.competitorImportBannerHandled !== true &&
		!plugin.localState.hasHandledImportBanner
	) {
		armCompetitorImportBanner(plugin);
	}

	const tutorialsSeen = plugin.settings.tutorialWelcomeSeen === true ||
		plugin.localState.hasSeenTutorialWelcome;
	if (tutorialsSeen) {
		// Keep the local memory when a synced marker arrives, and carry local
		// memory into the next deliberate save without writing for the greeting.
		if (!plugin.localState.hasSeenTutorialWelcome) plugin.localState.markTutorialWelcomeSeen();
		plugin.settings.tutorialWelcomeSeen = true;
		return;
	}
	// A non-fresh launch can also mean missing or unreadable settings. Let
	// recovery finish before offering tutorials; do not consume their marker.
	if (plugin.settingsWriter.isFrozen) return;

	// Persist locally before opening: a plugin reload while the modal is open
	// must not open a second automatic welcome. This deliberately does not mark
	// the installation initialized and does not create data.json.
	if (!plugin.localState.markTutorialWelcomeSeen()) return;
	plugin.settings.tutorialWelcomeSeen = true;
	if (isFreshInstall && !welcomeSeen) {
		plugin.localState.markWelcomeSeen();
		armCompetitorImportBanner(plugin);
		plugin.settings.welcomeSeen = true;
	}
	await new WelcomeModal(plugin).prompt();
}
