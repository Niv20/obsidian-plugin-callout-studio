import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { syncThemeOverlayRows } from "../src/manager/theme/themeOverlayRows";
import { applyImportedCallout } from "../src/utils/importedCallout";
import { planCalloutManagerImport } from "../src/utils/calloutManagerImport";
import { validateImportPayload } from "../src/utils/importValidator";
import { planAdmonitionImport } from "../src/utils/admonitionImport";
import { definition, discovered } from "./support/discoveryHarness";

function vault(...themeIds: string[]): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	syncThemeOverlayRows(registry, new Set(themeIds));
	return registry;
}

describe("theme overlay across destructive and durable operations", () => {
	it("reset recreates theme ids previously held by saved rows and aliases", () => {
		const registry = vault();
		registry.add(discovered("scanned"));
		registry.add(definition({ id: "mine", aliases: ["theme-alias"] }));
		syncThemeOverlayRows(registry, new Set(["scanned", "theme-alias", "note"]));
		let notifications = 0;
		registry.onChange(() => notifications++);
		registry.resetAll();
		assert.equal(notifications, 1, "reset is one complete change");
		for (const id of ["scanned", "theme-alias"]) {
			assert.equal(registry.get(id)?.source, "theme", id);
			assert.equal(registry.themeOwns(registry.get(id)!), true);
		}
		assert.equal(registry.get("mine"), undefined);
		assert.equal(registry.get("note")?.builtIn, true);
		assert.deepEqual(registry.toSaveData().callouts, []);
	});

	it("reset rebuilds temporary rows without references to deleted palettes or pictures", () => {
		const registry = vault();
		registry.update("note", { icon: { type: "image", value: "old-picture" }, paletteId: "old-palette" });
		syncThemeOverlayRows(registry, new Set(["recite"]));
		registry.resetAll();
		assert.deepEqual(registry.get("recite")?.icon, registry.get("note")?.icon);
		assert.equal(registry.get("recite")?.paletteId, registry.get("note")?.paletteId);
	});

	it("JSON import publishes an overlay replacement as one change", () => {
		const registry = vault("recite");
		const observed: (string | undefined)[] = [];
		registry.onChange(() => observed.push(registry.get("recite")?.source));
		assert.ok(applyImportedCallout(registry, definition({ id: "recite" })));
		assert.deepEqual(observed, ["user"]);
	});

	it("JSON import replaces attribute-equivalent overlay ids and aliases", () => {
		const registry = vault("two-words", "theme-alias");
		assert.ok(applyImportedCallout(registry, definition({ id: "two words", aliases: ["theme-alias"] })));
		assert.equal(registry.get("two-words"), undefined);
		assert.equal(registry.get("theme-alias"), undefined);
		assert.equal(registry.get("two words")?.source, "user");
		assert.equal(registry.themeOwns(registry.get("two words")!), true);
	});

	it("a refused import leaves the overlay and saved definitions intact", () => {
		const registry = vault("recite");
		const row = registry.get("recite");
		const saved = registry.toSaveData();
		assert.equal(applyImportedCallout(registry, definition({ id: "recite", aliases: ["note"] })), false);
		assert.deepEqual(registry.get("recite"), row);
		assert.deepEqual(registry.toSaveData(), saved);
	});

	it("Callout Manager import saves the same definition with and without the theme", () => {
		const a = vault("recite"), b = vault();
		for (const registry of [a, b]) {
			const plan = planCalloutManagerImport([{ id: "recite", color: "#123456" }], registry);
			assert.deepEqual(registry.applyCalloutManagerImport(plan.toApply), { created: 1, updated: 0 });
			assert.equal(registry.get("recite")?.source, "user");
		}
		// Separate imports allocate separate palette IDs. Their definitions and
		// palette contents must otherwise agree, and each link must resolve.
		for (const registry of [a, b]) assert.ok(registry.settings.customPalettes.some(
			palette => palette.id === registry.get("recite")?.paletteId,
		));
		assert.deepEqual(
			a.toSaveData().callouts.map(row => ({ ...row, paletteId: undefined })),
			b.toSaveData().callouts.map(row => ({ ...row, paletteId: undefined })),
		);
		assert.equal(a.themeOwns(a.get("recite")!), true);
	});

	it("Admonition import saves default fields independently of the theme", async () => {
		const a = vault("recite"), b = vault();
		for (const registry of [a, b]) {
			const plan = await planAdmonitionImport([{ type: "recite" }], registry, []);
			assert.deepEqual(registry.applyAdmonitionImport(plan), { created: 1, updated: 0 });
			assert.equal(registry.get("recite")?.source, "user");
		}
		// Separate imports allocate separate palette IDs. Their definitions and
		// palette contents must otherwise agree, and each link must resolve.
		for (const registry of [a, b]) assert.ok(registry.settings.customPalettes.some(
			palette => palette.id === registry.get("recite")?.paletteId,
		));
		assert.deepEqual(
			a.toSaveData().callouts.map(row => ({ ...row, paletteId: undefined })),
			b.toSaveData().callouts.map(row => ({ ...row, paletteId: undefined })),
		);
	});
	it("JSON validation does not treat a temporary alias as a saved conflict", async () => {
		const a = vault("two-words", "theme-alias"), b = vault();
		const backup = [definition({ id: "two words", aliases: ["theme-alias"], icon: { type: "emoji", value: "⭐" } })];
		const first = await validateImportPayload(backup, a);
		const second = await validateImportPayload(backup, b);
		assert.equal(first.validDefs.length, 1);
		assert.deepEqual(first.validDefs, second.validDefs);
		assert.ok(applyImportedCallout(a, first.validDefs[0]!));
	});

	it("a planned create cannot overwrite a saved row added while the import was open", () => {
		const registry = vault("recite");
		const plan = planCalloutManagerImport([{ id: "recite", color: "#123456" }], registry);
		applyImportedCallout(registry, definition({ id: "recite", displayName: "New local edit" }));
		const before = structuredClone(registry.get("recite"));
		assert.deepEqual(registry.applyCalloutManagerImport(plan.toApply), { created: 0, updated: 0 });
		assert.deepEqual(registry.get("recite"), before);
	});

});
