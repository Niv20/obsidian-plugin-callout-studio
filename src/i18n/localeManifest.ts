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
		bytes: 105338,
		sha256: "c9867b88a2b6fb68be2e90dea9bb1f1faac0328339869870bba80365f52d1f49",
		keys: 1134,
	},
	"bg": {
		bytes: 126512,
		sha256: "0e446de283772fed313e9f21c7a7aa0b29ef446432ce070dc9ebf297ff5f019f",
		keys: 1134,
	},
	"cs": {
		bytes: 86437,
		sha256: "b1d9f1e3365b03debd0b1b3d85226c13d4d7bdc8eaa773c5ebcd70d141825063",
		keys: 1134,
	},
	"da": {
		bytes: 83589,
		sha256: "c420c4e4f2b39a3394a28af42c8721cc80f27aaa940b9a47714ebfc119e217ea",
		keys: 1134,
	},
	"de": {
		bytes: 91396,
		sha256: "a479a4d62d4c87c3d5b0e0e0740482f7d6447510bbc127e836ded880c6826d6f",
		keys: 1134,
	},
	"el": {
		bytes: 134161,
		sha256: "1cd1b6740861d18aa5d4144338bae1ffe9f2d6d6f7b69d2de13a79f89ef519af",
		keys: 1134,
	},
	"es": {
		bytes: 88711,
		sha256: "0d5b5df2669874333e9b16d2a81bdcb2159f16af9618b0af47d715e8ef72efcf",
		keys: 1134,
	},
	"fa": {
		bytes: 114920,
		sha256: "cc2a7b57718ff64ecebb0bfcf949de018d9452392fc8291c3319a30dd06f8958",
		keys: 1134,
	},
	"fi": {
		bytes: 86031,
		sha256: "4677489166c3ef4b9688ef532bddfa18d9775b9bdd9458efa8838fff8b416a12",
		keys: 1134,
	},
	"fr": {
		bytes: 92704,
		sha256: "c9321581ee1be3df86b972c4388fb221578fc0f6e2491bca80f4b91918ea2ff7",
		keys: 1134,
	},
	"he": {
		bytes: 104265,
		sha256: "684953052657e280fb58fe746874b2230122cd851d919286f860ef6b71c826de",
		keys: 1134,
	},
	"hi": {
		bytes: 145961,
		sha256: "eb679f9d0692b1db74c5c4feb348f97305bb8caad0ce005f05ed7a31f039a82c",
		keys: 1134,
	},
	"hu": {
		bytes: 92158,
		sha256: "a71e51611af3fcc12a10bc8de878ef569234347b6a6f8ab172d277d08e32dc75",
		keys: 1134,
	},
	"id": {
		bytes: 83644,
		sha256: "6e16224d6b1cc6800079b9b85c8a004b89c9e0b5fa1952414c0c7013309f53cf",
		keys: 1134,
	},
	"it": {
		bytes: 89123,
		sha256: "b929e5bfe6154777f2170141ecb83ff16d2a8d785c86daa866b22501ac07db85",
		keys: 1134,
	},
	"ja": {
		bytes: 101133,
		sha256: "c454a97ff6f3da55940cc28c6195307f838bf6bb81505d54c258a77c061a6e1b",
		keys: 1134,
	},
	"ko": {
		bytes: 92428,
		sha256: "2dba7e4baff0007f818bc81d824de2de83918517228f7bf5943e33def0b869ae",
		keys: 1134,
	},
	"ms": {
		bytes: 83431,
		sha256: "98a3cc5fe4b3227e842de3a7be42591d0f56ae45d806fc993fe6e1a22d0bd687",
		keys: 1134,
	},
	"nb": {
		bytes: 84108,
		sha256: "c94eac9d94da96a88228413565bc01becd9355ce2da86be8cf392f56bdb96f56",
		keys: 1134,
	},
	"nl": {
		bytes: 86952,
		sha256: "4ddb4c6a10cf5572b507182d7b683a5a245161d049b7c2cd6c0b702e11a8fc09",
		keys: 1134,
	},
	"pl": {
		bytes: 87432,
		sha256: "780ed5a12364ef8c72203d3b27d8aaacfe6c525533923f58e3519066ef07690a",
		keys: 1134,
	},
	"pt": {
		bytes: 88417,
		sha256: "b33bd6279633dd3aebbefdd6a90fd97644697081a54322baa55d8b99792f92f3",
		keys: 1134,
	},
	"ro": {
		bytes: 90132,
		sha256: "18661d1ee5fd0a976fdfcee554010fac2eddd3abaef03bf657016f5287a83bd6",
		keys: 1134,
	},
	"ru": {
		bytes: 123715,
		sha256: "1d3af8713b8ccd65cf897dec7d1bebf5024fd05b88a91a51ca3536f53291616a",
		keys: 1134,
	},
	"sv": {
		bytes: 85292,
		sha256: "baa14f0adc5f2938613a28e1e2c24ff76999b2e6e627c30e9e45002963e1a731",
		keys: 1134,
	},
	"th": {
		bytes: 146938,
		sha256: "ca503b7f5accb079742209cbc69358ef70784704d5a1aeb51a632e59a435885a",
		keys: 1134,
	},
	"tr": {
		bytes: 86474,
		sha256: "df0ba62d27431844a556f520af4fc4c681ac52cf05567a62ab42283fcd9158a8",
		keys: 1134,
	},
	"uk": {
		bytes: 121841,
		sha256: "c07c15c48ed884b24e22e616734ba5c161cf874ed96052a977123700aa214864",
		keys: 1134,
	},
	"vi": {
		bytes: 97164,
		sha256: "113f7e1d75ff20b556bd28d44703c9112ef40ac9a15bcd0a77f3f9a8339d1ca5",
		keys: 1134,
	},
	"zh": {
		bytes: 78324,
		sha256: "b53c15c73200530a933e8e8911676f38b2506f456c9b478fa2acd52352d0187d",
		keys: 1134,
	},
	"zhTW": {
		bytes: 78620,
		sha256: "c14b6a6b67a6a46085c24ac3e42f82baccec8108bbc3ef66f654bfa13ec62bf3",
		keys: 1134,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
