/** Complete startup without scanning notes or creating discovered rows. */
import { confirmFreshInstall } from "./settingsLateArrival";
import { maybeShowWelcomeOnLaunch } from "../settings/welcomeRouting";
import { initializeSidebarTabs } from "../ui/initializeSidebarTabs";
import type { SettingsBootResult } from "./settingsBoot";
import type CalloutStudioPlugin from "../main";

export async function runLaunchSequence(
 plugin: CalloutStudioPlugin,
 boot: SettingsBootResult,
): Promise<void> {
 if (plugin.settingsWriter.isDestroyed) return;
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
