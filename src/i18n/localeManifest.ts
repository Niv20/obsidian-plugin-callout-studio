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
		bytes: 118273,
		sha256: "a5ab9542c3035204378a1c6dbb4c4f49e553efe3c80a95018c1ccfa648b5552a",
		keys: 1265,
	},
	"bg": {
		bytes: 141477,
		sha256: "ff0ac6c4b646dec52e9a40102c209fa65388bdc438efdd6237b01b33f3f92662",
		keys: 1265,
	},
	"cs": {
		bytes: 97199,
		sha256: "9e820a6fcab0a3cfad7e106de53895c11df833e888d5f1df52b945f33074f2dd",
		keys: 1265,
	},
	"da": {
		bytes: 93842,
		sha256: "8200d268abf0230ca420ba72b3d92e2af278411fbe4e65533de3cd7937cb576e",
		keys: 1265,
	},
	"de": {
		bytes: 102658,
		sha256: "ac395cb25b66ddcb6fdb1dfd7122220e025b90f581447e9f3724f46209e5b3b4",
		keys: 1265,
	},
	"el": {
		bytes: 149754,
		sha256: "95a0130e4214afb54deb6de66ad1330f726dbee782dcb446f6fd5294ddcde886",
		keys: 1265,
	},
	"es": {
		bytes: 99191,
		sha256: "891de4f954558ff03aa42db47b11f8609fbbd44961647edb67fe2c0c22c2e1f5",
		keys: 1265,
	},
	"fa": {
		bytes: 129733,
		sha256: "a6daf0e3d1ffc8d8f3d2a8df0109bee51dcbbea53ade0dccfd523aa63fb1826f",
		keys: 1265,
	},
	"fi": {
		bytes: 97009,
		sha256: "610a80cd3a802dee13f098e8ef82916fd52f8c8751db1633c835495d4ca0b0df",
		keys: 1265,
	},
	"fr": {
		bytes: 103992,
		sha256: "0a80cdfccb31095d024178640f67dc07152ab0ebb6d92f595808ee7ddda332ba",
		keys: 1265,
	},
	"he": {
		bytes: 117425,
		sha256: "e87a9c8bb9488120964bf65483e973e0ff4204901b428ca0cb298bae58a4bbfc",
		keys: 1265,
	},
	"hi": {
		bytes: 164181,
		sha256: "c317678ffd3c957c0554578cef7335b82752006014a00571036bc47cf7d4a252",
		keys: 1265,
	},
	"hu": {
		bytes: 103619,
		sha256: "b562c02a4e9c4dd3e683b03f48251f19036e0e75c7b5f303c1134a6186ffb298",
		keys: 1265,
	},
	"id": {
		bytes: 93879,
		sha256: "09d2caafc12d46e91535cd055b4d613976c4fd756be161ee495db90726ab5811",
		keys: 1265,
	},
	"it": {
		bytes: 99612,
		sha256: "ae11558d8c9fe1c6dfdf97fbe4e9235e753ee79330002e85e3d45485e27a165d",
		keys: 1265,
	},
	"ja": {
		bytes: 113835,
		sha256: "511b17e42a82200bc912314403f744bcb2e8953969332156713d2dd859e1b15f",
		keys: 1265,
	},
	"ko": {
		bytes: 104563,
		sha256: "0fc0c8a134d572621bf45cf1d1daa89590dc574b7de0a203cecf37daffa91b17",
		keys: 1265,
	},
	"ms": {
		bytes: 94008,
		sha256: "5b4088a912a2bdae910384f328d848969b07591dfc4d4d40ed6a29aa6072e546",
		keys: 1265,
	},
	"nb": {
		bytes: 94491,
		sha256: "3f6f5b5e941ca74746aa322e4cec269aab2d8014a28e25730f700ec5d7c9b0ac",
		keys: 1265,
	},
	"nl": {
		bytes: 97770,
		sha256: "93bb66eaf28c6ce9213cdb05b500c0cfd6a2b15ae6114b729a89e162a31b6459",
		keys: 1265,
	},
	"pl": {
		bytes: 98139,
		sha256: "cf2fb874ac868bedbc68f68c4832a46e028855fe580e05c43345db791e31bf99",
		keys: 1265,
	},
	"pt": {
		bytes: 99167,
		sha256: "15e50ce51c8d89eb351e895d626f75da2a30426d5e7c9ecf5665b7b7989b62f1",
		keys: 1265,
	},
	"ro": {
		bytes: 100986,
		sha256: "bafe8275ad80f7bf6621a18795891a94b1bab3a29a6d84742b7ef1cc9891092d",
		keys: 1265,
	},
	"ru": {
		bytes: 138458,
		sha256: "f65dc12403371337315ff7d78dd9ec98e34c704296a5db71149a9c3810a1474e",
		keys: 1265,
	},
	"sv": {
		bytes: 95768,
		sha256: "3170af620cb5d36845d0fe6c82689cb337de8d58475de42b9cec6d4026e42790",
		keys: 1265,
	},
	"th": {
		bytes: 163684,
		sha256: "0485f723f7e440054abd22b0bd449779d0a9b278660bf23a5bcb5173dd5256ea",
		keys: 1265,
	},
	"tr": {
		bytes: 97632,
		sha256: "3df44191062c4a06f548f22ade04a9b8738aa6625e60497d4a36c6807cf6a73c",
		keys: 1265,
	},
	"uk": {
		bytes: 136141,
		sha256: "c39071024aa3193225d87d6c9289979df85d2d51aa4a8f7d760f1c3515b741c7",
		keys: 1265,
	},
	"vi": {
		bytes: 108715,
		sha256: "ceef89fb0b83f5685ff5c0f372cefbe82f3dc8872cde9bf7e18e5972fce617c6",
		keys: 1265,
	},
	"zh": {
		bytes: 88310,
		sha256: "3a95997bf692e41374ce879c986574a64d23f225e49975f67f481e9a85fbd38a",
		keys: 1265,
	},
	"zhTW": {
		bytes: 88630,
		sha256: "936a48a0d9c01a3f1fc2a4efcab6be53d85437755b8cba83277b06d0786ee2c7",
		keys: 1265,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
