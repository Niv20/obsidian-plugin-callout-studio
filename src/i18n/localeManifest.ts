/**
 * i18n/localeManifest.ts — GENERATED FILE, do not edit.
 *
 * What each downloadable locale file should contain, baked into the build by
 * scripts/generate-locales.mjs. Regenerate with `npm run i18n:generate`; the
 * build does it for you, and CI fails if the result differs from what is
 * committed.
 *
 * Knowing the exact bytes and SHA-256 up front is what makes the download safe
 * to justify — a mis-served or tampered response cannot be accepted — and it
 * doubles as the staleness signal: a cached file whose hash no longer matches
 * this table is one an older version of the plugin downloaded.
 */

/** The on-disk locale format this build understands. */
export const LOCALE_FORMAT = 1;

/** A locale file's id, which is its source module name (`zhTW`, not `zh-tw`). */
export type LocaleFileId = keyof typeof LOCALE_MANIFEST;

export interface LocaleManifestEntry {
	/** Exact size of the JSON file, as a cheap gate before hashing. */
	bytes: number;
	/** SHA-256 of the file's bytes, verified before anything is registered. */
	sha256: string;
	/** How many strings it holds. Diagnostics only. */
	keys: number;
}

export const LOCALE_MANIFEST = {
	"ar": {
		bytes: 78400,
		sha256: "9fed0c35e6568f0738711fad5dc0bb7da9187cb9b9b236459b136a1dc9cd4abd",
		keys: 859,
	},
	"bg": {
		bytes: 93105,
		sha256: "f3d1e940c2f80d93956ed40d55a6aa3c6c93fd821cd6038331dfb03a2d20c7b6",
		keys: 859,
	},
	"cs": {
		bytes: 63961,
		sha256: "b3e5d8bbb009540d9e8bcf41a49f794bd10f4804b8c012767193bf43dca1695a",
		keys: 859,
	},
	"da": {
		bytes: 61715,
		sha256: "ce86b4345de5b932a72fa6e85dd5a5aee78e2a82480fa6cf30c545d97a6e5fd7",
		keys: 859,
	},
	"de": {
		bytes: 67619,
		sha256: "edf2e52a849088cbc0e800f610845fe9fe5642977a06f632be7a5dace4600b03",
		keys: 859,
	},
	"el": {
		bytes: 98356,
		sha256: "e9a61449d8c61341effa9f4bfce5d1808a52c2a771c006819d3db5f65f036c7d",
		keys: 859,
	},
	"es": {
		bytes: 65489,
		sha256: "a0da15557fb92c2c80a5d13666900e9a639f74461e9da62815f38c01ad759099",
		keys: 859,
	},
	"fa": {
		bytes: 85046,
		sha256: "83849beddbfadbb4855342d069712625786fcb31fc50108bc8ffd71b93aadd9f",
		keys: 859,
	},
	"fi": {
		bytes: 63804,
		sha256: "5059bc5add5dc8d6870f8f44a50acdeea1aa0cabfb5ad4ecb08936c328b24219",
		keys: 859,
	},
	"fr": {
		bytes: 68243,
		sha256: "8d5f31474de07763f413d5456ad406e7e199edbc01248fb3a4bab1985c70665f",
		keys: 859,
	},
	"he": {
		bytes: 78066,
		sha256: "e2bac72e271db066834dd76466638dd8222899ac1ea9bda2db81a86129362a89",
		keys: 859,
	},
	"hi": {
		bytes: 107733,
		sha256: "a185e82078c4958e46d9c4b0d5491fefa7790b48ad033690e2d586f359462c41",
		keys: 859,
	},
	"hu": {
		bytes: 68072,
		sha256: "e3509eeb87291f080530bc46bf8fd1a23248dbf8a7f53f36719cd4242d5dd6f4",
		keys: 859,
	},
	"id": {
		bytes: 61807,
		sha256: "442ad16ae1a5781372168f9436e55fde04d2bdbef6ea45791ac14717145f3da2",
		keys: 859,
	},
	"it": {
		bytes: 65292,
		sha256: "4979ddc4c09d3e5b2960029699c47ae4b663c3ebc2115653893d78d58f513463",
		keys: 859,
	},
	"ja": {
		bytes: 75358,
		sha256: "c9e296c56a14927fe77d7d3a272d3cd074f78434b2dffa6609c7de8e03a76512",
		keys: 859,
	},
	"ko": {
		bytes: 69267,
		sha256: "f861879bc3fbd77495e729fa36b359360d488d4f10c7d0b19787679a7663da09",
		keys: 859,
	},
	"ms": {
		bytes: 61645,
		sha256: "a0e0ad88c9da205cf97bca2b224273f30bccc6a61a6c1ba6105807e951303c44",
		keys: 859,
	},
	"nb": {
		bytes: 61888,
		sha256: "a9c529731f49fe938be0689b3b1ce0d2cced36cf56580583e2eef68d46081cd4",
		keys: 859,
	},
	"nl": {
		bytes: 64178,
		sha256: "b7241927fc4de0524e9698ffde2d8d02ebb553e03381e36de1d6f6454d2ca5c4",
		keys: 859,
	},
	"pl": {
		bytes: 64646,
		sha256: "c9102d3d71630d8c426cd89b386deb0813fce8ab7832ed641af0e073615b5e1b",
		keys: 859,
	},
	"pt": {
		bytes: 65265,
		sha256: "3fc622eb5e2e8ca3fde630cad2a25730c1d3e697b414c61332f465b679d3bc6c",
		keys: 859,
	},
	"ro": {
		bytes: 66359,
		sha256: "e7e6230b0458e25b8349735412d4a8faccd24c7b17392efb3cb5b9f29e572ffb",
		keys: 859,
	},
	"ru": {
		bytes: 91275,
		sha256: "d7dffefd52e9f54fe3441dd4dca34781759dac94c3556f67ba6cd84bb42a2993",
		keys: 859,
	},
	"sv": {
		bytes: 62823,
		sha256: "fe430f598d591c20c8792fdbfc3082618e59fb9a9c93e8515217c843ead3dbc6",
		keys: 859,
	},
	"th": {
		bytes: 107159,
		sha256: "2915005a7687a3481aa70e48d8329f53ea23225378369ffc33a18fd5d76e995a",
		keys: 859,
	},
	"tr": {
		bytes: 64332,
		sha256: "179e30f26acb4d2f699a80d277824cfa44285ee34e4e19bd0f24a1b025a34e36",
		keys: 859,
	},
	"uk": {
		bytes: 89501,
		sha256: "62a8b6f9b53ed59808ef4943746662019f2df0a1a91f17c164f6355e015eafe0",
		keys: 859,
	},
	"vi": {
		bytes: 71614,
		sha256: "eebfe8af11043bb824e3688678e99f3010b92d35f0f769940fc56d0d50f14f8d",
		keys: 859,
	},
	"zh": {
		bytes: 58122,
		sha256: "0fc4487907ef1f41bf5dbc9f606e99ebb12b9aed1103fd4a073e661cabb2f0d3",
		keys: 859,
	},
	"zhTW": {
		bytes: 58354,
		sha256: "300eb362ef57039531c527107b69dab8d5c7260a5f826a5dc4ba7679f2c319d1",
		keys: 859,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
