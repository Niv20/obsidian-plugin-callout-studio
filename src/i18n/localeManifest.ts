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
		bytes: 69129,
		sha256: "d62cb50de8d029d1a8e00d06da50cb93102a011205756baad802122edbf969f8",
		keys: 771,
	},
	"bg": {
		bytes: 81140,
		sha256: "01c12e5aec6f8e2dbd0c13a54c7868c17e6122292fe6d442299f56f15e724a6a",
		keys: 771,
	},
	"cs": {
		bytes: 56858,
		sha256: "83d4ef5c98b0166d4bf8a599ee171b8f7e983845ecefed276cbe5f692d06be10",
		keys: 771,
	},
	"da": {
		bytes: 54576,
		sha256: "e32dae302b3dd0c95ee4636efa42a6b7c7236a890d34f9be22d035d2e1bc7f92",
		keys: 771,
	},
	"de": {
		bytes: 59828,
		sha256: "5e7b1fd0c0a69ed314a652a56142572f7d24a9d84857082dadc88af79db2d903",
		keys: 771,
	},
	"el": {
		bytes: 85360,
		sha256: "01a58ee0d5277afe5b11ef09be6df81e009d59f6e7db1b6c9f0f98e554b6cbd7",
		keys: 771,
	},
	"es": {
		bytes: 58094,
		sha256: "e873face8e51ac920cadd50cfda72aaef5758d5899c9f72fad89a6b33118cd6b",
		keys: 771,
	},
	"fa": {
		bytes: 74720,
		sha256: "a8f34d04dbd53c7a4de6335b5b89ded71e64b148e3754f2ccf1f723bd4ca6fbe",
		keys: 771,
	},
	"fi": {
		bytes: 56692,
		sha256: "1e1d9f727055f5819f0acb4c73c42943091a50567a5e0e0e4b0178fb4cb1f6f0",
		keys: 771,
	},
	"fr": {
		bytes: 60456,
		sha256: "4cc7aa199d5b67b24a393100a7d8578c9cb714bff8f288a4cadff1a80bcaebec",
		keys: 771,
	},
	"he": {
		bytes: 69501,
		sha256: "763517dd51632db117a218d4d22f17f43ef99224f2a1f0d45fbfe3055c95c0fa",
		keys: 771,
	},
	"hi": {
		bytes: 93486,
		sha256: "acaddffd2ef907227d61cdfcd5db333e7063e2568c0164bf5ed5dd449d38fb08",
		keys: 771,
	},
	"hu": {
		bytes: 60231,
		sha256: "509030cd194065787f5d61dad93491eee5e9ed19bc9b94ed1237928bc65f596e",
		keys: 771,
	},
	"id": {
		bytes: 55125,
		sha256: "dc260f7141927a4a602206210f030c07f73aab31cc980ccf04633f1776576aad",
		keys: 771,
	},
	"it": {
		bytes: 57847,
		sha256: "7499f1ee4a422e24abf131696f6f5ef38040e32f27e187830d9f17d8ea0e7873",
		keys: 771,
	},
	"ja": {
		bytes: 66885,
		sha256: "ab0694800a15e4efb2f4c6e1f2277d03319f4bdaf3d31ff2ff64e0cf799e7de6",
		keys: 771,
	},
	"ko": {
		bytes: 61509,
		sha256: "893f757f29b3bbfd4d310324abeec5df434bc5cf6f81fa39b69ff8194a091380",
		keys: 771,
	},
	"ms": {
		bytes: 54983,
		sha256: "9942f1d0a8f7b1d19633fd27832d12830caa38ee34c76e28bac58c2d39fb0a6f",
		keys: 771,
	},
	"nb": {
		bytes: 54741,
		sha256: "589fe0be1c1a8ac4d9a7a3dadec9c482fdb07057bd27326c0817da9a6d3ae07b",
		keys: 771,
	},
	"nl": {
		bytes: 57110,
		sha256: "e6fb5f552b47c89991a48c6e01adf86d541c208fac9f2445f20aacd0a391a069",
		keys: 771,
	},
	"pl": {
		bytes: 57187,
		sha256: "67ccf33e7206f9774c44e5ab70b45665587896a73c878a3f3debd45efb30dfe8",
		keys: 771,
	},
	"pt": {
		bytes: 58076,
		sha256: "299217937bb665563a0a23abd7b107a893d56ed4804a8c30395194ba1a7234b1",
		keys: 771,
	},
	"ro": {
		bytes: 58590,
		sha256: "3be5df35c069cdb11f83b1df63833ba88e340863ea217780a8e983cf5a5ddbc9",
		keys: 771,
	},
	"ru": {
		bytes: 79847,
		sha256: "b55d2d749ebc368ddc795e1339e00ca7c56911f5273e6406497bbca8d23f1c11",
		keys: 771,
	},
	"sv": {
		bytes: 55657,
		sha256: "46d400eff3c315187e64382a7f627cade59dda5740da61a82276f411b25669bb",
		keys: 771,
	},
	"th": {
		bytes: 92663,
		sha256: "23a46bb860bdc6a50f17621d59950263bf7b7fec5f28b7d257879894951f998d",
		keys: 771,
	},
	"tr": {
		bytes: 56985,
		sha256: "f09fcf65b68cab7b1e75f67ddacbee9f0b2dd4085a0090c579f4214430c127d9",
		keys: 771,
	},
	"uk": {
		bytes: 78224,
		sha256: "a0198b6346b55b39bb4023ad54fcdebb215b480ee45f30bfe728f4089470819e",
		keys: 771,
	},
	"vi": {
		bytes: 63048,
		sha256: "a5550b1b89f73d558a2955e6030013e8e314a6155968c11c5cdf3c9e11941b4b",
		keys: 771,
	},
	"zh": {
		bytes: 52128,
		sha256: "100afff156d3dd5ee5570129a4c080806c17910271a5cdb47807d4d63d63a1aa",
		keys: 771,
	},
	"zhTW": {
		bytes: 52248,
		sha256: "a55806a2d6e6b30a41c9119cb5a18160b992bde5388cba1c4a6d405af72db4e3",
		keys: 771,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
