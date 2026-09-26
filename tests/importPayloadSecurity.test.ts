import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { DEFAULT_SETTINGS } from "../src/constants";
import { validateImportPayload } from "../src/utils/importValidator";
import { sanitizeImportedSettings } from "../src/utils/settingsValidator";
import { MAX_IMPORT_COLLECTION } from "../src/utils/importLimits";
import { materialPack } from "../src/icons/packs/material";
import { PackToolbarFilters } from "../src/settings/iconpicker/PackToolbarFilters";
import { asEl, el, fakeDom } from "./support/fakeDom";

function callout(): Record<string, unknown> {
	return { id: "security-test", displayName: "Security test", icon: { type: "emoji", value: "🙂" },
		colorLight: "#448aff", colorDark: "#448aff", foldable: true, defaultFolded: false };
}

describe("native import security boundaries", () => {
	it("reports missing image references in legacy array backups too", async () => {
		const registry = new CalloutRegistry(); registry.load(null);
		const entry = callout(); entry.icon = { type: "image", value: "img-absent" };
		const result = await validateImportPayload([entry], registry);
		assert.ok(result.issues.some(issue => issue.messageKey === "import.warn.imageMissing"));
		assert.equal(result.validDefs.length, 1);
	});

	it("refuses over-budget direct callers before per-entry validation", async () => {
		const registry = new CalloutRegistry(); registry.load(null);
		const result = await validateImportPayload(Array.from({ length: MAX_IMPORT_COLLECTION + 1 }, callout), registry);
		assert.equal(result.fatal, true);
		assert.equal(result.issues[0]?.messageKey, "import.err.tooComplex");
		assert.deepEqual(result.validDefs, []);
	});

	it("drops ignored Material-only values instead of storing unvalidated leftovers", async () => {
		const registry = new CalloutRegistry(); registry.load(null);
		const entry = callout(); entry.icon = { type: "emoji", value: "🙂", style: "unsupported", weight: Infinity };
		const result = await validateImportPayload([entry], registry);
		assert.deepEqual(result.validDefs[0]?.icon, { type: "emoji", value: "🙂" });
		assert.equal(result.issues.filter(issue => issue.messageKey === "import.warn.iconFieldIgnored").length, 2);
	});

	it("cannot smuggle objects into picker scalar values and crash string conversion", () => {
		// JSON can shadow both primitive-conversion methods without executing JS.
		// PackToolbarFilters renders variants with String(current).
		const hostile = JSON.parse('{"toString":0,"valueOf":0}') as unknown;
		assert.throws(() => String(hostile), TypeError);
		const { settings } = sanitizeImportedSettings({
			iconSources: { materialStyleDefault: hostile, materialWeightDefault: hostile,
				faStyleDefault: hostile, tablerStyleDefault: hostile, lastEmojiSkinTone: hostile,
				lastMaterialCategory: hostile, lastCategory: { material: hostile, emoji: "people" } },
			fallbackCalloutId: hostile, welcomeSeen: hostile,
			headingCallouts: { enabled: hostile, showFoldArrow: hostile },
			inlineCallouts: { enabled: hostile, allowContent: hostile },
			contextMenu: { enabled: hostile },
			globalStyle: { alignContentWithTitle: hostile, borderSides: { left: hostile },
				heading: { borderSides: { top: hostile } } },
		});
		assert.ok(settings);
		assert.deepEqual(settings.iconSources, { ...DEFAULT_SETTINGS.iconSources,
			lastCategory: { ...DEFAULT_SETTINGS.iconSources.lastCategory, emoji: "people" } });
		assert.doesNotThrow(() => String(settings.iconSources.materialStyleDefault));
		fakeDom.light();
		const filters = new PackToolbarFilters(asEl(el()), materialPack, {
			style: settings.iconSources.materialStyleDefault,
			weight: settings.iconSources.materialWeightDefault,
		}, settings.iconSources.lastCategory?.material ?? "", { onCategory: () => {}, onVariant: () => {} });
		filters.destroy();
		assert.equal(settings.fallbackCalloutId, DEFAULT_SETTINGS.fallbackCalloutId);
		assert.equal(settings.welcomeSeen, DEFAULT_SETTINGS.welcomeSeen);
		assert.deepEqual(settings.headingCallouts, DEFAULT_SETTINGS.headingCallouts);
		assert.deepEqual(settings.inlineCallouts, DEFAULT_SETTINGS.inlineCallouts);
		assert.equal(settings.contextMenu.enabled, DEFAULT_SETTINGS.contextMenu.enabled);
		assert.deepEqual(settings.globalStyle, DEFAULT_SETTINGS.globalStyle);
	});

	it("keeps valid false values and filters malformed picker ranges and enum names", () => {
		const { settings } = sanitizeImportedSettings({ contextMenu: { enabled: false },
			headingCallouts: { enabled: false }, globalStyle: { borderSides: { left: false } },
			iconSources: { materialStyleDefault: "constructor", materialWeightDefault: 1e100,
				faStyleDefault: "__proto__", tablerStyleDefault: "toString", lastEmojiSkinTone: -1 } });
		assert.equal(settings?.contextMenu.enabled, false);
		assert.equal(settings?.headingCallouts.enabled, false);
		assert.equal(settings?.globalStyle.borderSides.left, false);
		assert.deepEqual(settings?.iconSources, DEFAULT_SETTINGS.iconSources);
	});
});
