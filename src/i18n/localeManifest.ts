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
		bytes: 109611,
		sha256: "117d1fa033640a85eb142d47b61856feffc737db7c1f87810b21d0028e071a13",
		keys: 1186,
	},
	"bg": {
		bytes: 131250,
		sha256: "de5fc2cb4896e5c1b8918f6a15fb45465c9320d16146f8fa3e88af22dc8fee53",
		keys: 1186,
	},
	"cs": {
		bytes: 89898,
		sha256: "e42c557d15fc945cfa09dbe0b7fbbfe8e755fb784a5ab803f16aca8d6f2cd6c9",
		keys: 1186,
	},
	"da": {
		bytes: 87107,
		sha256: "941c74b2cbdb60a74f5aa7d44dc27babb8a95c70fdc3d382e12ebad1ba8328b0",
		keys: 1186,
	},
	"de": {
		bytes: 95189,
		sha256: "b8e0ad8b029b19acbc5a392ce32a417af3927ad850f8635b42338c4bd44d4bcc",
		keys: 1186,
	},
	"el": {
		bytes: 138973,
		sha256: "0d4517282e2f1d557fb4cd0c618946c73d31cb4b7c8c4ea471efb0afe73960cc",
		keys: 1186,
	},
	"es": {
		bytes: 92267,
		sha256: "667c842fc6794248501a99f44cfa9cfe4322ad526cb72f188678fd223752ff1b",
		keys: 1186,
	},
	"fa": {
		bytes: 119743,
		sha256: "4b9e6ab52e6d12a2a4bcd6526b666013b957ec54f00da695e17819194b9480be",
		keys: 1186,
	},
	"fi": {
		bytes: 89528,
		sha256: "027057578c4092c75cf76fcb17fd01ef5e3f028c432d890f90d5f567552887b9",
		keys: 1186,
	},
	"fr": {
		bytes: 96639,
		sha256: "ee16e870ff00399ac58cf238f584fd6f6ccace075efcb1728c769ec8490a5c91",
		keys: 1186,
	},
	"he": {
		bytes: 108555,
		sha256: "48c801244263f378116e1498b1c632a435c87116919befafd764c3e909d1e1f0",
		keys: 1186,
	},
	"hi": {
		bytes: 152250,
		sha256: "1b08608e3a5cb300a9b5a9c3fafedc514ab70342c73864285a99b13d85cf4f11",
		keys: 1186,
	},
	"hu": {
		bytes: 95946,
		sha256: "48d663c3e86158449e6e0fe95d2f0084b668c598879703b2d48173d2d09a19b9",
		keys: 1186,
	},
	"id": {
		bytes: 86906,
		sha256: "916bc4df9699ab88fa68b05a9f9a4eb91c3bc3fb67d4f5f40d1440d4982f7fa5",
		keys: 1186,
	},
	"it": {
		bytes: 92713,
		sha256: "90dfb0ae533fdf33abd2256b3c48358296bac37937789aad3e4cdc10b88ab981",
		keys: 1186,
	},
	"ja": {
		bytes: 105429,
		sha256: "f8d0d706e113e2e8c2d028a3229b79d95e443a348590de92017f82edec9d5f44",
		keys: 1186,
	},
	"ko": {
		bytes: 96528,
		sha256: "9b5ccaf5715baba0fa4353204e1bb4d9edf9214df2eb80d455439952719a87c4",
		keys: 1186,
	},
	"ms": {
		bytes: 86925,
		sha256: "afb88888839236fd308ec4b2773f6b3d360311518d0f3bfcf7a86ac838eee39d",
		keys: 1186,
	},
	"nb": {
		bytes: 87630,
		sha256: "93a2a0ec4b116962fb5cb5b335cb5c06686081725d347100a87e77a66c293a56",
		keys: 1186,
	},
	"nl": {
		bytes: 90790,
		sha256: "ba279e2d5c0072956014be70c20a37d965b7f0d20c3b59d2953ef5982c4ebe75",
		keys: 1186,
	},
	"pl": {
		bytes: 90896,
		sha256: "5470fe8beb3e120dfcd98b6cb595babe2f69e8986f778505c3181f85c1f676c4",
		keys: 1186,
	},
	"pt": {
		bytes: 92186,
		sha256: "844b63e2582b4847c7b0c76981adc51be622ea5cb3f93985aca00553db0cb59c",
		keys: 1186,
	},
	"ro": {
		bytes: 93861,
		sha256: "9548f29cdacf5900b61235bdd5ab0a5115b93f732542c9190219d5167dd88708",
		keys: 1186,
	},
	"ru": {
		bytes: 128428,
		sha256: "ae4e20d39afc44a0b551a8ae00d2bdb2e238ce3e33c3ea343defd360f247fee8",
		keys: 1186,
	},
	"sv": {
		bytes: 88712,
		sha256: "920aa3945b922e7f9b7e2c00b4eff2952a40c0a6968fd04a22f998ef80ea0460",
		keys: 1186,
	},
	"th": {
		bytes: 152376,
		sha256: "151ae75acb6666269c3a5eebdf2c0a690e3d3818c2326234aaf0700aea9c2256",
		keys: 1186,
	},
	"tr": {
		bytes: 90312,
		sha256: "98da2f8d3c4e17e148f21cbd727c676681b7bab08346ea4ec29d3898f6beaed7",
		keys: 1186,
	},
	"uk": {
		bytes: 126470,
		sha256: "6972cadafd2085e5fc0a66bff864a3a6850ee35589b89406ea9acb99855162ee",
		keys: 1186,
	},
	"vi": {
		bytes: 101048,
		sha256: "bf60a050cb436c932016be3ddaf4a92271db36a66b33c4a2bed3a80174bc7459",
		keys: 1186,
	},
	"zh": {
		bytes: 81582,
		sha256: "e9bd8c48f0c3c5c51be9d4cded26fa11e671604f6c86f1e8821d3d9fd835e379",
		keys: 1186,
	},
	"zhTW": {
		bytes: 81864,
		sha256: "529963dc050f0d3d761e9f29ee91b7ee21ae429ea806cad49c7199036838da22",
		keys: 1186,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
