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
		bytes: 109480,
		sha256: "09b8f87855344954d6d562fd2d26940c7568083547484ead54b5d6e14c4c3c72",
		keys: 1185,
	},
	"bg": {
		bytes: 131175,
		sha256: "5c7b34d43c4ed3cf5b23bf17fc0b6a7ad79806a2ddc91ae480e4c5cdc56385ca",
		keys: 1185,
	},
	"cs": {
		bytes: 89833,
		sha256: "9f96b43f9e5ad4d15c32b5c77f3712f3d4ac197c90413a25489ae66b317c0edf",
		keys: 1185,
	},
	"da": {
		bytes: 87018,
		sha256: "421170ff6d618bc40fe450d5afc7a38e2a1d02d707403e7a8b87406982c26db0",
		keys: 1185,
	},
	"de": {
		bytes: 95172,
		sha256: "3242543aea261171449b9063fee1e68d11b3779093c9819b8d67886b848cd3d9",
		keys: 1185,
	},
	"el": {
		bytes: 138886,
		sha256: "d388f8e459bea2368b838a4f961d06ff6073e433bedb232e9a01dcb111ff5c9c",
		keys: 1185,
	},
	"es": {
		bytes: 92156,
		sha256: "2a488fc17372753a3e4d71c1ad76716916c5229a3cdce8ea13efb6689cca1529",
		keys: 1185,
	},
	"fa": {
		bytes: 119611,
		sha256: "f03065e1d7887f0170dd18c321bee5cae49424c5ec20d7b94f9bcdbd92d08129",
		keys: 1185,
	},
	"fi": {
		bytes: 89474,
		sha256: "9f323ea6904f94fcd15ae64fe34160126fa370b3396d957085b5aafb857638dc",
		keys: 1185,
	},
	"fr": {
		bytes: 96559,
		sha256: "5a4e4150d3782b6995083edccada3eef147c290feb814fcc0e46da6b909f6d65",
		keys: 1185,
	},
	"he": {
		bytes: 108473,
		sha256: "591afa3ff1a6d6b4011c6712f8379bb5fd0ae5b6f0c8d1cc64acbea30e6d8dcf",
		keys: 1185,
	},
	"hi": {
		bytes: 152048,
		sha256: "452917baa9d1475f27fd425903532c72fbdcfb1edb4baa38069ecf3bc5ea84ee",
		keys: 1185,
	},
	"hu": {
		bytes: 95844,
		sha256: "28fe0b4e3774920eec4880746ecd1b632da8bb13f7612d616c98006b73abbd64",
		keys: 1185,
	},
	"id": {
		bytes: 86881,
		sha256: "3e5f8c2a4851a5df23772ca962e44cbcd198efe8b6332b540f51e173b9343bd5",
		keys: 1185,
	},
	"it": {
		bytes: 92620,
		sha256: "db049f5e966a5f82e649924558c559696632f3a6161a3c7e0135695da118946f",
		keys: 1185,
	},
	"ja": {
		bytes: 105330,
		sha256: "976a00ffda0fcde32ebe065baf91146eac49f9141a1db3c336228dccdc81a607",
		keys: 1185,
	},
	"ko": {
		bytes: 96442,
		sha256: "2838e5c6861a4dcfab9df9b5a6b1a08b91ca2f48dafba7ce8e8df4bbbf9ec916",
		keys: 1185,
	},
	"ms": {
		bytes: 86921,
		sha256: "3c586ebb83abfccf98c1ba6cd8ab3fb68f57b1442c542bc743e87ff4fc87fc8a",
		keys: 1185,
	},
	"nb": {
		bytes: 87517,
		sha256: "7c3b12605df309475d65aefcc6bb6f69fb8020da3618a9af30cc4f4641d21db0",
		keys: 1185,
	},
	"nl": {
		bytes: 90727,
		sha256: "5d5f56803cf08bf4787babac8ff6e48a8adf5d15e7fd19e756b3cbfa969ff2f7",
		keys: 1185,
	},
	"pl": {
		bytes: 90813,
		sha256: "4cfeca76ce99fcde0509d58936ca12cf8a96d855c22adf90aae8d322fd53215c",
		keys: 1185,
	},
	"pt": {
		bytes: 92085,
		sha256: "2028380f13cd6eb96b2e24d98ff48d373719c58d5f61ba8b83e1f4c0d6759c6b",
		keys: 1185,
	},
	"ro": {
		bytes: 93769,
		sha256: "f123c1c9baa306e086c74256da0bbb7dbdf5b3231b283f8566ebb5071628991e",
		keys: 1185,
	},
	"ru": {
		bytes: 128363,
		sha256: "b4ae66d58de48ac6e0d1166cda284915f18ae6b4da476141dc8acc14f718807c",
		keys: 1185,
	},
	"sv": {
		bytes: 88648,
		sha256: "8eb00012e35e13273f7ba8daec889578b1271517618fe98497222fcc4eb375d5",
		keys: 1185,
	},
	"th": {
		bytes: 152069,
		sha256: "3550a8c71438ba976716d122501dcab1db005dd8859b3c8b1715f960bed2e62a",
		keys: 1185,
	},
	"tr": {
		bytes: 90219,
		sha256: "e8fa87fe30f3fe1af7f6c2d4fe464025748ff778503ab5a0f1b4126d6e73eabb",
		keys: 1185,
	},
	"uk": {
		bytes: 126409,
		sha256: "459e03e3cc450dc1b769b5ed137aa176cac7f545f923980282485bff29007b4b",
		keys: 1185,
	},
	"vi": {
		bytes: 100914,
		sha256: "62b05958d32a79fb3c3bb71ec190cd9e49c959ff00cc37285b5423d61095fbd2",
		keys: 1185,
	},
	"zh": {
		bytes: 81502,
		sha256: "3b036a665184257c1eca9309c29eeba63742fa4b0160afe11f97ca6a13fd6dcc",
		keys: 1185,
	},
	"zhTW": {
		bytes: 81792,
		sha256: "04537ca633386f5ee2e20eb45fafbecda8f5f2a908bac47ef16a5275e04be405",
		keys: 1185,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
