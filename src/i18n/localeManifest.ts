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
		bytes: 67433,
		sha256: "e9d4430cb7106d19d25bb6a1744098ff3f04627876481ba60baa8876ca2d11a5",
		keys: 760,
	},
	"bg": {
		bytes: 79099,
		sha256: "89f5ea1f7f6c8c38db9190b781a30120201c3bc34961acdf51d3b3e670935686",
		keys: 760,
	},
	"cs": {
		bytes: 55491,
		sha256: "dc98f8c6c3ecf0c9c193803600b61f3740560515c1150ca3bbfc4c79515ef787",
		keys: 760,
	},
	"da": {
		bytes: 53280,
		sha256: "bb341073ea3437a874868e8252acc917de4766fc2083c1377160adea43fdcece",
		keys: 760,
	},
	"de": {
		bytes: 58343,
		sha256: "dc7c04c05e83884366e380171e8c3190256479c4ec9154a0c83271b44a423671",
		keys: 760,
	},
	"el": {
		bytes: 83262,
		sha256: "8a864883008df0a30abc30ec64df352f38df10232072134e0968a9225acb8455",
		keys: 760,
	},
	"es": {
		bytes: 56725,
		sha256: "1fb006bd7a7e0283c2befe61df2768072afa4c9d4e4888db5e3904f6caf3734a",
		keys: 760,
	},
	"fa": {
		bytes: 72611,
		sha256: "5dd2949b9b3091d794614759aadf8755dc9e3911a5f85fe2877bf7836be5e78f",
		keys: 760,
	},
	"fi": {
		bytes: 55239,
		sha256: "66b0d0f5fbbc73fe5542a1717b49cbb788e655803860b6115171e529851a2584",
		keys: 760,
	},
	"fr": {
		bytes: 58983,
		sha256: "42e320b1238a6602335ad4b417be3201ae21d7c42a143f14b546f4d196b22783",
		keys: 760,
	},
	"he": {
		bytes: 68038,
		sha256: "240a038dd44a5b978cb6838bbf6563f1efd0b6da15a474e178b8332fa0c745e1",
		keys: 761,
	},
	"hi": {
		bytes: 91111,
		sha256: "7990a5a4b30ec6846decf2df073ee6f79181a29028c6b18191d3d2d09cb0ad23",
		keys: 760,
	},
	"hu": {
		bytes: 58811,
		sha256: "2dd80d5f6d697038b07a46de30453009c95fe76bc9b27ab20e8f2b7918f35a87",
		keys: 760,
	},
	"id": {
		bytes: 53723,
		sha256: "4dbe977a6b8f37604c3d99763cb9b46d1629657ef51bf1f192353fffde82ab12",
		keys: 760,
	},
	"it": {
		bytes: 56436,
		sha256: "b0be01c10e3d548fe7d3455d920b2d24792cfb14d6783a755aacd3eb7072edb6",
		keys: 760,
	},
	"ja": {
		bytes: 65276,
		sha256: "9598e2e91c0ca4016ac2d593d5b973b3547eaaadd3049c5b36ce8efe80cf2afa",
		keys: 760,
	},
	"ko": {
		bytes: 59942,
		sha256: "9f2a8ccbb645ed96f87295dcb56bc07952d4ceb97bcf87fe0b8dfcdf03da0a3e",
		keys: 760,
	},
	"ms": {
		bytes: 53567,
		sha256: "557d25926c4a600580649765368db25024afc66dbaf98bae714777b3a14ad191",
		keys: 760,
	},
	"nb": {
		bytes: 53409,
		sha256: "50851ccbb7cdc37efb173ef5a23b074edb34a7ca754cb7fbaf2f2b657995be2e",
		keys: 760,
	},
	"nl": {
		bytes: 55695,
		sha256: "53f9781b38d92f2340133ee0328cf1204712807e11bda9c56a4c3dd0b5ae30fa",
		keys: 760,
	},
	"pl": {
		bytes: 55800,
		sha256: "6e11d2c60ea498b7a91a7a17b2d723baa0ffcb72f7c505015f7fd334c2b4ae5d",
		keys: 760,
	},
	"pt": {
		bytes: 56641,
		sha256: "64f25b34368a7844995b9076e4fa7e83b53f94f8688b5b97b11ecdf44aaa8530",
		keys: 760,
	},
	"ro": {
		bytes: 57171,
		sha256: "f789357641c55f7bf795e17d94e50bbca276f05e7b76d5086e8eaff2808adcaf",
		keys: 760,
	},
	"ru": {
		bytes: 77830,
		sha256: "462c2d2cccf17d89504c33e7678f0b23164da556c31ec827ac027ccffc5c8498",
		keys: 760,
	},
	"sv": {
		bytes: 54338,
		sha256: "bf7104b6b5304797f91846050ebe7d6bcff25a9cd31029f25a983622565c1727",
		keys: 760,
	},
	"th": {
		bytes: 90198,
		sha256: "2cded844da8196767cc0ece6b5736db8ca1d456fc69701c46875281eda9225e8",
		keys: 760,
	},
	"tr": {
		bytes: 55517,
		sha256: "04fd8a0285c2885f99bb2d5546faad42c17d8e830dc13b2781211a17daf26fc2",
		keys: 760,
	},
	"uk": {
		bytes: 76240,
		sha256: "9466aac7de41e23a44511eff148021267c1335b32efb27b409a2de7ba6bb906e",
		keys: 760,
	},
	"vi": {
		bytes: 61391,
		sha256: "b44c4a52eda4262f9f2b3c852359638e235d874d48610c83940dc43ca442399c",
		keys: 760,
	},
	"zh": {
		bytes: 50740,
		sha256: "504df2e660cc3361f70afaac3408daee6be17502951e6b308b3da3d3dbc6135f",
		keys: 760,
	},
	"zhTW": {
		bytes: 50857,
		sha256: "c7a134096b30257c181261617e9176ff106f1e6966f5d2678b2a7263e1abd681",
		keys: 760,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
