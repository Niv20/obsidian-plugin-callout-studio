import assert from "node:assert";
import { describe, it } from "node:test";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import { registerDeveloperProtocols } from "../src/settings/developerProtocols";
import { shouldShowCompetitorImportBanner } from "../src/settings/competitorImportState";

describe("the private import-banner URI", () => {
	it("forces the banner and opens this plugin's settings tab", () => {
		const routes = new Map<string, () => void>();
		const opened: string[] = [];
		const plugin = {
			registerObsidianProtocolHandler: (route: string, handler: () => void) => {
				routes.set(route, handler);
			},
			app: {
				setting: {
					open: () => opened.push("settings"),
					openTabById: (id: string) => opened.push(id),
				},
			},
			manifest: { id: "callout-studio" },
			registry: { settings: { competitorImportBannerHandled: true } },
			openWelcome: () => Promise.resolve(),
		} as unknown as SettingsTabPlugin & { openWelcome(): Promise<void> };

		registerDeveloperProtocols(plugin);
		routes.get("callout-studio-import-banner")?.();

		assert.strictEqual(shouldShowCompetitorImportBanner(plugin), true);
		assert.deepStrictEqual(opened, ["settings", "callout-studio"]);
	});
});
