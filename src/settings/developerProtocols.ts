/** Private URI entry points used to preview first-run UI during development. */
import type { SettingsTabPlugin } from "./sections/types";
import { forceCompetitorImportBanner } from "./competitorImportState";

const IMPORT_BANNER_PROTOCOL = ["callout", "studio", "import", "banner"].join("-");

type DeveloperProtocolHost = SettingsTabPlugin & {
	openWelcome(): Promise<void>;
};

export function registerDeveloperProtocols(plugin: DeveloperProtocolHost): void {
	plugin.registerObsidianProtocolHandler("callout-studio-welcome", () => {
		void plugin.openWelcome();
	});
	plugin.registerObsidianProtocolHandler(IMPORT_BANNER_PROTOCOL, () => {
		forceCompetitorImportBanner(plugin);
		plugin.app.setting.open();
		plugin.app.setting.openTabById(plugin.manifest.id);
	});
}
