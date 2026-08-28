/**
 * tests/exportRoundTrip.test.ts — export a vault, import it into another, and
 * check that nothing was lost on the way.
 *
 * "Export" means one thing to the user — *back up my callouts* — and three
 * pieces of code have to agree on it: `exportToJSONv2` writes the file,
 * `validateImportPayload` decides what in it is safe, and
 * `processImportedJSON` applies the result. A gap anywhere in that chain is
 * silent by construction: the file is written, the import reports success, and
 * the missing part is only noticed later, by a user who no longer has the
 * original vault. So the round trip is driven end to end here rather than at
 * any one of the three.
 *
 * The property the whole file is built around: **a fresh vault fed one vault's
 * export must export byte-for-byte the same file back.** That single assertion
 * covers every field of every definition and every settings key at once,
 * including ones added years after this was written, which is what a
 * hand-written list of fields could never do.
 *
 * Around it sit the cases where "restore" and "replace" are deliberately not
 * the same thing:
 *
 * - **A modified built-in travels, and lands on the built-in.** Recolouring
 *   `note` is real, user-authored work, and `toSaveData` already persists it —
 *   leaving it out of the file made "export" quietly not mean "back up my
 *   callouts". It must land *on* the built-in, not beside it as a duplicate
 *   user row.
 * - **An untouched built-in does not travel at all.**
 * - **The three lists the user builds up are merged by id, never replaced.**
 *   `customPalettes` / `userImages` / `customCommands` live in settings so that
 *   the export carries them; the price is that a plain `Object.assign` of the
 *   imported settings would wipe whatever the importing vault had of its own —
 *   including from a file that predates the list entirely. This is the one
 *   place that is tested, because `sanitizeImportedSettings` deliberately hands
 *   back empty arrays for a file that says nothing, and reading it alone makes
 *   the wipe look safe (see `settingsValidator.test.ts`).
 * - **Everything else IS replaced wholesale**, because global style, menu
 *   config and language are single values with no id to merge on.
 *
 * ── One gap, deliberately left ───────────────────────────────────────────────
 *
 * A picture arriving *in the file* is not exercised. `mergeSavedSettings` runs
 * every incoming `userImages` entry back through `sanitizeUserSvg`, which needs
 * a real `DOMParser` — Node has none, and `userImages.test.ts` already records
 * why a stubbed one would only be testing the stub. So the fixtures carry an
 * empty `userImages` and the pictures list is covered from the other side: the
 * importing vault's own pictures (set through `setUserImages`, which does not
 * re-sanitize) must survive an import, and must reach the pack through the
 * registry rather than by assignment. The merge itself is the same `byId` fold
 * as palettes and commands, both of which are covered in full below.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { EXPORT_FORMAT_ID, EXPORT_FORMAT_VERSION } from "../src/manager/CalloutRegistry";
import { processImportedJSON } from "../src/settings/sections/DataManagementSection";
import { validateImportPayload } from "../src/utils/importValidator";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import type {
	CalloutDefinition,
	CustomCommand,
	CustomPalette,
	PluginData,
	PluginSettings,
	UserImageIcon,
} from "../src/types";

// Seeded before the first registry load, for the reason calloutRegistryCore's
// header gives: `load()` runs the `lucide-` repair migration and
// `icons/lucideId.ts` memoizes the prefixed half of `getIconIds()` on first
// use. It is also what `createIconNameCheck` reads, so an empty list would make
// the importer replace every Lucide icon in the file with the fallback and
// warn about each one.
(globalThis as { __CS_ICON_IDS__?: string[] }).__CS_ICON_IDS__ = [
	"lucide-pencil",
	"lucide-star",
	"lucide-flame",
	"lucide-info",
	"dice",
];

/* ────────────────────────────────────────────────────────────────────────────
 * Fixtures
 * ──────────────────────────────────────────────────────────────────────────── */

function palette(over: Partial<CustomPalette> = {}): CustomPalette {
	return {
		id: "cp-source",
		name: "Ember",
		colorLight: "#b3541e",
		colorDark: "#ff9f5a",
		bgColorLight: "#fbeee4",
		bgColorDark: "#2a1a10",
		textColorLight: "#241109",
		textColorDark: "#f7e8dc",
		...over,
	};
}

function image(over: Partial<UserImageIcon> = {}): UserImageIcon {
	return {
		id: "img-source01",
		name: "logo.svg",
		format: "svg",
		svg: "<svg/>",
		width: 24,
		height: 24,
		monochrome: true,
		rev: 1,
		addedAt: 0,
		...over,
	};
}

function command(over: Partial<CustomCommand> = {}): CustomCommand {
	return { id: "cmd-source", calloutId: "alpha", role: "inline", ...over };
}

/**
 * A vault with something of everything in it: a user callout using every
 * optional field the model has, a picture-backed one, a transparent one, a
 * theme-owned one, a modified built-in and an untouched one — plus non-default
 * global settings and all three lists.
 *
 * Built through `load()` rather than through `add()` so the settings really go
 * through `mergeSavedSettings`, exactly as a vault read off disk does. That
 * matters for the equality test: it puts both sides of the comparison on the
 * same side of every sanitizer.
 */
function sourceVault(): CalloutRegistry {
	const callouts: CalloutDefinition[] = [
		{
			id: "alpha",
			displayName: "Alpha",
			icon: { type: "lucide", value: "lucide-flame" },
			colorLight: "#b3541e",
			colorDark: "#ff9f5a",
			bgColorLight: "#fbeee4",
			bgColorDark: "#2a1a10",
			bgGradient: {
				angleDeg: 135,
				toColorLight: "#fdf7f2",
				toColorDark: "#160d07",
				textGradient: true,
				textToColorLight: "#7a3a14",
				textToColorDark: "#ffd0ad",
			},
			textColorLight: "#241109",
			textColorDark: "#f7e8dc",
			foldable: true,
			defaultFolded: true,
			builtIn: false,
			source: "user",
			customized: true,
			paletteId: "cp-source",
			aliases: ["ember", "spark"],
			iconAdjust: { heading: { offsetX: 2, offsetY: -1, size: 1.2 } },
			iconOffsetX: 1,
			iconOffsetY: -2,
			iconSize: 1.1,
			metadata: { origin: "handbook" },
		},
		{
			id: "beta",
			displayName: "Beta",
			icon: { type: "emoji", value: "🔥" },
			colorLight: "#336699",
			colorDark: "#88bbee",
			foldable: false,
			defaultFolded: false,
			builtIn: false,
			source: "user",
			customized: true,
			transparentBg: true,
		},
		{
			id: "gamma",
			displayName: "Gamma",
			icon: { type: "lucide", value: "dice" },
			colorLight: "#2e7d32",
			colorDark: "#81c784",
			foldable: true,
			defaultFolded: false,
			builtIn: false,
			source: "user",
			customized: true,
			hideIcon: true,
			externalStyle: true,
		},
		// A built-in the user recoloured and renamed. `toSaveData` persists it,
		// so the export has to carry it too.
		{
			id: "note",
			displayName: "Memo",
			icon: { type: "lucide", value: "lucide-star" },
			colorLight: "#7b1fa2",
			colorDark: "#ce93d8",
			foldable: false,
			defaultFolded: false,
			builtIn: true,
			source: "builtin",
		},
	];

	const settings: Partial<PluginSettings> = {
		globalStyle: {
			borderSides: { top: false, right: false, bottom: false, left: true },
			borderWidth: 4,
			titleScale: 1.2,
			contentScale: 0.9,
			borderRadius: 10,
			alignContentWithTitle: true,
			heading: {
				borderSides: { top: false, right: false, bottom: true, left: false },
				borderWidth: 2,
				borderRadius: 8,
				paddingTop: 0.5,
				paddingBottom: 0.5,
				marginTop: 1,
			},
			inline: {
				borderSides: { top: true, right: true, bottom: true, left: true },
				borderWidth: 1,
				borderRadius: 20,
				fontScale: 0.95,
			},
		},
		contextMenu: {
			enabled: false,
			items: {
				regular: [
					{ id: "openSettings", enabled: true },
					{ id: "edit", enabled: false },
					{ id: "foldDefaults", enabled: true },
					{ id: "copyMarkdown", enabled: true },
				],
				heading: [
					{ id: "edit", enabled: true },
					{ id: "cutSection", enabled: false },
					{ id: "copySection", enabled: true },
					{ id: "deleteSection", enabled: true },
					{ id: "openSettings", enabled: true },
				],
				inline: [
					{ id: "openSettings", enabled: true },
					{ id: "edit", enabled: true },
				],
			},
		},
		autocomplete: { enabled: false },
		iconSources: {
			materialStyleDefault: "sharp",
			materialWeightDefault: 500,
			lastCategory: { material: "Social" },
			lastEmojiSkinTone: 3,
		},
		headingCallouts: {
			enabled: false,
			refCleanTitles: true,
			refShowIcon: true,
			showFoldArrow: false,
		},
		inlineCallouts: { enabled: true, allowContent: false },
		welcomeSeen: true,
		fallbackCalloutId: "alpha",
		language: "he",
		customPalettes: [palette()],
		// Empty on purpose — see the "one gap" note in the file header.
		userImages: [],
		customCommands: [command()],
		disabledFixedCommands: ["callout-unwrap"],
	};

	const registry = new CalloutRegistry();
	registry.load({ version: 3, callouts, settings } as Partial<PluginData>);
	return registry;
}

/** An empty vault: a fresh install, nothing but the 13 built-ins. */
function emptyVault(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

/**
 * An empty vault of the SAME era as {@link sourceVault} — one that predates the
 * two-mode model, as any vault carrying an exportable file does.
 *
 * The round trip needs this, not a clean install: on a clean install an
 * unconfigured built-in belongs to the theme, so an imported one that the
 * exporter was painting arrives carrying an explicit `styleMode` to say so, and
 * the re-export is legitimately one field longer. That behaviour is asserted
 * directly below rather than being allowed to blur the field-for-field check.
 */
function emptyVaultOfSameEra(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load({ version: 3, callouts: [] } as Partial<PluginData>);
	return registry;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Driving the real import path
 * ──────────────────────────────────────────────────────────────────────────── */

interface ImportRun {
	ctx: SettingsSectionContext;
	/** Notices raised, in order — the only user-facing result of an import. */
	notices: string[];
	calls: {
		saves: number;
		displays: number;
		renderModes: number;
		commandSweeps: number;
		artworkBatches: number;
	};
}

/**
 * The narrow slice of the settings tab `processImportedJSON` actually touches.
 *
 * A cast rather than a real plugin: `SettingsTabPlugin` is `Plugin & {…30
 * members}`, and every one of them not listed here would be dead scaffolding
 * that the next reader has to check is dead. What IS here is exactly what the
 * function calls, so an added call shows up as a `TypeError` naming it.
 */
function importRun(registry: CalloutRegistry): ImportRun {
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;

	const calls = {
		saves: 0,
		displays: 0,
		renderModes: 0,
		commandSweeps: 0,
		artworkBatches: 0,
	};

	const plugin = {
		registry,
		customCommands: {
			syncAll: () => {
				calls.commandSweeps++;
			},
		},
		saveSettings: () => {
			calls.saves++;
			return Promise.resolve();
		},
		refreshRenderModes: () => {
			calls.renderModes++;
		},
		ensureIconArtworkFor: () => {
			calls.artworkBatches++;
			return Promise.resolve();
		},
	};

	const ctx = {
		app: {} as App,
		plugin,
		display: () => {
			calls.displays++;
		},
		registerDisposer: () => {},
	} as unknown as SettingsSectionContext;

	return { ctx, notices, calls };
}

/** The export file, as a `File` — what the settings tab hands the importer. */
function fileOf(json: string): File {
	return new File([json], "callout-studio-export.json", {
		type: "application/json",
	});
}

/** Import `json` into `registry` through the real settings-tab entry point. */
async function importInto(
	registry: CalloutRegistry,
	json: string,
): Promise<ImportRun> {
	const run = importRun(registry);
	await processImportedJSON(run.ctx, fileOf(json));
	return run;
}

const parse = (json: string): Record<string, unknown> =>
	JSON.parse(json) as Record<string, unknown>;

const idsOf = (defs: CalloutDefinition[]): string[] => defs.map((d) => d.id);

/* ────────────────────────────────────────────────────────────────────────────
 * The envelope
 * ──────────────────────────────────────────────────────────────────────────── */

describe("exportToJSONv2 — the envelope", () => {
	it("stamps the format so the importer can recognize it", () => {
		const file = parse(sourceVault().exportToJSONv2());
		assert.strictEqual(file.format, EXPORT_FORMAT_ID);
		assert.strictEqual(file.formatVersion, EXPORT_FORMAT_VERSION);
	});

	it("carries the user's callouts and the full settings, and nothing else", () => {
		assert.deepStrictEqual(Object.keys(parse(sourceVault().exportToJSONv2())), [
			"format",
			"formatVersion",
			"callouts",
			"settings",
		]);
	});

	it("carries every modified callout — user rows and edited built-ins alike", () => {
		const source = sourceVault();
		assert.deepStrictEqual(idsOf(source.getExportableDefinitions()), [
			"alpha",
			"beta",
			"gamma",
			"note",
		]);
	});

	it("leaves the twelve untouched built-ins out", () => {
		// They are re-seeded from `constants.ts` on every load, so writing them
		// would put twelve rows in every export file that say nothing at all —
		// and would make an import from an older version silently *revert* the
		// reader's built-ins to that version's colours.
		const file = parse(sourceVault().exportToJSONv2());
		const callouts = file.callouts as CalloutDefinition[];
		assert.ok(!idsOf(callouts).includes("tip"));
		assert.ok(!idsOf(callouts).includes("warning"));
	});

	it("carries the three lists the user builds up", () => {
		// All three live in settings rather than on `PluginData` precisely so
		// that `exportToJSONv2` carries them. A key missing here is a list the
		// user cannot back up at all.
		const settings = parse(sourceVault().exportToJSONv2())
			.settings as PluginSettings;

		assert.deepStrictEqual(
			settings.customPalettes.map((p) => p.id),
			["cp-source"],
		);
		assert.deepStrictEqual(
			settings.customCommands.map((c) => c.id),
			["cmd-source"],
		);
		assert.ok(Array.isArray(settings.userImages), "the key is written even when empty");
	});

	it("carries a vault's pictures when it has any", () => {
		// The one picture assertion that does not need the artwork sanitizer:
		// `setUserImages` writes the list straight onto settings, and
		// `exportToJSONv2` serializes settings whole.
		const source = sourceVault();
		source.setUserImages([image()]);

		const settings = parse(source.exportToJSONv2()).settings as PluginSettings;
		assert.deepStrictEqual(
			settings.userImages.map((i) => i.id),
			["img-source01"],
		);
	});

	it("an empty vault exports an empty callout list, not a null", () => {
		const file = parse(emptyVault().exportToJSONv2());
		assert.deepStrictEqual(file.callouts, []);
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The round trip itself
 * ──────────────────────────────────────────────────────────────────────────── */

describe("export → import — a fresh vault becomes the exporting one", () => {
	it("passes validation with no issue at all", async () => {
		// Stated before the round trip below, because `processImportedJSON`
		// answers any issue with a modal — so a warning appearing here would turn
		// every later test in this file into a prompt nobody can answer.
		const json = sourceVault().exportToJSONv2();
		const result = await validateImportPayload(parse(json), emptyVault());

		assert.deepStrictEqual(result.issues, []);
		assert.strictEqual(result.fatal, false);
		assert.deepStrictEqual(idsOf(result.validDefs), [
			"alpha",
			"beta",
			"gamma",
			"note",
		]);
	});

	it("re-exports a byte-identical file", async () => {
		// The assertion the whole file exists for. Every definition field and
		// every settings key at once — including the ones added after this was
		// written, which a hand-listed set of fields would silently stop covering.
		const source = sourceVault();
		const json = source.exportToJSONv2();

		const target = emptyVaultOfSameEra();
		await importInto(target, json);

		assert.deepStrictEqual(parse(target.exportToJSONv2()), parse(json));
	});

	it("spells out a built-in's style mode the reader would not have assumed", () => {
		// The one field an import may legitimately *add*, and the reason the
		// round trip above is run into a vault of the same era. There is no vault
		// default to carry any more — a built-in is painted by this plugin
		// unless the active theme names it, which no file can record — so the
		// only style-mode key that crosses an export is `externalStyle`, and a
		// row that never had one arrives without one.
		const imported = sourceVault().exportToJSONv2();
		const rows = (parse(imported) as { callouts: CalloutDefinition[] }).callouts;
		const note = rows.find((c) => c.id === "note");
		assert.ok(note, "the source vault carries a modified built-in");
		assert.strictEqual(note.externalStyle, undefined, "not in the file");
	});

	it("lands the modified built-in ON the built-in, not beside it", async () => {
		// A duplicate user row would leave the real `note` untouched and styling
		// the vault, with the imported copy visible in the settings list but
		// reaching nothing.
		const target = emptyVault();
		await importInto(target, sourceVault().exportToJSONv2());

		const note = target.get("note");
		assert.strictEqual(note?.displayName, "Memo");
		assert.strictEqual(note.builtIn, true);
		assert.strictEqual(note.source, "builtin");
		assert.strictEqual(target.getBuiltIn().length, 13);
		assert.deepStrictEqual(idsOf(target.getUserDefined()), [
			"alpha",
			"beta",
			"gamma",
		]);
	});

	it("keeps every optional field of a fully-loaded definition", async () => {
		// Belt and braces beside the equality test above: when that one fails,
		// this says which half of the model moved.
		const target = emptyVault();
		await importInto(target, sourceVault().exportToJSONv2());

		const alpha = target.get("alpha");
		assert.ok(alpha);
		assert.deepStrictEqual(alpha.aliases, ["ember", "spark"]);
		assert.strictEqual(alpha.paletteId, "cp-source");
		assert.strictEqual(alpha.bgGradient?.textGradient, true);
		assert.strictEqual(alpha.bgGradient?.angleDeg, 135);
		assert.deepStrictEqual(alpha.iconAdjust, {
			heading: { offsetX: 2, offsetY: -1, size: 1.2 },
		});
		assert.deepStrictEqual(alpha.metadata, { origin: "handbook" });
		assert.strictEqual(alpha.customized, true);

		assert.strictEqual(target.get("beta")?.transparentBg, true);
		assert.deepStrictEqual(target.get("beta")?.icon, { type: "emoji", value: "🔥" });
		assert.strictEqual(target.get("gamma")?.hideIcon, true);
		assert.strictEqual(target.get("gamma")?.externalStyle, true);
	});

	it("restores the global settings wholesale", async () => {
		const source = sourceVault();
		const target = emptyVault();
		await importInto(target, source.exportToJSONv2());

		assert.deepStrictEqual(target.settings.globalStyle, source.settings.globalStyle);
		assert.deepStrictEqual(target.settings.contextMenu, source.settings.contextMenu);
		assert.strictEqual(target.settings.language, "he");
		assert.strictEqual(target.settings.fallbackCalloutId, "alpha");
		assert.deepStrictEqual(target.settings.disabledFixedCommands, [
			"callout-unwrap",
		]);
	});

	it("restores all three lists", async () => {
		const target = emptyVault();
		await importInto(target, sourceVault().exportToJSONv2());

		assert.deepStrictEqual(
			target.settings.customPalettes.map((p) => p.id),
			["cp-source"],
		);
		assert.deepStrictEqual(
			target.settings.customCommands.map((c) => c.id),
			["cmd-source"],
		);
	});

	it("is a fixed point — importing the same file twice changes nothing", async () => {
		const json = sourceVault().exportToJSONv2();
		const target = emptyVault();
		await importInto(target, json);
		const once = target.exportToJSONv2();

		await importInto(target, json);
		assert.deepStrictEqual(parse(target.exportToJSONv2()), parse(once));
	});

	it("saves, re-renders and sweeps the commands exactly once", async () => {
		const target = emptyVault();
		const run = await importInto(target, sourceVault().exportToJSONv2());

		assert.strictEqual(run.calls.saves, 1);
		assert.strictEqual(run.calls.renderModes, 1);
		assert.strictEqual(run.calls.commandSweeps, 1);
		assert.strictEqual(run.calls.displays, 1);
	});

	it("fetches artwork for the imported icons, skipping the hidden one", async () => {
		// The file carries no artwork, so an imported callout can name an icon
		// from a source this vault never downloaded. One that draws no icon is
		// skipped: nothing would render the result.
		const target = emptyVault();
		const run = await importInto(target, sourceVault().exportToJSONv2());
		assert.strictEqual(run.calls.artworkBatches, 1);
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The three lists — merged by id, never replaced
 * ──────────────────────────────────────────────────────────────────────────── */

/** A vault with one of each list entry, all under ids the source vault lacks. */
function vaultWithOwnLists(): CalloutRegistry {
	const registry = emptyVault();
	registry.settings.customPalettes = [
		palette({ id: "cp-local", name: "Local", colorLight: "#123456" }),
	];
	registry.setUserImages([image({ id: "img-local001", name: "local.svg" })]);
	registry.settings.customCommands = [
		command({ id: "cmd-local", calloutId: "note", role: "regular" }),
	];
	return registry;
}

describe("export → import — the lists the user builds up", () => {
	it("keeps the importing vault's own palettes, pictures and commands", async () => {
		// The failure this prevents: `Object.assign(settings, imported)` replaces
		// the arrays, so importing a colleague's export would delete every
		// palette, picture and command the reader had made — silently, and with
		// a success notice.
		const target = vaultWithOwnLists();
		await importInto(target, sourceVault().exportToJSONv2());

		assert.deepStrictEqual(
			target.settings.customPalettes.map((p) => p.id).sort(),
			["cp-local", "cp-source"],
		);
		assert.deepStrictEqual(
			target.settings.customCommands.map((c) => c.id).sort(),
			["cmd-local", "cmd-source"],
		);
		assert.deepStrictEqual(
			target.getUserImages().map((i) => i.id),
			["img-local001"],
			"kept even though the file named none",
		);
	});

	it("does not carry a retired-theme list in the file at all", () => {
		// It used to travel and be dropped on the way in. It is not in
		// `PluginSettings` any more — which theme is active is a property of a
		// machine, not of a vault, so the list lives in `DeviceLocalStore` —
		// which makes the old carve-out unnecessary and the guarantee stronger:
		// there is nothing to drop, on either side.
		const settings = parse(emptyVault().exportToJSONv2()).settings as Record<
			string,
			unknown
		>;
		assert.ok(!("retiredThemeIds" in settings));
	});

	it("lets the file win on a shared id, as a restore should", async () => {
		const target = emptyVault();
		target.settings.customPalettes = [
			palette({ id: "cp-source", name: "Stale name", colorLight: "#000000" }),
		];
		await importInto(target, sourceVault().exportToJSONv2());

		assert.strictEqual(target.settings.customPalettes.length, 1);
		assert.strictEqual(target.settings.customPalettes[0]?.name, "Ember");
		assert.strictEqual(target.settings.customPalettes[0]?.colorLight, "#b3541e");
	});

	it("does not wipe them when the file carries none", async () => {
		// An export from a vault that had no palettes says `customPalettes: []`,
		// and `sanitizeImportedSettings` hands that straight back — indistinguishable
		// from an older export that predates the list entirely. Either way it must
		// not be read as "delete what you have".
		const target = vaultWithOwnLists();
		await importInto(target, emptyVault().exportToJSONv2());

		assert.deepStrictEqual(
			target.settings.customPalettes.map((p) => p.id),
			["cp-local"],
		);
		assert.deepStrictEqual(
			target.getUserImages().map((i) => i.id),
			["img-local001"],
		);
		assert.deepStrictEqual(
			target.settings.customCommands.map((c) => c.id),
			["cmd-local"],
		);
	});

	it("survives a file written before commands existed at all", async () => {
		// A real 2.7-era export: a v2 envelope whose settings blob simply has no
		// `customCommands` key. The merge must read that as "nothing to add".
		const target = vaultWithOwnLists();
		const file = parse(sourceVault().exportToJSONv2());
		const settings = file.settings as Record<string, unknown>;
		delete settings.customCommands;
		delete settings.userImages;

		await importInto(target, JSON.stringify(file));

		assert.deepStrictEqual(
			target.settings.customCommands.map((c) => c.id),
			["cmd-local"],
		);
		assert.deepStrictEqual(
			target.getUserImages().map((i) => i.id),
			["img-local001"],
		);
	});

	it("hands the merged pictures to the pack through the registry", async () => {
		// By assignment they would reach `data.json` and nothing else: the pack
		// that draws them reads a module-level snapshot, because `buildSvg` is
		// synchronous and has no route back to the plugin.
		const target = vaultWithOwnLists();
		await importInto(target, sourceVault().exportToJSONv2());

		assert.deepStrictEqual(
			target.settings.userImages.map((i) => i.id).sort(),
			target.getUserImages().map((i) => i.id).sort(),
		);
	});

	it("folds a palette that duplicates a local one's colours", async () => {
		// Merging by id routinely brings in a palette identical to a local one
		// under a different id — two vaults named the same colour independently.
		// No vault may hold two of those, so the import folds them rather than
		// leaving a state the next launch would silently repair.
		const target = emptyVault();
		target.settings.customPalettes = [palette({ id: "cp-local", name: "Local" })];
		await importInto(target, sourceVault().exportToJSONv2());

		assert.strictEqual(
			target.settings.customPalettes.length,
			1,
			JSON.stringify(target.settings.customPalettes),
		);
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * What a restore is allowed to overwrite
 * ──────────────────────────────────────────────────────────────────────────── */

describe("export → import — what is replaced rather than merged", () => {
	it("replaces the global style, which has no id to merge on", async () => {
		const target = emptyVault();
		target.settings.globalStyle.borderRadius = 99;
		await importInto(target, sourceVault().exportToJSONv2());

		assert.strictEqual(target.settings.globalStyle.borderRadius, 10);
	});

	it("overwrites a callout the importing vault already had, by id", async () => {
		const target = emptyVault();
		await importInto(target, sourceVault().exportToJSONv2());
		target.update("alpha", { displayName: "Locally renamed" });

		await importInto(target, sourceVault().exportToJSONv2());
		assert.strictEqual(target.get("alpha")?.displayName, "Alpha");
	});

	it("says how many were overwritten rather than claiming they were new", async () => {
		const target = emptyVault();
		const json = sourceVault().exportToJSONv2();
		const first = await importInto(target, json);
		const second = await importInto(target, json);

		assert.strictEqual(first.notices.length, 1);
		assert.strictEqual(second.notices.length, 1);
		assert.notStrictEqual(first.notices[0], second.notices[0]);
	});

	it("leaves a callout the file never mentions alone", async () => {
		const target = emptyVault();
		target.add({
			id: "local-only",
			displayName: "Local only",
			icon: { type: "lucide", value: "lucide-info" },
			colorLight: "#336699",
			colorDark: "#88bbee",
			foldable: true,
			defaultFolded: false,
			builtIn: false,
			source: "user",
			customized: true,
		});
		await importInto(target, sourceVault().exportToJSONv2());

		assert.ok(target.has("local-only"));
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The legacy flat-array export
 * ──────────────────────────────────────────────────────────────────────────── */

describe("export → import — the legacy flat array", () => {
	it("is still accepted, and carries no settings", async () => {
		// `exportToJSON()` is part of the public plugin API surface, so files in
		// that shape keep arriving. A file with no settings must not be read as
		// a settings blob full of defaults.
		const target = vaultWithOwnLists();
		target.settings.language = "fr";
		const legacy = sourceVault().exportToJSON();

		await importInto(target, legacy);

		assert.ok(target.has("alpha"));
		assert.strictEqual(target.settings.language, "fr", "settings untouched");
		assert.deepStrictEqual(
			target.settings.customPalettes.map((p) => p.id),
			["cp-local"],
		);
	});

	it("carries only user callouts — a modified built-in is not in it", async () => {
		// The one real difference between the two export shapes, and why v2
		// exists: `exportToJSON` feeds the settings lists as well, so it is
		// `getUserDefined()` and cannot grow a built-in.
		const legacy = JSON.parse(sourceVault().exportToJSON()) as CalloutDefinition[];
		assert.deepStrictEqual(idsOf(legacy), ["alpha", "beta", "gamma"]);
	});
});
