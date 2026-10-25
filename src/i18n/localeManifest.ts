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
		bytes: 115288,
		sha256: "36013ee91eebe669a07127616312ff83c2356567d31c7e67c408d4cdc296a9ae",
		keys: 1243,
	},
	"bg": {
		bytes: 137555,
		sha256: "ea351b74eb7d16860eab5565d67b5ab8046eb24bd16bfd04ab5ef83499fddfd5",
		keys: 1243,
	},
	"cs": {
		bytes: 94468,
		sha256: "2642ff37b085c6538e34fa1cd77b6fe42ecd06dc6df7d995b01926fcde7d2676",
		keys: 1243,
	},
	"da": {
		bytes: 91497,
		sha256: "d0e6c3410a0798695835605f1dfc2df9f938d8d5fa9d3be99ec81f8ea986fdc8",
		keys: 1243,
	},
	"de": {
		bytes: 99883,
		sha256: "ab868caef191bcb03e02ee2edce715c45ea5747047be1461ad248355d602dd6e",
		keys: 1243,
	},
	"el": {
		bytes: 145460,
		sha256: "f6fba5dc1b186c47904e9e21266d4585ee92816cb4e6db9fdcd4ff4a02f36a44",
		keys: 1243,
	},
	"es": {
		bytes: 96834,
		sha256: "651c2fc7bf0c6cd8222c618985a78f1088065c76a8faef33621c18bf20b29559",
		keys: 1243,
	},
	"fa": {
		bytes: 126447,
		sha256: "42dd835da299f7863a65e3c90f9fbea8ac14995e733a3c34261f17eb7163ab9c",
		keys: 1243,
	},
	"fi": {
		bytes: 94237,
		sha256: "d85fbbe3059f03a06ca29db45aafa02f4c71ad6836b80b31d8a975391d6f2f04",
		keys: 1243,
	},
	"fr": {
		bytes: 101393,
		sha256: "ed2ce6c53eb5ebf51030eb3103b44f8660a84697679be97c2942a18a074febf0",
		keys: 1243,
	},
	"he": {
		bytes: 114211,
		sha256: "4be408b0796bba88d22c6a30715ea734d6fa650ccdf64fd4d1cd9ed97c578700",
		keys: 1243,
	},
	"hi": {
		bytes: 159444,
		sha256: "affc12b5867b295d45db82ba661c4a792c1a97a7a282d7e48279722ff7aa5f56",
		keys: 1243,
	},
	"hu": {
		bytes: 100907,
		sha256: "ee9d7f1248e41ac18adc7d2655f24b11c665bc261492f7a08b47fe718b921539",
		keys: 1243,
	},
	"id": {
		bytes: 91434,
		sha256: "f0d169a0efe239f3a809c80d119841693ee46f2616ce51daef43fe860a9d6b9f",
		keys: 1243,
	},
	"it": {
		bytes: 97192,
		sha256: "1783e43b46e7295fab0687215685e3db3d797740c482d63a67970ff3d5e6cde3",
		keys: 1243,
	},
	"ja": {
		bytes: 110781,
		sha256: "37f64c62b01fcd127a9fdb5a3e612bc6e33f5166445b7b35118dcba4f96ebd14",
		keys: 1243,
	},
	"ko": {
		bytes: 101647,
		sha256: "adbe10e8a272fc8945a1fb2a145b5e6ce24fda194d0a1cb7f689baf8795ffedb",
		keys: 1243,
	},
	"ms": {
		bytes: 91645,
		sha256: "a0cb4e451cca3893c71e09cffec351ab74cc130b658d33bed7b85a831858e3b1",
		keys: 1243,
	},
	"nb": {
		bytes: 92067,
		sha256: "8924b89f2cd5657bd858e8197d38d21d04458d31f80f7665191680130775fa4c",
		keys: 1243,
	},
	"nl": {
		bytes: 95224,
		sha256: "fea6a65577c50085ce57c000381b8a050782e2b940c040d3ae25cbc447c89edf",
		keys: 1243,
	},
	"pl": {
		bytes: 95500,
		sha256: "786c8fe555c4c2c300ab8194d08c2ffc2e67bba5cd265bbf20b4798b39494de8",
		keys: 1243,
	},
	"pt": {
		bytes: 96741,
		sha256: "4de1951233073e8609d5e70fa1fac950bcf92c419c9d49c117d7c3dea3a2c25d",
		keys: 1243,
	},
	"ro": {
		bytes: 98530,
		sha256: "a30df2d6d5dfd6647b7518f71ba87a35394991827d8993d72120dff2c5783961",
		keys: 1243,
	},
	"ru": {
		bytes: 134308,
		sha256: "0f356237a9553613880bfcd6167d802353f98567c1e721f98d2294725aa3f8e4",
		keys: 1243,
	},
	"sv": {
		bytes: 93235,
		sha256: "cdc772f1520045c4ce2319cc7b3f2b9895f5dbd08c9765fb0ccbc2b8a2d092ea",
		keys: 1243,
	},
	"th": {
		bytes: 159125,
		sha256: "fb8d373ca76be2122fe065f0e82218e8a58313b70a82874ffd7b11ebf0e2c38e",
		keys: 1243,
	},
	"tr": {
		bytes: 94932,
		sha256: "282c3c747463b8c0bad4ebd180758f4f529d481570fcf8570e56f139a7c03efa",
		keys: 1243,
	},
	"uk": {
		bytes: 132146,
		sha256: "c4df69e92b8d7eed30b2ee1c0d6c504c94baa3628f06b35dd728b0687753bfbd",
		keys: 1243,
	},
	"vi": {
		bytes: 105933,
		sha256: "c6c6e9b0bbff003bb459838c79fe7cd231a22cf070e9d4e4df04164751473dee",
		keys: 1243,
	},
	"zh": {
		bytes: 86025,
		sha256: "621613cff0815e1fd1e96d56f9976ef2597226e1cc3ec5f858bbe08fea1fc166",
		keys: 1243,
	},
	"zhTW": {
		bytes: 86321,
		sha256: "62fb1760ce6e3a63bf0acaf3f8173e66ef687aec7751ec0632069fed541bc033",
		keys: 1243,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
