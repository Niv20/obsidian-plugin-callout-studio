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
		bytes: 65964,
		sha256: "9a890875df0371c0f552b2dabfe81cd24fb733c2bdcd1e881ee10074b9b04756",
		keys: 743,
	},
	"bg": {
		bytes: 77399,
		sha256: "b6727ddccf09b7275f3e2b95154b1cb708711efc87f24b45d61303de5c5562d9",
		keys: 743,
	},
	"cs": {
		bytes: 54532,
		sha256: "3635a536ae7d1e44ade95094cddbae2c40c6cab7547381d28ae017b0f7cc68db",
		keys: 743,
	},
	"da": {
		bytes: 52412,
		sha256: "9d8fb54bf6e542d02e91520485d8bde6aafbd162c4d4a9ed273db1ab3af1e38f",
		keys: 743,
	},
	"de": {
		bytes: 57247,
		sha256: "a0db1c2309900c0a59e065cca8d0a77c67596289dd28eaab2802c642d29318ca",
		keys: 743,
	},
	"el": {
		bytes: 81158,
		sha256: "21f1920d68ee567baf1e9701803e88fe8a68f279e6f42ef31ab36df40602a5c2",
		keys: 743,
	},
	"es": {
		bytes: 55820,
		sha256: "9bd209e761ea45a95227597fc46d547529634afcef71c48031404e7c64d166ac",
		keys: 743,
	},
	"fa": {
		bytes: 71588,
		sha256: "7954d73e28d6009a61ef2f8dfae8bfbce0f60a8c3e0b8348cff1530925bb3910",
		keys: 743,
	},
	"fi": {
		bytes: 54422,
		sha256: "d5aeca72effc1fa9ab54ab0a09ba54e5d3650c5e52bd19fe1ce1f834d5321587",
		keys: 743,
	},
	"fr": {
		bytes: 57909,
		sha256: "31814a9a9a214e167df34c7fabad618edee2180d15c8214855fd762d252be81a",
		keys: 743,
	},
	"he": {
		bytes: 66824,
		sha256: "f53be2b11a45da3270a0c9fdd834068e1dc44b6eaf0aba87368c96d980922b54",
		keys: 743,
	},
	"hi": {
		bytes: 89237,
		sha256: "690266d508a4cdff4a180862ebcc7cd6498740d624a62180d5da09eeaf668ac4",
		keys: 743,
	},
	"hu": {
		bytes: 57714,
		sha256: "31b9d80b08b00386e10befd85e629aa24df3468278ab8ff17a4843cc924788ba",
		keys: 743,
	},
	"id": {
		bytes: 53077,
		sha256: "84eb8e1fddbcf57268763fd7a88d8951d545e6d961856206ea646e11cb118873",
		keys: 743,
	},
	"it": {
		bytes: 55458,
		sha256: "0318060d248e03c3be0c3bf6fe2361642aaf63c29547c6f5753b7852d3134e90",
		keys: 743,
	},
	"ja": {
		bytes: 64036,
		sha256: "df7ccff95457985a3f1a46fa55f3a12e6343dd17a9e7b99d51a1a69e28738a9c",
		keys: 743,
	},
	"ko": {
		bytes: 59000,
		sha256: "f94d29f525a6ec4e9f1ee11bbdf71d54f83a842c8dd52665eed8babc1fdac2bb",
		keys: 743,
	},
	"ms": {
		bytes: 52969,
		sha256: "522937fa0012fcf4228fba0742463e111b1eef95ddb0339efa361bed033b4de3",
		keys: 743,
	},
	"nb": {
		bytes: 52545,
		sha256: "24ea9698b2558eace40a496a2efaaf5f5f995257935b0641c18a9ed7e91b00e8",
		keys: 743,
	},
	"nl": {
		bytes: 54836,
		sha256: "7bdd4c06b86d8c30aea7f6c07bcd710e531ceb5b3e1f029c5c76ed36847d1650",
		keys: 743,
	},
	"pl": {
		bytes: 54807,
		sha256: "e9f01e607d1bb34c3b7d2b223b5779acda02e206829efe62e4f36437f781c271",
		keys: 743,
	},
	"pt": {
		bytes: 55715,
		sha256: "5ed87934c62776c61dd450bdfe0b28b9db8b6e028f1cdc8f5558ac1d205957d4",
		keys: 743,
	},
	"ro": {
		bytes: 56216,
		sha256: "5a3576eff88af0f209d9c97f9de26c3562c6e2d6d30435e8749cc37233701f3f",
		keys: 743,
	},
	"ru": {
		bytes: 76124,
		sha256: "4f6cefdc8a99ec558f31dff5cdfb78f25f58d47b9ead7e1cbfc15b11bc45972e",
		keys: 743,
	},
	"sv": {
		bytes: 53387,
		sha256: "6b695422a0a66a99e77801a2685d12c69421bde3faec64806526ada6af5f4ae6",
		keys: 743,
	},
	"th": {
		bytes: 88230,
		sha256: "d3d3f5e957e31512ca639090e15e04a78fe3210a72d7d0aabaf8b86fcdc6448e",
		keys: 743,
	},
	"tr": {
		bytes: 54833,
		sha256: "41839570d557fb838bdc74138ebc8574e7514b3e78a7c6249d95e4cacd16e3fb",
		keys: 743,
	},
	"uk": {
		bytes: 74564,
		sha256: "d683231dc5acf272faf535bfa5c45af75644d4f245ebc5f0945209717574984b",
		keys: 743,
	},
	"vi": {
		bytes: 60454,
		sha256: "c6d0b632ea0737c372ee43d6385d6c90fa098abf615cc4a94a9c86ab74a7e94b",
		keys: 743,
	},
	"zh": {
		bytes: 50280,
		sha256: "538c9b976040cb57cb7f3c4de839c9755b0de59c5f565f81d0257b38ffc36373",
		keys: 743,
	},
	"zhTW": {
		bytes: 50420,
		sha256: "84e304b62ab64f75ef108a246a6d19c64eca5ba0e392b15efd6b89a99aff5e39",
		keys: 743,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
