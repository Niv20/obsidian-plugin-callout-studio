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
		bytes: 106918,
		sha256: "15cf4f60053b068642f773af23f4ec7a36fa3c7dd435af24ec0d5c391066112a",
		keys: 1154,
	},
	"bg": {
		bytes: 128715,
		sha256: "d112a9be81aaf5ce8bf600d5c1c95403619a01c7f36946027f1e82ae94dfc528",
		keys: 1154,
	},
	"cs": {
		bytes: 87961,
		sha256: "ffa9adc812b37d283241e688bbdfc84e1d267b75293047ab538ebc1e0d0f4fe8",
		keys: 1154,
	},
	"da": {
		bytes: 84668,
		sha256: "c138c47e583fa3d8a49e0fc8864822a40346829e03f73d7ba83db2291197c2bf",
		keys: 1154,
	},
	"de": {
		bytes: 92891,
		sha256: "3041acff52a3e0ff45005b5c0c228f71a81c8c77a5a62295c844f25bd35596dc",
		keys: 1154,
	},
	"el": {
		bytes: 136154,
		sha256: "90d3f68211364d65e767fdd376345e560bc223ba168d8eb2bee891e57b325e16",
		keys: 1154,
	},
	"es": {
		bytes: 90303,
		sha256: "51494415d4b06c8e292d06f8c61c4d5c6b98f089fa62feb95fd1b5c7d87d2b09",
		keys: 1154,
	},
	"fa": {
		bytes: 116708,
		sha256: "a6a47539cda64d583aff019ca91b7616c4889407afd00a49e444bb5480e43dbc",
		keys: 1154,
	},
	"fi": {
		bytes: 87571,
		sha256: "c9f7ac8bd500338e0e269b6f02655b6f49a7999c7ee87078eb3618971239415d",
		keys: 1154,
	},
	"fr": {
		bytes: 94141,
		sha256: "93e36438ecd41d75c0c636e036d95ad8359ec52b339ab1f54a04efd74d6f3b7d",
		keys: 1154,
	},
	"he": {
		bytes: 106072,
		sha256: "41fbf64803b47a753d9f3d23141161ae4fd19350d7b4188dac96d500ccb89c78",
		keys: 1154,
	},
	"hi": {
		bytes: 148159,
		sha256: "8418e48cac03bb299f5fdd093f9265c34a075127786e7258d19d45e50385bd51",
		keys: 1154,
	},
	"hu": {
		bytes: 93746,
		sha256: "486fd3c274878d2806a279e1313892e771e5a2dfbbae855940995fa667d297de",
		keys: 1154,
	},
	"id": {
		bytes: 85093,
		sha256: "b158cf1f8db8e112942608d019d4a8463819dd7574186854149f60f638bb41e8",
		keys: 1154,
	},
	"it": {
		bytes: 90754,
		sha256: "1a9cdf9b0f50fe7d32b6bbcf6915f1fd4a10e74262ee2e01d70fdc543a9cff70",
		keys: 1154,
	},
	"ja": {
		bytes: 102952,
		sha256: "fb4f0ed084005d7994b133d4548b6103c86fa93f63af9917d7a92a03fa649b8f",
		keys: 1154,
	},
	"ko": {
		bytes: 94068,
		sha256: "247e6ae54a177467e287736cdb4a8d269f6f3dee03a841d9f8e9f2bc29837060",
		keys: 1154,
	},
	"ms": {
		bytes: 84753,
		sha256: "4f4723f0e103d3494e19132c39771be1480e99b6b0e1a4b57ddce1ab3084af2a",
		keys: 1154,
	},
	"nb": {
		bytes: 85161,
		sha256: "d4b913c5650f0066d2fa2d202fbf1500b8e36a2f4d21de9f99a9b7ac8fb49c9b",
		keys: 1154,
	},
	"nl": {
		bytes: 88407,
		sha256: "501d5f37bf30924141d9c9fb2ea64da9bc3e5587bbbe234a46ea4695f6c23703",
		keys: 1154,
	},
	"pl": {
		bytes: 88946,
		sha256: "db00a976758cb84b4cdab246509f600544438ad29e98e8e4c74540af75b8ea48",
		keys: 1154,
	},
	"pt": {
		bytes: 89974,
		sha256: "e688d60d0407c098611e42ae882023aff6c6e13f6147592d3c6237535bd945e7",
		keys: 1154,
	},
	"ro": {
		bytes: 91453,
		sha256: "71301ecf6cd31748463d107ebe9af0250bff88ac0c7f05cf570e3d64274cff6f",
		keys: 1154,
	},
	"ru": {
		bytes: 125947,
		sha256: "65e1729976ac38d48faaae7cf4c2418737a1e002c70d68eb49c324bc636fe75f",
		keys: 1154,
	},
	"sv": {
		bytes: 86408,
		sha256: "9a8670c650cbd986d3508b5bd722bdfb669cb5af87ec678cc0d755479be7d754",
		keys: 1154,
	},
	"th": {
		bytes: 149316,
		sha256: "5a61a26f9aea3a516d5cb7579a67ef0c1d607eec79678abb2bbb9bddb0f58565",
		keys: 1154,
	},
	"tr": {
		bytes: 87945,
		sha256: "727f2d347c1a6c558bead73fe21682a97bd868500ab84a220817f2937689cbc7",
		keys: 1154,
	},
	"uk": {
		bytes: 124012,
		sha256: "ba0df8905f3538f0682caaa92181fbb5748f0cb98815891fc6395af7542ab2a1",
		keys: 1154,
	},
	"vi": {
		bytes: 98984,
		sha256: "b558e036e74a10be94c343caba072f71850801e5abd516f5528c144a6d330395",
		keys: 1154,
	},
	"zh": {
		bytes: 79507,
		sha256: "f0da44144fbb54f1e7055728f5c616364778c0dc62bed6855ec4c14c5faf0317",
		keys: 1154,
	},
	"zhTW": {
		bytes: 79820,
		sha256: "40ccdc3b0016bfd1329c2e24305a6c7adedd5fa14a4a8bba4e00a30d30898816",
		keys: 1154,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
