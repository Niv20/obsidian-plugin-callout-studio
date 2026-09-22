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
		bytes: 68726,
		sha256: "1f0baad58cfd002ff0d80b52d4864d251612275b8822cd2a524e4190d7da25c1",
		keys: 769,
	},
	"bg": {
		bytes: 80666,
		sha256: "41f3d30c33e7fc9c34cf1af2bcdeb9085ac1a2486dcb51a7b741eb7f83a12c58",
		keys: 769,
	},
	"cs": {
		bytes: 56552,
		sha256: "f238fb3ff6d83f0a2841ae40ee42d23807c8f0b313b56e99aeb01c7d0adc7f68",
		keys: 769,
	},
	"da": {
		bytes: 54296,
		sha256: "01d43681821c2b82e222e7aa4b519b11c89575ded4a04e133ea7697af052db58",
		keys: 769,
	},
	"de": {
		bytes: 59499,
		sha256: "4b96d8076583e2db0b01c2659c918eddc5119a30a10d59f0936f89aa3875f848",
		keys: 769,
	},
	"el": {
		bytes: 84883,
		sha256: "b12fa3a92bf5a75e8748b90f84e8995bf363a2c9083e1c0c27420db59a3ae4d7",
		keys: 769,
	},
	"es": {
		bytes: 57784,
		sha256: "319413d655ea88f645237477edccf4d8a0cf86fc772d59929568b717531a0b78",
		keys: 769,
	},
	"fa": {
		bytes: 74208,
		sha256: "84ed59817e548dee51f890ee0b8bcf4193c9e456b9a2779c65e3110ae1b55c98",
		keys: 769,
	},
	"fi": {
		bytes: 56368,
		sha256: "635e751d229496866bd74a63d0c0b68be3482f65c38707bed6da7dce0b6a3417",
		keys: 769,
	},
	"fr": {
		bytes: 60123,
		sha256: "a02456e1ed4b06601b5cec5c639fdee3bac470ab58c044d00b999b10aaa084bf",
		keys: 769,
	},
	"he": {
		bytes: 69013,
		sha256: "a9b19533d6085013d99db852d2badcb2f88483df6e29fba108edcfb33ebfe3e2",
		keys: 769,
	},
	"hi": {
		bytes: 92850,
		sha256: "5b76bf00a6cc4469295a8bdc01312f68490106bd82be63336f9bff36eaf0ffb1",
		keys: 769,
	},
	"hu": {
		bytes: 59885,
		sha256: "f20c09bee48d6f239ba63188e59989dbc827d9da748fb65f376279723ca231e3",
		keys: 769,
	},
	"id": {
		bytes: 54811,
		sha256: "76e9a1c1080143ba4298bce2c8cd1388b6ebc1fa79033f387a5e456b766630ea",
		keys: 769,
	},
	"it": {
		bytes: 57522,
		sha256: "f45907aa5e86637e4e2f8e697c06553e957ffb808c92a0843c108c8fe2acc5be",
		keys: 769,
	},
	"ja": {
		bytes: 66516,
		sha256: "c6c6ea56a8b8cc9155d2cccf04c2267344051b80a1910ffb6629f429bf946d60",
		keys: 769,
	},
	"ko": {
		bytes: 61168,
		sha256: "91a471df9dc0a28fa486bfdfe813bd1211537e1f227da8c406aead9930f05796",
		keys: 769,
	},
	"ms": {
		bytes: 54659,
		sha256: "e5ac1fdf6af89330bedd8e7dc586dbd7a708080e77218ad9416c02e71e8fcfab",
		keys: 769,
	},
	"nb": {
		bytes: 54441,
		sha256: "005c96258aadcaadcfa609ebc895e0a96d020660ea2c9d59be16a1c9bcd203c4",
		keys: 769,
	},
	"nl": {
		bytes: 56777,
		sha256: "8bfdc5f6b0e768346ce24175dfebbd8e69cc9af83782b451bad27ed2d9bbc808",
		keys: 769,
	},
	"pl": {
		bytes: 56875,
		sha256: "f537e33407ff9acf21cc93323299cd1debd0dc96d963765b38772de3a7427d73",
		keys: 769,
	},
	"pt": {
		bytes: 57733,
		sha256: "28d52cdd2eb03f51eed32c359fa1cf97d7b8b5acbbc6efe4702c95a8f1a52372",
		keys: 769,
	},
	"ro": {
		bytes: 58248,
		sha256: "a5999902b30bfaff871e9a431773ea051f3fb43297e5979bdee18530a3ec284f",
		keys: 769,
	},
	"ru": {
		bytes: 79365,
		sha256: "bf3f2f14bdb0e1e9c666c664cbeb6fabf2abffc4fcb8a2ba53a33d341077dedb",
		keys: 769,
	},
	"sv": {
		bytes: 55356,
		sha256: "9cb4e7a6a354562b5acd3144a9a862577144898a4394bbf63179cbe2b4cbcdec",
		keys: 769,
	},
	"th": {
		bytes: 92096,
		sha256: "7f145a3747ac8a8009bcb9b08ea825c34da790f4629dfecb3cecb54ff44123a3",
		keys: 769,
	},
	"tr": {
		bytes: 56618,
		sha256: "8e063a8623db5cb34a28598f6cce3aa2a1a4e08995d6e2299c77425586a1df74",
		keys: 769,
	},
	"uk": {
		bytes: 77789,
		sha256: "3ae9d30119cd29d0e487356d38620a3b150aad0dd5cd61abe9e0b7e989afda5d",
		keys: 769,
	},
	"vi": {
		bytes: 62653,
		sha256: "4d5a8785299004a28869d11f8f46159e59d63a0d5bc51dbb1d25eee244432fdd",
		keys: 769,
	},
	"zh": {
		bytes: 51817,
		sha256: "f676e75490a4cf2b1e812cd76a7bd2b2124326dbaa2124a48fb8c228d3173562",
		keys: 769,
	},
	"zhTW": {
		bytes: 51924,
		sha256: "88b9478873549196d65a73a6feb935dabf563e4e2ff4e29ed31ec74c32a231fb",
		keys: 769,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
