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
		bytes: 78655,
		sha256: "3fdcd6e140fc0266b8c4452e87399c65e64b1da4a2cdf6d262592b862012161d",
		keys: 861,
	},
	"bg": {
		bytes: 93403,
		sha256: "050ea8f0d47e3ccbbb971ec5695c32ea0908660ad92516ac72e42da78ea9cb1e",
		keys: 861,
	},
	"cs": {
		bytes: 64175,
		sha256: "b5a428448e4c31ef97eba38817b8ada883ab75496fd58e5a8f26be3deae7ed87",
		keys: 861,
	},
	"da": {
		bytes: 61911,
		sha256: "6f1fc79891366216414a5a5d742220e1a27a64d0b82c56f7d30c9c031b5dc2e5",
		keys: 861,
	},
	"de": {
		bytes: 67829,
		sha256: "4855458670f3be4e626a58fb6fdb03bb4044d85de6b61db873f51b48eef04d79",
		keys: 861,
	},
	"el": {
		bytes: 98665,
		sha256: "2e2174573b1771e514ef3c23c1ad38d13b8a31ff149c8cde9b3f0788426dd3fa",
		keys: 861,
	},
	"es": {
		bytes: 65693,
		sha256: "399ef9731553c1cb3530e4d8fde4b46de7c05e87a80fd845db230d607e086ca4",
		keys: 861,
	},
	"fa": {
		bytes: 85346,
		sha256: "58d9c48720e16f166f3a77cb71dba86e3ee3d049d6f2dcb4cf07968ec6144c96",
		keys: 861,
	},
	"fi": {
		bytes: 63994,
		sha256: "4ed3332e2177012e353a40a0788462e9b0ecfce536e404091fc8b00d1624cac0",
		keys: 861,
	},
	"fr": {
		bytes: 68459,
		sha256: "190dd6a2f243e57f837cfb3b4f12f858de82cdb2d0fe18e73492d50739b5cd6c",
		keys: 861,
	},
	"he": {
		bytes: 78303,
		sha256: "f836b18748b58ce5db4efaeb12e5c981f5e3d9e2f427965a93da483f1c24acfc",
		keys: 861,
	},
	"hi": {
		bytes: 108123,
		sha256: "2743750e03a385fcd399a5bdcd11cdc47ad8e50a52a4a382990551073a39af22",
		keys: 861,
	},
	"hu": {
		bytes: 68270,
		sha256: "6fad21ce930b8eaca421750fcf400713446baa68e5fbdf1eaa9ee3384195a940",
		keys: 861,
	},
	"id": {
		bytes: 61993,
		sha256: "be3c8f5a9f7a55f4e71ec1909f6bf974379c7f0c2a33368cb0bfbdfe6562177f",
		keys: 861,
	},
	"it": {
		bytes: 65489,
		sha256: "399f32bd8d35eb42107e40b8d4a0bbf472b9f85c1f73ebe094f9d6550f0cca8a",
		keys: 861,
	},
	"ja": {
		bytes: 75619,
		sha256: "a56b642ed08506320d8ab90adb0d24b359268031cfd665c5e8bd6e62daeca381",
		keys: 861,
	},
	"ko": {
		bytes: 69497,
		sha256: "a9f53e3f4019acec62c20e89c8853babba71270dc22b381fd0b5c92722f50d31",
		keys: 861,
	},
	"ms": {
		bytes: 61829,
		sha256: "1fcbd371a90cf5b180a2560fa698d6e9e19c061750a96bd276acea40f0a840d6",
		keys: 861,
	},
	"nb": {
		bytes: 62072,
		sha256: "bf4333b97743e68b9f585599d29a95f8eb79f3ee34e8d2492c2a42b28396723a",
		keys: 861,
	},
	"nl": {
		bytes: 64386,
		sha256: "5e90b9d371b855742b54423f5a9b823695b4ac187b23abaeb2428f1a134f7ec1",
		keys: 861,
	},
	"pl": {
		bytes: 64835,
		sha256: "83e0cc5906082ce8066d9303df487e827005df66e3bb8494022cab39d44ac84a",
		keys: 861,
	},
	"pt": {
		bytes: 65468,
		sha256: "6207a9948ff83d1cb74bdca543eef884c2a13366f6112fb47ea65aadc0ee4ac5",
		keys: 861,
	},
	"ro": {
		bytes: 66578,
		sha256: "419d184cc768a303a551f706c448ccf594a863a688f8ea1b40de62b64a46c85e",
		keys: 861,
	},
	"ru": {
		bytes: 91565,
		sha256: "d22d58bd4e8b5748a7b04ea9d1b387dd2278ea571555e0c335bbcaae70ba7c4c",
		keys: 861,
	},
	"sv": {
		bytes: 62992,
		sha256: "7fea196ac94283a9894a1ed07ccc53e533ff8fdf1085a62bc252da3a80de90c1",
		keys: 861,
	},
	"th": {
		bytes: 107510,
		sha256: "4dd9ea6066b159ec4cefa738414f1eca9a1bd0524793454dc36e724291d243d8",
		keys: 861,
	},
	"tr": {
		bytes: 64557,
		sha256: "f973b67b72ae61f910869cb5d941b0b274f3ae0d5ecdd36f2a6570155bef128a",
		keys: 861,
	},
	"uk": {
		bytes: 89776,
		sha256: "7bfa2a458c33bebe30809fd3fa24a8f0c211da5e166ae20d5fabd90d78c8ecb1",
		keys: 861,
	},
	"vi": {
		bytes: 71842,
		sha256: "5335064f68eda74119af7bc6ee9947e9b932dd1bcb9236f0a2bf49f0349dc0ab",
		keys: 861,
	},
	"zh": {
		bytes: 58305,
		sha256: "a0cf303ffaa0916414d65e08b782ecc92b775822963d0b09151ebb096cf39512",
		keys: 861,
	},
	"zhTW": {
		bytes: 58540,
		sha256: "68dd97696c1ab05c409cf6060416795be8b51a9e8558cf91b5042ac32c152843",
		keys: 861,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
