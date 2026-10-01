/**
 * tests/importPaletteNames.test.ts — an imported palette that carries a name the
 * vault already uses.
 *
 * The editor will not save a second palette under a name that is taken, and its
 * auto-suggested name for any blue is "Blue 2" (the preset owns "Blue"), so two
 * vaults that each made a blue palette both end up with a "Blue 2" under
 * different ids. Importing one into the other used to merge by id alone, and the
 * only tidy-up after it compared *colours* — so two palettes of the same name
 * and different looks both stayed, indistinguishable in every dropdown.
 *
 * A name is how the user tells palettes apart, so an import treats it as the
 * palette's identity: the file's version replaces the vault's, which keeps its
 * own id (every callout already linked to it stays linked) and its place in the
 * list. These drive the real importer end to end, the way `importSafety.test.ts`
 * does; the merge rule itself is pinned in `importListMerge.test.ts`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { processImportedJSON } from "../src/settings/sections/DataManagementSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import type { CalloutDefinition, CustomPalette } from "../src/types";
import { bakePaletteColors, customPaletteToColorPalette } from "../src/utils/colorPalettes";
import { definition } from "./support/discoveryHarness";
import { memoryVault, PLUGIN_MANIFEST, savingWriter, stubConfirm } from "./support/importSafetyStubs";

(globalThis as { __CS_ICON_IDS__?: string[] }).__CS_ICON_IDS__ = ["lucide-pencil", "pencil"];

const PLAIN = {
	colorLight: "#4183f2", colorDark: "#448aff", bgColorLight: "#ecf3ff", bgColorDark: "#202733",
	textColorLight: "#1a1a1a", textColorDark: "#e0e0e0",
};
const DEEPER = {
	colorLight: "#3d7ce6", colorDark: "#448aff", bgColorLight: "#dae8ff", bgColorDark: "#243249",
	textColorLight: "#1a1a1a", textColorDark: "#e0e0e0",
};

const palette = (id: string, name: string, colors: typeof PLAIN = PLAIN): CustomPalette => ({ id, name, ...colors });

/** A callout that applies `p`: its colours baked on and the link to it set. */
const using = (id: string, p: CustomPalette): CalloutDefinition =>
	definition({ id, displayName: id, paletteId: p.id, ...bakePaletteColors(customPaletteToColorPalette(p)) });

function vault(palettes: CustomPalette[], callouts: CalloutDefinition[] = []): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.settings.customPalettes = palettes;
	for (const def of callouts) registry.add(def);
	return registry;
}

/** Import `source`'s export into `target`, confirming the dialog. */
async function importInto(target: CalloutRegistry, source: CalloutRegistry): Promise<string[]> {
	const confirm = stubConfirm(true);
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
	const ctx = {
		app: {} as App,
		plugin: {
			registry: target, app: memoryVault().app, manifest: PLUGIN_MANIFEST, settingsWriter: savingWriter(),
			customCommands: { syncAll: () => {} },
			saveSettings: () => Promise.resolve(),
			refreshRenderModes: () => {}, ensureIconArtworkFor: () => Promise.resolve(),
		},
		display: () => {},
	} as unknown as SettingsSectionContext;
	try {
		await processImportedJSON(ctx, new File([source.exportToJSONv2()], "backup.json", { type: "application/json" }));
	} finally { confirm.restore(); }
	return notices;
}

const names = (registry: CalloutRegistry): string[] => registry.settings.customPalettes.map((p) => p.name);
const colorsOf = (def: CalloutDefinition | undefined) =>
	({ colorLight: def?.colorLight, bgColorLight: def?.bgColorLight, bgColorDark: def?.bgColorDark });

describe("importing a palette whose name the vault already has", () => {
	it("updates the vault's palette instead of adding a second one", async () => {
		const mine = palette("cp-local", "Blue 2", PLAIN);
		const theirs = palette("cp-file", "Blue 2", DEEPER);
		const target = vault([mine], [using("mine", mine)]);
		await importInto(target, vault([theirs], [using("theirs", theirs)]));

		assert.deepEqual(names(target), ["Blue 2"], "the import left two palettes under one name");
		const kept = target.settings.customPalettes[0]!;
		assert.equal(kept.id, "cp-local", "the vault's palette lost its id, orphaning the callouts linked to it");
		assert.equal(kept.bgColorLight, DEEPER.bgColorLight, "the file's colours did not replace the vault's");
	});

	it("keeps every callout linked, the imported one included", async () => {
		const mine = palette("cp-local", "Blue 2", PLAIN);
		const theirs = palette("cp-file", "Blue 2", DEEPER);
		const target = vault([mine], [using("mine", mine)]);
		await importInto(target, vault([theirs], [using("theirs", theirs)]));

		assert.equal(target.get("mine")?.paletteId, "cp-local");
		assert.equal(target.get("theirs")?.paletteId, "cp-local", "the imported callout points at a palette that is gone");
	});

	it("restyles the callouts that use it, as editing the palette would", async () => {
		// "Blue 2" now reads as one colour everywhere. Leaving a callout that is
		// not in the file on the old look would put two appearances under one
		// name — the very thing this rule exists to prevent.
		const mine = palette("cp-local", "Blue 2", PLAIN);
		const theirs = palette("cp-file", "Blue 2", DEEPER);
		const target = vault([mine], [using("mine", mine)]);
		await importInto(target, vault([theirs], [using("theirs", theirs)]));

		assert.deepEqual(colorsOf(target.get("mine")), colorsOf(target.get("theirs")));
		assert.equal(target.get("mine")?.bgColorLight, DEEPER.bgColorLight);
	});

	it("matches names ignoring case and surrounding spaces, as the editor does", async () => {
		const target = vault([palette("cp-local", "Blue 2", PLAIN)]);
		await importInto(target, vault([palette("cp-file", "  blue 2 ", DEEPER)]));
		assert.equal(target.settings.customPalettes.length, 1);
		assert.equal(target.settings.customPalettes[0]?.id, "cp-local");
	});

	it("still adds a palette whose name is new", async () => {
		const target = vault([palette("cp-local", "Blue 2", PLAIN)]);
		await importInto(target, vault([palette("cp-file", "Green", DEEPER)]));
		assert.deepEqual(names(target).sort(), ["Blue 2", "Green"]);
	});

	it("changes nothing when the same file is imported again", async () => {
		const theirs = palette("cp-file", "Blue 2", DEEPER);
		const target = vault([palette("cp-local", "Blue 2", PLAIN)]);
		const source = vault([theirs], [using("theirs", theirs)]);
		await importInto(target, source);
		const once = JSON.stringify([target.settings.customPalettes, target.get("theirs")]);
		await importInto(target, source);
		assert.equal(JSON.stringify([target.settings.customPalettes, target.get("theirs")]), once);
		assert.equal(target.settings.customPalettes.length, 1);
	});

	it("leaves callouts alone when the colours it brings are the ones the vault had", async () => {
		// Same name, same look, different id: nothing to restyle, and a callout
		// the user tuned by hand since must not be repainted for no reason.
		const mine = palette("cp-local", "Blue 2", PLAIN);
		const target = vault([mine], [{ ...using("mine", mine), bgColorLight: "#123456" }]);
		await importInto(target, vault([palette("cp-file", "Blue 2", PLAIN)]));
		assert.equal(target.get("mine")?.bgColorLight, "#123456");
		assert.equal(target.settings.customPalettes.length, 1);
	});

	it("folds two same-named palettes a vault already holds into the one the file brings", async () => {
		// The state an earlier version left behind: one palette made here, one
		// that arrived with an import, both called "Blue 2". Importing the file
		// again is enough to repair it.
		const first = palette("cp-a", "Blue 2", PLAIN);
		const second = palette("cp-b", "Blue 2", DEEPER);
		const target = vault([first, second], [using("x", first), using("y", second)]);
		const notices = await importInto(target, vault([second]));

		assert.deepEqual(names(target), ["Blue 2"], "the vault still holds two palettes called Blue 2");
		const kept = target.settings.customPalettes[0]!;
		assert.equal(target.get("x")?.paletteId, kept.id);
		assert.equal(target.get("y")?.paletteId, kept.id, "a callout was left pointing at the palette that was folded away");
		assert.equal(target.get("x")?.bgColorLight, DEEPER.bgColorLight);
		assert.ok(notices.some((n) => n.startsWith("Merged 1 saved color")), "the fold was not announced");
	});

	it("does not fold two palettes of the same name that the file itself carries", async () => {
		// A file exported from a vault in the state above. Neither is the vault's
		// to overwrite, so both arrive as they were rather than one eating the other.
		const target = vault([]);
		await importInto(target, vault([palette("cp-a", "Blue 2", PLAIN), palette("cp-b", "Blue 2", DEEPER)]));
		assert.deepEqual(target.settings.customPalettes.map((p) => p.id), ["cp-a", "cp-b"]);
	});
});
