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
		bytes: 112025,
		sha256: "64c4707a6aef3e1eaf2c3f33033e406ee7118ec2286db37755e606893684f68d",
		keys: 1207,
	},
	"bg": {
		bytes: 133932,
		sha256: "30f276fa1d2e68f4c2293cdfbe27cbb499529a18019d3f25b676c1d14bfc209b",
		keys: 1207,
	},
	"cs": {
		bytes: 91810,
		sha256: "6bc6d8f2145bf59a604a7ab8514891c6812be69387c32bed703838c22225d32b",
		keys: 1207,
	},
	"da": {
		bytes: 88872,
		sha256: "523749ad2a3a8bfcb94c6491156f4523f4ea19a057c7f1b824f1896230a8d3f4",
		keys: 1207,
	},
	"de": {
		bytes: 97164,
		sha256: "b5e27f0f2aea0115defa1cc6efb481f8421656787fd215db3abec87fd7e44bcd",
		keys: 1207,
	},
	"el": {
		bytes: 141930,
		sha256: "6280da6164cd1d3c67d103c256a95e2e3307aa3cd610fbc1e2700ae6c6b18208",
		keys: 1207,
	},
	"es": {
		bytes: 94175,
		sha256: "5ea2cb3580931639e4ed9268c072ae65f5d89edb8884dcf516bca933188e0da1",
		keys: 1207,
	},
	"fa": {
		bytes: 122489,
		sha256: "66b0ffaf2d1cfe54060959249155f48da23f9039b516fa96d43cca69bb004bf9",
		keys: 1207,
	},
	"fi": {
		bytes: 91487,
		sha256: "817e471a66179476161d586855662fad24ed00ebba809ca0ffc07b9d2609080c",
		keys: 1207,
	},
	"fr": {
		bytes: 98640,
		sha256: "fa516c56750fc1e416c9be7b2dad2d82377b332f83a296541d509069b9d2ca5b",
		keys: 1207,
	},
	"he": {
		bytes: 110946,
		sha256: "a314eaacb0e0427bf8659ff333c9e940070fdb3066e93cb7ebc06cddff0008d4",
		keys: 1207,
	},
	"hi": {
		bytes: 155612,
		sha256: "c0d9d2dc366e27ec2d1d572dbd099241e816af4d47a2eabc2b911949e3ef19dc",
		keys: 1207,
	},
	"hu": {
		bytes: 97947,
		sha256: "a04abbcca200ca875247483fd5e771619a6417d23d3afbe7e03ea1f2ba9727f9",
		keys: 1207,
	},
	"id": {
		bytes: 88740,
		sha256: "6fb1d2a5c0dcf068cb712c6165597042b337881ee0d6549901d607f65646c637",
		keys: 1207,
	},
	"it": {
		bytes: 94557,
		sha256: "a514fc4d41b2fb4b1c7204b4573bcf4818e64ec463b028ccb93fd8e89868686a",
		keys: 1207,
	},
	"ja": {
		bytes: 107786,
		sha256: "0f45d2eb08d164fa0e732fbd8c1dec50f79af21f0ed9190ecf24b7de8bf6452a",
		keys: 1207,
	},
	"ko": {
		bytes: 98714,
		sha256: "e6fa90d2e77b52e4d0b752071191e39048240e60c0ebb9c0d5c97ac13e66d186",
		keys: 1207,
	},
	"ms": {
		bytes: 88819,
		sha256: "33ab589ef4077bed086e208807b63ee4090ea9b8f11e9eb3bffa6d61b0753655",
		keys: 1207,
	},
	"nb": {
		bytes: 89438,
		sha256: "ef226f9011708fc1bc960292c32c8d727b5dc7e098319d2df40394f091d49ab5",
		keys: 1207,
	},
	"nl": {
		bytes: 92611,
		sha256: "32241a4b9de665274f22c317d62ba9124d694b02130170122fc0edaa703680a2",
		keys: 1207,
	},
	"pl": {
		bytes: 92792,
		sha256: "b8f58aa3395f7731b60ec5882e54a0ff2b572c9e58618c82b4399730081523fd",
		keys: 1207,
	},
	"pt": {
		bytes: 94059,
		sha256: "e8196b4f4eacf3ab817db7076ecf1e7913879d95ba0c478035053b1e88b1c28c",
		keys: 1207,
	},
	"ro": {
		bytes: 95792,
		sha256: "abff02bc61543a400c447c1452a16132bc6647d3a99b31f85b8daba675548886",
		keys: 1207,
	},
	"ru": {
		bytes: 131125,
		sha256: "58edda8122fab90cbe37fd217ee891263f112274a9ea3d8b34434ac0c46933d7",
		keys: 1207,
	},
	"sv": {
		bytes: 90577,
		sha256: "063a6b0e60410183fe3cfa6f4e59a5cf19a07b58d166d7bd57480d11ae476795",
		keys: 1207,
	},
	"th": {
		bytes: 155387,
		sha256: "db930545f3b2737f9b58da28cb0ae85bb4532053fe3d3cd02c7a47405cb7e411",
		keys: 1207,
	},
	"tr": {
		bytes: 92262,
		sha256: "b00e07a6b4c9e397fa4e16bdb75d77c6804803bf9f7a08b92a862ddd571aea85",
		keys: 1207,
	},
	"uk": {
		bytes: 128961,
		sha256: "a182b7d5f74588f5de0b9d02b8dfcd255b835059aa3d9bd17af5e0e7c5b3319d",
		keys: 1207,
	},
	"vi": {
		bytes: 103164,
		sha256: "da483b3ac796b6d96a1fd78c51fe4e597a5eaec77ca4a136c76d45c4f49fa114",
		keys: 1207,
	},
	"zh": {
		bytes: 83374,
		sha256: "29e5e0da25409bdd8811727e71283c45e32534ad5fab979fec4911e7ce682e24",
		keys: 1207,
	},
	"zhTW": {
		bytes: 83674,
		sha256: "8e3ccf59fb8d3069b60f6d1cd994c7c6124da953b67d39f936cadca3a8a4c3d3",
		keys: 1207,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
