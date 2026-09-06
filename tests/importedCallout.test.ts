import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { applyImportedCallout } from "../src/utils/importedCallout";
import { validateImportPayload } from "../src/utils/importValidator";
import type { CalloutDefinition } from "../src/types";

const row = (): CalloutDefinition => ({
	id: "saved", displayName: "Saved", icon: { type: "emoji", value: "📝" },
	colorLight: "#123456", colorDark: "#654321", foldable: true,
	defaultFolded: false, builtIn: false, source: "user",
});

describe("backup callout replacement", () => {
	it("restores omitted optional fields while preserving aliases used by notes", async () => {
		const registry = new CalloutRegistry(); registry.load(null); registry.add(row());
		const backup = JSON.parse(registry.exportToJSONv2()) as unknown;
		registry.update("saved", {
			textColorLight: "#ff0000", textColorDark: "#00ff00", iconSize: 1.5,
			iconAdjust: { heading: { size: 1.2 } }, iconOffsetX: 4, iconOffsetY: 2,
			paletteId: "later-palette", metadata: { later: "value" },
			customized: true, externalStyle: true, aliases: ["still used"],
		});
		const result = await validateImportPayload(backup, registry);
		assert.equal(result.fatal, false); assert.equal(result.validDefs.length, 1);
		assert.equal(applyImportedCallout(registry, result.validDefs[0]!), true);
		const restored = registry.getReal("saved")!;
		for (const key of ["textColorLight", "textColorDark", "iconSize", "iconAdjust",
			"iconOffsetX", "iconOffsetY", "paletteId", "metadata", "customized", "externalStyle"] as const) {
			assert.equal(restored[key], undefined, key);
		}
		assert.equal(registry.findByIdentity("still-used")?.id, "saved");
		assert.equal(registry.applyPaletteColors("later-palette", { colorLight: "#ffffff", colorDark: "#ffffff" }), 0);
		assert.equal(restored.colorLight, "#123456");
		const first = JSON.stringify(registry.toSaveData());
		applyImportedCallout(registry, result.validDefs[0]!);
		assert.equal(JSON.stringify(registry.toSaveData()), first);
	});
	it("merges aliases by canonical identity even when the backup supplies an empty list", () => {
		const registry = new CalloutRegistry(); registry.load(null);
		registry.add({ ...row(), aliases: ["old name"] });
		applyImportedCallout(registry, { ...row(), aliases: [] });
		assert.deepEqual(registry.getReal("saved")?.aliases, ["old name"]);
		applyImportedCallout(registry, { ...row(), aliases: ["new name", "old-name"] });
		assert.deepEqual(registry.getReal("saved")?.aliases, ["new name", "old-name"]);
	});
});
