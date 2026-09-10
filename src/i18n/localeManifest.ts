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
		bytes: 67842,
		sha256: "307e4e2c4aaa3169ead5f6057c46d194abfdcd282d0b9ffc18be7f634b7b0048",
		keys: 757,
	},
	"bg": {
		bytes: 79760,
		sha256: "021030bc2187b0324d4c6339f8a011efb48d92201d95427187cd7de2d81e64fb",
		keys: 757,
	},
	"cs": {
		bytes: 56065,
		sha256: "01b7c8459f2e67808f6257bf549c999c52e807df31be933bd84f138456d7f904",
		keys: 757,
	},
	"da": {
		bytes: 53755,
		sha256: "e9ba60afe450c0956547dcaa94e0515604555bbd61c209377aa7662fbcb38854",
		keys: 757,
	},
	"de": {
		bytes: 58894,
		sha256: "bfc4297d8e5884fe3280a89889c6448eebb3597bb8e852e1eba63fb9b090a87d",
		keys: 757,
	},
	"el": {
		bytes: 83695,
		sha256: "5bf0224b699624dcf0c55d01aac1b75200955a854f5f0ada5c4e9fbaed52c152",
		keys: 757,
	},
	"es": {
		bytes: 57255,
		sha256: "341a933dfee04e3c6a710c36f9b5ffc9c573f6bf28b8f17eed0f75b5b156529d",
		keys: 757,
	},
	"fa": {
		bytes: 73688,
		sha256: "c56770e94ae571f65c1360e923f9ac316b6aa35274258ea675d4ba32e758e658",
		keys: 757,
	},
	"fi": {
		bytes: 55836,
		sha256: "8147029521553810bf4ab8208d40e0de812d17f12ac1bfe4a2a8560b84c879d1",
		keys: 757,
	},
	"fr": {
		bytes: 59485,
		sha256: "17c2403f48fb6ebe7a78f33259e1da2699c5e7f0a050eae0387abaa3cdfe2ae8",
		keys: 757,
	},
	"he": {
		bytes: 68617,
		sha256: "e649daa93d9c3e309c0f74fb8a12ba981f9868d536e249450e32b48be21d2c27",
		keys: 757,
	},
	"hi": {
		bytes: 92113,
		sha256: "53c6ca2c2ff94b9281a2951714b035b02a3610dedd2e9632dceab3ff05ca0e15",
		keys: 757,
	},
	"hu": {
		bytes: 59275,
		sha256: "5dfd4aaae143ae7310adf182184756d3bbc8e91fead5aa1eff07b0510f75f2c8",
		keys: 757,
	},
	"id": {
		bytes: 54488,
		sha256: "489f0c778cf880117de14d2214261453660635661daa38c6797ab446052697f2",
		keys: 757,
	},
	"it": {
		bytes: 56965,
		sha256: "5e9cccdc47f53daec36f0c7955ac9b7485f9354132d353e494010c1ed92422a2",
		keys: 757,
	},
	"ja": {
		bytes: 65853,
		sha256: "fbd47cc7442a42371d5a605f3caf8e83f9fef5b6137dabe78980ebdd381f0db0",
		keys: 757,
	},
	"ko": {
		bytes: 60572,
		sha256: "28c4a3d66600c98447dcf49d4463de9740d8d2e37d3db5dd7be3018acda0a21d",
		keys: 757,
	},
	"ms": {
		bytes: 54371,
		sha256: "9af169158bc0837b3041e0ba0ac25197822bc6b64bf145643e90ea022612117d",
		keys: 757,
	},
	"nb": {
		bytes: 53914,
		sha256: "6deb4e530218c45328be1c2316fb1d0073bbc8fda661aef2dd804bfc458cc2ae",
		keys: 757,
	},
	"nl": {
		bytes: 56324,
		sha256: "067802baa4cafeb9a433443cb5c13427ac1fd0ffadd13821add4a0506cb1ae88",
		keys: 757,
	},
	"pl": {
		bytes: 56322,
		sha256: "48d9ad8232e2f9e6eeef35b2fb3209775200f2fa8f6ed8c52fcd7e0014ad8a00",
		keys: 757,
	},
	"pt": {
		bytes: 57177,
		sha256: "83ee0b548affdc2a8a8acfceef790bcb351f69cf6f55c34269a625a037d1b2d3",
		keys: 757,
	},
	"ro": {
		bytes: 57747,
		sha256: "302349d1da2a23d9d8878caf4be64256603eab41689f2c38bfd47cb57f802832",
		keys: 757,
	},
	"ru": {
		bytes: 78479,
		sha256: "c5f0bc08b974bd57690f5d6f5104cfab9ce7f0cb1285cbbd566b2faccdcd4663",
		keys: 757,
	},
	"sv": {
		bytes: 54834,
		sha256: "5cb887d172bb381237bda8a0a77ed6b4a833db5b7ea6cb6e4bccd8a21b580b0f",
		keys: 757,
	},
	"th": {
		bytes: 91052,
		sha256: "65fec74a99129210e36c4f031dd18a167bcc25b24dc34252d13b86c2e0163b1b",
		keys: 757,
	},
	"tr": {
		bytes: 56219,
		sha256: "269a52bcb0e92748b41e27a3a9dc556a028079762d614c24fd63b284d72e30f0",
		keys: 757,
	},
	"uk": {
		bytes: 76793,
		sha256: "2109c0047229a593c11c08bfdf291a46cf5e3eb05984042040f1dd46bb31c2c2",
		keys: 757,
	},
	"vi": {
		bytes: 62100,
		sha256: "e537324d40304c7a668fd7e168fb01639d3e17260b4cd5269f3bf7e65737ac7b",
		keys: 757,
	},
	"zh": {
		bytes: 51534,
		sha256: "302ff2cfa463a96b6bdea6bd9def76a2ae91537d43b962c2c232f5645dcee63e",
		keys: 757,
	},
	"zhTW": {
		bytes: 51674,
		sha256: "75b4674ca0cd001b244f95440c967ae2c3929b010fe77d0b2fca869aead3f0c8",
		keys: 757,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
