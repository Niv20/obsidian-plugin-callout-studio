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
		bytes: 106994,
		sha256: "9f3561fcbdd9301d0d646d699037f6de3e334e94a99504355c7a6f545cfefa93",
		keys: 1156,
	},
	"bg": {
		bytes: 128825,
		sha256: "5608834b3afa9e63a48c8a5f280fa9358beb0c6f683ee38ce140a013afc4401c",
		keys: 1156,
	},
	"cs": {
		bytes: 88029,
		sha256: "d9bc0776a6b849428e13450ce7d4405c0646f16eb3e1ac4a94965a44044d8f19",
		keys: 1156,
	},
	"da": {
		bytes: 84734,
		sha256: "082234b8021a6996f6e7d43d539acdab907d1811195e0759635c16d13b3a1283",
		keys: 1156,
	},
	"de": {
		bytes: 92968,
		sha256: "edb6439962418ef31c11da0f79505f90018a99ac1f5ed967af10b79f57bc4e5e",
		keys: 1156,
	},
	"el": {
		bytes: 136227,
		sha256: "197f1d03e09ee0b32b845ae061aaefc7e923ecd6b1476a27b797b9925fb35970",
		keys: 1156,
	},
	"es": {
		bytes: 90368,
		sha256: "8414cf7d4cc9da2aa10064b08c82f08bd3debdc7df0865a6bd0627219eafed06",
		keys: 1156,
	},
	"fa": {
		bytes: 116818,
		sha256: "df03b5881765dab15066554e09516d81c7c8d57ac644159e0a305cc6be14c639",
		keys: 1156,
	},
	"fi": {
		bytes: 87628,
		sha256: "54ed40fa6d7faa22417a5dd7a2a9bd142f26923eafc7e7e862bf2e93d91dc30c",
		keys: 1156,
	},
	"fr": {
		bytes: 94218,
		sha256: "dd38a492332dc2fedd8ddf8c9ee85278f7f3bf443d6a601c22cc8fe3695f3ab2",
		keys: 1156,
	},
	"he": {
		bytes: 106172,
		sha256: "87ddca9573e40df2e79a23cf97aceb509aebc7520b1701783e7d7a4fa7b0325e",
		keys: 1156,
	},
	"hi": {
		bytes: 148249,
		sha256: "20eed37cb0440b5b71bb319a6fa62d2338ff8374e58c2034d63dadb86b325b2b",
		keys: 1156,
	},
	"hu": {
		bytes: 93825,
		sha256: "6304cdf06f9bffdba2426a0dbd04e60e359624a4d415d7493ea6c1ecba3a4fe9",
		keys: 1156,
	},
	"id": {
		bytes: 85148,
		sha256: "37b12bc249e9595860a75fb7114d7b4991a4521a4f3a616f9e14c86b6ed48128",
		keys: 1156,
	},
	"it": {
		bytes: 90820,
		sha256: "aad78c4aef542315b185a54afaad1d50fed749d529002e521d96996902f3e12a",
		keys: 1156,
	},
	"ja": {
		bytes: 103027,
		sha256: "779b0b60fcf75d5f3146c3b177db348226651bf7be67e6447d34da354fef094c",
		keys: 1156,
	},
	"ko": {
		bytes: 94139,
		sha256: "97ac410e7a496800a26df10785802f0beade0573f9c1f15ef08d5b60d2117e7c",
		keys: 1156,
	},
	"ms": {
		bytes: 84810,
		sha256: "f2341276e9859502dc9c8b03b5a150ef211b618bcd94e7c7a5e5e80247847cc4",
		keys: 1156,
	},
	"nb": {
		bytes: 85229,
		sha256: "66163182e656980ff5768e1400dde58f499df912fc5897c3f18d0657fb4470ef",
		keys: 1156,
	},
	"nl": {
		bytes: 88480,
		sha256: "c8d198cb70ea225e4112216331d16d1cd4658893e08278fad7758f1eac1c9445",
		keys: 1156,
	},
	"pl": {
		bytes: 89018,
		sha256: "8e834ddcc9a34f9f89d46d8c51d58375418d69f630da7d8f1a11e109f5c617b2",
		keys: 1156,
	},
	"pt": {
		bytes: 90040,
		sha256: "9bd56b4f93bb80667a6cf04d4d506a1015aa464fc898798141f578edab1055a0",
		keys: 1156,
	},
	"ro": {
		bytes: 91524,
		sha256: "b672e0445c648fd0a2005da0c58eed6f2c969f6d02df5c873b9aa6ea769faf36",
		keys: 1156,
	},
	"ru": {
		bytes: 126020,
		sha256: "134973832558e807a7d0f59bde5288b0b43b6c5d18ef72256387e88efc93fa72",
		keys: 1156,
	},
	"sv": {
		bytes: 86475,
		sha256: "af9984300724916b37886483d1b3ee884f20e353d1249b8198abf25e0738822f",
		keys: 1156,
	},
	"th": {
		bytes: 149399,
		sha256: "f9e66333f1475d55e923e8562914d03a8c498929f0b333eb6327e8038e6ee90c",
		keys: 1156,
	},
	"tr": {
		bytes: 88026,
		sha256: "df957493e545f436b7c66954436d74e6c9d27a3c9051dac2414f336993faa1f7",
		keys: 1156,
	},
	"uk": {
		bytes: 124087,
		sha256: "c621976f68c7df6ac4255599ac93246aba63c285c32ab432dfac0bbd60231588",
		keys: 1156,
	},
	"vi": {
		bytes: 99045,
		sha256: "96775f541edc9727f07e93b1a12ae64ebbb91639c36aedf49523cc22e50305f0",
		keys: 1156,
	},
	"zh": {
		bytes: 79566,
		sha256: "e13531a4a63f64f9ecc2044625ca3638aef834ea6e36609b94dbff017cedc4c7",
		keys: 1156,
	},
	"zhTW": {
		bytes: 79879,
		sha256: "130a8ad607dd7fd7dd77e2bb6761332a211d5f47cf417695adb6314f7d99b6c2",
		keys: 1156,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
