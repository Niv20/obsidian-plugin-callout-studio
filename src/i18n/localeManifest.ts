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
		bytes: 68283,
		sha256: "1ca80a019d739fd8ec88a4d06ba0ea9eb8706d6a7a4eb5703dd5a0edbdd0c9cb",
		keys: 768,
	},
	"bg": {
		bytes: 80039,
		sha256: "26dd885cc565434750cf176ee2a414ca6770438f7dd22d8c77608fa504bb4343",
		keys: 768,
	},
	"cs": {
		bytes: 56173,
		sha256: "249750a9020d8e77271507085cbb1bf60247e855128c80c9b8c4af7f7ca96395",
		keys: 768,
	},
	"da": {
		bytes: 53945,
		sha256: "98a89d784a5cf63cef44d5c585641ae8b722ddaccef199e0b5871625bd516f03",
		keys: 768,
	},
	"de": {
		bytes: 59074,
		sha256: "1169476c5e9012b4456d625b8867e7659f6d5fae0e0de58d2bddb4f5b958190e",
		keys: 768,
	},
	"el": {
		bytes: 84261,
		sha256: "27d145b8645fac3cfb54fd74de6e2570d6f40fc81b0e8b1d7e5ea617ab1bfcb1",
		keys: 768,
	},
	"es": {
		bytes: 57416,
		sha256: "9a71c4b9e2e8c31c95ce1b49b58078b2e344d8a29aac20e349c4a380c92f0042",
		keys: 768,
	},
	"fa": {
		bytes: 73558,
		sha256: "512f455c8f6bae895217281e3e69b7fea8c0583112681a18d6d4223fc821593e",
		keys: 768,
	},
	"fi": {
		bytes: 55974,
		sha256: "642fc720210deaa352ca57c9179dc7a98ba3168f5ae4d0f04df9d081a1727ab5",
		keys: 768,
	},
	"fr": {
		bytes: 59702,
		sha256: "48e6160c0b07a413fd174bb2ac807b89ccc84b68c6e7ee91bcb711439b863485",
		keys: 768,
	},
	"he": {
		bytes: 68500,
		sha256: "313e108043f7f06658ec652283310065c403c4d77a10dc6dc172e1d2d735a43f",
		keys: 768,
	},
	"hi": {
		bytes: 92196,
		sha256: "b403d717e5a40cba9109b5a3e65b0eee9d5564b7a8afa11f271b256b86bd7491",
		keys: 768,
	},
	"hu": {
		bytes: 59559,
		sha256: "c8dc98887335e9385536e762694e3aed5824abcc6b4a6b584cdb4225c29a244d",
		keys: 768,
	},
	"id": {
		bytes: 54425,
		sha256: "534e595eccd0d71ec67a36fa7e1ca552a557e333a8a560c741c9da97954b0f91",
		keys: 768,
	},
	"it": {
		bytes: 57164,
		sha256: "37033dbec1e5360611ea3fe63c5a807a7ec9f4d5b29b44582cea9dc408c6cce7",
		keys: 768,
	},
	"ja": {
		bytes: 66084,
		sha256: "0a1e1eb3b6692612a2c8b07eb302e7c75b0da71d663b5a8034095fd50a9d0520",
		keys: 768,
	},
	"ko": {
		bytes: 60761,
		sha256: "881a089a4eea6077e114d79e50fae5b322da30e889c6efed9f3d29143826afbe",
		keys: 768,
	},
	"ms": {
		bytes: 54279,
		sha256: "ea0acb69d804abd2dfb689777e1ce175c3a5169bc0eb313be36cf1ec5619bd00",
		keys: 768,
	},
	"nb": {
		bytes: 54075,
		sha256: "f26eb691e3fc28008a0403d872b770e0ce38a45490639513d4f18daad6fd6f0e",
		keys: 768,
	},
	"nl": {
		bytes: 56364,
		sha256: "b4b055974284ff654b09e86ce97bec4703b0e7b1396681df422d6157c5e02f54",
		keys: 768,
	},
	"pl": {
		bytes: 56471,
		sha256: "d2f5800fc804a00229bad452fe8fef6bb629cb46e3f52e1ce07e13f128cc6b9b",
		keys: 768,
	},
	"pt": {
		bytes: 57386,
		sha256: "7e8d3cb513e570ab8424051d7055d3a464c0f5b7c7799dab73ab348f938f21a6",
		keys: 768,
	},
	"ro": {
		bytes: 57880,
		sha256: "6f4c332d09b04d3b4644c08b22e83cb3d4d37c5f69f3e267065710b59433da0e",
		keys: 768,
	},
	"ru": {
		bytes: 78774,
		sha256: "0d1a912501109ccc95f1e6f9a5b815b3c2e325c3fe64c752e3e7183609f05ef8",
		keys: 768,
	},
	"sv": {
		bytes: 54997,
		sha256: "c46a61927dbb25f63590c73785366219ca76b2020be594e9b7f1313ac9598ee8",
		keys: 768,
	},
	"th": {
		bytes: 91349,
		sha256: "e760f841b245eba0c9bc34f8a924d362808aaef4d198e3061d8909e5bd7d1c2b",
		keys: 768,
	},
	"tr": {
		bytes: 56272,
		sha256: "fbc4dee86327f398553d688691022a941637d068c46c31768b54f10c6d17e23d",
		keys: 768,
	},
	"uk": {
		bytes: 77182,
		sha256: "92e8b4ab5dc5aa6d2e45544788e3ec0a8f95c90d9df70db466314334b825f256",
		keys: 768,
	},
	"vi": {
		bytes: 62219,
		sha256: "90b81a02aae2428edb1e57e080ab093a8b772412d7b1ffa1a3c45b47a7f9e1de",
		keys: 768,
	},
	"zh": {
		bytes: 51452,
		sha256: "0bef2bd91dda986b67272f17de0bbd9d8561249bb1efd124efef00e4d810a46e",
		keys: 768,
	},
	"zhTW": {
		bytes: 51562,
		sha256: "492457b50b240d37c0829128c8f82bbe0d36864efa1e597b175481af0ecca6ef",
		keys: 768,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
