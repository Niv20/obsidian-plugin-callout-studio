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
		bytes: 59376,
		sha256: "f70d31c8ee1982746d4e95e5b15718f01d27f5e6ff3f9a84b650dd25c06465fa",
		keys: 721,
	},
	"bg": {
		bytes: 68555,
		sha256: "2d795e76e8ef532dad3a481a0a7a5aa07055c9d6c63fcd77271f0a4636cca4db",
		keys: 721,
	},
	"cs": {
		bytes: 48876,
		sha256: "cec72fd67ded8db65ac5103d32f064aa4aa578d14866fc8b704f616eaf3ff219",
		keys: 721,
	},
	"da": {
		bytes: 47043,
		sha256: "3fd82e4d3fa8dc2a540231f2ca905a3e11bd747107f0ffd6ca8275ca97248ca5",
		keys: 721,
	},
	"de": {
		bytes: 51073,
		sha256: "befd5de88067ec601bcaeb298cf813401593a52a99d3371fa3ade9a9cdb99e94",
		keys: 721,
	},
	"el": {
		bytes: 71685,
		sha256: "31723b63bc65e17fbbbf5e95b53a392c8f6d6f6da0dd813c97f3bb1615667a6a",
		keys: 721,
	},
	"es": {
		bytes: 49965,
		sha256: "fa6838a37d0c0cf6837612ec0bbb10f5702b5af99fcc6fc76b002819a0227f20",
		keys: 721,
	},
	"fa": {
		bytes: 63839,
		sha256: "08f4c7d04af8f0ef766fa489ec3f547b3fda14950681ea9dea4b6e659e0cdb78",
		keys: 721,
	},
	"fi": {
		bytes: 49030,
		sha256: "30710b0afcffd85897aeb00a806d2acf7cee60280e5385bd7de2e81f4256d4b7",
		keys: 721,
	},
	"fr": {
		bytes: 51760,
		sha256: "a4a1f5bf599cfeb456cece6d660eb4034ff2c3f09a5d322072e82191cbd35839",
		keys: 721,
	},
	"he": {
		bytes: 59997,
		sha256: "ad4287de51fe1c26c18d5d7fccf16b587ccf8b3cdcd53ca3c7194349df5812aa",
		keys: 721,
	},
	"hi": {
		bytes: 79541,
		sha256: "566009ab3ae822b6a6a7c47967e29e5d4b9eb4be91a301ec976572b572e71dcc",
		keys: 721,
	},
	"hu": {
		bytes: 51744,
		sha256: "de39d61923800410ec210e7568572f7f6305bde9101ee468edc35ec0dd845482",
		keys: 721,
	},
	"id": {
		bytes: 47876,
		sha256: "0dc19ba1058ee9d484ad5194d233d650d93d20bbd480dc6f243eeb461eabef19",
		keys: 721,
	},
	"it": {
		bytes: 49546,
		sha256: "1dbc30335a85aeafb03e11f7d49a7302d7ca7902db346f03156f2347e2bc8069",
		keys: 721,
	},
	"ja": {
		bytes: 57310,
		sha256: "55f3705cf8fe51ac336468cf369c40784086b80456a1856a64a1439a6ba326ca",
		keys: 721,
	},
	"ko": {
		bytes: 53111,
		sha256: "a9b1735929f54714014a032e720fd9764fe652357d71d95d6aed754b06d80203",
		keys: 721,
	},
	"ms": {
		bytes: 47832,
		sha256: "9fbeb0d54dc68516a5bdbc864e7308b18285435f38a16a7cdaa236df39496902",
		keys: 721,
	},
	"nb": {
		bytes: 47127,
		sha256: "fbce22e1673fc6bd0b74348d7e55260c187ec02764fe8899485788714449404f",
		keys: 721,
	},
	"nl": {
		bytes: 49179,
		sha256: "4d575c0fa6a443315d76b32e9ac6327fe72a55bae1844b26c2cc387d76f3b2f1",
		keys: 721,
	},
	"pl": {
		bytes: 49013,
		sha256: "341a66ca8fb154a18c7ba6989603157bec327b9eee68ea059535fd6809a02de6",
		keys: 721,
	},
	"pt": {
		bytes: 49717,
		sha256: "1ca5169490306af6074ba1fb3903e58647ef0ac5d64aa4021aef0d0605a543bd",
		keys: 721,
	},
	"ro": {
		bytes: 50389,
		sha256: "c5543284f4a3c8bf743001750e4e58c19222fa967e072cda5287d2e19b15ef97",
		keys: 721,
	},
	"ru": {
		bytes: 67684,
		sha256: "a80d722dfba5c6dbcaaa2ae9bce39176ff2a467d66fa9cba1c7762f5ccf9cd51",
		keys: 721,
	},
	"sv": {
		bytes: 47749,
		sha256: "0ace6d2fd3e7fa88e97840989bfd78272eb932ab12215e1cf592710dc4dcd2de",
		keys: 721,
	},
	"th": {
		bytes: 77382,
		sha256: "b3770b6334e0b2acb2230c44ec90b48435cb6b6b4c0dc7ca8a7d08cd0737f468",
		keys: 721,
	},
	"tr": {
		bytes: 49244,
		sha256: "3d1e2383d19db5999ae9d54eef101567973d23e7ac85bcd87e5969f9674f367e",
		keys: 721,
	},
	"uk": {
		bytes: 66417,
		sha256: "3c28c96cb10132def17fb0ff68dd06eb20540a117f53c4ebd655c3b06de5ad25",
		keys: 721,
	},
	"vi": {
		bytes: 54114,
		sha256: "602d3e1745ca55e6050bb7080b19927cec03286917d70f0865760005f5fb54f1",
		keys: 721,
	},
	"zh": {
		bytes: 45504,
		sha256: "e70227e207f383b93c96fee9efea538a166445fbc716f443ad61c16e4b96c328",
		keys: 721,
	},
	"zhTW": {
		bytes: 45660,
		sha256: "18378ce05fbc5d05db8fb5393b53cfdcc922d16fdd326cf9648f5916244ed364",
		keys: 721,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
