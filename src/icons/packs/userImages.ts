/**
 * icons/packs/userImages.ts — Pictures the user added from their own computer.
 *
 * The only source whose artwork is neither bundled nor downloadable: it lives in
 * `PluginSettings.userImages`, so it syncs with the rest of `data.json` and
 * travels inside an export without the export having to become an archive.
 *
 * Whatever was uploaded, the stored artwork is SVG markup — an uploaded SVG kept
 * as vector, or a raster re-encoded through a canvas and wrapped in
 * `<svg><image href="data:…"></svg>` (see `userImageImport.ts`). That is what
 * lets every render surface, the resolver and the PDF-export path treat a
 * picture as an ordinary icon; only CSSInjector cares, and only to decide
 * between a mask and a background.
 *
 * The pack reads a module-level snapshot rather than the settings object,
 * because `buildSvg` is synchronous by contract and is called from render paths
 * that have no route back to the plugin. `setUserImages` is the one writer;
 * CalloutRegistry calls it whenever the list loads or changes.
 */
import type { CalloutIcon, UserImageIcon } from "../../types";
import type { IconEntry, IconIndex, IconPack } from "../types";

/**
 * The current pictures, keyed by id for the per-render lookups.
 *
 * A plain module-level map is enough because there is exactly one settings
 * object per plugin instance, and every reader wants the same snapshot.
 */
let images = new Map<string, UserImageIcon>();

/** Replace the pack's view of the user's pictures. Called on load and on edit. */
export function setUserImages(list: readonly UserImageIcon[]): void {
	images = new Map(list.map((image) => [image.id, image]));
}

/** The picture behind an icon, or undefined once it has been deleted. */
export function findUserImage(id: string): UserImageIcon | undefined {
	return images.get(id);
}

/**
 * The picture behind an icon, when the icon is one of the user's own.
 *
 * Undefined for every library icon, and also for a picture that has since been
 * deleted — in both cases the caller wants the ordinary monochrome treatment.
 */
export function userImageFor(icon: CalloutIcon): UserImageIcon | undefined {
	return icon.type === "image" ? findUserImage(icon.value) : undefined;
}

/** Every picture, newest first — the order the picker's grid shows them in. */
export function listUserImages(): UserImageIcon[] {
	return [...images.values()].sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Whether this callout wants its picture stencilled in the callout's colour.
 *
 * The choice is the callout's (`CalloutIcon.recolor`) but the capability is the
 * artwork's, and only an SVG has it. Both halves live here so that the places
 * that split on it — CSS deciding between a mask and a background image, and
 * renderIcon deciding whether to stencil the DOM copy — cannot drift apart.
 */
export function followsCalloutColor(
	icon: CalloutIcon,
	image: UserImageIcon | undefined,
): boolean {
	return image !== undefined && image.format === "svg" && icon.recolor === true;
}

export const userImagesPack: IconPack = {
	id: "image",
	kind: "local",
	labelKey: "iconPicker.custom",
	descriptionKey: "iconPicker.descCustom",
	emblemIcon: "image",
	searchPlaceholderKey: "iconPicker.searchCustom",
	// The user's own handful of pictures; a category filter would be noise.
	hasCategories: false,

	// No third-party artwork, so nothing to credit. An empty licence list is the
	// existing signal for "show no attribution block" (see allSources).
	attribution: {
		title: "Custom Icons",
		homepage: "",
		version: "",
		licenses: [],
	},

	loadIndex(): Promise<IconIndex> {
		// Not memoized, unlike every other pack: this index changes whenever the
		// user adds or deletes a picture, and it is a handful of entries built
		// from memory rather than a decode of a bundled blob.
		return Promise.resolve({
			entries: listUserImages().map(
				(image): IconEntry => ({
					name: image.id,
					label: image.name,
					categories: [],
					// The id is meaningless to search on, so the name carries it.
					keywords: [image.name],
				}),
			),
			categories: [],
		});
	},

	makeIcon(entry: IconEntry): CalloutIcon {
		// A flat one-colour drawing is offered following the callout's colour,
		// which is almost always what is wanted and is the only way a black logo
		// stays visible in a dark theme. From here it is the callout's to change.
		return {
			type: "image",
			value: entry.name,
			recolor: images.get(entry.name)?.monochrome === true,
		};
	},

	/**
	 * The artwork identity. `rev` belongs here even though it is not part of the
	 * icon: replacing a picture keeps the same id, so without it an open note
	 * would keep its stale drawing (see `iconRenderKey`). `recolor` is the
	 * callout's own, and two callouts sharing a picture must not share a key —
	 * one would keep the other's paint. Same for every render role, though:
	 * one picture, one drawing.
	 */
	cacheVariant(icon: CalloutIcon): string {
		const image = images.get(icon.value);
		if (!image) return "0";
		return `${image.rev}${icon.recolor ? "c" : ""}`;
	},

	/**
	 * Null once the picture is deleted, which is the same answer as artwork that
	 * was never downloaded — so a callout still pointing at it falls back to the
	 * caller's placeholder rather than breaking.
	 */
	buildSvg(icon: CalloutIcon): string | null {
		return images.get(icon.value)?.svg ?? null;
	},
};
