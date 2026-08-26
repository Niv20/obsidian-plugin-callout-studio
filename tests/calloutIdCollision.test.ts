/**
 * tests/calloutIdCollision.test.ts — one callout, however it is spelled.
 *
 * Obsidian reduces a callout header to
 * `type.trim().toLowerCase().replace(/\s+/g, "-")` before a plugin ever sees it,
 * so `[!banner icon]`, `[!banner   icon]`, `[!Banner Icon]` and `[!banner-icon]`
 * are four spellings of ONE callout: they all render as
 * `data-callout="banner-icon"`. A second registry row for a second spelling is
 * therefore never a second type — it is a duplicate that fights the first over a
 * single CSS rule, splits its usage count, and shows up twice in every list.
 *
 * `calloutIdentity` is the one function that answers "are these the same?", and
 * this suite is the proof that nothing can get past it. The three properties
 * worth stating plainly, because each was false somewhere before:
 *
 * - **The guard is at the seam, not at the call sites.** `CalloutRegistry.add`
 *   and the rename branch of `update` refuse a colliding spelling themselves.
 *   Every caller used to pre-check for itself and the JSON backup importer did
 *   not, which is exactly how a duplicate pair reached `data.json`.
 * - **Order does not matter.** Whichever spelling a vault, a file or an import
 *   presents first, the result is one row — and the same one.
 * - **Nothing is silently discarded.** A pair already sitting in `data.json` is
 *   merged rather than halved: the survivor keeps every field it authored, the
 *   loser fills the gaps, and the hotkey-bound commands and the fallback
 *   selection that named the loser are re-pointed. See
 *   `manager/idCollisionMigration.ts`.
 *
 * The registry's own dash/space arithmetic (`findAttrIdConflict`,
 * `vaultIdFormsFor`) has its own coverage in calloutRegistryRows.test.ts, the
 * load-time fold in calloutRegistryMigrations.test.ts, and `calloutIdentity`
 * itself in calloutId.test.ts. What is here is the end-to-end story: the paths a
 * duplicate actually arrived through.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { ThemeCalloutStore } from "../src/manager/theme/ThemeCalloutStore";
import { syncThemeProvidedRows } from "../src/manager/theme/themeProvidedRows";
import { validateImportPayload } from "../src/utils/importValidator";
import { filterUsableCallouts } from "../src/utils/usableCallouts";
import { buildKnownCalloutIds } from "../src/manager/knownCalloutIds";
import { scanStringForUnknownCallouts } from "../src/utils/vaultCalloutScanner";
import {
	definition,
	discovered,
	discoveryHarness,
} from "./support/discoveryHarness";
import type { App } from "obsidian";
import type { CalloutDefinition, CustomCommand, PluginData } from "../src/types";

/** The user's own rows, by id — what the settings list would show. */
const userIds = (registry: CalloutRegistry): string[] =>
	registry
		.getUserDefined()
		.map((d) => d.id)
		.sort();

function importEntry(over: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "test",
		displayName: "Test",
		icon: { type: "lucide", value: "star" },
		colorLight: "#ff0000",
		colorDark: "#ff0000",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

const errorKeys = (issues: { level: string; messageKey: string }[]): string[] =>
	issues.filter((i) => i.level === "error").map((i) => i.messageKey);

/* ========================================================================== */
/* 1. Discovered from vault files — the reported case, in both orders         */
/* ========================================================================== */

describe("discovery — two spellings across the vault are one row", () => {
	it("[!banner icon] then [!banner-icon]", async () => {
		const h = discoveryHarness({
			"a.md": "> [!banner icon] spaced",
			"b.md": "> [!banner-icon] dashed",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
	});

	it("the same two forms discovered in the opposite order", async () => {
		// The file order is reversed, and the answer is not: `a b` wins over
		// `a-b` because that is the spelling the editor's own ID field produces,
		// not because it happened to be seen first.
		const h = discoveryHarness({
			"a.md": "> [!banner-icon] dashed",
			"b.md": "> [!banner icon] spaced",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
	});

	it("both spellings inside ONE note", async () => {
		const h = discoveryHarness({
			"a.md": "> [!banner icon] one\n\n> [!banner-icon] two",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
	});

	it("repeated whitespace — [!banner   icon]", async () => {
		const h = discoveryHarness({
			"a.md": "> [!banner   icon] padded",
			"b.md": "> [!banner-icon] dashed",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		// Collapsed to a single space on the way in, so the row reads the way
		// the user would have typed it.
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
	});

	it("mixed case — ids are case-insensitive, so [!Banner Icon] is the same row", async () => {
		const h = discoveryHarness({
			"a.md": "> [!Banner Icon] shouty",
			"b.md": "> [!banner-icon] dashed",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
	});

	it("every role counts — a heading and a pill collide with a block", async () => {
		const h = discoveryHarness({
			"a.md": "## [!banner icon] heading",
			"b.md": "a [!banner-icon] pill",
			"c.md": "> [!BANNER   ICON] block",
		});
		assert.strictEqual(await h.discovery.runVaultScan(), 1);
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
	});
});

describe("discovery — a collision found while scanning files, one at a time", () => {
	it("does not add a second row when the dash spelling turns up later", async () => {
		const h = discoveryHarness({ "a.md": "> [!banner icon] spaced" });
		await h.internals.scanFileNow(h.vault.file("a.md"));
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);

		h.vault.write("b.md", "> [!banner-icon] dashed");
		await h.internals.scanFileNow(h.vault.file("b.md"));
		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
	});

	it("nor when the SPACE spelling turns up after a dashed row exists", async () => {
		// The direction that used to be asymmetric: `buildKnownCalloutIds`
		// registers both spellings of what it stores, but only the scanner
		// testing a found id's identity too closes the other half.
		const h = discoveryHarness({ "a.md": "> [!banner-icon] dashed" });
		await h.internals.scanFileNow(h.vault.file("a.md"));
		assert.deepStrictEqual(userIds(h.registry), ["banner-icon"]);

		h.vault.write("b.md", "> [!banner icon] spaced");
		await h.internals.scanFileNow(h.vault.file("b.md"));
		assert.deepStrictEqual(userIds(h.registry), ["banner-icon"]);
	});

	it("the scanner does not even report it as unknown, in either direction", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(definition({ id: "banner icon" }));
		const known = buildKnownCalloutIds(registry);
		assert.deepStrictEqual(
			scanStringForUnknownCallouts("> [!banner-icon]", known),
			[],
		);

		const other = new CalloutRegistry();
		other.load(null);
		other.add(definition({ id: "banner-icon" }));
		assert.deepStrictEqual(
			scanStringForUnknownCallouts(
				"> [!banner icon]\n> [!banner   ICON]",
				buildKnownCalloutIds(other),
			),
			[],
		);
	});

	it("an ALIAS covers the other spelling too", async () => {
		const h = discoveryHarness({ "a.md": "> [!banner-icon] dashed" });
		h.registry.add(definition({ id: "flag", aliases: ["banner icon"] }));
		await h.internals.scanFileNow(h.vault.file("a.md"));
		assert.deepStrictEqual(userIds(h.registry), ["flag"]);
	});
});

/* ========================================================================== */
/* 2. The registry refuses the pair itself                                    */
/* ========================================================================== */

describe("CalloutRegistry.add — the guard is at the seam", () => {
	const seeded = (): CalloutRegistry => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(definition({ id: "banner icon" }));
		return registry;
	};

	for (const spelling of [
		"banner-icon",
		"banner   icon",
		"Banner Icon",
		"BANNER-ICON",
	]) {
		it(`refuses "${spelling}" beside "banner icon"`, () => {
			const registry = seeded();
			assert.strictEqual(
				registry.add(definition({ id: spelling })),
				false,
			);
			assert.deepStrictEqual(userIds(registry), ["banner icon"]);
		});
	}

	it("refuses a new row whose ALIAS collides with an existing id", () => {
		const registry = seeded();
		assert.strictEqual(
			registry.add(definition({ id: "other", aliases: ["banner-icon"] })),
			false,
		);
		assert.deepStrictEqual(userIds(registry), ["banner icon"]);
	});

	it("refuses a new row whose id collides with an existing ALIAS", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(definition({ id: "flag", aliases: ["banner icon"] }));
		assert.strictEqual(
			registry.add(definition({ id: "banner-icon" })),
			false,
		);
		assert.deepStrictEqual(userIds(registry), ["flag"]);
	});

	it("still lets an unrelated id through", () => {
		const registry = seeded();
		assert.strictEqual(registry.add(definition({ id: "banner" })), true);
		assert.deepStrictEqual(userIds(registry), ["banner", "banner icon"]);
	});
});

describe("CalloutRegistry.update — a rename cannot create the pair either", () => {
	it("refuses to rename a row onto another row's other spelling", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(definition({ id: "banner icon" }));
		registry.add(definition({ id: "spare" }));
		assert.strictEqual(
			registry.update("spare", { id: "banner-icon" }),
			false,
		);
		assert.deepStrictEqual(userIds(registry), ["banner icon", "spare"]);
	});

	it("still lets a row rename onto one of its OWN aliases", () => {
		// `excludeId` is what keeps the guard from firing on the row being
		// renamed — without it, adopting your own alias would be a collision.
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(definition({ id: "banner icon", aliases: ["flag"] }));
		assert.strictEqual(
			registry.update("banner icon", { id: "flag" }),
			true,
		);
		assert.deepStrictEqual(userIds(registry), ["flag"]);
	});
});

/* ========================================================================== */
/* 3. Import                                                                  */
/* ========================================================================== */

describe("import — an entry is the callout it already is", () => {
	const withRow = (def: CalloutDefinition): CalloutRegistry => {
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(def);
		return registry;
	};

	it("re-homes a dashed entry onto the row the vault spells with a space", async () => {
		// A backup taken from a vault that spelled the type `banner-icon`. It
		// used to miss the exact-id lookup here and land as a second row.
		const registry = withRow(definition({ id: "banner icon" }));
		const result = await validateImportPayload(
			[importEntry({ id: "banner-icon", displayName: "Banner icon" })],
			registry,
		);
		assert.deepStrictEqual(errorKeys(result.issues), []);
		assert.deepStrictEqual(
			result.validDefs.map((d) => d.id),
			["banner icon"],
		);
	});

	it("and the other way round, keeping the row's own spelling", async () => {
		const registry = withRow(definition({ id: "banner-icon" }));
		const result = await validateImportPayload(
			[importEntry({ id: "Banner   Icon" })],
			registry,
		);
		assert.deepStrictEqual(
			result.validDefs.map((d) => d.id),
			["banner-icon"],
		);
	});

	it("rejects a file that carries BOTH spellings as two entries", async () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const result = await validateImportPayload(
			[
				importEntry({ id: "banner icon" }),
				importEntry({ id: "banner-icon" }),
			],
			registry,
		);
		assert.deepStrictEqual(
			result.validDefs.map((d) => d.id),
			["banner icon"],
		);
		assert.deepStrictEqual(errorKeys(result.issues), [
			"import.err.duplicateInFile",
		]);
	});

	it("counts repeated whitespace and case as the same entry too", async () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const result = await validateImportPayload(
			[importEntry({ id: "banner icon" }), importEntry({ id: "BANNER   ICON" })],
			registry,
		);
		assert.strictEqual(result.validDefs.length, 1);
		assert.deepStrictEqual(errorKeys(result.issues), [
			"import.err.duplicateInFile",
		]);
	});

	it("flags one entry listing both spellings as one alias twice", async () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const result = await validateImportPayload(
			[importEntry({ id: "flag", aliases: ["banner icon", "banner-icon"] })],
			registry,
		);
		assert.deepStrictEqual(errorKeys(result.issues), [
			"import.err.aliasDup",
		]);
	});

	it("flags an imported alias that collides with an existing row's id", async () => {
		const registry = withRow(definition({ id: "banner icon" }));
		const result = await validateImportPayload(
			[importEntry({ id: "flag", aliases: ["banner-icon"] })],
			registry,
		);
		assert.deepStrictEqual(errorKeys(result.issues), [
			"import.err.aliasConflict",
		]);
	});

	it("flags an alias that is the entry's OWN id in another spelling", () => {
		// Not a cross-row conflict — an entry naming itself twice. It used to
		// pass, leaving a row carrying a self-alias that resolved back to it.
		const registry = new CalloutRegistry();
		registry.load(null);
		return validateImportPayload(
			[importEntry({ id: "banner icon", aliases: ["banner-icon"] })],
			registry,
		).then((result) => {
			assert.deepStrictEqual(errorKeys(result.issues), [
				"import.err.aliasDup",
			]);
		});
	});
});

/* ========================================================================== */
/* 4. Startup — a pair already in data.json                                   */
/* ========================================================================== */

function command(over: Partial<CustomCommand> = {}): CustomCommand {
	return { id: "cmd-1", calloutId: "banner-icon", role: "regular", ...over };
}

function savedPair(
	callouts: CalloutDefinition[],
	settings?: Record<string, unknown>,
): Partial<PluginData> {
	return {
		callouts,
		...(settings ? { settings } : {}),
	} as Partial<PluginData>;
}

describe("startup — persisted data holding both forms", () => {
	it("comes up as one row, whichever order the file lists them in", () => {
		for (const order of [
			[definition({ id: "banner icon" }), definition({ id: "banner-icon" })],
			[definition({ id: "banner-icon" }), definition({ id: "banner icon" })],
		]) {
			const registry = new CalloutRegistry();
			registry.load(savedPair(order));
			assert.deepStrictEqual(userIds(registry), ["banner icon"]);
			assert.deepStrictEqual(registry.get("banner icon")?.aliases, [
				"banner-icon",
			]);
		}
	});

	it("folds a repeated-whitespace and a mixed-case row in too", () => {
		const registry = new CalloutRegistry();
		registry.load(
			savedPair([
				definition({ id: "banner icon" }),
				definition({ id: "Banner   Icon" }),
				definition({ id: "BANNER-ICON" }),
			]),
		);
		assert.deepStrictEqual(userIds(registry), ["banner icon"]);
	});

	it("keeps the survivor's authored fields and fills its gaps from the loser", () => {
		// The documented merge rule. Two rows customized differently come out as
		// one carrying the union, with the survivor winning every real
		// disagreement — nothing is silently halved.
		const registry = new CalloutRegistry();
		registry.load(
			savedPair([
				definition({
					id: "banner icon",
					icon: { type: "lucide", value: "flag" },
					colorLight: "#c00000",
					customized: true,
				}),
				definition({
					id: "banner-icon",
					icon: { type: "lucide", value: "star" },
					colorLight: "#00c000",
					bgColorDark: "#123456",
					hideIcon: true,
					customized: true,
				}),
			]),
		);
		const row = registry.get("banner icon");
		// Survivor's own values survive untouched...
		assert.strictEqual(row?.icon.value, "flag");
		assert.strictEqual(row?.colorLight, "#c00000");
		// ...and what it never set is taken from the loser rather than lost.
		assert.strictEqual(row?.bgColorDark, "#123456");
		assert.strictEqual(row?.hideIcon, true);
	});

	it("never takes provenance from the loser", () => {
		// `builtIn` and `source` describe where a row came from. A built-in that
		// absorbs a user row must not come out claiming to be user-created.
		const registry = new CalloutRegistry();
		registry.load(
			savedPair([
				definition({ id: "note", builtIn: true, source: "builtin" }),
				definition({ id: "NOTE", source: "user", customized: true }),
			]),
		);
		const row = registry.get("note");
		assert.strictEqual(row?.builtIn, true);
		assert.strictEqual(row?.source, "builtin");
	});

	it("marks the survivor customized once it has inherited authored styling", () => {
		// Otherwise the prune pass would throw the merged row away the next time
		// the vault stopped mentioning it.
		const registry = new CalloutRegistry();
		registry.load(
			savedPair([
				definition({ id: "banner icon" }),
				definition({ id: "banner-icon", customized: true }),
			]),
		);
		assert.strictEqual(registry.get("banner icon")?.customized, true);
	});

	it("a disposable discovery row never outranks a real one, whichever spelling it wears", () => {
		// Survivor selection prefers the dash-free spelling — but only among
		// rows that are real. Auto-junk loses even when it is spelled the way
		// the editor's own ID field would have spelled it.
		const registry = new CalloutRegistry();
		registry.load(
			savedPair([
				discovered("banner icon"),
				definition({ id: "banner-icon", customized: true }),
			]),
		);
		assert.deepStrictEqual(userIds(registry), ["banner-icon"]);
		// And the auto-created row is dropped outright rather than aliased:
		// discovery owns that id again the moment a note mentions it.
		assert.strictEqual(registry.get("banner-icon")?.aliases, undefined);
	});

	it("re-points a custom command that named the losing row", () => {
		// `CustomCommandManager.syncAll()` drops any command whose callout the
		// registry cannot find, taking the user's hotkey with it.
		const registry = new CalloutRegistry();
		registry.load(
			savedPair(
				[
					definition({ id: "banner icon" }),
					definition({ id: "banner-icon", customized: true }),
				],
				{ customCommands: [command({ calloutId: "banner-icon" })] },
			),
		);
		assert.deepStrictEqual(
			registry.settings.customCommands.map((c) => c.calloutId),
			["banner icon"],
		);
		assert.strictEqual(registry.settings.customCommands[0]?.id, "cmd-1");
	});

	it("re-points the fallback selection that named the losing row", () => {
		// A dangling `fallbackCalloutId` is not inert: `generateFallbackCSS`
		// bails and every unrecognized callout loses its colour and icon.
		const registry = new CalloutRegistry();
		registry.load(
			savedPair(
				[
					definition({ id: "banner icon" }),
					definition({ id: "banner-icon", customized: true }),
				],
				{ fallbackCalloutId: "banner-icon" },
			),
		);
		assert.strictEqual(
			registry.settings.fallbackCalloutId,
			"banner icon",
		);
		assert.ok(registry.get(registry.settings.fallbackCalloutId));
	});

	it("folds a row whose ALIAS is another row's id", () => {
		const registry = new CalloutRegistry();
		registry.load(
			savedPair([
				definition({ id: "flag", aliases: ["banner-icon"] }),
				definition({ id: "banner icon" }),
			]),
		);
		assert.strictEqual(userIds(registry).length, 1);
	});

	it("writes the merge back, and settles — the pass is a fixed point", () => {
		// Un-flushed, `data.json` keeps both rows and the merge is redone on
		// every launch: the user sees one row and the file holds two.
		const registry = new CalloutRegistry();
		registry.load(
			savedPair([
				definition({ id: "banner icon" }),
				definition({ id: "banner-icon", customized: true }),
			]),
		);
		assert.strictEqual(registry.needsSaveAfterLoad(), true);

		const again = new CalloutRegistry();
		again.load(registry.toSaveData());
		assert.deepStrictEqual(userIds(again), ["banner icon"]);
		assert.strictEqual(again.needsSaveAfterLoad(), false);
		assert.deepStrictEqual(
			again.get("banner icon")?.aliases,
			registry.get("banner icon")?.aliases,
		);
	});
});

/* ========================================================================== */
/* 5. Theme-provided rows obey the same rule                                  */
/* ========================================================================== */

describe("a theme's callout is the user's row when they are one callout", () => {
	const themeApp = (css: string): App =>
		({
			customCss: {
				theme: "Nord",
				themes: { Nord: { version: "1.0.0" } },
				styleEl: { textContent: css },
				snippets: [],
				enabledSnippets: new Set<string>(),
				extraStyleEls: [],
			},
		}) as unknown as App;

	it("mints nothing when the user already spells the theme's id with a space", () => {
		// A theme declares its callouts in CSS, where the id is always the
		// dasherized `data-callout` spelling. The user's row is spelled the way
		// the editor's ID field produces. One callout, so one row.
		const registry = new CalloutRegistry();
		registry.load(null);
		registry.add(definition({ id: "banner icon" }));
		const store = new ThemeCalloutStore(
			themeApp('.callout[data-callout="banner-icon"] { color: red; }'),
		);
		assert.strictEqual(syncThemeProvidedRows(registry, store), 0);
		assert.deepStrictEqual(userIds(registry), ["banner icon"]);
		assert.strictEqual(registry.getThemeProvided().length, 0);
	});

	it("and the theme still owns it, so the plugin emits nothing for it", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const row = definition({ id: "banner icon" });
		registry.add(row);
		const store = new ThemeCalloutStore(
			themeApp('.callout[data-callout="banner-icon"] { color: red; }'),
		);
		syncThemeProvidedRows(registry, store);
		assert.strictEqual(registry.themeOwns(registry.get("banner icon")!), true);
	});
});

/* ========================================================================== */
/* 6. What the lists show                                                     */
/* ========================================================================== */

describe("the lists show one entry, not two", () => {
	it("settings, quick insert and autocomplete all read one row", async () => {
		const h = discoveryHarness({
			"a.md": "> [!banner icon] spaced",
			"b.md": "> [!banner-icon] dashed",
		});
		await h.discovery.runVaultScan();

		assert.deepStrictEqual(userIds(h.registry), ["banner icon"]);
		// The list every writable surface reads — quick insert, the command
		// builder, the suggestion popup.
		const usable = filterUsableCallouts(
			[...h.registry.getBuiltIn(), ...h.registry.getUserDefined()],
			(id) => h.discovery.isKnownZeroUsageFallback(id),
		).filter((d) => !d.builtIn);
		assert.deepStrictEqual(
			usable.map((d) => d.id),
			["banner icon"],
		);
	});

	it("and both spellings in the notes resolve to it", async () => {
		const h = discoveryHarness({
			"a.md": "> [!banner icon] spaced",
			"b.md": "> [!banner-icon] dashed",
		});
		await h.discovery.runVaultScan();
		assert.strictEqual(h.registry.findByAttrId("banner-icon")?.id, "banner icon");
		assert.strictEqual(h.registry.findByAttrId("banner icon")?.id, "banner icon");
		assert.strictEqual(h.registry.findByAttrId("BANNER   ICON")?.id, "banner icon");
	});
});
