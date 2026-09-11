import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import {
	competitorImportMessage,
	detectEnabledCompetitors,
} from "../src/settings/competitorImportBanner";

function appWithPlugins(enabled: string[], installed = enabled): App {
	return {
		plugins: {
			enabledPlugins: new Set(enabled),
			manifests: Object.fromEntries(installed.map((id) => [id, { id }])),
		},
	} as unknown as App;
}

describe("the first-install competitor import banner", () => {
	it("requires a competitor to be both installed and enabled", () => {
		assert.deepStrictEqual(
			detectEnabledCompetitors(
				appWithPlugins(["callout-manager"], ["obsidian-admonition"]),
			),
			[],
		);
	});

	it("recognizes both supported competitors in a stable display order", () => {
		assert.deepStrictEqual(
			detectEnabledCompetitors(
				appWithPlugins(["obsidian-admonition", "callout-manager"]),
			),
			[
				{ id: "callout-manager", name: "Callout Manager" },
				{ id: "admonition", name: "Admonition" },
			],
		);
	});

	it("passes one locale-aware plugin list to one translation string", () => {
		assert.strictEqual(
			competitorImportMessage([{ id: "admonition", name: "Admonition" }]),
			"We noticed you are using Admonition. Would you like to import your callouts?",
		);
		assert.strictEqual(
			competitorImportMessage([
				{ id: "callout-manager", name: "Callout Manager" },
				{ id: "admonition", name: "Admonition" },
			]),
			"We noticed you are using Callout Manager and Admonition. Would you like to import your callouts?",
		);
	});
});
