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
		bytes: 68780,
		sha256: "c101ee0ec3e99eab3ff0428ffa6502f4d976a9b1afc444df2377b00d73d8ac67",
		keys: 770,
	},
	"bg": {
		bytes: 80720,
		sha256: "532a68637f7c57386b794515b6fb3212ff41322affcd6b736ad6bee57c55576b",
		keys: 770,
	},
	"cs": {
		bytes: 56592,
		sha256: "be8ff24b7d5302ba46cfdbaed97c181df7bcdb842f53f110c4993dc381627d93",
		keys: 770,
	},
	"da": {
		bytes: 54341,
		sha256: "d5c89a87727a37417b5d0c62e20626a276b361857b192648aa1af7788a3ee4e1",
		keys: 770,
	},
	"de": {
		bytes: 59550,
		sha256: "d1ff8351b19e79002148eaf1355ff376b8fa8303c760ad38a1fc0a7e8b9e1d77",
		keys: 770,
	},
	"el": {
		bytes: 84941,
		sha256: "874b6f717d7db42722dcab8b3cca2c1be96948e219d814ab4021fef4025a79d3",
		keys: 770,
	},
	"es": {
		bytes: 57827,
		sha256: "44f416d5e0a80db60732bbb55d9dc094c0645dc8f2ac9de994fafb2aeab69f9b",
		keys: 770,
	},
	"fa": {
		bytes: 74259,
		sha256: "695cbcbd2781e4a5e150c943b5b2d0209f303cd3c49187a0ab7ce1921f8b896f",
		keys: 770,
	},
	"fi": {
		bytes: 56408,
		sha256: "2e673270916642b8f7f8925baeb7665fea3282275e884a30c2b1a85b8143c824",
		keys: 770,
	},
	"fr": {
		bytes: 60170,
		sha256: "f3f536dfbd87fd32796d595de42000cf8015a4fd54100dcaecfb4e2173577616",
		keys: 770,
	},
	"he": {
		bytes: 69056,
		sha256: "164707f6324364690cfc9e2d72f583c4ca2ae209985de2d8e6b0f3f9f2b0c35d",
		keys: 770,
	},
	"hi": {
		bytes: 92937,
		sha256: "42e5f3d18948e85a79312f3443207eb752d092eb548bd85244a1d8e0395a4f0e",
		keys: 770,
	},
	"hu": {
		bytes: 59930,
		sha256: "a652fb27e0aa9c65ba9ad33eb4fb8f2984ed2d834a5fc62d7a611eeb39886bc4",
		keys: 770,
	},
	"id": {
		bytes: 54854,
		sha256: "16020247aad1b1d6bd5f44faf4aae111b9430eedf77bdec00d4aef1766acb46c",
		keys: 770,
	},
	"it": {
		bytes: 57565,
		sha256: "ceb67346e7477c2b335c275c0e962f8c2b8dab80c70f57c34c9c16ba394b0f51",
		keys: 770,
	},
	"ja": {
		bytes: 66567,
		sha256: "1f97d10d6fbeca3853d5f8118906a346e3f61ef5a8e2b43aa362d256c581984f",
		keys: 770,
	},
	"ko": {
		bytes: 61218,
		sha256: "274c537e6b539a5a1f5ab214404c39f87db18d2086220287dbbc8175f68a67aa",
		keys: 770,
	},
	"ms": {
		bytes: 54707,
		sha256: "142968e469a42d2d620613bc560306293d91d93278a8d4ae78751d35813bbce7",
		keys: 770,
	},
	"nb": {
		bytes: 54486,
		sha256: "aa21e53f8e91aa36199b6e084f8bc386c9118e68ba54a92d608c26d9daf9a250",
		keys: 770,
	},
	"nl": {
		bytes: 56822,
		sha256: "393f182497cec965ef0343b11561d1ecb5b409d6e4de5f3673ad86afb069657a",
		keys: 770,
	},
	"pl": {
		bytes: 56916,
		sha256: "14860d162b8b2b32dbd48bae3a1f60be13b46597e6ed050160e533b2d32e54f8",
		keys: 770,
	},
	"pt": {
		bytes: 57780,
		sha256: "18236615aa6f3aa5875cc2a72f640473bec68b0d7eea0d71b949b7cae431f481",
		keys: 770,
	},
	"ro": {
		bytes: 58290,
		sha256: "642eeb219c1510583559a1d68bd6c31d6004ea95b3b73778ad0e1235d20e7bf8",
		keys: 770,
	},
	"ru": {
		bytes: 79418,
		sha256: "f85dc6f04cd5f6f9bacc3eeb6d7a75c9e7bfa837f149a933e51987b86bef3371",
		keys: 770,
	},
	"sv": {
		bytes: 55400,
		sha256: "e33ebdaf0c1ba6ef9ee50d4d4074be68204fb11c88642c03eb3dd8aaee045245",
		keys: 770,
	},
	"th": {
		bytes: 92180,
		sha256: "c8c3e855f87d020037bddcc253a7491e9afcc57719f9786798b5b321c6a1ceac",
		keys: 770,
	},
	"tr": {
		bytes: 56660,
		sha256: "30524ee44cfa7e7c538612570e882016c4eea981bdf03efde34106bcb18b9738",
		keys: 770,
	},
	"uk": {
		bytes: 77846,
		sha256: "b6ce8348d0137dd87e458805a96d4841e2cb5d794332eae8b21a556f5b88d5f4",
		keys: 770,
	},
	"vi": {
		bytes: 62702,
		sha256: "c7f2a00c836a913a20d5e8f4aead96c01335c00647ec0f865ffa056e2440ccb3",
		keys: 770,
	},
	"zh": {
		bytes: 51859,
		sha256: "9679a1d58ac0e6d2a3893b76f7e58b89adb5f8bfde46657b4c22c08613881d32",
		keys: 770,
	},
	"zhTW": {
		bytes: 51966,
		sha256: "b7c3d1b9196e51a8939226063a15344f786e763a4816f229b171d6efe31c95de",
		keys: 770,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
