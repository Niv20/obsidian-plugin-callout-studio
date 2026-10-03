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
		bytes: 108640,
		sha256: "0710a3c3f05960328bce44b63a0b1c1f2df8f20001c5ce090d5046872b96c97d",
		keys: 1172,
	},
	"bg": {
		bytes: 130272,
		sha256: "f0547848da88e68b821f26b6147afd8c83f8fed94744ada4e686f5586ae9faa8",
		keys: 1172,
	},
	"cs": {
		bytes: 89045,
		sha256: "51035572a61d321c5d16b25bc3fe7dc1137fb5e2b976b71e15a436a3d8a0310e",
		keys: 1172,
	},
	"da": {
		bytes: 86196,
		sha256: "429d8f23d7226efdf9d670bb5ac63412d2cf419ef779766f24aaa01bd1a330ec",
		keys: 1172,
	},
	"de": {
		bytes: 94354,
		sha256: "1a25b443764becd82a1e5fbc5df72f6f470492068f7ca81bca3f9e6a8c461388",
		keys: 1172,
	},
	"el": {
		bytes: 138213,
		sha256: "bf205e631f7ffc27aa91a227c5a153bc7fb48ae1defbb05999b3fcf46eb88fff",
		keys: 1172,
	},
	"es": {
		bytes: 91423,
		sha256: "7232120fb1d1a339b32afb390526cdc449e030d8bbe35eef23e168af28b0d057",
		keys: 1172,
	},
	"fa": {
		bytes: 118711,
		sha256: "e8e8e7840a0ca1247b1a4bfdf6fc775a3ab86e4f14c0a42c97877130ffc60f5e",
		keys: 1172,
	},
	"fi": {
		bytes: 88727,
		sha256: "1d3f69e7c450827af3a05acc6e34c4e44619080ade1d93aa740800deea3fe072",
		keys: 1172,
	},
	"fr": {
		bytes: 95709,
		sha256: "ff8fbf2f82d66843ab5932a777618643336142ed540933b21941968fee69662b",
		keys: 1172,
	},
	"he": {
		bytes: 107479,
		sha256: "cd443111f4884658426659f3a5e5bc162b3be36b9c72a66be421920f48bbcaad",
		keys: 1172,
	},
	"hi": {
		bytes: 150654,
		sha256: "67411d373d29e2c92a071b3e20a64200899d3027fbb6af707dd191860ee9fc9c",
		keys: 1172,
	},
	"hu": {
		bytes: 95087,
		sha256: "50fce5e02312dcf0f17e514c0f48879d33e83da4083e0adb5f972f554507ec85",
		keys: 1172,
	},
	"id": {
		bytes: 86178,
		sha256: "611366bbd0083be32af7913e9fcf1436a7a76a7cb83ba1945b39505009361691",
		keys: 1172,
	},
	"it": {
		bytes: 91790,
		sha256: "8d1010577e399d8e63b6345ba13586509833b812641acd3b7ca20fb53e044422",
		keys: 1172,
	},
	"ja": {
		bytes: 104516,
		sha256: "58eefb11439276420d0ae318db1f50a53611e8a9cb2874ceb1b153ad0c722967",
		keys: 1172,
	},
	"ko": {
		bytes: 95505,
		sha256: "305aae4318c7ea2c63a954dc15906ebcac5385e49524dbc35341dc016b10b5f3",
		keys: 1172,
	},
	"ms": {
		bytes: 86059,
		sha256: "bd72b76b4bb64bf4af8d410e07d59f1d21924c95eb4624bd2175332b75b65abf",
		keys: 1172,
	},
	"nb": {
		bytes: 86733,
		sha256: "be83c6beac89d156abf1711cd38cf9ce6b95ebb2cc129247fc99e52eed4b945b",
		keys: 1172,
	},
	"nl": {
		bytes: 89825,
		sha256: "b4b0177f9d2c79c9c0414803d9cf628291ffd8e585ee9f99cc4af459fb96399f",
		keys: 1172,
	},
	"pl": {
		bytes: 90123,
		sha256: "5dc8aa1f4b05777a68412e8260b0e1a1dcd551df3e35f3e4d9b6b0effb719fc4",
		keys: 1172,
	},
	"pt": {
		bytes: 91147,
		sha256: "3b54d753272b41e124401c3b13e4d6b01a2ec926354e05ac0dbf365ae576d4f4",
		keys: 1172,
	},
	"ro": {
		bytes: 93002,
		sha256: "bc2b25f3b360574e24180da07c8080615bc41f8d377f2db4977c0d92f6d04fcc",
		keys: 1172,
	},
	"ru": {
		bytes: 127472,
		sha256: "7f22e807fc7549b9a4280d92f663bfed6f5124e8f45d19fd568f9c29d8e5a5b5",
		keys: 1172,
	},
	"sv": {
		bytes: 87869,
		sha256: "b1f0d6a13b40a800506439223d29fef30f7853f087b26b0cf2e28d6409aa72f7",
		keys: 1172,
	},
	"th": {
		bytes: 151248,
		sha256: "cadd3277cdfdaadd82bb393384f8c85f37300d7aa1b50dfbd595f2f46d9a1850",
		keys: 1172,
	},
	"tr": {
		bytes: 89295,
		sha256: "7718a1ab271d033feb102c5f564b76b442d557be6e6031545f94c65ebfc0497d",
		keys: 1172,
	},
	"uk": {
		bytes: 125677,
		sha256: "9b42afcff4883ce4a10d90a34a2079563bb31cf21e1b22d05c91e2b92c1670c5",
		keys: 1172,
	},
	"vi": {
		bytes: 100192,
		sha256: "be0c5aaa005b82c5dbad0c8a7590db62abfcc11bd59e330f108c37b73583dfb1",
		keys: 1172,
	},
	"zh": {
		bytes: 80822,
		sha256: "055b9e62d908e24a341edb135312d455cc5fbf104b9141920dadab8880d753ed",
		keys: 1172,
	},
	"zhTW": {
		bytes: 81127,
		sha256: "a134d1c28edd51b391dd0ededf47f31b9c57a46667a868a4e2d5bea3aee68707",
		keys: 1172,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
