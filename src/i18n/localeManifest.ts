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
		bytes: 112456,
		sha256: "2e8cc62cbb6e18b0a25c42be78198f0a16810bf3ad8bc2a440f802a9411bc657",
		keys: 1197,
	},
	"bg": {
		bytes: 135141,
		sha256: "ae18f0bb095759d0cc2c291a1fac13bc629bb2e0ce358a7e4ec5e8d58db7312c",
		keys: 1197,
	},
	"cs": {
		bytes: 92326,
		sha256: "19f9efaa14d8b35092cced3425f73e14cded884a6bc46095472c1924199a4c16",
		keys: 1197,
	},
	"da": {
		bytes: 89099,
		sha256: "267577d0838107302f2b54281567f6e27cc52b05ec6a08dcd67ca000043522e7",
		keys: 1197,
	},
	"de": {
		bytes: 97481,
		sha256: "f7a91295cf596c3d4ab15a8ad8600241a414010f051a024fa90237e6fdad69e0",
		keys: 1197,
	},
	"el": {
		bytes: 143162,
		sha256: "0bccb3aeeefd16310cbdc5c6e5698d0a6aa969b3302fcf6c5af2f34553f5a300",
		keys: 1197,
	},
	"es": {
		bytes: 94719,
		sha256: "cc7736eae2d962148d4407a01a018024059dd809b6be3d79d1854dec20e0ff9c",
		keys: 1197,
	},
	"fa": {
		bytes: 122747,
		sha256: "0514bdbbf000725fdaa1a20b5d58724ecb37b0bffd30f1ef63139637619fe770",
		keys: 1197,
	},
	"fi": {
		bytes: 91839,
		sha256: "5796b147bcf4bbb59d1f6b38cc51ccf67a619d7c0eaedb7cc3b38f6e44f43a5c",
		keys: 1197,
	},
	"fr": {
		bytes: 98802,
		sha256: "b1a60c0b0a2c96813b104b64374e9e2001b76b859b9047f72195d97ea4626e1e",
		keys: 1197,
	},
	"he": {
		bytes: 111451,
		sha256: "14fd26e1c3fc62c835024a03044dcff8d10df21bee4023eaddc945883118d7c9",
		keys: 1197,
	},
	"hi": {
		bytes: 155867,
		sha256: "84e2da3641520ad966cf4ce0b71a85aec7fc456797b493672859de2cc4d20a17",
		keys: 1197,
	},
	"hu": {
		bytes: 98362,
		sha256: "1c9e5d49af371d21eca57f65780a7e3a23b63daa354b0179842653ef85fce8f5",
		keys: 1197,
	},
	"id": {
		bytes: 89278,
		sha256: "c29208208941776a1fd8db32f546269b12b544f58275c1ed432dbb8f13d72ac8",
		keys: 1197,
	},
	"it": {
		bytes: 95181,
		sha256: "c475a306805b68a1d23aecf7dd20a8c47e717c2bdedec8569b2c3527d712ef90",
		keys: 1197,
	},
	"ja": {
		bytes: 108080,
		sha256: "ede5d3432ab25812ca9aed5e1a60518a2638943f8d97eb721a0d88b759f1b679",
		keys: 1197,
	},
	"ko": {
		bytes: 98753,
		sha256: "727cd2faf63eecb1eda8c64447dfbc99ad13e6f525007515d829c88f6ac5fb7f",
		keys: 1197,
	},
	"ms": {
		bytes: 89007,
		sha256: "566892f904f36bd0d84acb60e4b9f6d51471923776c5a13db6d38ebed86e1e48",
		keys: 1197,
	},
	"nb": {
		bytes: 89605,
		sha256: "77d650b7c12755faaa17e957d85b3cb76ab21a43fec078d792e78de59ce0c89c",
		keys: 1197,
	},
	"nl": {
		bytes: 92746,
		sha256: "75fb18c6cd717fef86b8f7315734aeee34cd7272bf5a6d286bd8d4050cf351ec",
		keys: 1197,
	},
	"pl": {
		bytes: 93304,
		sha256: "a7f1e720f17a46f0527eefa46668245f538ea58dd50bc00bb9afa008093bd3c2",
		keys: 1197,
	},
	"pt": {
		bytes: 94485,
		sha256: "b72b280b008c3ee886d2c5dfa67b2443addcd77a57c36edc9c5596601eeecbd6",
		keys: 1197,
	},
	"ro": {
		bytes: 96127,
		sha256: "6a62182cf288df7b0705c30cabb798eefedfeb4ea76dc494821a5fc46fab6c75",
		keys: 1197,
	},
	"ru": {
		bytes: 132306,
		sha256: "425aa7fc3ed142b184a99ea251eec05f6bd6ad3d7c411ce36fbe85f2e408fe4f",
		keys: 1197,
	},
	"sv": {
		bytes: 90816,
		sha256: "b82a0f6585e5382befcefac573a396d01383328030de9f9824c4c10313f2c67c",
		keys: 1197,
	},
	"th": {
		bytes: 157179,
		sha256: "0d799bcfd5b51049ce49163b7a39cd2d38bab96f6b5bf1f74065d5c2e8e0c3ee",
		keys: 1197,
	},
	"tr": {
		bytes: 92254,
		sha256: "5a406b08f462650f8a6dfdcbbd5583b4cb4e68cba72e6cdeb6426214b568ecef",
		keys: 1197,
	},
	"uk": {
		bytes: 130204,
		sha256: "63197892c9dacaefc9b06aced8f8fb19c574c7bbf8ccacd2aba6f35e3679d5d3",
		keys: 1197,
	},
	"vi": {
		bytes: 103854,
		sha256: "ab4cd680b08a35e34ec28f23b92b1e129c1dc5ceec43efde62b969a18548d363",
		keys: 1197,
	},
	"zh": {
		bytes: 83587,
		sha256: "b17bc337ca9e5bdb211bb65024116edaf49ec4869c05be75bbd52b16636709fe",
		keys: 1197,
	},
	"zhTW": {
		bytes: 83879,
		sha256: "969a8cea08c743eb980138c4ec6f39b886f4f4ca92c25f40c104176114da3432",
		keys: 1197,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
