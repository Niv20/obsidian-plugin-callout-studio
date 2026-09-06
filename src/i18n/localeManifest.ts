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
		bytes: 67109,
		sha256: "0f270d02ffdcd3bc8b1c890af9f9594ad89f9f0104b1c4c12169f5e234598372",
		keys: 749,
	},
	"bg": {
		bytes: 78911,
		sha256: "54ab60fdc09590131a8717e6436287eab6de86afdb791bc87f554b7dfbe0f548",
		keys: 749,
	},
	"cs": {
		bytes: 55495,
		sha256: "22227a4edcbee0550ebbf730fb57b9be5963f379bb71e3435b2ee0c8333964af",
		keys: 749,
	},
	"da": {
		bytes: 53247,
		sha256: "c77d9e6dabaf6f677a4652165872bbdc4a71a2fe123bb0c27806b736db68d6c3",
		keys: 749,
	},
	"de": {
		bytes: 58289,
		sha256: "86270df92b9c5dfe0e63d05c1a1343fff45aba2203442fb6d19b06d71dc71805",
		keys: 749,
	},
	"el": {
		bytes: 82755,
		sha256: "1ae2b4fb393682f7cc504bc0e614bcbd076ac8a707d165da60520f5c0302ea6a",
		keys: 749,
	},
	"es": {
		bytes: 56709,
		sha256: "9f4e186980c13536badcd6cdb4812d79065f8ab44b0db9b2ec6057c21e482e33",
		keys: 749,
	},
	"fa": {
		bytes: 72910,
		sha256: "98f23c64962936fd85e891d80660a74e26fd00bbed9964876c5644abee926f24",
		keys: 749,
	},
	"fi": {
		bytes: 55319,
		sha256: "b1ca50ad1daeeb59540a63250e3e83cf5401ce54fe9e649ad143f0aeab52743e",
		keys: 749,
	},
	"fr": {
		bytes: 58870,
		sha256: "3bce9f00307addb87bd9ed0553b2fb42bce18cdce977548dedf89e782a53e50d",
		keys: 749,
	},
	"he": {
		bytes: 67890,
		sha256: "71b0af02f10b7d0083c05f611e161fbec5609f27a765483ddb5ccb794d801041",
		keys: 749,
	},
	"hi": {
		bytes: 91010,
		sha256: "72e9f86baeabdf1f9a1022c909f76aaf4eea04be7a14d7686498d373b09c8179",
		keys: 749,
	},
	"hu": {
		bytes: 58688,
		sha256: "753093b0cbbee15013bc31386b404ccdd9614e6c6b33d2e86051d347276daf60",
		keys: 749,
	},
	"id": {
		bytes: 53947,
		sha256: "612135b745efec3a75848a55b5e01da23f72394d78b18ce6c08e8b2f54c74b34",
		keys: 749,
	},
	"it": {
		bytes: 56397,
		sha256: "5420c18542b5ca31da5d87f7c83a53e8f05ca43d2b4f229c570dba0fc1b96ac2",
		keys: 749,
	},
	"ja": {
		bytes: 65158,
		sha256: "94c49f452455972be8884af3e760acfb6e1d92197b9ccaae3c8ffcbc4ec69374",
		keys: 749,
	},
	"ko": {
		bytes: 59990,
		sha256: "568b09e306c8dba5a3b781b108e7d295f5d76d18c99631babf2b8fdd859fef3d",
		keys: 749,
	},
	"ms": {
		bytes: 53832,
		sha256: "496a9d0341877b76889fb2b9707dc220f663531a85da208433cd534ba70c0b66",
		keys: 749,
	},
	"nb": {
		bytes: 53386,
		sha256: "cc2ed0f22dd739352f9f72d6388c0347a465d0213490c6146a46c9ca9805e677",
		keys: 749,
	},
	"nl": {
		bytes: 55778,
		sha256: "dd5437e7759467784aff32eb265a2d65fd6209e0c9ee1c847e0bfe7ef7026a48",
		keys: 749,
	},
	"pl": {
		bytes: 55773,
		sha256: "6eb61cfc21b72fa5ddf276ada4e75378a6ac05e15e8858e1a5e6fc26cc51a0b4",
		keys: 749,
	},
	"pt": {
		bytes: 56626,
		sha256: "69067e7e7083d56608ad7cdb137dc7b4a8a3d9b2e89288536b65ae9542b1308b",
		keys: 749,
	},
	"ro": {
		bytes: 57167,
		sha256: "da0f4ae447a6b4415a6f88e6f32b947c36c8eb3f83cf98bb195b4e4e920b2c2f",
		keys: 749,
	},
	"ru": {
		bytes: 77580,
		sha256: "f1a7154ebf7010230ed146d74386e6ea77f48f25097b2fa4f44719546cd87bd2",
		keys: 749,
	},
	"sv": {
		bytes: 54295,
		sha256: "385b6091367a266811b2ebf9ae3411d3e2ad92385e156b9ba24df8d6d8bdb247",
		keys: 749,
	},
	"th": {
		bytes: 90080,
		sha256: "de8a576d2f9da17a88582aae4fbaeaa85d410239f269b39697e9dc0eeee8055d",
		keys: 749,
	},
	"tr": {
		bytes: 55664,
		sha256: "0f8a14f4eb57cbafd6c35bf6986955b0e0820d78650b43b63d007989d74a7e13",
		keys: 749,
	},
	"uk": {
		bytes: 75951,
		sha256: "12e89942ef835539108d86ed475fd2d95b8d6bc0a7938dab9c11bc40e8d77fd6",
		keys: 749,
	},
	"vi": {
		bytes: 61481,
		sha256: "8b930a384a7dc4283d2ad44c83645aaba2e9d81ecf41fe2d1dcb9322ecb183f9",
		keys: 749,
	},
	"zh": {
		bytes: 51031,
		sha256: "42e38fd4885c1ccce2dc28f06567b27e493af78e9456e222f6f7b60c535a36ea",
		keys: 749,
	},
	"zhTW": {
		bytes: 51162,
		sha256: "e6eb0e59d83272842c276a1bd4f6c902252456cc2438ee9ca8c78ecfd306a89b",
		keys: 749,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
