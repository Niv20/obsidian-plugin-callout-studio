/**
 * The "Reset everything" confirmation lists what this vault would lose, with a
 * count beside each kind. A row that would change nothing is left out, and a
 * setup with nothing to lose has an empty inventory — which is what lets the
 * button say "nothing to reset" instead of asking.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { isResetInventoryEmpty, resetInventory } from "../src/settings/resetInventory";
import { en } from "../src/i18n/en";
import { definition } from "./support/discoveryHarness";

function fresh(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

describe("Reset inventory", () => {
	it("is empty on a fresh setup", () => {
		assert.deepEqual(resetInventory(fresh()), { deleted: [], restored: [] });
		assert.ok(isResetInventoryEmpty(resetInventory(fresh())));
	});

	it("counts what would be deleted and leaves out what is not there", () => {
		const registry = fresh();
		registry.add(definition({ id: "mine", displayName: "Mine" }));
		registry.add(definition({ id: "yours", displayName: "Yours" }));
		assert.deepEqual(resetInventory(registry), {
			deleted: [{ labelKey: "settings.resetItemCallouts", count: 2 }],
			restored: [],
		});
	});

	it("names a setting group only once it differs from its default", () => {
		const registry = fresh();
		registry.settings.globalStyle.borderRadius += 1;
		registry.settings.fallbackCalloutId = "tip";
		assert.deepEqual(resetInventory(registry), {
			deleted: [],
			restored: [
				{ labelKey: "settings.resetItemGlobalStyle" },
				{ labelKey: "settings.resetItemFallback" },
			],
		});
	});

	it("is empty again after the reset", () => {
		const registry = fresh();
		registry.add(definition({ id: "mine", displayName: "Mine" }));
		registry.settings.headingCallouts.enabled = false;
		assert.equal(isResetInventoryEmpty(resetInventory(registry)), false);
		registry.resetAll();
		assert.ok(isResetInventoryEmpty(resetInventory(registry)));
	});

	it("has an English label for every row it can return", () => {
		const registry = fresh();
		registry.add(definition({ id: "mine", displayName: "Mine" }));
		Object.assign(registry.settings, {
			globalStyle: {}, contextMenu: {}, headingCallouts: {}, inlineCallouts: {}, fallbackCalloutId: "",
			iconLibraries: { order: [], hidden: ["emoji"] },
		});
		const { deleted, restored } = resetInventory(registry);
		assert.equal(restored.length, 6);
		for (const row of [...deleted, ...restored]) assert.ok(en[row.labelKey], row.labelKey);
	});

	it("names the icon libraries once they differ, and the reset puts them back", () => {
		// Their order and what is hidden are settings; the downloaded files are
		// this device's cache, which no reset of settings touches.
		const registry = fresh();
		registry.settings.iconLibraries.hidden = ["emoji"];
		assert.deepEqual(resetInventory(registry).restored, [{ labelKey: "settings.resetItemIconLibraries" }]);
		registry.resetAll();
		assert.deepEqual(registry.settings.iconLibraries, { order: [], hidden: [] });
		assert.ok(isResetInventoryEmpty(resetInventory(registry)));
	});

	it("puts the number first in every counted row's sentence", () => {
		const registry = fresh();
		registry.add(definition({ id: "mine", displayName: "Mine" }));
		const { deleted } = resetInventory(registry);
		assert.ok(deleted.length > 0);
		for (const row of deleted) {
			assert.ok(en[row.labelKey]!.startsWith("{{count}} "), `${row.labelKey} should open with its number`);
		}
		assert.ok(en["settings.resetItemReferences"]!.startsWith("{{count}} "));
	});
});
