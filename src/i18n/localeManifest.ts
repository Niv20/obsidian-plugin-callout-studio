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
		bytes: 110428,
		sha256: "ad549007e1959b2c0cf55bb386746451dea209499f7bc85cb98c28da591e131a",
		keys: 1180,
	},
	"bg": {
		bytes: 132717,
		sha256: "e758e491b10da0f33bf4fabd0a37796703f58359c73f62a2c92a4bd47c968c2f",
		keys: 1180,
	},
	"cs": {
		bytes: 90668,
		sha256: "e821f0260e98eca4fd7acf91577124c297f0a30657b6807ef087064cf9a1d739",
		keys: 1180,
	},
	"da": {
		bytes: 87555,
		sha256: "e37e6ef8fd731905bb5dd1a70824b749b319e33b7e2cbc36827a39c5cb190288",
		keys: 1180,
	},
	"de": {
		bytes: 95762,
		sha256: "524c887482e1e476f0978b94779657c7cfce9079d77f14451c4c14efb8b0c1e4",
		keys: 1180,
	},
	"el": {
		bytes: 140662,
		sha256: "797bca93e1b0ba1f15aa3f9d92ebf5feeb30d623efc74e9f392a9760dcc9f1bf",
		keys: 1180,
	},
	"es": {
		bytes: 93114,
		sha256: "8831b0971137712e0e7dd7dc0723007692c675de1625205ab833fa03547348e7",
		keys: 1180,
	},
	"fa": {
		bytes: 120461,
		sha256: "7f97f0c39ac939fbec5a3f9bb5bd6ab7dc57c96cf697baaedf89a3ea5b7602ec",
		keys: 1180,
	},
	"fi": {
		bytes: 90265,
		sha256: "aa5c980ac00913f6ef3bd93523f4e4d1c193c911e3e50f097e8971b3a04e7047",
		keys: 1180,
	},
	"fr": {
		bytes: 97123,
		sha256: "1914b639c6dad44798ca2acb60fcbdccbe3e0bdad1b2e009d3b9a761ebd9d705",
		keys: 1180,
	},
	"he": {
		bytes: 109394,
		sha256: "9ac98213e233924a9a07303a31959329275d2e67d13ef44de4d59161fc545d84",
		keys: 1180,
	},
	"hi": {
		bytes: 153027,
		sha256: "d92428fb4ea8eb082e9e8b128fc258e77f2ce2789cebe8a55470b9efd09c6044",
		keys: 1180,
	},
	"hu": {
		bytes: 96648,
		sha256: "f7b83555a041ba77812f274835ace1f16fd0d1f528dbe47f3f50826bacf63d83",
		keys: 1180,
	},
	"id": {
		bytes: 87710,
		sha256: "88afa1ffa092b148cdf4f36f478bb0b48d7b58d91680617c606c56926fedb1cd",
		keys: 1180,
	},
	"it": {
		bytes: 93529,
		sha256: "480648df6e996b8d584ff183713a648de9356c8e30bf8e1dca4fb28545257351",
		keys: 1180,
	},
	"ja": {
		bytes: 106062,
		sha256: "6c384ec3f8b0b35734cfe915e6ab793530afda26fd0e108bd94a15b925823295",
		keys: 1180,
	},
	"ko": {
		bytes: 96980,
		sha256: "a845d105f385812312b9649097d90f544d91517d5a4d7c5adee7a5467d1bf62d",
		keys: 1180,
	},
	"ms": {
		bytes: 87450,
		sha256: "d869e6555cabac39b17cb620de8e8d4411e682ab3f60cf1703410f663e0918e2",
		keys: 1180,
	},
	"nb": {
		bytes: 88079,
		sha256: "a0b30026c6acb7e1aff456424c6ebd8da35d7333bd2fe5dc8a72f016c458c376",
		keys: 1180,
	},
	"nl": {
		bytes: 91107,
		sha256: "632a28d33b6d08bf1a24cdf49409697a1f04ca99eabd03f43eb7bb81a4bb8ae6",
		keys: 1180,
	},
	"pl": {
		bytes: 91720,
		sha256: "6f87ddcc7aa1d25de54012c9ac9137a3bdcc3e40a10218ce4f680d3481bc8834",
		keys: 1180,
	},
	"pt": {
		bytes: 92824,
		sha256: "c2d53f42f0315cd9d8141d345206a38f164a564d5f2e7283534c88ef6f7709f0",
		keys: 1180,
	},
	"ro": {
		bytes: 94502,
		sha256: "5303bc1691444885a5746023dd71485fc581ccc6c681d3d4387c29ffaff33517",
		keys: 1180,
	},
	"ru": {
		bytes: 129951,
		sha256: "85129ba0f53ea04ba9e1705760008db10b5128e6753ddd52500073c9b38585cd",
		keys: 1180,
	},
	"sv": {
		bytes: 89261,
		sha256: "d0e0facb8817bd2f5544107dfd36c2d84bcbed1b822d6ce894dea964ec65dd6b",
		keys: 1180,
	},
	"th": {
		bytes: 154560,
		sha256: "23de8451b0b2832f20a42e759be168449bd6946ea96b116049a8e6e55db03837",
		keys: 1180,
	},
	"tr": {
		bytes: 90718,
		sha256: "e46a584b4eff8dc7e5caee1dc62c8ffd42bf622d4ad80ff7e38abf27095359b0",
		keys: 1180,
	},
	"uk": {
		bytes: 127945,
		sha256: "8e39b8649145dfa1f9925b6e2bf82c846bc13f13a7865d6dd1d5a289e348140b",
		keys: 1180,
	},
	"vi": {
		bytes: 101997,
		sha256: "552490f1b1df4faa6473ff77d0a7e962d81f76b7a6ddde2d8bf7ce09084f00f2",
		keys: 1180,
	},
	"zh": {
		bytes: 82151,
		sha256: "68a4008133ab4d88335cc46bc7c06cde7de95d1d3cf0b49e1a10d01a0bad4a7e",
		keys: 1180,
	},
	"zhTW": {
		bytes: 82456,
		sha256: "b8a2b3db0ada97cfd7d1f8ffb01e949b665c17e4d26e1e89d322ee9a26fe8c26",
		keys: 1180,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
