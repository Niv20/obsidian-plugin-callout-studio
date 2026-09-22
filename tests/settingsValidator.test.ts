/**
 * tests/settingsValidator.test.ts — what an import file may say about settings.
 *
 * `sanitizeImportedSettings` is a thin, deliberate wrapper: it rebuilds the blob
 * through `mergeSavedSettings`, the same field-by-field merge the registry runs
 * on every load, so an import can never introduce a shape the loader would not
 * have produced. Two properties are what make that safe, and both are tested:
 *
 * - **A structural problem is a warning, never a fatal.** A bad settings blob
 *   must not block the callouts sitting next to it in the same file.
 * - **Unknown top-level fields are dropped.** Settings are written back
 *   wholesale by `toSaveData()` and `exportToJSONv2()`, so a key that survived
 *   the merge would be re-saved forever and copied into every future export.
 *
 * The third property this file exists to pin is the one that is NOT here:
 * `customPalettes` / `userImages` / `customCommands` come back as whatever the
 * file said — **empty arrays when the file said nothing** — and merging them by
 * id against the user's own is the *caller's* job, in
 * `DataManagementSection.applyImport`. The tests below state that boundary
 * explicitly, because reading this function alone makes `Object.assign` look
 * safe, and it is exactly what would wipe the three lists a user builds up.
 * The other half of that boundary — the merge itself — is
 * `utils/mergeById.ts`, tested in `importListMerge.test.ts`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { sanitizeImportedSettings } from "../src/utils/settingsValidator";
import { DEFAULT_SETTINGS } from "../src/constants";
import type { CustomPalette } from "../src/types";

function palette(over: Partial<CustomPalette> = {}): CustomPalette {
	return {
		id: "cp-1",
		name: "Imported",
		colorLight: "#ff0000",
		colorDark: "#ff8888",
		bgColorLight: "#ffeeee",
		bgColorDark: "#331111",
		textColorLight: "#1a1a1a",
		textColorDark: "#e0e0e0",
		...over,
	};
}

describe("sanitizeImportedSettings — nothing to do", () => {
	it("reports no settings for an absent blob", () => {
		assert.deepStrictEqual(sanitizeImportedSettings(undefined), {
			settings: null,
			issues: [],
		});
		assert.deepStrictEqual(sanitizeImportedSettings(null), {
			settings: null,
			issues: [],
		});
	});

	it("distinguishes absent from empty — `{}` is a real, full settings object", () => {
		// A legacy flat-array export carries no settings at all; a v2 envelope
		// with an empty object is asking for the defaults.
		assert.equal(sanitizeImportedSettings(undefined).settings, null);
		assert.ok(sanitizeImportedSettings({}).settings);
	});
});

describe("sanitizeImportedSettings — a blob that is not an object", () => {
	for (const junk of [[], "settings", 42, true]) {
		it(`warns rather than fails on ${JSON.stringify(junk)}`, () => {
			const result = sanitizeImportedSettings(junk);
			assert.equal(result.settings, null);
			assert.equal(result.issues.length, 1);
			// A warning, not an error: the callouts in the same file still import.
			assert.equal(result.issues[0]?.level, "warning");
			assert.equal(
				result.issues[0]?.messageKey,
				"import.warn.settingsIgnored",
			);
			assert.equal(result.issues[0]?.index, -1);
		});
	}
});

describe("sanitizeImportedSettings — the merge against defaults", () => {
	it("fills every missing field from DEFAULT_SETTINGS", () => {
		const { settings, issues } = sanitizeImportedSettings({});
		assert.deepStrictEqual(issues, []);
		assert.ok(settings);
		assert.equal(
			settings.globalStyle.borderWidth,
			DEFAULT_SETTINGS.globalStyle.borderWidth,
		);
		assert.equal(
			settings.autocomplete.enabled,
			DEFAULT_SETTINGS.autocomplete.enabled,
		);
		assert.equal(
			settings.contextMenu.enabled,
			DEFAULT_SETTINGS.contextMenu.enabled,
		);
		assert.equal(settings.language, DEFAULT_SETTINGS.language);
	});

	it("keeps supported values but forces retired autocomplete opt-outs on", () => {
		const { settings } = sanitizeImportedSettings({
			globalStyle: { borderRadius: 12 },
			autocomplete: { enabled: false },
			language: "he",
		});
		assert.equal(settings?.globalStyle.borderRadius, 12);
		assert.equal(settings?.autocomplete.enabled, true);
		assert.equal(settings?.language, "he");
	});

	it("drops an unknown top-level field", () => {
		// Otherwise it would be re-saved forever and copied into every export.
		const { settings } = sanitizeImportedSettings({
			someFutureFeature: { enabled: true },
			nonsense: 1,
		});
		assert.ok(settings);
		assert.ok(!("someFutureFeature" in settings));
		assert.ok(!("nonsense" in settings));
	});

	it("rebuilds borderSides as a complete object from a partial one", () => {
		const { settings } = sanitizeImportedSettings({
			globalStyle: { borderSides: { left: true } },
		});
		assert.deepStrictEqual(settings?.globalStyle.borderSides, {
			...DEFAULT_SETTINGS.globalStyle.borderSides,
			left: true,
		});
	});

	it("deep-merges the nested role frame styles rather than replacing them", () => {
		// A spread of globalStyle would replace `heading` wholesale and drop
		// every field a newer version added.
		const { settings } = sanitizeImportedSettings({
			globalStyle: { heading: { borderWidth: 3 } },
		});
		assert.equal(settings?.globalStyle.heading.borderWidth, 3);
		assert.equal(
			settings?.globalStyle.heading.borderRadius,
			DEFAULT_SETTINGS.globalStyle.heading.borderRadius,
		);
		assert.equal(
			settings?.globalStyle.inline.fontScale,
			DEFAULT_SETTINGS.globalStyle.inline.fontScale,
		);
	});

	it("tolerates junk in place of a whole section", () => {
		const { settings } = sanitizeImportedSettings({
			contextMenu: "yes",
			autocomplete: null,
			globalStyle: 42,
			iconSources: [],
		});
		assert.ok(settings);
		assert.equal(
			settings.globalStyle.borderWidth,
			DEFAULT_SETTINGS.globalStyle.borderWidth,
		);
		assert.equal(
			settings.autocomplete.enabled,
			DEFAULT_SETTINGS.autocomplete.enabled,
		);
	});

	it("refuses a language that is not a string", () => {
		// `main.ts` hands this to `setLocale`, which lowercases it on the load
		// path — so a file carrying `"language": 5` is a `TypeError` during
		// startup, not a mislabelled button. An unknown *string* is fine and
		// stays untouched: the i18n resolver falls back to English by itself.
		assert.equal(sanitizeImportedSettings({ language: 5 }).settings?.language, "auto");
		assert.equal(
			sanitizeImportedSettings({ language: { code: "he" } }).settings?.language,
			"auto",
		);
		assert.equal(sanitizeImportedSettings({ language: "kl-DK" }).settings?.language, "kl-DK");
	});

	it("forces the settings that are no longer user-configurable", () => {
		const { settings } = sanitizeImportedSettings({
			headingCallouts: { refCleanTitles: false, refShowIcon: false },
		});
		assert.equal(settings?.headingCallouts.refCleanTitles, true);
		assert.equal(settings?.headingCallouts.refShowIcon, true);
	});

	it("range-checks the numeric global-style values", () => {
		// The spread that merges `globalStyle` is blind to values, and every one
		// of them is interpolated straight into a stylesheet. A file can carry a
		// number no slider can produce — and then no slider can undo it either,
		// short of dragging the one control it belongs to. `clampGlobalStyle`
		// repairs it on the way in; `settingsGuards.test.ts` owns the limits.
		const { settings } = sanitizeImportedSettings({
			globalStyle: { borderWidth: -999, borderRadius: 1e6, titleScale: 0 },
		});
		assert.equal(settings?.globalStyle.borderWidth, 0);
		assert.equal(settings?.globalStyle.borderRadius, 64);
		assert.equal(settings?.globalStyle.titleScale, 0.1);
	});

	it("replaces a style value that is not a number at all", () => {
		// `border-radius: ${gs.borderRadius}px` — a string closes that
		// declaration and opens rules of its own, so an import file must not be
		// able to put one there.
		const { settings } = sanitizeImportedSettings({
			globalStyle: { borderRadius: "0px; } .callout { display: none } .x {" },
		});
		assert.equal(
			settings?.globalStyle.borderRadius,
			DEFAULT_SETTINGS.globalStyle.borderRadius,
		);
	});

	it("leaves a value the sliders can actually produce exactly as given", () => {
		const { settings } = sanitizeImportedSettings({
			globalStyle: { borderWidth: 2.5, borderRadius: 12, titleScale: 1.35 },
		});
		assert.equal(settings?.globalStyle.borderWidth, 2.5);
		assert.equal(settings?.globalStyle.borderRadius, 12);
		assert.equal(settings?.globalStyle.titleScale, 1.35);
	});
});

describe("sanitizeImportedSettings — the three lists the user builds up", () => {
	it("returns EMPTY arrays when the file carries none of them", () => {
		// This is the whole reason DataManagementSection must merge by id: an
		// Object.assign of this result would replace the user's palettes,
		// pictures and commands with nothing.
		const { settings } = sanitizeImportedSettings({});
		assert.deepStrictEqual(settings?.customPalettes, []);
		assert.deepStrictEqual(settings?.userImages, []);
		assert.deepStrictEqual(settings?.customCommands, []);
	});

	it("an older export, which predates commands entirely, still yields []", () => {
		const { settings } = sanitizeImportedSettings({
			globalStyle: { borderWidth: 2 },
			customPalettes: [palette()],
		});
		assert.equal(settings?.customPalettes.length, 1);
		assert.deepStrictEqual(settings?.customCommands, []);
	});

	it("carries the file's own palettes through, sanitized", () => {
		const { settings } = sanitizeImportedSettings({
			customPalettes: [
				palette({ id: "cp-good" }),
				palette({ id: "cp-bad", colorLight: "not a colour" }),
				palette({ id: "" }),
				null,
				"nope",
			],
		});
		assert.deepStrictEqual(
			settings?.customPalettes.map((p) => p.id),
			["cp-good"],
		);
	});

	it("drops a duplicate palette id rather than keeping both", () => {
		const { settings } = sanitizeImportedSettings({
			customPalettes: [
				palette({ id: "cp-1", name: "First" }),
				palette({ id: "cp-1", name: "Second" }),
			],
		});
		assert.equal(settings?.customPalettes.length, 1);
		assert.equal(settings?.customPalettes[0]?.name, "First");
	});

	it("carries the file's own commands through, sanitized", () => {
		const { settings } = sanitizeImportedSettings({
			customCommands: [
				{ id: "cc-1", calloutId: "note", role: "regular" },
				{ id: "cc-2", calloutId: "note", role: "not-a-role" },
				{ id: "cc-3", calloutId: "", role: "inline" },
				{ calloutId: "note", role: "inline" },
			],
		});
		assert.deepStrictEqual(
			settings?.customCommands.map((c) => c.id),
			["cc-1"],
		);
	});

	it("returns [] for a list that is not an array at all", () => {
		const { settings } = sanitizeImportedSettings({
			customPalettes: { "cp-1": palette() },
			userImages: "none",
			customCommands: 0,
		});
		assert.deepStrictEqual(settings?.customPalettes, []);
		assert.deepStrictEqual(settings?.userImages, []);
		assert.deepStrictEqual(settings?.customCommands, []);
	});

	it("hands back fresh arrays, never DEFAULT_SETTINGS' own", () => {
		// A shared reference would let one import's mutation leak into the
		// defaults for the rest of the session.
		const { settings } = sanitizeImportedSettings({});
		assert.notEqual(settings?.customPalettes, DEFAULT_SETTINGS.customPalettes);
		assert.notEqual(settings?.userImages, DEFAULT_SETTINGS.userImages);
		assert.notEqual(settings?.customCommands, DEFAULT_SETTINGS.customCommands);
		assert.notEqual(
			settings?.globalStyle.borderSides,
			DEFAULT_SETTINGS.globalStyle.borderSides,
		);
	});
});
