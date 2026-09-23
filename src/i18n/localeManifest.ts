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
		bytes: 69558,
		sha256: "8e775a17b4dd866d402c22ec999760f4bc0a9c7503887f22e7cd07dab39920ee",
		keys: 771,
	},
	"bg": {
		bytes: 81961,
		sha256: "d715b42eb49d356e92063d98ea8d21d5cbbd2d501342e164a270c9dff709c442",
		keys: 771,
	},
	"cs": {
		bytes: 56886,
		sha256: "6e6221435158488a50e4686599a10994315f80c0f2bc9d110bf0f05c99bb8f79",
		keys: 771,
	},
	"da": {
		bytes: 54795,
		sha256: "cfefaf57ea27a0fafaf7ea3119b2c54325a489e2bab1fe97e85468ebb53600ea",
		keys: 771,
	},
	"de": {
		bytes: 59925,
		sha256: "cde967b74783347005dd75122ad6dcdc03e470b0f9452c27144b607695d6a878",
		keys: 771,
	},
	"el": {
		bytes: 86467,
		sha256: "a4217b28b47979af420f8f6af3f095620faf00938d213a9ec4ff49ffda305ccd",
		keys: 771,
	},
	"es": {
		bytes: 58198,
		sha256: "779ab352fbcc01521f6c9f9d0d89fcd54aea8dbc0c4893d62ec8a7c5740a45a1",
		keys: 771,
	},
	"fa": {
		bytes: 75207,
		sha256: "afebd34b478f88d379c8db38c48c37b9e2c5dab59e31795ef77b81d0d46acd64",
		keys: 771,
	},
	"fi": {
		bytes: 56697,
		sha256: "326bee48df33e3d1decc41a7287de877df6a177e13cabd577f58d3c5ed8919a0",
		keys: 771,
	},
	"fr": {
		bytes: 60601,
		sha256: "7d64ecbb5a13fbc619997ac2086f7badf25877aa10f628d4e6bd9af9de14e7d6",
		keys: 771,
	},
	"he": {
		bytes: 69669,
		sha256: "d773585e848f3d0d60ca6af16b9dd93fff40d1a6d3ceaab489273d1f0c8be835",
		keys: 771,
	},
	"hi": {
		bytes: 94997,
		sha256: "a671b51b9b42270349a2d010b8ffe6b9a039644f21a03f29399914a01a7fdf1f",
		keys: 771,
	},
	"hu": {
		bytes: 60466,
		sha256: "aad4c61edb53bca8c2c463db3ffe7813184619c6f422d979d45aee425e920796",
		keys: 771,
	},
	"id": {
		bytes: 55041,
		sha256: "a6ee409246a84d0fc3737b68d491fab8d88261e9bcb74be7d3799fec85055332",
		keys: 771,
	},
	"it": {
		bytes: 57998,
		sha256: "582feb829db88b9eaa6380b2f8901b6c6cf1c663ce5e3d143ba915af3c92f129",
		keys: 771,
	},
	"ja": {
		bytes: 67286,
		sha256: "c15e4aef691a30707ef49ceeec98f0162a549031e390635276bfeb72eaa444d1",
		keys: 771,
	},
	"ko": {
		bytes: 61588,
		sha256: "6bac7192b93c3a29c8a0ba7d5762c66558b06e4ba111e9af9e129ec47485e124",
		keys: 771,
	},
	"ms": {
		bytes: 54894,
		sha256: "c1b0defc24618042554f7299b0ea51fabed90436458b5a19d634d935c46058e9",
		keys: 771,
	},
	"nb": {
		bytes: 54965,
		sha256: "bc170591cf66579f1c3830264a165f45b657ab4820a05e317a791b1163ecb079",
		keys: 771,
	},
	"nl": {
		bytes: 57205,
		sha256: "3d524a853ffc7d0f479a4bfaddcf67c365834ddeaa1d1aadd1534da439085511",
		keys: 771,
	},
	"pl": {
		bytes: 57311,
		sha256: "b041cc86644f6e24190c12eb857c2f988240e118a13faef54a3f9bd4cc333819",
		keys: 771,
	},
	"pt": {
		bytes: 58112,
		sha256: "0c5ff9d0688cb74e4d40b688d66ef530884f2a9f18f23268a9c511396d0c1cd8",
		keys: 771,
	},
	"ro": {
		bytes: 58931,
		sha256: "0a7785ed8bc7ab31f27a825a959fc7d184f9f1b5a2c89bd2a037a8887bca405f",
		keys: 771,
	},
	"ru": {
		bytes: 80620,
		sha256: "461de78a26684e119df9ca00a8e974f2987884ae4d14fc2132a9efb666d1d1f7",
		keys: 771,
	},
	"sv": {
		bytes: 55735,
		sha256: "5cd75288a11edb1a396371532814066056197a2efa62be678ff28d44aeced4be",
		keys: 771,
	},
	"th": {
		bytes: 94237,
		sha256: "93ed15b52ce34b3e6987f55d3d59c1900011908fda1acd91f6c96ac5dfdc4216",
		keys: 771,
	},
	"tr": {
		bytes: 57077,
		sha256: "c1ef65ec68b56f1c11e97ea3ed4c63ae2b7e4f6d20be2cd110bfd7f34dcb1553",
		keys: 771,
	},
	"uk": {
		bytes: 78946,
		sha256: "f765ed6585b8efb49be87f096ddc2f41fec83af5189b3f37f4c5222807fdb166",
		keys: 771,
	},
	"vi": {
		bytes: 63202,
		sha256: "89a1c046621ff9ebd8f4f669579ea1ec7b32d5d551ffbe75aa316efcf629153e",
		keys: 771,
	},
	"zh": {
		bytes: 51875,
		sha256: "0bacbdad6ce9f9d512a61b9a68254fd370c95c1c1392f6ed1d30acf489039dc1",
		keys: 771,
	},
	"zhTW": {
		bytes: 52082,
		sha256: "edd3ae1fa8093ec221a57ad2e092c256197a4675a97071484ac97e27b1a713a8",
		keys: 771,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
