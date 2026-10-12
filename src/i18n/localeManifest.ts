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
		bytes: 111654,
		sha256: "59b2f5408b2a860f4bea9fa3d4763b54e875e3e0478f19e7735936c35d71e1ca",
		keys: 1205,
	},
	"bg": {
		bytes: 133527,
		sha256: "b2e73a546ec0f6bfc5bc0ca31b79bc91a2ff5d56470d2cac6465c9321d16f488",
		keys: 1205,
	},
	"cs": {
		bytes: 91507,
		sha256: "2504e4b00962f7e7550a61002b85d7a4b13639d3704f31b7b4ec45b892893a53",
		keys: 1205,
	},
	"da": {
		bytes: 88605,
		sha256: "9561b9c071dd84533fbd8b2b5f2a924873e2c7a31c7f8788784b01149f5c3f33",
		keys: 1205,
	},
	"de": {
		bytes: 96874,
		sha256: "5b323414b14f8e957b3a10323b18d052d3fcdacc611a2208be4cad013213e36d",
		keys: 1205,
	},
	"el": {
		bytes: 141462,
		sha256: "47255b9372ab2b85be613910e8121a9b330736b9a8be6bed4ac9afcee6dbec3d",
		keys: 1205,
	},
	"es": {
		bytes: 93877,
		sha256: "a7fd12f60ff1aa85b95c56b1cd61a24fc2dae90db7e2a48617624f8b3cbf77ae",
		keys: 1205,
	},
	"fa": {
		bytes: 122032,
		sha256: "7cdeb8f0bfa8c5fcb622133d311d25e7fffc8f38d858db67b10bba6466fb98bb",
		keys: 1205,
	},
	"fi": {
		bytes: 91191,
		sha256: "22a8ff133cb8fee7331eec4426b53d5a351512fd8ae0132f5c1a4986a13a94b0",
		keys: 1205,
	},
	"fr": {
		bytes: 98352,
		sha256: "3131478634ea5d850929f4b16632d4540146358794d870e12c6f63d0e51b6ebb",
		keys: 1205,
	},
	"he": {
		bytes: 110523,
		sha256: "341ca339f88d84f88fa4eea39e26243b7e6b13f3f2f4157f1756298c413750d7",
		keys: 1205,
	},
	"hi": {
		bytes: 155102,
		sha256: "77af0a938f786d6fd8f494d0b810f0399227c37139e3e349305cf9657ebca4d1",
		keys: 1205,
	},
	"hu": {
		bytes: 97590,
		sha256: "e38ed8c04ec8495b0c7ef024060b90da5d74605576a99803b22ca4fdd95dca6e",
		keys: 1205,
	},
	"id": {
		bytes: 88448,
		sha256: "474f18c9393aa7f11ef45eaee0e0b9f30aff3dc4a9fedb56002a20d8ec7369e1",
		keys: 1205,
	},
	"it": {
		bytes: 94267,
		sha256: "cde775f379a83dacdd06afc66bef833698f2204ada5c92bc1115b902e890d7ad",
		keys: 1205,
	},
	"ja": {
		bytes: 107434,
		sha256: "70fa1801276cf99b6ca3a864d3e0efc4580b4a22f1b83854db629ecea4518a65",
		keys: 1205,
	},
	"ko": {
		bytes: 98382,
		sha256: "9753714c27f69ca88989ad77da5526da5030fb15345af81364f39ea11cef50cd",
		keys: 1205,
	},
	"ms": {
		bytes: 88530,
		sha256: "b5a92f16d02ecf960fd1b8b9628ed8ec84c1588ec2db92f0cf6d076a1d02fdea",
		keys: 1205,
	},
	"nb": {
		bytes: 89153,
		sha256: "6f377fb880dcbe1d82de01134789ba052d193c9612e94e71475eccce481ea1ad",
		keys: 1205,
	},
	"nl": {
		bytes: 92347,
		sha256: "38bf9122d0ce6943c2b7f0383e39887e4ca49c952cd69da595595dfb6981d541",
		keys: 1205,
	},
	"pl": {
		bytes: 92496,
		sha256: "5215ab42ed63908d4a0c72cfc6766f27253874277364066492dad26e9c0f9807",
		keys: 1205,
	},
	"pt": {
		bytes: 93746,
		sha256: "c342c052f328600275faea7040156db184d3f31b8e1e7b425eaa47a5a1c13743",
		keys: 1205,
	},
	"ro": {
		bytes: 95470,
		sha256: "62059bdd92d208161686f56808315f2b9ffc8e83e7c1ead492d1e64c684490e5",
		keys: 1205,
	},
	"ru": {
		bytes: 130700,
		sha256: "2d9c4c9edd65710c711a5cb6d9846204a9c61d27863b370bc8f16234c32b3c9f",
		keys: 1205,
	},
	"sv": {
		bytes: 90296,
		sha256: "9f60c5a149a2a2cb6109cf0f8ba21a2153aefc6a5f0c167d541e6d658e345cc5",
		keys: 1205,
	},
	"th": {
		bytes: 154961,
		sha256: "002b4930a86fc96f9c07611ee987b036dcfb81fc44a28e45e7a6f0e9b5e86106",
		keys: 1205,
	},
	"tr": {
		bytes: 91952,
		sha256: "3540804e181b04fd4e9d71e5ddbe00672005bec7d74fef243865f139a7d6e12f",
		keys: 1205,
	},
	"uk": {
		bytes: 128610,
		sha256: "5a51e615a49e33bde7d09c5fbf2ed299745217cd5f272f79e4d406ca7db9e64d",
		keys: 1205,
	},
	"vi": {
		bytes: 102855,
		sha256: "82d1acb9328940b85833ee483ff14575d4a439062399ffb02ee8d5ed4619f83f",
		keys: 1205,
	},
	"zh": {
		bytes: 83106,
		sha256: "06cc87617ba286f86f81fea80000f952573e52f33c4801af7f73488e2e3809f9",
		keys: 1205,
	},
	"zhTW": {
		bytes: 83400,
		sha256: "f34b0d94fca786db1356767be12e788695fb555323a2e05712ce111aed988705",
		keys: 1205,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
