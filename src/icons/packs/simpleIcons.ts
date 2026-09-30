/**
 * icons/packs/simpleIcons.ts — Simple Icons, the logos of brands and projects.
 *
 * Mechanically the plainest downloadable pack there is: every logo is one path
 * on a 24-unit square, with one drawing, no styles and no taxonomy. One file,
 * downloaded once, rather than Material's request per icon — there is exactly
 * one drawing of each logo, so a whole-library file exists, the picker grid can
 * draw from it, and a single checksum vouches for all of it.
 *
 * What sets it apart is what the artwork *is*: somebody else's mark. That shows
 * up in three places.
 *
 * The licence is not one licence. Simple Icons dedicates its collection to the
 * public domain (CC0) and is explicit that this does not make every logo in it
 * CC0: where a brand published its logo under terms of its own, upstream
 * records them on the icon. The generator reads that record and decides logo by
 * logo — see the Simple Icons section of scripts/generate-icon-packs.mjs. A
 * logo whose terms a credit can meet ships, and is credited by name in
 * docs/SIMPLE-ICONS-LICENSES.md; a logo whose terms it cannot (non-commercial,
 * no derivatives, GPL-family, brand-specific) is not in the file at all.
 *
 * Every logo is a trademark, whatever its copyright licence says. So the notice
 * Font Awesome raises for its Brands style alone stands here for the whole
 * source, always.
 *
 * And the names are upstream's slugs — `nodedotjs`, not `Node.js` — because the
 * slug is the stable id: it is the file name upstream publishes, and what
 * anyone who has used Simple Icons elsewhere already knows a logo by. The title
 * rides along in the index only where it says something the slug does not.
 */
import type { CalloutIcon } from "../../types";
import type { IconEntry, IconIndex, IconPack } from "../types";
import { buildPackSvg } from "../packData";
import { decodeIndex, memoizeIndex } from "../data/codec";
import { PACKS_TAG } from "../data/packManifest";
import { SIMPLE_ICONS_INDEX } from "../data/simple-icons.index";

const SIMPLE_ICONS_VERSION = "16.33.0";

/**
 * The per-logo credits, at the tag the pack file itself is served from.
 *
 * Pinned to that tag rather than to the default branch on purpose: the list is
 * generated in the same pass as the file, so at that tag the two describe each
 * other exactly — whatever a later refresh adds or drops.
 */
const PER_LOGO_NOTICES_URL =
	`https://github.com/Niv20/obsidian-plugin-callout-studio/blob/${PACKS_TAG}` +
	"/docs/SIMPLE-ICONS-LICENSES.md";

/** Every logo is drawn on the same 24-unit square, so there is one size. */
const SIMPLE_ICONS_SIZES = ["24"] as const;

const loadIndex = memoizeIndex(() => decodeIndex(SIMPLE_ICONS_INDEX));

export const simpleIconsPack: IconPack = {
	id: "simple-icons",
	kind: "bundledRemote",
	labelKey: "iconPicker.simpleIcons",
	descriptionKey: "iconPicker.descSimpleIcons",
	// A badge with nothing on it: an insignia, without the tick that would read
	// as "verified" — the one thing a set of other people's marks must not say.
	emblemIcon: "badge",
	searchPlaceholderKey: "iconPicker.searchSimpleIcons",
	// No taxonomy upstream; a brand is found by its name.
	hasCategories: false,
	dataPacks: ["simple-icons"],

	attribution: {
		title: "Simple Icons",
		homepage: "https://simpleicons.org",
		version: SIMPLE_ICONS_VERSION,
		licenses: [
			{
				name: "CC0 1.0 Universal",
				spdx: "CC0-1.0",
				url: "https://creativecommons.org/publicdomain/zero/1.0/",
				holder: "Simple Icons Collaborators",
				scope: "the collection",
			},
			// Not an SPDX id, because it is not one licence: it is the link to
			// the list that says which logo is under which, and that list is
			// the credit those licences ask for.
			{
				name: "Per-logo licences",
				spdx: "various",
				url: PER_LOGO_NOTICES_URL,
				holder: "their respective owners",
				scope: "logos published under a licence of their own",
			},
		],
		modifications:
			"Path data copied unchanged from the published SVGs into a pack " +
			"file; each file's title element is dropped and the fill colour is " +
			"applied at render time. Logos whose own licence forbids commercial " +
			"use or derivatives, is GPL-family, or is specific to the brand are " +
			"left out.",
		// The whole source is brand marks, so unlike Font Awesome's — which
		// covers one style — this notice is never off.
		noticeKey: "iconPack.simpleIconsNotice",
	},

	loadIndex(): Promise<IconIndex> {
		return loadIndex();
	},

	makeIcon(entry: IconEntry): CalloutIcon {
		return { type: "simple-icons", value: entry.name };
	},

	cacheVariant(): string {
		return "";
	},

	buildSvg(icon: CalloutIcon): string | null {
		return buildPackSvg("simple-icons", icon.value, SIMPLE_ICONS_SIZES);
	},
};
