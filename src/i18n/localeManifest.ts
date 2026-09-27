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
		bytes: 84589,
		sha256: "c450cbb25bbfb09810b1f18d7aae2658cb91c79e847319606252f401e1fc6eeb",
		keys: 902,
	},
	"bg": {
		bytes: 101013,
		sha256: "9ecbb0ec511f7af15bc68af2f2e28f6973065af23aa305714a97a2a668d666a2",
		keys: 902,
	},
	"cs": {
		bytes: 68966,
		sha256: "44b221a8ad65b9f3abb53c4753c2d0480d843e35e20d07dd0613e2eaf52eae95",
		keys: 902,
	},
	"da": {
		bytes: 66445,
		sha256: "ca1365f1d8a70b5ca1a8606e2f6eb8156339a8cd2ff1390c82d689022f31333f",
		keys: 902,
	},
	"de": {
		bytes: 73021,
		sha256: "39c899788df3d8f4b598a388a9f60048d9311b3b12d114efa591feaab3d641f4",
		keys: 902,
	},
	"el": {
		bytes: 106832,
		sha256: "72f48e471fcee5c75bdbec34a75b9b0068dc00e64738fadbe7fc7835b5f2f95d",
		keys: 902,
	},
	"es": {
		bytes: 70526,
		sha256: "47709fc1a3553ef50c251de66d0f53c29e1ab1b774135163495b99a1192b2478",
		keys: 902,
	},
	"fa": {
		bytes: 92380,
		sha256: "2874baa9cbac3f5cae340458dc52ec56e0d12b6ad0cc3098e216a85cd948c9ed",
		keys: 902,
	},
	"fi": {
		bytes: 68575,
		sha256: "da45e314bd38fb67bbe530cc71bd2b194d3750b7fd0c157e00ccedc0e4254532",
		keys: 902,
	},
	"fr": {
		bytes: 73629,
		sha256: "2583dafafdd66f35705bddf8e0d280e1c29ac7b96d50a9a028e13ea479041684",
		keys: 902,
	},
	"he": {
		bytes: 83963,
		sha256: "538cab68c3fb3950b4f2ff7aa6556cf73f9cb3f61632d89319607f580e8531dd",
		keys: 902,
	},
	"hi": {
		bytes: 117255,
		sha256: "b4e91939687d3dd703c91ca16f8a2c7d06bd4b9d1dab64e895df61b6695a13cb",
		keys: 902,
	},
	"hu": {
		bytes: 73566,
		sha256: "091bf1a1165078ba205f89cdfb027b652c13f7d3e94b17e8c88de1b341d30d7f",
		keys: 902,
	},
	"id": {
		bytes: 66612,
		sha256: "feeee21adecca631e71e5db8d6f3371d75e860acb7e76baca58db85a6fd9e8e3",
		keys: 902,
	},
	"it": {
		bytes: 70418,
		sha256: "f9cb60129236891eedb87ae6dad474246722b3de6d2ce1e4442ee8caf42e2351",
		keys: 902,
	},
	"ja": {
		bytes: 81490,
		sha256: "d4e67990051da2e556dbf81e5c67daa3ebc7f80b53edc6d30887c459d5d97b77",
		keys: 902,
	},
	"ko": {
		bytes: 74637,
		sha256: "eae874e3de23d57039c9a61113ebe4a5fdd7fcd89514e26fe7221b1c809ce688",
		keys: 902,
	},
	"ms": {
		bytes: 66466,
		sha256: "2b451e9f1b8248be112b280be54a6c935423d1ed32dd3d2bd99f9269ff446f47",
		keys: 902,
	},
	"nb": {
		bytes: 66663,
		sha256: "9f03149795dbd476165237ad5469c8bd8e9c998daab7a12e59de340ea211d0a8",
		keys: 902,
	},
	"nl": {
		bytes: 69313,
		sha256: "88c315344936d6839bc6971437c1962a97518e80d2e88f525bb4d2e6ca084c2e",
		keys: 902,
	},
	"pl": {
		bytes: 69621,
		sha256: "ee32a6301552523447928fc84b2acb3dd0dff2af56e0538288729c6749527bfb",
		keys: 902,
	},
	"pt": {
		bytes: 70436,
		sha256: "a6556a7d1161db830fefec00872fceb2a725b6c664a58394afa40b7345d6d3a7",
		keys: 902,
	},
	"ro": {
		bytes: 71564,
		sha256: "dacc7c3c10acc48dd846c4426849734b3850f2b4550d661b19dfd6e98bb82de3",
		keys: 902,
	},
	"ru": {
		bytes: 99117,
		sha256: "daac5dca9e5dcc4a31639fc84003b8de2e4f5b6e12b0445b99883298a4ea4824",
		keys: 902,
	},
	"sv": {
		bytes: 67699,
		sha256: "2c568402d394317df4a995b580e7393da93e1e0a2a999b4391757ec8766d49bc",
		keys: 902,
	},
	"th": {
		bytes: 116614,
		sha256: "8890a2f2a9b6c9f4c75a00c8fd7745bbde021bc4b99b68e3925f5fc55a9e79b5",
		keys: 902,
	},
	"tr": {
		bytes: 69175,
		sha256: "56d09a08d5b7ce61cb8a741855f3a23c71941c131cc39d8f0d1845c94d93360a",
		keys: 902,
	},
	"uk": {
		bytes: 97100,
		sha256: "dd87c0bdc416ae5a7251afcc8ccb578f5028063ecd7255455998e4f8a5c089de",
		keys: 902,
	},
	"vi": {
		bytes: 77412,
		sha256: "f6c5429d9329bdfb85438a1597cfe910692434872d4c71cf892652d7dcbfb8d0",
		keys: 902,
	},
	"zh": {
		bytes: 62396,
		sha256: "5be62b5de0d5fbcdc8528a17575df4af4c73841fc3f4f671f7ad5500f4f30821",
		keys: 902,
	},
	"zhTW": {
		bytes: 62643,
		sha256: "e016745078847dd78c7207e90329b265dbaba7d811bef129949d2dfdc8cfec34",
		keys: 902,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
