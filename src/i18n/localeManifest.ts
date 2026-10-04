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
		bytes: 109493,
		sha256: "cdfc2b19a368441a222ff596becf7d45cd6881e27929d5fb3598903312880280",
		keys: 1184,
	},
	"bg": {
		bytes: 131144,
		sha256: "d9f3cef29d7664e764a6c6e5f1fec4d0923e7074a1f8a545a3a963fd6f9df093",
		keys: 1184,
	},
	"cs": {
		bytes: 89794,
		sha256: "43b2a498573d0905f5df00f1b22ab322fcfc97c198baa3bd83f2d83ad5a75776",
		keys: 1184,
	},
	"da": {
		bytes: 86992,
		sha256: "a2ade76c1d830865559392fd07dd96736ed54997b35606ecad3660d18b4bdb90",
		keys: 1184,
	},
	"de": {
		bytes: 95137,
		sha256: "8d389342de28b4a53804078f12b5859a9dfa397b2b061fccd62ba64b7e3177bf",
		keys: 1184,
	},
	"el": {
		bytes: 138844,
		sha256: "d3de8150f11219e8bef04c47835369b4b42915f55a86980aa1b02940d711ff12",
		keys: 1184,
	},
	"es": {
		bytes: 92104,
		sha256: "006ae80fc54ccf9b3bddc9b3a21c7493776610ef919818ed1d90238d6fad8e10",
		keys: 1184,
	},
	"fa": {
		bytes: 119607,
		sha256: "0379b741bd5761c2ef0c69e19645b077f83a088742791c92f38173955580af17",
		keys: 1184,
	},
	"fi": {
		bytes: 89439,
		sha256: "ddd09d720d31d2f818edcbf90eac4ac606770910dadeee2187eb9ddc424402bb",
		keys: 1184,
	},
	"fr": {
		bytes: 96531,
		sha256: "8c027e89745761ec6abaab700190d76a6fc6328deb1b47e7240998673580057e",
		keys: 1184,
	},
	"he": {
		bytes: 108404,
		sha256: "274f2d571b881182574ebd74463f6f8df0f7ba679d2fbcecaced08049e0f2058",
		keys: 1184,
	},
	"hi": {
		bytes: 152004,
		sha256: "d114d12d45f7efd6d6b293fcee5b77dc8d75859c1d8d596a4128b3886571ab13",
		keys: 1184,
	},
	"hu": {
		bytes: 95819,
		sha256: "3a79efc1be2ba42739840de5f60d23f66c230c112176449d4c2d7460d2149c8b",
		keys: 1184,
	},
	"id": {
		bytes: 86845,
		sha256: "e6d1108321d770895b08e63b7e6c582fc4087384be7baae7602fa46465c3937e",
		keys: 1184,
	},
	"it": {
		bytes: 92578,
		sha256: "93bdecc6b36bfe0588464fe33a636606db5762849b11f717a342c568e74cc5b1",
		keys: 1184,
	},
	"ja": {
		bytes: 105293,
		sha256: "831e8b7c7ac3d7e49c2135864d6ea053b75d22d543f748c8641b2d64699be4ff",
		keys: 1184,
	},
	"ko": {
		bytes: 96414,
		sha256: "57cd31e173850c24fe7d878d1d40420d335365520918effc680d6645077a928e",
		keys: 1184,
	},
	"ms": {
		bytes: 86888,
		sha256: "a17da17cba29bab7704300db3887f02a83bf877c29b11d049799c6caeef0cc4e",
		keys: 1184,
	},
	"nb": {
		bytes: 87466,
		sha256: "0ea1c8731a6afb65a34889df37613215bfdaf62d77d8bc3bb3e528efb3771e08",
		keys: 1184,
	},
	"nl": {
		bytes: 90683,
		sha256: "7e1b82be1a55b5e48679d80561169c9d2273cedcfff5ea37f5e280f54f5005e7",
		keys: 1184,
	},
	"pl": {
		bytes: 90769,
		sha256: "d6a84ad2fb1fc047d825368f22013a2ccec968aada5553d2145873590daaae7d",
		keys: 1184,
	},
	"pt": {
		bytes: 92031,
		sha256: "24153a208d89206d975f2f44027243b65d77666a1e18aa11777829c7442e11bd",
		keys: 1184,
	},
	"ro": {
		bytes: 93724,
		sha256: "e610e5dcb64d9668bf29227aaa319be6ddf3ede53f6dca48ef374b5a718a773a",
		keys: 1184,
	},
	"ru": {
		bytes: 128361,
		sha256: "be07cdb047638326a66146b7c8a7e70613cd6e7b3215b205d9b39bb22e8955f1",
		keys: 1184,
	},
	"sv": {
		bytes: 88622,
		sha256: "9eed389f3c0cb4a2cb71d074ec5d2646e0f24e85ee72b4faaad862855ac2c94c",
		keys: 1184,
	},
	"th": {
		bytes: 152083,
		sha256: "0f056a5cbdcd92740d14a6dc8fa6c6b1185703de998f68e937639d6118205257",
		keys: 1184,
	},
	"tr": {
		bytes: 90172,
		sha256: "1203cf2afeeef20fa24f5bf03ed2ee088e72e85c6f10581fa7bb2fcf1ff98f75",
		keys: 1184,
	},
	"uk": {
		bytes: 126401,
		sha256: "b2c63986e713fb6fb7eb1795faa9f7981c30af1bb77a61088849cf1ef84b0e4a",
		keys: 1184,
	},
	"vi": {
		bytes: 100922,
		sha256: "c7487c6c84208518cc8c40cfd0f827c29ab11c929d69043383dc75334f1ec09b",
		keys: 1184,
	},
	"zh": {
		bytes: 81471,
		sha256: "50235c454d053407a4b773be1cd3d0ec02ee007c940bf89d9e3f5eadfec73100",
		keys: 1184,
	},
	"zhTW": {
		bytes: 81761,
		sha256: "e8198104942083c56d6532786508a8b0ac9e1d2bc96f0fec144bd11c638bbb7b",
		keys: 1184,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
