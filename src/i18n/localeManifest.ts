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
		bytes: 60312,
		sha256: "dc78e64f888ef9ee654fb90acccfcf5e359f0ca35bb60d3a17f1ad762159088e",
		keys: 725,
	},
	"bg": {
		bytes: 69709,
		sha256: "38941ff24760e5b557e3324c5dbb6c02428134d7fa5e47eb8da936f6fe1081f0",
		keys: 725,
	},
	"cs": {
		bytes: 49620,
		sha256: "f9867776105f310c239f3a43805d597868eb2ed81b5dc7fd83debee4a0b3b217",
		keys: 725,
	},
	"da": {
		bytes: 47744,
		sha256: "30bdff0b93ed3a5a98109b57f5a9fd44973ba930a2292765146370008cef970a",
		keys: 725,
	},
	"de": {
		bytes: 51844,
		sha256: "d58a658aed6d6764f338ecc35e903350ff01b5fbb761649be8b25ebfb84b19a2",
		keys: 725,
	},
	"el": {
		bytes: 72995,
		sha256: "7f0dbf3e5df33cf7440d97bb5ee87788579da0c7f86085b3d4d9cb157a5f46d1",
		keys: 725,
	},
	"es": {
		bytes: 50712,
		sha256: "35d9d017830f571d8ee67449d2f566ac222a1fb67880fae2e10f844c2b179df2",
		keys: 725,
	},
	"fa": {
		bytes: 64929,
		sha256: "59fea209c17a294d9b9de14b4de62468e48f5570d86bfff662554785c57e7035",
		keys: 725,
	},
	"fi": {
		bytes: 49766,
		sha256: "a0463ec34a904f0c852ba422097952959bc5685eafe65eaada774de6640bc249",
		keys: 725,
	},
	"fr": {
		bytes: 52533,
		sha256: "78215362d71fd7c28e0f1a281ff3d532b6bd0e509af329400ff3ebc4fc320f34",
		keys: 725,
	},
	"he": {
		bytes: 60875,
		sha256: "3123980d39e40aa5f0e61c155573b49ea17ef7eff64af232b126f6e531dddecb",
		keys: 725,
	},
	"hi": {
		bytes: 80949,
		sha256: "b4c865fefd7df853f48f4c1ee041199f4c2485e9b401ab28e4482fa29edb5b61",
		keys: 725,
	},
	"hu": {
		bytes: 52548,
		sha256: "5c0941f58b3b5fbb6e247d121700fc6b252bc3bb4e113d411854fcfad4760a64",
		keys: 725,
	},
	"id": {
		bytes: 48578,
		sha256: "a104536bcd48a96730788e9034ee9962e18a3ef687daff7f1089d863862ec324",
		keys: 725,
	},
	"it": {
		bytes: 50326,
		sha256: "bdd25ba6da9d8e18a7f2621e7b17bbf28a5ef534e145208fb54048c851bfb53c",
		keys: 725,
	},
	"ja": {
		bytes: 58327,
		sha256: "97517ca2e19c42095005937f8309724ee635de45a530a5541522db15080ffcf0",
		keys: 725,
	},
	"ko": {
		bytes: 53974,
		sha256: "bfbeb581b30e311feb1fd6eaa6bec94037ef0c6da9460361bc61907a83f41172",
		keys: 725,
	},
	"ms": {
		bytes: 48534,
		sha256: "185bc37d198c4369b6b69ea2d0ac1f2eafef660dcd431e47a702cdd2e2983511",
		keys: 725,
	},
	"nb": {
		bytes: 47827,
		sha256: "60e4b848097720ebab21348d155e627f3cfa05f205658b88b78f087b27356bba",
		keys: 725,
	},
	"nl": {
		bytes: 49924,
		sha256: "7cacf15b9d363312437d539c8c907ac297e53b24f9fbcfbad32606f529a65f93",
		keys: 725,
	},
	"pl": {
		bytes: 49787,
		sha256: "26f3127896b29fe26cf1ad2b5beb94adb7bb1bc78ec30fc3e4d3359e63c7a053",
		keys: 725,
	},
	"pt": {
		bytes: 50507,
		sha256: "8b6405a488d700e60e2dbec67aecd6f60e4488ec400037f9c973ca9b50f0d3df",
		keys: 725,
	},
	"ro": {
		bytes: 51177,
		sha256: "bbe5a13f80aa2d93be7186e86eb0faeb592ffba5e897b30b982613c54c380f3b",
		keys: 725,
	},
	"ru": {
		bytes: 68862,
		sha256: "4cea094c715d2863c4957221b444ac85d38868aeb6a42c88959fafb2e3691721",
		keys: 725,
	},
	"sv": {
		bytes: 48474,
		sha256: "96f395c7f450c9270f985e34c8da03e0075fc7631fd99daa728c7180f383998a",
		keys: 725,
	},
	"th": {
		bytes: 78885,
		sha256: "401f0edb52112cfef8b7a08be58df06f7396a7e454b6d60b5bbb9566cee097b9",
		keys: 725,
	},
	"tr": {
		bytes: 49996,
		sha256: "760531fe7a8aa33c6191f3d016bd28e9f7abb75a149cc0a323e87140c55a2fed",
		keys: 725,
	},
	"uk": {
		bytes: 67537,
		sha256: "2fb1e65d987934713ce46168705a4b647ca87a10989c570217a3f57f7dd4de76",
		keys: 725,
	},
	"vi": {
		bytes: 55012,
		sha256: "26182cfc22195d95f2e149c5526744b6b50cddab224d0e80b23b2e881183561c",
		keys: 725,
	},
	"zh": {
		bytes: 46169,
		sha256: "c8c5e24f14bb90e2d96f39b53caf5e48947f92d5a67688561503d38719e47ad5",
		keys: 725,
	},
	"zhTW": {
		bytes: 46340,
		sha256: "4a19f0b10d1fd0d5efcd107de012a9fdaab4fa95a4a5e315dfdbaa709fc2babb",
		keys: 725,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
