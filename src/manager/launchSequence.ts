/** Complete startup without scanning notes or creating discovered rows. */
import { confirmFreshInstall, confirmLaunchRead } from "./settingsLateArrival";
import { settleWait } from "./settingsSettledRead";
import { maybeShowWelcomeOnLaunch } from "../settings/welcomeRouting";
import { initializeSidebarTabs } from "../ui/initializeSidebarTabs";
import type { SettingsBootResult } from "./settingsBoot";
import type CalloutStudioPlugin from "../main";

export async function runLaunchSequence(plugin: CalloutStudioPlugin, boot: SettingsBootResult): Promise<void> {
	if (plugin.settingsWriter.isDestroyed) return;
	// What launch still owes the settings file (`confirmLater` in settingsBoot.ts).
	if (boot.confirmLater && boot.isFreshInstall) {
		// The pause itself, spent here where nothing waits behind it, so the
		// confirmation below looks at the folder exactly as late as it always did.
		await settleWait(plugin)();
		if (plugin.settingsWriter.isDestroyed) return;
	} else if (boot.confirmLater) {
		// Not awaited: the second read must not hold the welcome back either.
		void confirmLaunchRead(plugin).catch((error: unknown) => {
			console.error("[callout-studio] could not confirm settings after launch", error);
		});
	}
	const fresh = boot.isFreshInstall ? await confirmFreshInstall(plugin) : false;
	if (plugin.settingsWriter.isDestroyed) return;
	try {
		await initializeSidebarTabs(plugin, fresh);
	} catch (error) {
		console.warn("[CalloutStudio] could not initialize sidebar tabs", error);
	}
	if (plugin.settingsWriter.isDestroyed) return;
	await maybeShowWelcomeOnLaunch(plugin, fresh);
}
