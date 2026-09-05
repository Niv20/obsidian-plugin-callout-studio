import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { listUserImages } from "../src/icons/packs/userImages";
import type { PluginData, PluginSettings } from "../src/types";
import { definition } from "./support/discoveryHarness";

function populatedRegistry(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load({ callouts: [definition({ id: "local" })], futureLocalField: true } as Partial<PluginData>);
	registry.settings.fallbackCalloutId = "local";
	registry.settings.customPalettes.push({ id: "local-palette", name: "Local palette",
		colorLight: "#123456", colorDark: "#654321", bgColorLight: "#abcdef", bgColorDark: "#fedcba",
		textColorLight: "#000000", textColorDark: "#ffffff" });
	registry.setUserImages([{ id: "img-local", name: "Local.svg", format: "svg", svg: "<svg/>",
		width: 24, height: 24, monochrome: false, rev: 1, addedAt: 1 }]);
	registry.iconSvgCache.push({ pack: "material", name: "local", variant: "", svg: "<svg/>" });
	return registry;
}

describe("loading settings replaces the whole previous device state", () => {
	const incoming: Array<[string, Partial<PluginData> | null]> = [
		["null", null],
		["empty legacy object", {}],
		["empty callouts without settings", { callouts: [] }],
		["callouts without settings or artwork", { callouts: [definition({ id: "remote" })] }],
		["explicit undefined legacy keys", { settings: undefined, iconSvgCache: undefined }],
		["partial settings", { settings: { fallbackCalloutId: "warning" } as PluginSettings }],
	];
	for (const [label, data] of incoming) {
		it(`${label} produces the same data on a fresh and previously used device`, () => {
			const fresh = new CalloutRegistry(); fresh.load(structuredClone(data));
			const expected = fresh.toSaveData();
			const used = populatedRegistry();
			assert.equal(listUserImages().length, 1);
			assert.equal(used.iconSvgCache.length, 1);
			used.load(structuredClone(data));
			assert.deepEqual(used.toSaveData(), expected);
			assert.deepEqual(used.iconSvgCache, []);
			assert.deepEqual(listUserImages(), []);
			assert.equal(used.get("local"), undefined);
			assert.equal(used.hasPreviewDefinition(), false);
			assert.equal(used.needsSaveAfterLoad(), fresh.needsSaveAfterLoad());
		});
	}
	it("does not leak mutations into shipped defaults or the next reset", () => {
		const registry = populatedRegistry(); registry.load(null);
		registry.settings.customPalettes.push({ id: "new", name: "New",
			colorLight: "#123456", colorDark: "#654321", bgColorLight: "#abcdef", bgColorDark: "#fedcba",
			textColorLight: "#000000", textColorDark: "#ffffff" });
		registry.load(null);
		assert.deepEqual(registry.settings.customPalettes, []);
		assert.equal(registry.settings.fallbackCalloutId, "note");
	});
});

describe("a reload retires the previous preview and its shadow", () => {
	for (const demo of [false, true]) {
		for (const sameIdArrives of [false, true]) {
			it(`clearing an old ${demo ? "demo" : "editor"} preview cannot ${sameIdArrives ? "replace an incoming edit" : "resurrect a removed definition"}`, () => {
				const registry = populatedRegistry();
				registry.setPreviewDefinition(definition({ id: "local", displayName: "Unsaved preview" }), demo);
				const remote = definition({ id: sameIdArrives ? "local" : "remote", displayName: "From other device" });
				registry.load({ callouts: [remote] });
				assert.equal(registry.hasPreviewDefinition(), false);
				assert.equal(registry.getPreviewDefinition(), null);
				assert.equal(registry.isPreviewDemo(), false);
				const before = structuredClone(registry.toSaveData());
				registry.setPreviewDefinition(null);
				assert.deepEqual(registry.toSaveData(), before);
				assert.equal(registry.get(remote.id)?.displayName, "From other device");
				if (!sameIdArrives) assert.equal(registry.get("local"), undefined);
			});
		}
	}
	it("does not delete a newly synced definition that uses the old draft id", () => {
		const registry = populatedRegistry();
		registry.setPreviewDefinition(definition({ id: "draft" }));
		registry.load({ callouts: [definition({ id: "draft", displayName: "Remote saved draft" })] });
		registry.setPreviewDefinition(null);
		assert.equal(registry.get("draft")?.displayName, "Remote saved draft");
	});
	it("a null load also drops the old preview shadow permanently", () => {
		const registry = populatedRegistry();
		registry.setPreviewDefinition(definition({ id: "local" }));
		registry.load(null); registry.setPreviewDefinition(null);
		assert.equal(registry.get("local"), undefined);
		assert.equal(registry.hasPreviewDefinition(), false);
	});
});
