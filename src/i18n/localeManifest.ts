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
		bytes: 115864,
		sha256: "283c5bbe4beb527febf2506d8bd945921a2ca8a7dc920aa4933b6cd4f81f0e60",
		keys: 1242,
	},
	"bg": {
		bytes: 138449,
		sha256: "a4df157caa17d64061dd1709a8349442b84f374641a17282e8349b02219c43e6",
		keys: 1242,
	},
	"cs": {
		bytes: 95024,
		sha256: "ad5fe85df1168976192048aa4422dc27bf92b4160f8af8f25192fbe734a36fce",
		keys: 1242,
	},
	"da": {
		bytes: 91845,
		sha256: "6a867ad1bd67668c3b8fa7dea357471b511b4a041b5216d29588a22196448e1c",
		keys: 1242,
	},
	"de": {
		bytes: 100448,
		sha256: "7263f3dc0fb7e79fc5a96742bb4d27189281725aa87ab55bb88e074b5e930c3e",
		keys: 1242,
	},
	"el": {
		bytes: 146455,
		sha256: "ed314b1dc772a10924773df7feaf87e5af9e6709f1195d2a6447307d56385981",
		keys: 1242,
	},
	"es": {
		bytes: 97246,
		sha256: "57599fe3e280ee05fb0e59ca0c9a3cec951486673d6a9dd6549fc2b47a991e23",
		keys: 1242,
	},
	"fa": {
		bytes: 126990,
		sha256: "8ca3d4a0bc2f1bad10a850a522118446b088866dfe4c15cd952b5d8f75597a86",
		keys: 1242,
	},
	"fi": {
		bytes: 94693,
		sha256: "de92a4a56c2c76d1ddb0241b9847ea9b59020ba125c5cb38104acf8cdc7667ca",
		keys: 1242,
	},
	"fr": {
		bytes: 101829,
		sha256: "a47d03e274165e12d2606d6f2cce2d1f0cc415724c06fe67907da6cc5a2f02a4",
		keys: 1242,
	},
	"he": {
		bytes: 114753,
		sha256: "ca6088b3678453f3b014d103eb245f978551208242a81c460fda47a82d8dd8cd",
		keys: 1242,
	},
	"hi": {
		bytes: 160821,
		sha256: "bcad64e60542e97c278847dead0940761c49e420f87ada6664b9cd6a308ad82c",
		keys: 1242,
	},
	"hu": {
		bytes: 101465,
		sha256: "8c183cecf505b406f9ec9586a58dd9db1adf0f4fdcbd1eaf9d1b2e611a821e3a",
		keys: 1242,
	},
	"id": {
		bytes: 91869,
		sha256: "3d196933c5d45309197762af49eaf064304f6afc92c1aa943cb4d0ce7b3fb8af",
		keys: 1242,
	},
	"it": {
		bytes: 97643,
		sha256: "77aefa69c77f55a62bb7b00076bffee5233006dfaee73cd1ffe818fb7a830f56",
		keys: 1242,
	},
	"ja": {
		bytes: 111321,
		sha256: "897594067a38805b79b780bb42e425ca6abeeb32dfc7ce190cde01326f036b39",
		keys: 1242,
	},
	"ko": {
		bytes: 102160,
		sha256: "aa4ac90f7a34510518687d8fce2a05a8a5c3146ca2a69917c21d147dc9c6643c",
		keys: 1242,
	},
	"ms": {
		bytes: 91969,
		sha256: "924fa4f2777f2dc315e8d1519b0a178e628ac37ee6e00953ee632b78dd510fc8",
		keys: 1242,
	},
	"nb": {
		bytes: 92448,
		sha256: "5f2d1443dea72afb82bb51e45c9782778441d88121d96ef902df64a60223e5ab",
		keys: 1242,
	},
	"nl": {
		bytes: 95674,
		sha256: "456102c28068708c2463876ce60915af97b989d95f59d84b0ada1282f04a75be",
		keys: 1242,
	},
	"pl": {
		bytes: 95933,
		sha256: "d9c5086407e9cfe9f16fc138a6f0092d18359b73e36451258923805d338ce134",
		keys: 1242,
	},
	"pt": {
		bytes: 97171,
		sha256: "c7a2c72d691849543a51139dbf887166d574fcb9d56f4b08dd9ab639744bc5f3",
		keys: 1242,
	},
	"ro": {
		bytes: 99036,
		sha256: "634c7c9f18d002d16973672056434f89a559f66dcfb4923a6cfd30cab671b0e5",
		keys: 1242,
	},
	"ru": {
		bytes: 135338,
		sha256: "098667f816355ccbf3885d59d2c6f0301704daaa4b2e01e82b66e8d9dc842079",
		keys: 1242,
	},
	"sv": {
		bytes: 93650,
		sha256: "772223b4bcf858bcdb8b06a626a080da5852ff5381cd828f5749dfed1fc79ecc",
		keys: 1242,
	},
	"th": {
		bytes: 160470,
		sha256: "5510c76f023776a81f8788a00468d43e8c0fbfae24a39983e832378a20f85571",
		keys: 1242,
	},
	"tr": {
		bytes: 95453,
		sha256: "9fcfc2a651d0c778f2bc9fd8cbecc7859a845fec03f26c2332e91cbb9712d11e",
		keys: 1242,
	},
	"uk": {
		bytes: 133035,
		sha256: "f32e37ca554e2dbce7c49a15139f6e45505601499f71be434cb608e28eb0899d",
		keys: 1242,
	},
	"vi": {
		bytes: 106506,
		sha256: "7f52998ce2212aa737e0a716992868ce72ce23a9d9d996067ff86a3cd31f3b5f",
		keys: 1242,
	},
	"zh": {
		bytes: 86311,
		sha256: "31f04cc61325b80407639a57625e7c328cdfbeff529d1e2ef61bf395f19967f5",
		keys: 1242,
	},
	"zhTW": {
		bytes: 86628,
		sha256: "90dcea0c42c1db66ee94e476515a320ba9b0f854a1c35d31a630f5fb9ac9ea0f",
		keys: 1242,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
