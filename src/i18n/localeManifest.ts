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
		bytes: 111818,
		sha256: "32b56d28746a22cce71e8d50be032542ecd6c23604955feda008fe285c69d181",
		keys: 1206,
	},
	"bg": {
		bytes: 133702,
		sha256: "b248ab53335eb86cd452501da1e57017a117f344b1ed8a15e1c0fed62f3a90df",
		keys: 1206,
	},
	"cs": {
		bytes: 91637,
		sha256: "dec2676fffad362f648affe26ea350aae1699c037d18d230a07137aa233a2596",
		keys: 1206,
	},
	"da": {
		bytes: 88718,
		sha256: "6a50d81c129729a115542ebf7fb92c7e9ac03e3a97c3b428195806b4688ef4c5",
		keys: 1206,
	},
	"de": {
		bytes: 96997,
		sha256: "d57db77df10238478a622021263fbc2ad7bdd25e6db255ec96c1d372c80b62d0",
		keys: 1206,
	},
	"el": {
		bytes: 141663,
		sha256: "e3b6d8b1d1c0c9e4c47327b0426ca7ba528d399dc3b0a4a11ee5f8319c2055c5",
		keys: 1206,
	},
	"es": {
		bytes: 94006,
		sha256: "6666ffb5e09c69b534f3e5fc48561b66c1703bb4aec9f419305eb7cb93146ec3",
		keys: 1206,
	},
	"fa": {
		bytes: 122229,
		sha256: "74d35be39433db20ba3f8127b954e493b0432924b0703ce0d564f39b1906c19a",
		keys: 1206,
	},
	"fi": {
		bytes: 91317,
		sha256: "b62ca1413ab26c0f692d14c084e5dca2fe380cda6b0c5cc3bc0e43d0c357d4f1",
		keys: 1206,
	},
	"fr": {
		bytes: 98475,
		sha256: "08bb5812f3f94852783d9eca35141b0e2c81770335b77c0da06a97a342aca4db",
		keys: 1206,
	},
	"he": {
		bytes: 110709,
		sha256: "b9c255975fb2ad798ec012c17769aff91aafcafdaffd802b2d91c520a122ba57",
		keys: 1206,
	},
	"hi": {
		bytes: 155323,
		sha256: "bcbb4cd068bb9378802070db29d82e342c8f0702d8aab2026afea6e99bf1efa6",
		keys: 1206,
	},
	"hu": {
		bytes: 97733,
		sha256: "960e220e31e0415688c0b9c1aafcfccce0ff1a8d0047cc748098352928630d08",
		keys: 1206,
	},
	"id": {
		bytes: 88571,
		sha256: "a41f2ce7aa09fac0b39b582fcf2ef8f425d2ec3431af4024e705bb2afdb3ba02",
		keys: 1206,
	},
	"it": {
		bytes: 94392,
		sha256: "a4e7c46b303e5c37e2f830523437261d566219007afc8ffc236944bfb186adf8",
		keys: 1206,
	},
	"ja": {
		bytes: 107587,
		sha256: "a578941a994611b4dcca909a87915156328c86b73e26a0fdb90eebba58e4cc4e",
		keys: 1206,
	},
	"ko": {
		bytes: 98522,
		sha256: "8c2f0cfd1dde5ebba3329b2c99b6e4473e145991ecd9683ae809edaabab1cbbb",
		keys: 1206,
	},
	"ms": {
		bytes: 88653,
		sha256: "d4d86f4745f15ae3f091310c6a2b5077ba4e3fc934ae9a7b2bd4d5ed9a8c38e6",
		keys: 1206,
	},
	"nb": {
		bytes: 89275,
		sha256: "d6be1e0a3d5262c9e33bd04af6f0b3b25f8d504f5cb4b3d5351f900410ae6a43",
		keys: 1206,
	},
	"nl": {
		bytes: 92459,
		sha256: "0693c181423cd1fe2159867f0726a2c6594344b1775ffae6f344cd203d327fe9",
		keys: 1206,
	},
	"pl": {
		bytes: 92624,
		sha256: "a0db3d02247a0add15384d2e1e745614e45be103a6eb64a9e58e2f41f9b07429",
		keys: 1206,
	},
	"pt": {
		bytes: 93881,
		sha256: "63df0b3747dcfc7e251d8458b9d2cab3b2638d7537e2b9ea0ecd604c7c479eb3",
		keys: 1206,
	},
	"ro": {
		bytes: 95608,
		sha256: "b13ab61bbbb27a8b60c125b8f375847fe343b738445bed22d23fb3e06926ad1b",
		keys: 1206,
	},
	"ru": {
		bytes: 130883,
		sha256: "dac847499eba708473789a005707b94893ba19ed79dd40814280b25106ddf53e",
		keys: 1206,
	},
	"sv": {
		bytes: 90416,
		sha256: "c93ce36e5aad4f67c5f295e4a19e4d8c654527207c790ab8ea4e6244669e3c4a",
		keys: 1206,
	},
	"th": {
		bytes: 155149,
		sha256: "db4f30aa55e1f01f3ae596a2693ee4637375ce66215d026b662ab8a16142192b",
		keys: 1206,
	},
	"tr": {
		bytes: 92078,
		sha256: "827e57b4b83ff8fe008b8afee63ee84916f64a8e1c6b5e696913b2f0928b1a19",
		keys: 1206,
	},
	"uk": {
		bytes: 128763,
		sha256: "07aaefd5e265c2c18a7d14da9a84d68b4505a1737c815efb38faf1d3a6407546",
		keys: 1206,
	},
	"vi": {
		bytes: 102989,
		sha256: "5d6e590aca66b33c5b3638e14ce26e0dc989ed6f72f1e5ba067fe2a3fb9982d9",
		keys: 1206,
	},
	"zh": {
		bytes: 83217,
		sha256: "b07bf214ab6e849e6c41207389d2a1b028d1935b974d792c9a2f60c31b090481",
		keys: 1206,
	},
	"zhTW": {
		bytes: 83514,
		sha256: "9a2a337ef6ab1083a228604e5d26412c69dcee720c48bb3efea5279b5ad27159",
		keys: 1206,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
