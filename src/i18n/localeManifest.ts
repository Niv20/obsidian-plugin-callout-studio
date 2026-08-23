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
		bytes: 55319,
		sha256: "6eed688a8f1b519d52935d97dea73848650857954aaca717c06e0f65f39da976",
		keys: 699,
	},
	"bg": {
		bytes: 63656,
		sha256: "f5059bb5e61af49c123f967e8e428bb482cb06b612998892f50a13b85b09e6d5",
		keys: 699,
	},
	"cs": {
		bytes: 45683,
		sha256: "3d42d2b173958fbc28d3cb5bceae9f0d6d4d60270e7f8153f7244c1387bd1ee1",
		keys: 699,
	},
	"da": {
		bytes: 44081,
		sha256: "4aa3d6a569ba2b133ef992b92c890f07f5336be34983cedab910b498ec55a6a4",
		keys: 699,
	},
	"de": {
		bytes: 47736,
		sha256: "e968ed0a540261fe5317022d9d0ee63ce475bd5c945a4ae4ea28407bd7056c96",
		keys: 699,
	},
	"el": {
		bytes: 66572,
		sha256: "fc8266ca9ef3ca1721787c469b45897d1ce29a30162e7cbe2c44bdbb5c46cd47",
		keys: 699,
	},
	"es": {
		bytes: 46786,
		sha256: "81388265f701b86ca423b2699dceccfced7b6c97b368801a1cc1a3ed39b629c7",
		keys: 699,
	},
	"fa": {
		bytes: 58682,
		sha256: "0fefc4a51a6889f595455d9ebd39db4e2e1add50691c713e141d51543a98ad4e",
		keys: 699,
	},
	"fi": {
		bytes: 45766,
		sha256: "b10ed0bcfef2f5151f5cce6248a93a7ae169fdc0333e7ea16ff87b05a648cd37",
		keys: 699,
	},
	"fr": {
		bytes: 48485,
		sha256: "3aa14f8bfb78eee80162d6f4889a605fd49b6ad25b29783ab41d6af225b206f0",
		keys: 699,
	},
	"he": {
		bytes: 55468,
		sha256: "f9838f66f6f4c48eea941e3e17966ee4756f3b752929987431465e864f90afee",
		keys: 699,
	},
	"hi": {
		bytes: 72929,
		sha256: "10e9d6bdc7c131ea7d827769abecb460de060e3984e38f0e6c524fa815f49e7e",
		keys: 699,
	},
	"hu": {
		bytes: 48269,
		sha256: "fa8312349ca2b609ee7dd2bc6d6d8aa2a27b22877dae3ca370edc593a9606ef6",
		keys: 699,
	},
	"id": {
		bytes: 44645,
		sha256: "ed0190c5d2c007f09cc53f5ece252e5663de599bcc518a081ba7411de7b7e0ba",
		keys: 699,
	},
	"it": {
		bytes: 46376,
		sha256: "9a750b20ab3db6365e70528a121ad350b7cc73cb3ba656a83fdb1f5cb90751e6",
		keys: 699,
	},
	"ja": {
		bytes: 53582,
		sha256: "9203b798bb5e1d738784a107731166d41e5b44a404ca3d2845fcfe207e20b011",
		keys: 699,
	},
	"ko": {
		bytes: 49481,
		sha256: "e2335542088db904c64e15e8bde8f5fb134ee3aa45811b77f6b6f0a50e4ff85b",
		keys: 699,
	},
	"ms": {
		bytes: 44587,
		sha256: "79021ec9ca244f973adf7c4589322b88c3ff6d4fcae40f4a159c3d5eb5bfe019",
		keys: 699,
	},
	"nb": {
		bytes: 44120,
		sha256: "6a0374bddcdd98050888c3bcd754156567e4839f57e92fd353cb8a8beac5cc2d",
		keys: 699,
	},
	"nl": {
		bytes: 46074,
		sha256: "df6680e0f8fde02622c2c699dbcdc9cf7619b5517b6c32b784f55e2c9d6e17d1",
		keys: 699,
	},
	"pl": {
		bytes: 45831,
		sha256: "110a94b4a0d7caed52fe8c817d3fb6c2224a5319dd6831abecad844c8f60369c",
		keys: 699,
	},
	"pt": {
		bytes: 46556,
		sha256: "c8e9df18ea34730f161a9b8c7494cce405feee9f17e7fff9a46e6e2d5efc1426",
		keys: 699,
	},
	"ro": {
		bytes: 47003,
		sha256: "c472f6926fad858f67e1d67dcaf81eb128f6db0940ef49ff5e6ab3833a0f7e81",
		keys: 699,
	},
	"ru": {
		bytes: 62582,
		sha256: "ec8d9b81692748b850d33a09b800efe97c0ea76e7ae34e0d847c37e5bf73feff",
		keys: 699,
	},
	"sv": {
		bytes: 44638,
		sha256: "d3f21f1682f9967623084d24db5403e2df939f6470068e2915a22954bc8fe234",
		keys: 699,
	},
	"th": {
		bytes: 71390,
		sha256: "f1c7d3bf5927df7e0bd64b1835c0d35f0ddc40b14ed729ef54da10e6ca3c579b",
		keys: 699,
	},
	"tr": {
		bytes: 45921,
		sha256: "fd8d4c0209e0a618b9172d1b65d394ffb5ecc602fc80631f0196d9d1adf0e3a3",
		keys: 699,
	},
	"uk": {
		bytes: 61723,
		sha256: "78cd72a40a828d90d463a6459cdec3185afdf28335e4e3b2380e4ddb279d3b63",
		keys: 699,
	},
	"vi": {
		bytes: 50248,
		sha256: "7b6203ab91639c8a4be0e09c5c68f37667fce1011d7934749f3cc64bbede16ac",
		keys: 699,
	},
	"zh": {
		bytes: 42622,
		sha256: "34731f0d737379a7ce9dfbc80d5e1edfccf42edfe8070b240b4edfa22b9c36ba",
		keys: 699,
	},
	"zhTW": {
		bytes: 42628,
		sha256: "54459c5e9b4e1b3de75d37cd3563913db9b7e5aa4f8d75b0a8dd8c6a4f806d6a",
		keys: 699,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
