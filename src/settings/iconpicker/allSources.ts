/**
 * settings/iconpicker/allSources.ts — Searching every source at once.
 *
 * With six libraries and 10,000-odd icons, knowing *which* one holds the icon
 * you want is its own puzzle — you want "swords", not "the fantasy one".
 * This pools every source whose artwork is usable into one searchable list.
 *
 * It is itself an IconPack, so the picker panel needs no special case: it just
 * renders another source. Each pooled entry remembers where it came from, and
 * every per-icon operation is delegated back to that source.
 *
 * Only the libraries Pick an icon offers are pooled — `pickerSources` in
 * icons/iconLibraries.ts, in the user's order. A downloadable library that is
 * not on this device would otherwise contribute a few hundred blank cells,
 * and one the user hid would turn up in the results anyway.
 */
import type { CalloutIcon, IconSourceId } from "../../types";
import type {
	IconEntry,
	IconIndex,
	IconPack,
	IconVariantState,
} from "../../icons/types";
import { getSource, packFor } from "../../icons/registry";

/** Marks the pooled option in the source menu; not a real source id. */
export const ALL_SOURCES = "all";

export type PickerSourceId = IconSourceId | typeof ALL_SOURCES;

/**
 * How the pooled list presents itself in the source menu. Split out so the menu
 * can describe it without building the pooled pack, which is rebuilt from every
 * member's index each time it is needed.
 */
export const ALL_SOURCES_META = {
	labelKey: "iconPicker.allSources",
	descriptionKey: "iconPicker.descAllSources",
	emblemIcon: "search",
	searchPlaceholderKey: "iconPicker.searchAllSources",
} as const;

/** The pooled list, which also says which libraries it pools. */
export interface AllSourcesPack extends IconPack {
	/**
	 * The libraries in the pool. The panel asks before loading Material's
	 * webfont from Google: a pool without Material — the user hid it — must not
	 * fetch the font for cells it will never draw.
	 */
	readonly memberIds: readonly IconSourceId[];
}

/**
 * Whether a pack is the pooled list. It borrows the IconPack shape (and so the
 * IconPackId field) without being a real library, which is what lets the picker
 * panel render it with no special case.
 */
export function isAllSources(pack: IconPack): pack is AllSourcesPack {
	return (pack.id as string) === ALL_SOURCES;
}

/**
 * Build the pooled source over `members`.
 *
 * Not memoized: which sources qualify changes as the user downloads, deletes
 * or hides them, and rebuilding is a concat of already-decoded arrays.
 */
export function createAllSourcesPack(members: readonly IconPack[]): AllSourcesPack {
	return {
		id: ALL_SOURCES as IconSourceId,
		kind: "builtin",
		...ALL_SOURCES_META,
		memberIds: members.map((pack) => pack.id),
		// Category taxonomies do not survive pooling — Font Awesome's 68 have
		// no counterpart in the other sources, so the filter would apply to a
		// fraction of the grid and silently hide the rest.
		hasCategories: false,

		attribution: {
			title: "",
			homepage: "",
			version: "",
			licenses: [],
		},

		async loadIndex(): Promise<IconIndex> {
			const indexes = await Promise.all(
				members.map(async (pack) => ({
					pack,
					index: await pack.loadIndex(),
				})),
			);
			const entries: IconEntry[] = [];
			for (const { pack, index } of indexes) {
				for (const entry of index.entries) {
					entries.push({ ...entry, pack: pack.id });
				}
			}
			return { entries, categories: [] };
		},

		makeIcon(entry: IconEntry, variants: IconVariantState): CalloutIcon {
			const owner = entry.pack ? getSource(entry.pack) : undefined;
			// An entry always carries its source here; the fallback keeps a
			// malformed one from throwing mid-render.
			return owner
				? owner.makeIcon(entry, variants)
				: { type: "lucide", value: entry.name };
		},

		cacheVariant(icon, role): string {
			return packFor(icon)?.cacheVariant(icon, role) ?? "";
		},

		buildSvg(icon, role): string | null {
			return packFor(icon)?.buildSvg?.(icon, role) ?? null;
		},
	};
}
