/**
 * icons/registry.ts — The set of icon libraries the plugin knows about.
 *
 * Two id spaces meet here, and keeping them apart is the point of this file:
 *
 * - **IconSourceId** is a library as the user meets it — one row in the picker's
 *   source menu, one toolbar, one download button.
 * - **IconPackId** is one body of artwork — one `CalloutIcon.type`, one entry in
 *   the pack manifest, one downloaded file, one SVG cache key.
 *
 * They are the same string for every library but Font Awesome, whose Solid,
 * Regular and Brands are three files behind one source. Both mappings are plain
 * frozen records rather than self-registration: each is total over its union, so
 * declaring an id without the thing behind it fails to compile, and there is no
 * import-order dependency to get wrong.
 *
 * Adding a library is a file under `packs/`, a member on each union, and a line
 * in each record here.
 */
import type { CalloutIcon, IconPackId, IconSourceId } from "../types";
import type { IconPack } from "./types";
import { lucidePack } from "./packs/lucide";
import { tablerPack } from "./packs/tabler";
import { materialPack } from "./packs/material";
import { emojiPack } from "./packs/emoji";
import { octiconsPack } from "./packs/octicons";
import { faPack } from "./packs/fontAwesome";
import { rpgAwesomePack } from "./packs/rpgAwesome";
import { simpleIconsPack } from "./packs/simpleIcons";
import { userImagesPack } from "./packs/userImages";

export const ICON_SOURCES: Readonly<Record<IconSourceId, IconPack>> =
	Object.freeze({
		lucide: lucidePack,
		// Second, next to Lucide: it is the same outline idiom drawn on the same
		// 24-unit grid, so the two read as neighbours rather than as alternatives.
		tabler: tablerPack,
		material: materialPack,
		emoji: emojiPack,
		octicons: octiconsPack,
		fa: faPack,
		"rpg-awesome": rpgAwesomePack,
		"simple-icons": simpleIconsPack,
		// Last, and deliberately so: the libraries are what most people want, and
		// the user's own pictures read as the escape hatch at the end of the list.
		image: userImagesPack,
	});

/** Every source, in the order the picker offers them. */
export const ICON_SOURCE_IDS: readonly IconSourceId[] = Object.freeze(
	Object.keys(ICON_SOURCES) as IconSourceId[],
);

/** Which source owns each body of artwork. */
const SOURCE_OF_TYPE: Readonly<Record<IconPackId, IconSourceId>> = Object.freeze(
	{
		lucide: "lucide",
		"tabler-outline": "tabler",
		"tabler-filled": "tabler",
		material: "material",
		emoji: "emoji",
		octicons: "octicons",
		"fa-solid": "fa",
		"fa-regular": "fa",
		"fa-brands": "fa",
		"rpg-awesome": "rpg-awesome",
		"simple-icons": "simple-icons",
		image: "image",
	},
);

/**
 * Every icon type that may appear as `CalloutIcon.type`. Not the same list as
 * the sources — this is what an import is validated against.
 */
export const ICON_PACK_IDS: readonly IconPackId[] = Object.freeze(
	Object.keys(SOURCE_OF_TYPE) as IconPackId[],
);

export function getSource(id: IconSourceId): IconPack {
	return ICON_SOURCES[id];
}

/**
 * The source an icon belongs to, or undefined when its `type` is not one this
 * build knows — an import from a newer version, or a hand-edited `data.json`.
 * Callers must handle undefined rather than assume the union is exhaustive at
 * runtime; the type system cannot vouch for data read off disk.
 */
export function packFor(icon: CalloutIcon): IconPack | undefined {
	const source = SOURCE_OF_TYPE[icon.type];
	return source ? ICON_SOURCES[source] : undefined;
}

/**
 * Identity of one cached drawing. Keyed by icon type rather than by source: two
 * Font Awesome styles of the same name are two different drawings, and each is
 * cached under the file it came from. Only ever used to compare entries with
 * each other, so the separator just has to be something no id, icon name or
 * variant contains.
 */
export function iconCacheKey(
	pack: IconPackId,
	name: string,
	variant: string,
): string {
	return `${pack} ${name} ${variant}`;
}
