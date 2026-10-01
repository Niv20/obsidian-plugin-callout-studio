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
		bytes: 111758,
		sha256: "6076e8ab9032b5f4cd0236a42ad51a94a2ef47ae9f56577e82f966c15989a46e",
		keys: 1191,
	},
	"bg": {
		bytes: 134368,
		sha256: "aba5f73ade4746d0ad0b0e6c1aea8a9b2a1febd4b761e7cc0b6df9db2271bc22",
		keys: 1191,
	},
	"cs": {
		bytes: 91740,
		sha256: "8231b117a7f2765c5d1a4bf9d6d059846e2997d6b2e22b014c8e59fddeace5df",
		keys: 1191,
	},
	"da": {
		bytes: 88650,
		sha256: "054518fbe88b249a74fd1d4a77265c2a76e1755baef2d31119c7db1be0f82fb0",
		keys: 1191,
	},
	"de": {
		bytes: 96945,
		sha256: "dff5b93413d2424f7cec0416ec5f8df7daaef63c2f1c669bddc5288ccdc0e5e9",
		keys: 1191,
	},
	"el": {
		bytes: 142484,
		sha256: "aa7ff6e2126fba030157de7551bd067807337b08d125a43db72f923df1b80cae",
		keys: 1191,
	},
	"es": {
		bytes: 94195,
		sha256: "67e8ec1d3b43397e829c392a3c0dd31adf323d14e1f11ea17100eb13914cb60e",
		keys: 1191,
	},
	"fa": {
		bytes: 122076,
		sha256: "5b7321b11533316367e198cd9b17c8a85d3bc3bc4ffd1842001430f5fda15122",
		keys: 1191,
	},
	"fi": {
		bytes: 91308,
		sha256: "d7a68371c886d36f53b8bf284a3bd315e16ac9719650fc713143eee7db549df6",
		keys: 1191,
	},
	"fr": {
		bytes: 98355,
		sha256: "ac4133f3a3fc33fbb672a42dde4151ec59fd11455a238fa7d90e7b179cd8674c",
		keys: 1191,
	},
	"he": {
		bytes: 110666,
		sha256: "230d27bc06526a60dc94389b3282ecac3b317e05fdff2d3ce48532379b1c8734",
		keys: 1191,
	},
	"hi": {
		bytes: 155212,
		sha256: "8d55a938194b611e2936a965841d6679901067d73e72c9c3b61a3a6d518dc641",
		keys: 1191,
	},
	"hu": {
		bytes: 97815,
		sha256: "6acc3583de0d7ad1cc45c81d329024e3c6973acb020d2e50bfe1c749d0a8c632",
		keys: 1191,
	},
	"id": {
		bytes: 88785,
		sha256: "dfbc097b7c5c5efbb9a275354dc4b33e7f5c8304f484b4be457bddac33df6468",
		keys: 1191,
	},
	"it": {
		bytes: 94617,
		sha256: "f1866913c5dd5afe047bde351862b90acff5f88fba077ae634025443f9e8556a",
		keys: 1191,
	},
	"ja": {
		bytes: 107407,
		sha256: "ad3ab01f5cca70d4da40d552d1f4ae4568b2d6abb8f798973b0de326e840d29a",
		keys: 1191,
	},
	"ko": {
		bytes: 98169,
		sha256: "aa205c2baaa2d5fb0dfecf00458bd962f61bccd0979ebb4b638dbbede73fa7c6",
		keys: 1191,
	},
	"ms": {
		bytes: 88515,
		sha256: "995ee277be268a448f4436206ebaa636991412ece202c4d90fb3e7436539fbb5",
		keys: 1191,
	},
	"nb": {
		bytes: 89194,
		sha256: "8ac6f949c0e1fe051689174d3880605011d0b8201920226ee2f067512ebfbb56",
		keys: 1191,
	},
	"nl": {
		bytes: 92225,
		sha256: "8fc3aba70fe814e02d42335d1642fb0a91329a1c14c75ab26d44f2b4a634ab3f",
		keys: 1191,
	},
	"pl": {
		bytes: 92809,
		sha256: "419676da611fcc54999bc12587d3d3a621554af9bf02762e6dc23adae9e7fa0c",
		keys: 1191,
	},
	"pt": {
		bytes: 93930,
		sha256: "2e710689b183480764ff838454aef8e95bda6b4153dc285826d2dfec7495890d",
		keys: 1191,
	},
	"ro": {
		bytes: 95656,
		sha256: "456dd8e6c053619c41956a29998cb3a80fa84bc7eb62835808b2e3c5289f92be",
		keys: 1191,
	},
	"ru": {
		bytes: 131668,
		sha256: "8738b8124a3a13ccf5356370fc81ee8d338960dfd977749d82236da412eb08a7",
		keys: 1191,
	},
	"sv": {
		bytes: 90389,
		sha256: "cfb366b01434aa2a6685794a4672f25218654ef3ce27b37ef8ebbb9577d41263",
		keys: 1191,
	},
	"th": {
		bytes: 156489,
		sha256: "ac3bdb07b545b2345131e3e0c2121d2d872d2557af5e884498e7bae04ae9b57e",
		keys: 1191,
	},
	"tr": {
		bytes: 91809,
		sha256: "ab22d996bd362dbbe5696a662744eb3998c8c6837d0f875f1993420d4fdab137",
		keys: 1191,
	},
	"uk": {
		bytes: 129550,
		sha256: "c4ad0ca4d58d0672937d43df5a9c7f1a59f4a8527b9f6c76d6c33a283ff406bb",
		keys: 1191,
	},
	"vi": {
		bytes: 103253,
		sha256: "5b5313e21d3181fa6e8c06568ba07b2ff9c905e63f4cec58f7c6aa3a55989092",
		keys: 1191,
	},
	"zh": {
		bytes: 83118,
		sha256: "7e2864a6f72ca44c642398a59651e42a180d24b9dacc0d820a5c339799182ee7",
		keys: 1191,
	},
	"zhTW": {
		bytes: 83429,
		sha256: "8b952f5df14d3f4ebcce47f47e46c45618054c2f181a838a4b77b89980a3b663",
		keys: 1191,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
