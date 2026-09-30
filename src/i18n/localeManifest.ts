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
		bytes: 110758,
		sha256: "095564a55837654f715659d65b02ae01801a1ffc11ffd7d20b4c9285aee499de",
		keys: 1180,
	},
	"bg": {
		bytes: 133147,
		sha256: "982a99e9a8d534ba98f345d7389124f52c339577d0a0be68b20e2fa5276763e8",
		keys: 1180,
	},
	"cs": {
		bytes: 90959,
		sha256: "dcfcd0d618005fb60cc0550a8423f5b47f9ed67d766e858c6113e96a883fdd68",
		keys: 1180,
	},
	"da": {
		bytes: 87744,
		sha256: "72f492e7418dd2394d156ed22fdf3ed0af565fd2edda7a3bc34de97d4d7c2e2a",
		keys: 1180,
	},
	"de": {
		bytes: 96052,
		sha256: "946ef89ab43302176fb39e14906fce34947f9b798e4d6939df4ce32aaa7796d3",
		keys: 1180,
	},
	"el": {
		bytes: 141131,
		sha256: "c677fb1f3ed34f9ba4632b53213c70850f920aca129d261592462a1535fb1c3a",
		keys: 1180,
	},
	"es": {
		bytes: 93284,
		sha256: "a230b2f4fdcc89b4b626d04e7b62a9a0fb35a7ac5fd15fa7093287ed7a33216a",
		keys: 1180,
	},
	"fa": {
		bytes: 121019,
		sha256: "2787ddae5dbe8545a362015796029c91d011be780347dc4910d5818606ce8e4e",
		keys: 1180,
	},
	"fi": {
		bytes: 90515,
		sha256: "53a4ad68c13bed3d6dca3cb32487f1bc720c25489db9a51b3e35ca26677c80b3",
		keys: 1180,
	},
	"fr": {
		bytes: 97339,
		sha256: "4270f55b9d7cd60d6e7f442eb6d7d2fc812868ce87270f768f19c7c27dedfc47",
		keys: 1180,
	},
	"he": {
		bytes: 109849,
		sha256: "15cb213db19b79ecb27c0885eadc36a0ed217f2e1c690f98113126728a9dce26",
		keys: 1180,
	},
	"hi": {
		bytes: 153733,
		sha256: "6f78ed4207916225ce281d360c81d637fc35368c8b63d33529af728fa4327984",
		keys: 1180,
	},
	"hu": {
		bytes: 96980,
		sha256: "d79f4a576239be46860f37d51c2762dd03bf4a89fade2697dfda8c2ae82963d7",
		keys: 1180,
	},
	"id": {
		bytes: 87997,
		sha256: "5643c970ae860a37719e469278a30fdac4a149b697f3c4c60b91b079b73440ac",
		keys: 1180,
	},
	"it": {
		bytes: 93795,
		sha256: "f4e99180993dda4425fe66bbb9e0fa5cf4dae2ab91168094b08770fb2de87b35",
		keys: 1180,
	},
	"ja": {
		bytes: 106554,
		sha256: "3e21a458432ca5d6aa3da9ac56dd2463673b860d8aa0c4209d6fbc5a7a54c80e",
		keys: 1180,
	},
	"ko": {
		bytes: 97367,
		sha256: "c9dc07fcf3ef834f4327affd221564d9fa844aa8db2717039346f3b3cf80105f",
		keys: 1180,
	},
	"ms": {
		bytes: 87675,
		sha256: "a7b5e1f13295ff2c0424d66a5e44f309c77f6973ab479615e6e8050ef2bcc2ab",
		keys: 1180,
	},
	"nb": {
		bytes: 88204,
		sha256: "de82fea5812e78bf2c00d947926e5e70aa15a0a2c434b66329931434926f1c54",
		keys: 1180,
	},
	"nl": {
		bytes: 91338,
		sha256: "01b1ee6c70fc170ff1ebd6f3b9cfeb7b62b9c2615c2f31bf98d282032e91039e",
		keys: 1180,
	},
	"pl": {
		bytes: 91961,
		sha256: "34ea8dddea961c6c99856ed3fe2f9585e5fa29efe0fd74882077beaf095847c8",
		keys: 1180,
	},
	"pt": {
		bytes: 93113,
		sha256: "a182008808f6ae0338f73e1951e7316cc5d11ce813a65f7b4c5f2bcd0f194511",
		keys: 1180,
	},
	"ro": {
		bytes: 94675,
		sha256: "114a23747c2b8ac53af0d984dce0f4a94f7d5f4ab7986a35fac0361f38faee17",
		keys: 1180,
	},
	"ru": {
		bytes: 130361,
		sha256: "3cbc2b20c06ee8a61fb17a6d5dc13ab0b99d894ce1bc5e2c2ec8332f5c55de55",
		keys: 1180,
	},
	"sv": {
		bytes: 89470,
		sha256: "4bb498fcdafd8d980956925706779ee65ee5c39f1ae8f5a842381f0e63eef1af",
		keys: 1180,
	},
	"th": {
		bytes: 154855,
		sha256: "37db567c985f519625cb0d2d75f36663450e4e03f4ee0fa115ea721ddde1663f",
		keys: 1180,
	},
	"tr": {
		bytes: 90979,
		sha256: "bdc0f205db058e2b5dfc3ddf40427ffb878cf3a061148c0c250ec545acf81827",
		keys: 1180,
	},
	"uk": {
		bytes: 128307,
		sha256: "3205d9148a9fe59219984ac12ae0ce2184fd1833af49db1b91600dc02ecc1136",
		keys: 1180,
	},
	"vi": {
		bytes: 102357,
		sha256: "07cf890b33de1d370ea44dcb178b48ea2070782da0f144d6aa1bcf6814e6d29c",
		keys: 1180,
	},
	"zh": {
		bytes: 82376,
		sha256: "72302941f195f2878a93eae21428fb9063533e9b1c2719ccf3576c45936a2d4e",
		keys: 1180,
	},
	"zhTW": {
		bytes: 82674,
		sha256: "3afd7c64f7dd85ea0bcbc98ded7d3a1db40dcc834c006e13438c7b5d41e6a473",
		keys: 1180,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
