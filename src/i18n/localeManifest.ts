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
		bytes: 109545,
		sha256: "b9f2d76ffb145bfcf0144035293319e5ce268b26ed707431e8dee5d1f6767210",
		keys: 1184,
	},
	"bg": {
		bytes: 131168,
		sha256: "353e166318f5ba70f9fd9debbc0e99d96c4a5fe01b9dd22d4867d71e9a787591",
		keys: 1184,
	},
	"cs": {
		bytes: 89828,
		sha256: "76c672120a0b8e5066f66aabc7a42d292e635df446f1e39ae1dc974869ed98bb",
		keys: 1184,
	},
	"da": {
		bytes: 87036,
		sha256: "9cac9b3091732ba131facf0d32db1f478c398ad75f17ba0c723e49e73afa52f8",
		keys: 1184,
	},
	"de": {
		bytes: 95122,
		sha256: "221ae08fb6bb8028322dfbb46a2f4d80ef0462ce7441fb2b69a6a1e0d32bc4a9",
		keys: 1184,
	},
	"el": {
		bytes: 138899,
		sha256: "8d54415b2a4deb4052b28aef5b9f1bdeb446100b766104fc0b112749fe3e4e53",
		keys: 1184,
	},
	"es": {
		bytes: 92205,
		sha256: "7b5b249e5ab038df365df2b8a8193cd8adbce70f6978731769d1c86c6ebde701",
		keys: 1184,
	},
	"fa": {
		bytes: 119675,
		sha256: "a5fdcbc2cedc8bef6a7fa65c0ac4198b23ffe5ea6b3cfadb725f1d15b433d811",
		keys: 1184,
	},
	"fi": {
		bytes: 89455,
		sha256: "989277c8b019ef1a32c14e905f52956784850db2a42b27e44fe24b50108b3df0",
		keys: 1184,
	},
	"fr": {
		bytes: 96572,
		sha256: "8136bd14595b3e9b7a347c9d9ee32cb7561558effd4c27b2f0663b03e01fe492",
		keys: 1184,
	},
	"he": {
		bytes: 108485,
		sha256: "85a3bf7233315f3a30bb1d3f1c7aa948a99a40e662b9dc6366ce177bff6d9654",
		keys: 1184,
	},
	"hi": {
		bytes: 152166,
		sha256: "0332df2d834755d5624862fea4cc564e455b2c1a174fe95a2f0787159367a293",
		keys: 1184,
	},
	"hu": {
		bytes: 95872,
		sha256: "06e138f23cf90a6853ef591bcbc9d0cfee26aa742956c8abe286ab3f6728877b",
		keys: 1184,
	},
	"id": {
		bytes: 86833,
		sha256: "961fcd23c73c66abb9b395a343aad7abca401d622f70f2d8f1b0e027b7d1249f",
		keys: 1184,
	},
	"it": {
		bytes: 92640,
		sha256: "9b950123d651aafe63dffb5734a6febc0ec35691ed78b28595b639f455896c64",
		keys: 1184,
	},
	"ja": {
		bytes: 105360,
		sha256: "0a68f147c7fd5c6853a9246940a5880026a6f4fc75598bfedca6f005c6bba6e9",
		keys: 1184,
	},
	"ko": {
		bytes: 96462,
		sha256: "bf0f16737001254b5dea325b20fa26f0b2f138e3efd5f5f20a8311c590c085e7",
		keys: 1184,
	},
	"ms": {
		bytes: 86853,
		sha256: "fb7db2d214811ef793762eb7e70e3f043adce3c499b29881dae3b81d2ef185f5",
		keys: 1184,
	},
	"nb": {
		bytes: 87560,
		sha256: "b9b679f82d6a976b082bfa75021f2971dcf81bca84ecc41d375423fd869629e9",
		keys: 1184,
	},
	"nl": {
		bytes: 90726,
		sha256: "ab1f15f380516e006032f0acbdb9bcdcb5eb1e46d4f04407d2ec3675df41eef6",
		keys: 1184,
	},
	"pl": {
		bytes: 90824,
		sha256: "6560d19bfcf5f62d0eb8f2feb3398f32c2008c291e58cd6344d5d86ade3b3582",
		keys: 1184,
	},
	"pt": {
		bytes: 92122,
		sha256: "8f9bd42fe6094773eb6da09b1fd19bb35dca25301200a5255eb5dc9781b9e213",
		keys: 1184,
	},
	"ro": {
		bytes: 93790,
		sha256: "89c6c1320fe603eb928acf5cace41b5ebbb05989a7533a846046ba18523196ed",
		keys: 1184,
	},
	"ru": {
		bytes: 128350,
		sha256: "e47ca94792a2dfdfef74fedad980979ee739e4702445e8c63319f48a0b4cb4eb",
		keys: 1184,
	},
	"sv": {
		bytes: 88644,
		sha256: "8b694c9696c4208c2d62e87494f7153e5beb135d56f857d2994cb8016c74b2e0",
		keys: 1184,
	},
	"th": {
		bytes: 152274,
		sha256: "0c46b706991a3ad6e5abef895d674d170b3a6535e5c4c1f057914b3aaeb45f0b",
		keys: 1184,
	},
	"tr": {
		bytes: 90251,
		sha256: "f3f443231f86edff7d6741f2bfbc2b7e19314832fae9d7fdb5654d5ca873a7ba",
		keys: 1184,
	},
	"uk": {
		bytes: 126377,
		sha256: "ef2a9ba9b316d8854a305c3b4ad701af08d3f2ba09372e4e6b2c584da0fb0430",
		keys: 1184,
	},
	"vi": {
		bytes: 100976,
		sha256: "80f1969357a2dea5080d2af7b5bbe27d1c86345fbde3e33cde5a2b788fe6aff5",
		keys: 1184,
	},
	"zh": {
		bytes: 81513,
		sha256: "cddff14f833f124a8d805fc05467561a32aafa25f057bfa610e3aff66d4e3303",
		keys: 1184,
	},
	"zhTW": {
		bytes: 81795,
		sha256: "5ae745d4056160ae8222917137aae50a50fbc33b8ba647b43ddaf590c638405c",
		keys: 1184,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
