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
		bytes: 110152,
		sha256: "943b1ddf452b4ef2ceaab3bdcac957d388b18f3392cc34165f0b3621966357ed",
		keys: 1176,
	},
	"bg": {
		bytes: 132454,
		sha256: "aa2caa24d6b725294abcc40c95d66cd4aa7ac5234bb6783a214e8130cdc1628d",
		keys: 1176,
	},
	"cs": {
		bytes: 90528,
		sha256: "58d51f18bb7623ecc200f04a4f6feb150b3f38c2efcf9d1ff33f5e544262fddb",
		keys: 1176,
	},
	"da": {
		bytes: 87300,
		sha256: "82b61982a03dfb25493447ca61ef1d682847cd5076287a4a3ff580f6919edc4c",
		keys: 1176,
	},
	"de": {
		bytes: 95596,
		sha256: "51944dc03d3b07c7064d7beefdd05ef8070a3a5355506a1ac9499c77e4bd793b",
		keys: 1176,
	},
	"el": {
		bytes: 140369,
		sha256: "38c0812b4e28a6dbb0ef8fa27e9271b2160da540fcff774517a0e1fa33c40b25",
		keys: 1176,
	},
	"es": {
		bytes: 92812,
		sha256: "a7b4a86bead13423ef8c5102837cae9ee8ab9de4e9788ff8082c04f094acde6b",
		keys: 1176,
	},
	"fa": {
		bytes: 120372,
		sha256: "5daeee51ad97a8e2d5ecd9e1ce53e730f889c4759bbefd48483391e22ee09c92",
		keys: 1176,
	},
	"fi": {
		bytes: 90032,
		sha256: "b7ef6d559d9bb3f31a046529bb63f1dbaeb468e062999d2d1847fea8949f18a6",
		keys: 1176,
	},
	"fr": {
		bytes: 96844,
		sha256: "57e3eda23adc1a1cca2091d91a2e51a4692ac1bec272fb7ca7b8840f1324a01c",
		keys: 1176,
	},
	"he": {
		bytes: 109260,
		sha256: "c7da1b6a1ad73c6b1a097e7e6168faf5cdb9d434d1ab83fa74ce885b951d75ec",
		keys: 1176,
	},
	"hi": {
		bytes: 152823,
		sha256: "6d17107a92fe63cbb6445c7e4228400d6e530f776917322bfe8ccf646117f306",
		keys: 1176,
	},
	"hu": {
		bytes: 96510,
		sha256: "a2ca4c364fdc93a3e0d16d867d233549110f38f14c17f64d612ee2791b52943f",
		keys: 1176,
	},
	"id": {
		bytes: 87582,
		sha256: "92a4dfaab054742c6148998e6e290b4cbebb82542023db3af0b52ab2a94aea88",
		keys: 1176,
	},
	"it": {
		bytes: 93344,
		sha256: "12f841e7b89efceb256f29762789fc0261c5f7e07b7f6d57bf3e27efe1c48851",
		keys: 1176,
	},
	"ja": {
		bytes: 105992,
		sha256: "90dba18a12eda2f24a2f1069198e2674bdd948ee07c3b9921ea91341d2f3e8bd",
		keys: 1176,
	},
	"ko": {
		bytes: 96855,
		sha256: "1b516c62f7b4ce0dbf00607aad36e71d840a4b528a40b997e4cf191c85d84eeb",
		keys: 1176,
	},
	"ms": {
		bytes: 87252,
		sha256: "95b3f2dc19265241f0d802e06bbd86dd787a7ef77d3097926c14283e824e3c0d",
		keys: 1176,
	},
	"nb": {
		bytes: 87771,
		sha256: "95d34c72a2850ef95d5ab4294bfff1832e75f6db63bdcf5a9218b424f1ca9381",
		keys: 1176,
	},
	"nl": {
		bytes: 90895,
		sha256: "1ab3f543fbadf3f7a7057cc3526499acb31328b3abfcc087a3f80ce25806c80e",
		keys: 1176,
	},
	"pl": {
		bytes: 91501,
		sha256: "27a717648c50970fac2f5ef9a269149fc87f063752e334258bbbeb51a3b05fad",
		keys: 1176,
	},
	"pt": {
		bytes: 92628,
		sha256: "11751bf40b3c63ef18846addd43b66de4bdcd3b7cedc5370965705bed4eaad56",
		keys: 1176,
	},
	"ro": {
		bytes: 94199,
		sha256: "262935d453e3177d17cefa5097212931b2b67d6f5e76055035aa4062fe60557b",
		keys: 1176,
	},
	"ru": {
		bytes: 129652,
		sha256: "7e3c3e131acf30baae6d3f5105fd049b00c4aeae240f6552a53cf381b617186c",
		keys: 1176,
	},
	"sv": {
		bytes: 88991,
		sha256: "285695fdef65032ceedad4cdb1e88e34df1557bf7031a957c5675a39b8059f6b",
		keys: 1176,
	},
	"th": {
		bytes: 153982,
		sha256: "11570d4262cfa52385503cd6fddd05933691ed70bc5112c1f1da9450f65e24c7",
		keys: 1176,
	},
	"tr": {
		bytes: 90524,
		sha256: "a127bd9bcd4e316602d2f9ba3d28534490e5eabc14d22690b3dbd55bfc4ff07d",
		keys: 1176,
	},
	"uk": {
		bytes: 127623,
		sha256: "9d71376e75a893a4da5ef2feaddc20f32ff50cdbcfa0c9839e5889d21cd80d76",
		keys: 1176,
	},
	"vi": {
		bytes: 101827,
		sha256: "9fce2ffd876e6a0f6d57a5fc62bc65175ad24646fed61b46b28f664cde17c254",
		keys: 1176,
	},
	"zh": {
		bytes: 81985,
		sha256: "6f06331c3e87f073fbc9f6941f62181f5319b4b75aeef8faa044b18ecc1c03dd",
		keys: 1176,
	},
	"zhTW": {
		bytes: 82280,
		sha256: "73162e73a1fd21c1fd4b4ab3afd1dba6ada9544e92c5940a02b318889c359821",
		keys: 1176,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
