/**
 * icons/data/packManifest.ts — What each downloadable pack should contain.
 *
 * Every field here is baked into the plugin build, which is what makes the
 * download safe to justify: the plugin knows the exact byte count and SHA-256
 * of the file it expects, and refuses anything else. A compromised or
 * mis-served CDN response cannot become executable data, and a stale cached
 * file is detected rather than rendered.
 *
 * Regenerate the numbers with `npm run icons:generate`, which prints them.
 */
import type { IconPackId } from "../../types";

/**
 * The on-disk pack format this build understands. Bumping it invalidates every
 * cached pack file, forcing a re-download in the new shape.
 */
export const PACK_FORMAT = 1;

/**
 * Tag the pack files are fetched from — deliberately *not* the plugin version.
 *
 * jsDelivr caches a tagged URL permanently, so pinning to a dedicated tag means
 * an ordinary patch release does not invalidate every user's cached pack.
 * Refreshing pack data is then an explicit act: new tag, bumped `revision`.
 * The tag also does not match the release workflow's version pattern, so
 * pushing it cannot trigger a plugin build.
 */
export const PACKS_TAG = "packs-v3";

const REPO = "Niv20/obsidian-plugin-callout-studio";

/** Primary and fallback URLs for a pack file, in the order they are tried. */
export function packUrls(id: IconPackId): string[] {
	return [
		`https://cdn.jsdelivr.net/gh/${REPO}@${PACKS_TAG}/packs/${id}.json`,
		`https://raw.githubusercontent.com/${REPO}/${PACKS_TAG}/packs/${id}.json`,
	];
}

export interface PackManifestEntry {
	/** Upstream release the data was generated from. */
	version: string;
	iconCount: number;
	/** Exact size of the pack file, for the download prompt and a cheap check. */
	bytes: number;
	/** SHA-256 of the pack file's bytes, verified before anything is stored. */
	sha256: string;
}

export const PACK_MANIFEST: Partial<Record<IconPackId, PackManifestEntry>> = {
	octicons: {
		version: "19.31.0",
		iconCount: 383,
		bytes: 384490,
		sha256: "8d34725983eee3d840da65e802fd29e583fc2845058923b88e8151fa418b852f",
	},
	"fa-solid": {
		version: "7.3.1",
		iconCount: 1422,
		bytes: 813460,
		sha256: "2c2f11e29443c4904baf60eb299dadb1804f5e52ae9b54ae24d4eaf881681f92",
	},
	"fa-regular": {
		version: "7.3.1",
		iconCount: 169,
		bytes: 107068,
		sha256: "e066aa24f5c41926a7da616ec0da8c6e76c087543f1bfe2c747d1b76f5edd2ba",
	},
	"fa-brands": {
		version: "7.3.1",
		iconCount: 572,
		bytes: 572059,
		sha256: "591d8baeba5b82513ce2393b9dc788e337576b7e272006e31a8625345cbe3df6",
	},
	"rpg-awesome": {
		version: "0.2.0",
		iconCount: 495,
		bytes: 639853,
		sha256: "3f6bdf26563410a99d3d20638707ef9f4a530d7b6b87d93883a841e6eb1b9194",
	},
	"tabler-outline": {
		version: "3.46.0",
		iconCount: 5130,
		bytes: 1193174,
		sha256: "aa8aca305403a64c2b7d2f6160461cf6c40a1311c2d7c5148de35b46b0ac908a",
	},
	"tabler-filled": {
		version: "3.46.0",
		iconCount: 1054,
		bytes: 515352,
		sha256: "9fd4edf7ef4eeb5f4734735bdcdd5325b73cc6ec9cecb7fc82c07335e484bca7",
	},
	"simple-icons": {
		version: "16.33.0",
		iconCount: 3376,
		bytes: 4638664,
		sha256: "ad7cf03a6d35f8916aa3d78fcc4a8e730077e9ff4fe0313de49870a81c89c489",
	},
};
