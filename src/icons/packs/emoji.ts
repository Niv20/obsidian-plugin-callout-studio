/**
 * icons/packs/emoji.ts — Unicode emoji, drawn by the system emoji font.
 *
 * There is no artwork to ship: the glyph itself is the stored value and the
 * platform renders it. Only the searchable dataset is bundled (generated from
 * emojibase by scripts/generate-emoji.mjs).
 */
import type { IconEntry, IconIndex, IconPack, IconVariantState } from "../types";
import { EMOJI_DATA } from "../../data/emojiData";

let index: IconIndex | null = null;
let labelByGlyph: Map<string, string> | null = null;

/** Human-readable name for a stored emoji glyph, base or skin-tone variant. */
export function emojiLabelFor(glyph: string): string | undefined {
	if (!labelByGlyph) {
		labelByGlyph = new Map();
		for (const entry of EMOJI_DATA) {
			labelByGlyph.set(entry.emoji, entry.label);
			for (const skin of entry.skins ?? []) {
				labelByGlyph.set(skin, entry.label);
			}
		}
	}
	return labelByGlyph.get(glyph);
}

export const emojiPack: IconPack = {
	id: "emoji",
	kind: "glyph",
	labelKey: "iconPicker.emoji",
	descriptionKey: "iconPicker.descEmoji",
	emblemIcon: "smile",
	searchPlaceholderKey: "iconPicker.searchEmoji",
	hasCategories: false,
	variants: [{ kind: "skin-tone" }],

	attribution: {
		title: "Emoji",
		homepage: "https://github.com/milesj/emojibase",
		version: "emojibase",
		licenses: [
			{
				name: "MIT License",
				spdx: "MIT",
				url: "https://github.com/milesj/emojibase/blob/master/LICENSE",
				holder: "Miles Johnson",
				scope: "emoji names and search keywords",
			},
		],
		modifications:
			"Names, keywords and skin-tone variants extracted from emojibase-data; " +
			"the glyphs themselves are rendered by the reader's system emoji font.",
	},

	loadIndex(): Promise<IconIndex> {
		if (!index) {
			const entries: IconEntry[] = EMOJI_DATA.map((e) => ({
				name: e.emoji,
				label: e.label,
				categories: [],
				keywords: e.tags,
				variants: e.skins,
			}));
			index = { entries, categories: [] };
		}
		return Promise.resolve(index);
	},

	makeIcon(entry: IconEntry, variants: IconVariantState) {
		const tone = variants.emojiSkinTone ?? 0;
		// Tone 0 is the base glyph; 1–5 index the light → dark variants, which
		// only skin-tone-capable emoji carry.
		const value = tone >= 1 && tone <= 5 ? (entry.variants?.[tone - 1] ?? entry.name) : entry.name;
		return { type: "emoji" as const, value };
	},

	cacheVariant(): string {
		return "";
	},
};
