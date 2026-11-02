/**
 * icons/packs/tabler.ts — Tabler Icons, both styles.
 *
 * One source with a style control, the same shape Font Awesome already has and
 * for the same reason: Outline and Filled are one library to everyone who uses
 * them, and splitting them would mean two rows in the source menu and two
 * decisions for what is one. Underneath they stay two pack files and two icon
 * types, so a chosen icon carries its style with it and cached drawings never
 * collide.
 *
 * The style control filters the grid as well as restyling it. Every one of the
 * 5,130 names has an outline drawing but only 1,054 have a filled one, so
 * showing all of them under Filled would leave four cells in five empty.
 *
 * This is the first stroked pack. Every other downloadable library is solid
 * artwork the renderer fills; Tabler's outlines are drawn with a stroke and
 * `fill="none"`, which is a paint the drawing has to state for itself. That
 * paint lives here, in source, rather than in the downloaded file — the file
 * stays path data and 1s, which is what lets it skip SVG sanitization
 * altogether. buildPackSvg emits it and renderIcon recognises it.
 */
import type { CalloutIcon, IconPackId, TablerIconStyle } from "../../types";
import type { IconEntry, IconIndex, IconPack, IconVariantState } from "../types";
import type { LocaleKey } from "../../i18n";
import { buildPackSvg } from "../packData";
import type { PackStroke } from "../packData";
import { decodeIndex, memoizeIndex } from "../data/codec";
import type { EncodedIndex } from "../data/codec";
import { TABLER_OUTLINE_INDEX } from "../data/tabler-outline.index";
import { TABLER_FILLED_INDEX } from "../data/tabler-filled.index";

const TABLER_VERSION = "3.46.0";
const TABLER_HOMEPAGE = "https://tabler.io/icons";

/** Every Tabler drawing is on the same 24-unit square, so there is one size. */
const TABLER_SIZES = ["24"] as const;

/**
 * How the outline style is drawn, copied from the values every one of its SVGs
 * carries on its root. Filled passes none of this and is painted the ordinary
 * way.
 */
const TABLER_STROKE: PackStroke = {
	width: 2,
	linecap: "round",
	linejoin: "round",
};

/**
 * Outline first: every icon is drawn in it, which also makes it the fallback
 * for a name the chosen style has no drawing of.
 */
export const TABLER_STYLES: readonly TablerIconStyle[] = ["outline", "filled"];

export const TABLER_DEFAULT_STYLE: TablerIconStyle = "outline";

/** The icon type — and so the pack file — each style's artwork lives in. */
const TABLER_TYPE_OF: Readonly<Record<TablerIconStyle, IconPackId>> = {
	outline: "tabler-outline",
	filled: "tabler-filled",
};

const TABLER_INDEX_OF: Readonly<Record<TablerIconStyle, EncodedIndex>> = {
	outline: TABLER_OUTLINE_INDEX,
	filled: TABLER_FILLED_INDEX,
};

const TABLER_STYLE_LABEL_KEYS: readonly LocaleKey[] = ["iconPicker.tablerStyleOutline", "iconPicker.tablerStyleFilled"];

/** The two pack files this source draws from, in style order. */
export const TABLER_DATA_PACKS: readonly IconPackId[] = TABLER_STYLES.map((style) => TABLER_TYPE_OF[style]);

const TABLER_TYPES = new Set<string>(TABLER_DATA_PACKS);

/**
 * Which styles hold a drawing of each name, in TABLER_STYLES order. Populated
 * by the index build below, which every code path that reads it runs first.
 */
const stylesByName = new Map<string, TablerIconStyle[]>();

/**
 * Merge the two bundled indexes into one list of names.
 *
 * Upstream's metadata is a single set of icons annotated with the styles each is
 * drawn in, and this reassembles that: 5,130 distinct names carrying the union
 * of their categories and search terms, so a search hits an icon whichever
 * style is showing.
 */
function buildMergedIndex(): IconIndex {
	interface Merged {
		categories: Set<string>;
		keywords: Set<string>;
	}
	const merged = new Map<string, Merged>();
	const categories = new Set<string>();

	for (const style of TABLER_STYLES) {
		const index = decodeIndex(TABLER_INDEX_OF[style]);
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
			for (const category of entry.categories) existing.categories.add(category);
			for (const keyword of entry.keywords) existing.keywords.add(keyword);
		}
	}

	const entries: IconEntry[] = [...merged.keys()].sort().map((name) => {
		const item = merged.get(name) as Merged;
		return {
			name,
			categories: [...item.categories],
			keywords: [...item.keywords],
		};
	});

	return { entries, categories: [...categories].sort() };
}

const loadIndex = memoizeIndex(buildMergedIndex);

/**
 * The style an icon of this name is actually drawn in, given the one asked for.
 * `stylesByName` is in preference order, so a name Filled does not draw falls
 * back to Outline rather than to nothing.
 */
function resolveStyle(name: string, wanted: TablerIconStyle): TablerIconStyle {
	const available = stylesByName.get(name);
	if (!available || available.includes(wanted)) return wanted;
	return available[0] ?? wanted;
}

export const tablerPack: IconPack = {
	id: "tabler",
	kind: "bundledRemote",
	labelKey: "iconPicker.tabler",
	descriptionKey: "iconPicker.descTabler",
	emblemIcon: "square-terminal",
	searchPlaceholderKey: "iconPicker.searchTabler",
	hasCategories: true,
	dataPacks: TABLER_DATA_PACKS,
	variants: [
		{
			kind: "select",
			key: "tablerStyle",
			labelKey: "iconPicker.tablerStyle",
			options: TABLER_STYLES,
			optionLabelKeys: TABLER_STYLE_LABEL_KEYS,
		},
	],

	attribution: {
		title: "Tabler Icons",
		homepage: TABLER_HOMEPAGE,
		version: TABLER_VERSION,
		licenses: [
			{
				name: "MIT License",
				spdx: "MIT",
				url: "https://github.com/tabler/tabler-icons/blob/main/LICENSE",
				holder: "Paweł Kuna",
			},
		],
		modifications:
			"Path data extracted from the published SVGs and re-serialized; the " +
			"transparent bounding path every file opens with is dropped, the stroke " +
			"styling is applied at render time rather than baked in, and the " +
			"half-opacity on one path of `brand-parsinta` is not carried over.",
	},

	loadIndex(): Promise<IconIndex> {
		return loadIndex();
	},

	entryMatches(entry: IconEntry, variants: IconVariantState): boolean {
		const style = variants.tablerStyle ?? TABLER_DEFAULT_STYLE;
		return stylesByName.get(entry.name)?.includes(style) ?? true;
	},

	makeIcon(entry: IconEntry, variants: IconVariantState): CalloutIcon {
		// The fallback is for the pooled "All sources" grid, which shows every
		// name at once with no style control to keep them in step.
		const style = resolveStyle(entry.name, variants.tablerStyle ?? TABLER_DEFAULT_STYLE);
		return { type: TABLER_TYPE_OF[style], value: entry.name };
	},

	cacheVariant(): string {
		// The style is already the icon's `type`, which is part of every cache
		// key — so there is nothing left for this to distinguish.
		return "";
	},

	buildSvg(icon: CalloutIcon): string | null {
		// Guarded so hand-edited data cannot aim this at another pack's file.
		if (!TABLER_TYPES.has(icon.type)) return null;
		return buildPackSvg(
			icon.type,
			icon.value,
			TABLER_SIZES,
			icon.type === "tabler-outline" ? TABLER_STROKE : undefined,
		);
	},
};

/** The style an already-stored icon was picked in, for reopening the picker. */
export function tablerStyleOf(icon: CalloutIcon): TablerIconStyle | undefined {
	return TABLER_STYLES.find((style) => TABLER_TYPE_OF[style] === icon.type);
}
