/**
 * icons/packs/fontAwesome.ts — Font Awesome Free, all three styles.
 *
 * One source with a style control, not three sources. Solid, Regular and Brands
 * are one library to everyone who uses them, and splitting them meant three
 * rows in the source menu and three separate downloads for what is one decision.
 *
 * The style control filters the grid rather than just restyling it, which is
 * what makes one source workable: Regular holds 169 outline versions of Solid
 * icons and Brands 572 company marks with nothing in common with either, so
 * showing all 1,992 names under every style would leave most cells empty. Pick a
 * style and you see exactly the icons that style draws.
 *
 * Underneath, the three styles stay three pack files and three icon types —
 * `fa-solid`, `fa-regular`, `fa-brands`. That is what keeps every callout and
 * every cached drawing already out there working untouched, and it means a
 * chosen icon still carries its style with it.
 *
 * Licensing is the reason this file carries so much attribution detail. Font
 * Awesome's icons are CC BY 4.0, which requires visible credit and a note that
 * the work was modified — and it was: the path data is extracted from the
 * published SVGs and re-serialized, which drops the attribution comment those
 * files carry. Brands adds a trademark question the icon licence does not
 * cover, so selecting that style also raises a standing notice in the picker.
 */
import type { CalloutIcon, FontAwesomeStyle, IconPackId } from "../../types";
import type { IconAttribution, IconEntry, IconIndex, IconPack, IconVariantState } from "../types";
import type { LocaleKey } from "../../i18n";
import { buildPackSvg } from "../packData";
import { decodeIndex, memoizeIndex } from "../data/codec";
import type { EncodedIndex } from "../data/codec";
import { FA_SOLID_INDEX } from "../data/fa-solid.index";
import { FA_REGULAR_INDEX } from "../data/fa-regular.index";
import { FA_BRANDS_INDEX } from "../data/fa-brands.index";

const FA_VERSION = "7.3.1";
const FA_HOMEPAGE = "https://fontawesome.com";

/**
 * Every Font Awesome icon is 512 units tall, so each has exactly one drawing
 * and the size preference has nothing to choose between.
 */
const FA_SIZES = ["512"] as const;

/**
 * Solid first: it is by far the largest style, and it is the fallback for an
 * icon the selected style has no drawing of.
 */
export const FA_STYLES: readonly FontAwesomeStyle[] = ["solid", "regular", "brands"];

export const FA_DEFAULT_STYLE: FontAwesomeStyle = "solid";

/** The icon type — and so the pack file — each style's artwork lives in. */
const FA_TYPE_OF: Readonly<Record<FontAwesomeStyle, IconPackId>> = {
	solid: "fa-solid",
	regular: "fa-regular",
	brands: "fa-brands",
};

const FA_INDEX_OF: Readonly<Record<FontAwesomeStyle, EncodedIndex>> = {
	solid: FA_SOLID_INDEX,
	regular: FA_REGULAR_INDEX,
	brands: FA_BRANDS_INDEX,
};

const FA_STYLE_LABEL_KEYS: readonly LocaleKey[] = [
	"iconPicker.faStyleSolid",
	"iconPicker.faStyleRegular",
	"iconPicker.faStyleBrands",
];

/** The three pack files this source draws from, in style order. */
export const FA_DATA_PACKS: readonly IconPackId[] = FA_STYLES.map((style) => FA_TYPE_OF[style]);

const FA_TYPES = new Set<string>(FA_DATA_PACKS);

/**
 * Which styles hold a drawing of each name, in FA_STYLES order. Populated by
 * the index build below, which every code path that reads it runs first.
 */
const stylesByName = new Map<string, FontAwesomeStyle[]>();

/**
 * Merge the three bundled indexes into one list of names.
 *
 * Font Awesome's own metadata is a single set of icons annotated with the
 * styles each is drawn in, and this reassembles that: 1,992 distinct names
 * across the three files, each carrying the union of its categories and search
 * terms so a search hits it whichever style is showing.
 */
function buildMergedIndex(): IconIndex {
	interface Merged {
		label?: string;
		categories: Set<string>;
		keywords: Set<string>;
	}
	const merged = new Map<string, Merged>();
	const categories = new Set<string>();

	for (const style of FA_STYLES) {
		const index = decodeIndex(FA_INDEX_OF[style]);
		for (const category of index.categories) categories.add(category);

		for (const entry of index.entries) {
			const styles = stylesByName.get(entry.name);
			if (styles) styles.push(style);
			else stylesByName.set(entry.name, [style]);

			let existing = merged.get(entry.name);
			if (!existing) {
				existing = { categories: new Set(), keywords: new Set() };
				merged.set(entry.name, existing);
			}
			existing.label ??= entry.label;
			for (const category of entry.categories) existing.categories.add(category);
			for (const keyword of entry.keywords) existing.keywords.add(keyword);
		}
	}

	const entries: IconEntry[] = [...merged.keys()].sort().map((name) => {
		const item = merged.get(name) as Merged;
		const entry: IconEntry = {
			name,
			categories: [...item.categories],
			keywords: [...item.keywords],
		};
		if (item.label) entry.label = item.label;
		return entry;
	});

	return { entries, categories: [...categories].sort() };
}

const loadIndex = memoizeIndex(buildMergedIndex);

/**
 * The style an icon of this name is actually drawn in, given the one asked for.
 * `stylesByName` is in preference order, so an icon the chosen style does not
 * draw falls back to Solid before Regular before Brands.
 */
function resolveStyle(name: string, wanted: FontAwesomeStyle): FontAwesomeStyle {
	const available = stylesByName.get(name);
	if (!available || available.includes(wanted)) return wanted;
	return available[0] ?? wanted;
}

const FA_LICENSES: IconAttribution["licenses"] = [
	{
		name: "Creative Commons Attribution 4.0 International",
		spdx: "CC-BY-4.0",
		url: "https://creativecommons.org/licenses/by/4.0/",
		holder: "Fonticons, Inc.",
		scope: "icons",
	},
	{
		name: "MIT License",
		spdx: "MIT",
		url: "https://fontawesome.com/license/free",
		holder: "Fonticons, Inc.",
		scope: "code",
	},
	{
		name: "SIL Open Font License 1.1",
		spdx: "OFL-1.1",
		url: "https://scripts.sil.org/OFL",
		holder: "Fonticons, Inc.",
		scope: "fonts (not shipped by this plugin)",
	},
];

const FA_MODIFICATIONS =
	"Path data extracted from the official Font Awesome Free SVGs and " +
	"re-serialized; the fill colour is applied at render time rather than " +
	"baked in.";

export const faPack: IconPack = {
	id: "fa",
	kind: "bundledRemote",
	labelKey: "iconPicker.fa",
	descriptionKey: "iconPicker.descFa",
	// Font Awesome's own logo is a flag.
	emblemIcon: "flag",
	searchPlaceholderKey: "iconPicker.searchFa",
	hasCategories: true,
	dataPacks: FA_DATA_PACKS,
	variants: [
		{
			kind: "select",
			key: "faStyle",
			labelKey: "iconPicker.faStyle",
			options: FA_STYLES,
			optionLabelKeys: FA_STYLE_LABEL_KEYS,
		},
	],

	attribution: {
		title: "Font Awesome Free",
		homepage: FA_HOMEPAGE,
		version: FA_VERSION,
		licenses: FA_LICENSES,
		modifications: FA_MODIFICATIONS,
		// Trademarks are not covered by the icons' CC BY licence, and Font
		// Awesome asks that brand marks only be used to represent the thing they
		// refer to. Passing that on is the whole point of the notice.
		noticeKey: "iconPack.faBrandsNotice",
	},

	loadIndex(): Promise<IconIndex> {
		return loadIndex();
	},

	entryMatches(entry: IconEntry, variants: IconVariantState): boolean {
		const style = variants.faStyle ?? FA_DEFAULT_STYLE;
		return stylesByName.get(entry.name)?.includes(style) ?? true;
	},

	makeIcon(entry: IconEntry, variants: IconVariantState): CalloutIcon {
		// The fallback is for the pooled "All sources" grid, which shows every
		// name at once with no style control to keep them in step.
		const style = resolveStyle(entry.name, variants.faStyle ?? FA_DEFAULT_STYLE);
		return { type: FA_TYPE_OF[style], value: entry.name };
	},

	cacheVariant(): string {
		// The style is already the icon's `type`, which is part of every cache
		// key — so there is nothing left for this to distinguish.
		return "";
	},

	pickerNotice(variants: IconVariantState): LocaleKey | undefined {
		return (variants.faStyle ?? FA_DEFAULT_STYLE) === "brands" ? "iconPack.faBrandsNotice" : undefined;
	},

	buildSvg(icon: CalloutIcon): string | null {
		// Guarded so hand-edited data cannot aim this at another pack's file.
		if (!FA_TYPES.has(icon.type)) return null;
		return buildPackSvg(icon.type, icon.value, FA_SIZES);
	},
};

/** The style an already-stored icon was picked in, for reopening the picker. */
export function faStyleOf(icon: CalloutIcon): FontAwesomeStyle | undefined {
	return FA_STYLES.find((style) => FA_TYPE_OF[style] === icon.type);
}

/**
 * Which of the three files actually draws this name, honouring `wanted` when it
 * is one of them. Undefined for a name Font Awesome does not have at all.
 *
 * For imports, which arrive knowing a name and — at best — a style they are not
 * required to have got right. The search index cannot answer this on its own:
 * the three styles are merged into one list of names, so a membership test says
 * "Font Awesome has this" and never "Solid has this". A Brands-only name like
 * `square-github` stored as Solid points into a file with no such drawing.
 *
 * The correction runs even when a style was stated, and deliberately: the same
 * `resolveStyle` fallback backs the picker, so an import lands on exactly the
 * icon picking that name there would have given.
 *
 * Async because it needs the merged index built; it is memoized, so the cost is
 * paid once per session and is already paid by any name check that ran first.
 */
export async function faTypeForName(
	name: string,
	wanted: FontAwesomeStyle = FA_DEFAULT_STYLE,
): Promise<IconPackId | undefined> {
	await loadIndex();
	if (!stylesByName.has(name)) return undefined;
	return FA_TYPE_OF[resolveStyle(name, wanted)];
}
