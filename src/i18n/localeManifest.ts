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
		bytes: 109638,
		sha256: "3cea7f87277a9bac67883e8cc066cd582295a20b1be007b69641eb57c92b7620",
		keys: 1187,
	},
	"bg": {
		bytes: 131375,
		sha256: "a4a3c789d8bf03ca45a2042bc046fc31d88b45b3675beae6473bcb7b0fdcbdc8",
		keys: 1187,
	},
	"cs": {
		bytes: 89961,
		sha256: "4d0b8a98c237f63f18086e45b21b2d2f0cc1bcab9db2cbcbb2264128bb7cddb8",
		keys: 1187,
	},
	"da": {
		bytes: 87155,
		sha256: "411cc25bb63f30464166e24fbecc7d4e8b7c30f50dcdb70062cab5b5ff82595d",
		keys: 1187,
	},
	"de": {
		bytes: 95327,
		sha256: "e9589713b869bf66a49da0088f0b593282314ed9633a1bfcc88cbfe3aeb97691",
		keys: 1187,
	},
	"el": {
		bytes: 139106,
		sha256: "b9ce77ca9bb1b419955313873ea874a7029b7b2ad7bc6ae325220625a8ae06af",
		keys: 1187,
	},
	"es": {
		bytes: 92301,
		sha256: "059930f1ee4f93030838a118f331da73bd5e1dc03d5be5885811b69b01b4d9ca",
		keys: 1187,
	},
	"fa": {
		bytes: 119778,
		sha256: "956d13f5eaed66515983a089b588853ef1b41f5840bb9d0f96c39f0dda083600",
		keys: 1187,
	},
	"fi": {
		bytes: 89615,
		sha256: "09adb322475fef8144e0d39cba35e5613d2e78a4fe7eae374a49f790b9170ec9",
		keys: 1187,
	},
	"fr": {
		bytes: 96713,
		sha256: "19072619867554633929ef446023a7ba15db6a9d8f2e652cdaf075a63e510e5a",
		keys: 1187,
	},
	"he": {
		bytes: 108631,
		sha256: "042f22540299bd021732db2e67ae16c1ace8bf60e27ffcbee5bc45c826ddc6c9",
		keys: 1187,
	},
	"hi": {
		bytes: 152245,
		sha256: "469ccee18bfd52438d8bbf8c959ef29e65673ff4e4a829f12207fc9b846e47e6",
		keys: 1187,
	},
	"hu": {
		bytes: 95984,
		sha256: "a795aa333707d85202584716642c820992f63dc2d7ab12194fb9e7a17027c745",
		keys: 1187,
	},
	"id": {
		bytes: 87009,
		sha256: "c17bf62d758df7caab2cef0e426048d66de12f47336e2df715b2ccb630beec45",
		keys: 1187,
	},
	"it": {
		bytes: 92758,
		sha256: "2c8ad3aa412d7df20ff7a0d262fd303ae9f687d108359bf55e3b4b87c04d74d4",
		keys: 1187,
	},
	"ja": {
		bytes: 105486,
		sha256: "3a5cb83f7875eb7d12c5e0c049d73eb7456d6685910f995bfe0b25013a05d738",
		keys: 1187,
	},
	"ko": {
		bytes: 96573,
		sha256: "d738074550528980e875c3eb3495ad61b41b1e8a4ad92775e7a1e403f50354c4",
		keys: 1187,
	},
	"ms": {
		bytes: 87043,
		sha256: "04635158d0b1f6e77f23cba920105bec172873ff559cedf69129eeef7adf4fe4",
		keys: 1187,
	},
	"nb": {
		bytes: 87658,
		sha256: "bd90213457c29f7876d75fd1fff716080f0c8942278ae936f7bb6e545f5d6fd6",
		keys: 1187,
	},
	"nl": {
		bytes: 90875,
		sha256: "ca55c823421a04f85797b6f0ae5a2cc844ccd216e0eb5319024473e9e7b42e53",
		keys: 1187,
	},
	"pl": {
		bytes: 90957,
		sha256: "5cc98e244aeac3d9c9ed6b7a1f2062db2b18c1b96dc6364b8604cb6d6dea09f1",
		keys: 1187,
	},
	"pt": {
		bytes: 92227,
		sha256: "dde5e3aef31f6eafe13e8b032319526c94a1ea416632633e71d368a72a919609",
		keys: 1187,
	},
	"ro": {
		bytes: 93905,
		sha256: "c2b1344152904fee34a36ef5e0c1d1280d8ecb7d7bbce1843a510569cfe7eb26",
		keys: 1187,
	},
	"ru": {
		bytes: 128551,
		sha256: "bb3b2c9ad7ff3e08e1df6995688bc9af798168767fc2668262663926316b94d0",
		keys: 1187,
	},
	"sv": {
		bytes: 88780,
		sha256: "ce56dba50c48a2765273fca11edf5f6040fcee13b0dc0864e8fc893b8ac24fbc",
		keys: 1187,
	},
	"th": {
		bytes: 152252,
		sha256: "cc3b230d880b03f506f7e429f4847153c99ba111817c577c630cfd7bd43965b2",
		keys: 1187,
	},
	"tr": {
		bytes: 90357,
		sha256: "41a454c05628a7663cd1d403d2f2e713b3aac6190f7ee3d3c06bbfd4f25f029d",
		keys: 1187,
	},
	"uk": {
		bytes: 126609,
		sha256: "38325876ebade3a81987ecf6bad53e8e3aae55ba7fc9ab461b482bab2ba03b81",
		keys: 1187,
	},
	"vi": {
		bytes: 101084,
		sha256: "5d3a30c0019e976cd18a6a9aeee786da45a0406ed1233a98465457e2cffcdfff",
		keys: 1187,
	},
	"zh": {
		bytes: 81619,
		sha256: "92672febbdad510eb23e7d4d497a0f8e5c7d2c534629a3da679d4c3ee119a2a6",
		keys: 1187,
	},
	"zhTW": {
		bytes: 81909,
		sha256: "9a95fca30409f596f2d094d17c23666f34fa01a1bc3cd7094245ed4ed1b92d37",
		keys: 1187,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
