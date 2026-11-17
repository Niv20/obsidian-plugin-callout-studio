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
		bytes: 125314,
		sha256: "aa5f1845f781693083048f8197e6ac52c1d70e1cc24c09b94eb118af331aaf64",
		keys: 1366,
	},
	"bg": {
		bytes: 149271,
		sha256: "8b3a6a612c0abbea401586cc1ebd963091bc6ffef91c3ff34c7e65fc983a15f3",
		keys: 1366,
	},
	"cs": {
		bytes: 102965,
		sha256: "f17425a125e13f003feecb0d2d8e271b396e6176b924108437fd0e6927b47588",
		keys: 1366,
	},
	"da": {
		bytes: 99537,
		sha256: "f1b6051554b4b2da16a0e5c8e0a20c45a62c4e11644ac602ad1a9da40cbaa997",
		keys: 1366,
	},
	"de": {
		bytes: 108999,
		sha256: "becd51e85a01074bead7e739b1fecf9176e18aab87a8e99eba51e6fd85821d3c",
		keys: 1366,
	},
	"el": {
		bytes: 158780,
		sha256: "b05e35fb2d32257fc8046aecc2bf68260e9d0405ffbc1cb4130a102adf61a738",
		keys: 1366,
	},
	"es": {
		bytes: 105210,
		sha256: "63cff8b3a3c308db907288d24e826e4cd6fb2232fe055bdd556e15ac20245e73",
		keys: 1366,
	},
	"fa": {
		bytes: 137916,
		sha256: "35941c4bada97d7dd739209ebe8072cc92622dcef9555960c5ef2e57d23331d4",
		keys: 1366,
	},
	"fi": {
		bytes: 102764,
		sha256: "3e3e8659b5dca49c623ff2102ff2f748fe72d3c78b91f1f5aad47690d9a6ae7d",
		keys: 1366,
	},
	"fr": {
		bytes: 110096,
		sha256: "eb414b14dd2b88fa596ccf51329b308d8c8e92d0e71ed9078f2880c1440874b4",
		keys: 1366,
	},
	"he": {
		bytes: 124075,
		sha256: "098115894872e65ce80b9eca539ffbe7f0df4644b2b50a362c418fd760c8dffb",
		keys: 1366,
	},
	"hi": {
		bytes: 173804,
		sha256: "d53397311e39f4fa357ea42ead5d76bd25c1d637cb529bd7e78ba94463de343b",
		keys: 1366,
	},
	"hu": {
		bytes: 110147,
		sha256: "80f554c4497fb44cf0189cdb9c4a446c56d8a9234b3f19129afe6723c813685f",
		keys: 1366,
	},
	"id": {
		bytes: 99658,
		sha256: "ba4ae142dda20d4742e0bdee3498f38d5e2f73272f2dc84fe0b2e91466f818fe",
		keys: 1366,
	},
	"it": {
		bytes: 105568,
		sha256: "794499b3381cc040e1c3a77935e6cb305e70468828dad6095967829275a5be54",
		keys: 1366,
	},
	"ja": {
		bytes: 120874,
		sha256: "e1e54607242ef98abebb46573cf8d20dbdb2bbac049728452ba28cfd8cd57eb7",
		keys: 1366,
	},
	"ko": {
		bytes: 110889,
		sha256: "a960bf18801a47818495b8f9e8778f43041869d035f12bafacc0e5e59a05bffd",
		keys: 1366,
	},
	"ms": {
		bytes: 99865,
		sha256: "d0d1bf8ecb375062786b1517fc5552cd3e615627fcc93e56555875abbd037a4c",
		keys: 1366,
	},
	"nb": {
		bytes: 100226,
		sha256: "f98fa050de593bb981b58a85c8d58bca57a4900eae813c168547c4802cc62db4",
		keys: 1366,
	},
	"nl": {
		bytes: 103635,
		sha256: "3be617c9cefeb824faef63dd001843333a58cb059c7d1a7b1cc0603850ecc2a0",
		keys: 1366,
	},
	"pl": {
		bytes: 103959,
		sha256: "6c77f34705d7e18f19bd2d5a7e8e572fa477873587650f8608c8cae0794630d5",
		keys: 1366,
	},
	"pt": {
		bytes: 105175,
		sha256: "af4456995e22151ceb4c4f4062ab78c385239e71286b44441ae8bac8ca3946f1",
		keys: 1366,
	},
	"ro": {
		bytes: 107440,
		sha256: "2358bc1cd8a27c9f40223330418db2d17f167d49b337b74dec87af068a5db137",
		keys: 1366,
	},
	"ru": {
		bytes: 145766,
		sha256: "2c542bf9eeaeb78ab41fc0629f85bbf64df3dd3cf0741d856f0cc0539b1dc308",
		keys: 1366,
	},
	"sv": {
		bytes: 101607,
		sha256: "2063460f9fa61e6292a193f5a76486df5484cfbe46cb0c46c1b95b0e83070a46",
		keys: 1366,
	},
	"th": {
		bytes: 172611,
		sha256: "c58430a9692b187956bbdd2179115e73ad0d9397317e26a674e5334890855dcd",
		keys: 1366,
	},
	"tr": {
		bytes: 103415,
		sha256: "2b729ed8e53b151c2cdb1d4398ec46f892841457a6cb9b9ac0000ad66cedd638",
		keys: 1366,
	},
	"uk": {
		bytes: 143318,
		sha256: "0f7da795c4deba13839f9e8302f2c4b2e58c451d98f552fa78ecd01679327ff4",
		keys: 1366,
	},
	"vi": {
		bytes: 115048,
		sha256: "a8113233d6c2ef3518888d147a459581c8912c755ee704d88496e203a18df5b9",
		keys: 1366,
	},
	"zh": {
		bytes: 94164,
		sha256: "be593686569fd5a7546d95b8b0db3db9216ced08b9187293efbe5372c03b7bcc",
		keys: 1366,
	},
	"zhTW": {
		bytes: 94476,
		sha256: "73aed2fb929059d7edabaf6ebd1623ce0d21b75dc05c74678dc22a99d08e391b",
		keys: 1366,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
