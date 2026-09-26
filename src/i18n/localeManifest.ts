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
		bytes: 84174,
		sha256: "ae54f493bdd11994b3e54b01b2f1030cb874b2433c16f1d19c0017482e48c7bc",
		keys: 903,
	},
	"bg": {
		bytes: 100385,
		sha256: "c00664b3e7ff5945a68f1f96d834bdb2559ad4130c4176ef3d506ae57c1dec52",
		keys: 903,
	},
	"cs": {
		bytes: 68699,
		sha256: "0921724e946faa5f6eea01002cb1003c7c4ccc4dc3563987951ce497cf21bc9f",
		keys: 903,
	},
	"da": {
		bytes: 66164,
		sha256: "4a56d9f42f7c8444afd4635e2c4d01fada6b37688c72a705970dba3d826effda",
		keys: 903,
	},
	"de": {
		bytes: 72657,
		sha256: "8a3aee4a3a0681790ea15aeb31f6953f02d8b4dd5b35820e1ba1877356e9695e",
		keys: 903,
	},
	"el": {
		bytes: 106157,
		sha256: "4d68f297a812c1f737dab3e12df76640f3eb7c60d97544b6420957dba77e3a53",
		keys: 903,
	},
	"es": {
		bytes: 70193,
		sha256: "f1292c1d53615982ff404dcbd1c0b9a5f7543aaf5f9abe65f00e9fbb056aa491",
		keys: 903,
	},
	"fa": {
		bytes: 91817,
		sha256: "e33ce15d03a17c01a952f24f373b25f4cd8a5400c217dc7087354750c539c383",
		keys: 903,
	},
	"fi": {
		bytes: 68311,
		sha256: "1844d53a25f748067a07c177013c01145233bb335fb3df64a1602e3015d96eda",
		keys: 903,
	},
	"fr": {
		bytes: 73262,
		sha256: "ec39a624f9be6a0966f0d2973065f9e0417574255825e6e939f1c463981ed150",
		keys: 903,
	},
	"he": {
		bytes: 83549,
		sha256: "1f1ec975cc3a5c8d586becbaec1a6ebb28b0e14b4b6efa77f2252f0641d44596",
		keys: 903,
	},
	"hi": {
		bytes: 116431,
		sha256: "7e34281c0251f9ab18dc9941f5cb0b59f9ae59faf77270a885b2ce1dc829f913",
		keys: 903,
	},
	"hu": {
		bytes: 73194,
		sha256: "b6d56acf7ec7a35716fc7866edc03011fcbd9867655b5fb29554277962c6329d",
		keys: 903,
	},
	"id": {
		bytes: 66340,
		sha256: "c30ce4a5d03e2debb3451eb1e42ec3b3f6daeb698bb8146f15eacec8b0c6507d",
		keys: 903,
	},
	"it": {
		bytes: 70103,
		sha256: "3df587c9c8fcfb48e6ad33d2eda4f5f00ab98aff38b173a44af40c8b1c7314f2",
		keys: 903,
	},
	"ja": {
		bytes: 81140,
		sha256: "924bcf9beff828d14012be82e6cdec4afa7fa2f8df04c11915466e19b5c0ed96",
		keys: 903,
	},
	"ko": {
		bytes: 74317,
		sha256: "489e3d5a74aa85a5044b9dd1dea40f4a7a60c9f55c83d187591e81e2c0fd8b96",
		keys: 903,
	},
	"ms": {
		bytes: 66188,
		sha256: "36c77640d5a42d053fdfcdbfbacb12efcc73b114edcd2e09a8516735a0a8cce9",
		keys: 903,
	},
	"nb": {
		bytes: 66373,
		sha256: "5f3cc2bdca937dd8e45dc5d2439645d9ba3708da87a86c573f3d534fd516ae92",
		keys: 903,
	},
	"nl": {
		bytes: 68990,
		sha256: "b37adfaa0d956977f8be787fe58b3917d4424a7dc0594c26446cd19382aa6928",
		keys: 903,
	},
	"pl": {
		bytes: 69306,
		sha256: "545f0bd2b9b9f0f02291fea75e8c820f7e24bcaaedda16c81d1d15c5e4b8c03e",
		keys: 903,
	},
	"pt": {
		bytes: 70102,
		sha256: "5281a2ea39d4786a69354026efcb2933d1633c92c92c665a1fb49a7b4949b99f",
		keys: 903,
	},
	"ro": {
		bytes: 71229,
		sha256: "23050ab9dbbaccc11b0307e87142ecaa269df2612e147052e82649540bc52a0d",
		keys: 903,
	},
	"ru": {
		bytes: 98508,
		sha256: "f4b4a233c067142e9c1ff41f0bf31a8ce8fb125c24fd335e8439369298a447ca",
		keys: 903,
	},
	"sv": {
		bytes: 67396,
		sha256: "98fcbc7d1a4a34db4f4b1f5f2ad9945347e042d5b2d249056cc5e13e5b504495",
		keys: 903,
	},
	"th": {
		bytes: 115949,
		sha256: "40444cd4f58e744f0feb5d6615b9b8fafe01b9527f35cd60599894b924eb4295",
		keys: 903,
	},
	"tr": {
		bytes: 68848,
		sha256: "5be318d12d660639880bd3d2d196b24284c86353dd0bb50e6c4f505be46543dc",
		keys: 903,
	},
	"uk": {
		bytes: 96520,
		sha256: "dd6fa3906c10df0591b79713795787950941d2f369ed6c2842790d9718f2d534",
		keys: 903,
	},
	"vi": {
		bytes: 77043,
		sha256: "d60cf57b2a277afd7ca9d14373a228e83661454676a5b74d503a67d7ba2340a8",
		keys: 903,
	},
	"zh": {
		bytes: 62171,
		sha256: "fd7e335e25e5bf449324d28f5e8c181eaba1117c77eea76764be7531ae2d47ab",
		keys: 903,
	},
	"zhTW": {
		bytes: 62412,
		sha256: "b153c28b622ffcaae37c10baced2a26a1158b9a9812b26fcf5b303ed5f3a7eb7",
		keys: 903,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
