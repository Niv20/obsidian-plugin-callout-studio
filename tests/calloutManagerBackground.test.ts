/** Issue #39: importing an accent must retain Obsidian's native nested tint. */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { CalloutDefinition, CustomPalette, PluginData } from "../src/types";
import { parseCalloutManagerExport } from "../src/utils/calloutCssParse";
import { parseCalloutManagerData } from "../src/utils/calloutManagerFormat";
import {
	planCalloutManagerImport,
	toCalloutManagerEntries,
	type CalloutManagerEntry,
} from "../src/utils/calloutManagerImport";
import { blendHex, derivePaletteFromColor, derivePaletteFromColors } from "../src/utils/colorUtils";
import { definition, harness, must, parseRules, type Harness } from "./support/cssInjectorHarness";

const PURPLE = "#a882ff";

beforeEach(() => {
	(globalThis as unknown as { __CS_ICON_IDS__: string[] }).__CS_ICON_IDS__ = ["star", "pencil"];
});

function fileEntries(id: string, dark?: string): CalloutManagerEntry[] {
	const data: unknown = JSON.parse(JSON.stringify({
		calloutDetection: { obsidian: true, theme: true, snippet: true },
		callouts: {
			custom: [id],
			settings: {
				[id]: [
					{ changes: { color: "168, 130, 255", icon: "lucide-star" } },
					...(dark ? [{ condition: { colorScheme: "dark" }, changes: { color: dark } }] : []),
				],
			},
		},
	}));
	const raw = parseCalloutManagerData(data);
	assert.ok(raw);
	return toCalloutManagerEntries(raw);
}

function apply(h: Harness, entries: CalloutManagerEntry[]) {
	const plan = planCalloutManagerImport(entries, h.registry);
	assert.deepEqual(plan.issues, []);
	return h.registry.applyCalloutManagerImport(plan.toApply);
}

function reload(h: Harness): Harness {
	const next = harness();
	next.registry.load(JSON.parse(JSON.stringify(h.registry.toSaveData())) as PluginData);
	return next;
}

function nativeBackground(h: Harness, id: string): CalloutDefinition {
	const def = must(h.registry.getReal(id), id);
	assert.equal(def.bgColorLight, undefined, `${id}: light background must remain native`);
	assert.equal(def.bgColorDark, undefined, `${id}: dark background must remain native`);
	assert.equal(def.bgGradient, undefined);
	assert.equal(def.transparentBg, undefined);
	for (const mode of ["light", "dark"] as const) {
		assert.deepEqual(h.css.bgProps(def, mode), [], `${id}: ${mode} emits no fill override`);
	}
	for (const rule of parseRules(h.css.generateCalloutCSS(def))) {
		assert.ok(!rule.props.includes("background-color"), rule.selector);
		assert.ok(!rule.props.includes("background-image"), rule.selector);
	}
	return def;
}

describe("Callout Manager imports keep the native nested-callout background", () => {
	for (const source of ["data.json", "per-scheme data.json", "pasted CSS"] as const) {
		it(`keeps accents and text, without a fill override, immediately and after reload: ${source}`, () => {
			const h = harness();
			const dark = source === "per-scheme data.json" ? "#ff8a65" : PURPLE;
			const entries = source === "pasted CSS"
				? parseCalloutManagerExport('.callout[data-callout="purple"] { --callout-color: 168, 130, 255; --callout-icon: lucide-star; }')
				: fileEntries("purple", dark === PURPLE ? undefined : dark);
			assert.deepEqual(apply(h, entries), { created: 1, updated: 0 });
			const expected = derivePaletteFromColors(PURPLE, dark);
			// This correction is why the existing derived-background migration
			// cannot recognize these original 18% fills from the saved accent.
			assert.notEqual(expected.colorLight, PURPLE);
			for (const state of [h, reload(h)]) {
				const def = nativeBackground(state, "purple");
				for (const key of ["colorLight", "colorDark", "textColorLight", "textColorDark"] as const) {
					assert.equal(def[key], expected[key], key);
				}
				assert.deepEqual(def.icon, { type: "lucide", value: "star" });
				assert.equal(state.registry.settings.customPalettes.length, 1);
				const palette = must(state.registry.settings.customPalettes[0]);
				assert.equal(def.paletteId, palette.id);
				assert.equal(palette.bgColorLight, expected.bgColorLight);
				assert.equal(palette.bgColorDark, expected.bgColorDark);
			}
		});
	}

	it("updates a built-in and creates custom rows in one notification, sharing one palette", () => {
		const h = harness();
		let changes = 0;
		h.registry.onChange(() => changes++);
		assert.deepEqual(apply(h, [...fileEntries("note"), ...fileEntries("purple"), ...fileEntries("other")]), {
			created: 2, updated: 1,
		});
		assert.equal(changes, 1);
		assert.equal(h.registry.settings.customPalettes.length, 1);
		const paletteId = h.registry.getReal("purple")?.paletteId;
		for (const id of ["note", "purple", "other"]) {
			assert.equal(nativeBackground(h, id).paletteId, paletteId);
		}
		assert.equal(h.registry.getReal("note")?.builtIn, true);
	});

	for (const base of ["#1c1c1c", "#1e1e1e"]) {
		it(`repairs explicitly reimported legacy backgrounds over ${base}, preserving other saved choices`, () => {
			const h = harness();
			const derived = derivePaletteFromColor(PURPLE);
			const palette: CustomPalette = { id: "cp-existing", name: "My purple", ...derived };
			h.registry.settings.customPalettes.push(palette);
			h.registry.add(definition({
				id: "legacy purple", displayName: "My original title", ...derived,
				bgColorDark: blendHex(PURPLE, base, 0.82), paletteId: palette.id,
				aliases: ["prior-purple"], metadata: { owner: "kept" },
				foldable: false, defaultFolded: true, iconSize: 1.2,
			}));
			h.registry.add(definition({ id: "authored", ...derived, paletteId: palette.id }));
			const loaded = reload(h);
			const before = structuredClone(must(loaded.registry.getReal("legacy purple")));
			assert.equal(before.bgColorLight, derived.bgColorLight, "the legacy fill survives the existing load migration");
			assert.equal(before.bgColorDark, blendHex(PURPLE, base, 0.82));
			const unrelated = structuredClone(loaded.registry.getReal("authored"));
			const palettes = structuredClone(loaded.registry.settings.customPalettes);
			const size = loaded.registry.getAll().length;
			for (let attempt = 0; attempt < 2; attempt++) {
				assert.deepEqual(apply(loaded, fileEntries("legacy-purple")), { created: 0, updated: 1 });
				const repaired = nativeBackground(loaded, "legacy purple");
				for (const key of ["id", "displayName", "aliases", "metadata", "foldable", "defaultFolded", "iconSize", "paletteId"] as const) {
					assert.deepEqual(repaired[key], before[key], key);
				}
				assert.equal(loaded.registry.findByIdentity("prior-purple")?.id, "legacy purple");
				assert.equal(loaded.registry.getAll().length, size);
				assert.deepEqual(loaded.registry.settings.customPalettes, palettes);
				assert.deepEqual(loaded.registry.getReal("authored"), unrelated);
			}
			const again = reload(loaded);
			nativeBackground(again, "legacy purple");
			assert.deepEqual(again.registry.getReal("authored"), unrelated);
			assert.deepEqual(again.registry.settings.customPalettes, palettes);
		});
	}

	it("leaves authored colors and backgrounds intact when the import only changes icons", () => {
		const h = harness();
		const rows = [
			definition({ id: "authored", ...derivePaletteFromColor(PURPLE), bgGradient: {
				angleDeg: 90, toColorLight: "#ffeedd", toColorDark: "#332211",
			} }),
			definition({ id: "clear", transparentBg: true }),
		];
		for (const row of rows) h.registry.add(row);
		const before = rows.map(row => structuredClone(must(h.registry.getReal(row.id))));
		const entries = parseCalloutManagerExport(rows.map(row =>
			`.callout[data-callout="${row.id}"] { --callout-icon: lucide-star; }`,
		).join("\n"));
		assert.deepEqual(apply(h, entries), { created: 0, updated: 2 });
		for (const row of before) {
			assert.deepEqual(h.registry.getReal(row.id), { ...row, icon: { type: "lucide", value: "star" } });
		}
		assert.deepEqual(h.registry.settings.customPalettes, []);
	});

	for (const state of ["gradient", "transparent"] as const) {
		it(`clears an earlier ${state} when the source explicitly replaces its color`, () => {
			const h = harness();
			h.registry.add(definition({
				id: "purple",
				...(state === "transparent" ? { transparentBg: true as const } : {
					...derivePaletteFromColor(PURPLE),
					bgGradient: { angleDeg: 90, toColorLight: "#ffeedd", toColorDark: "#332211" },
				}),
			}));
			assert.deepEqual(apply(h, fileEntries("purple")), { created: 0, updated: 1 });
			nativeBackground(h, "purple");
			nativeBackground(reload(h), "purple");
		});
	}
});
