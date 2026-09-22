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
		bytes: 68385,
		sha256: "0bbdda8613171636e468030821c09fa60e47c2626fa4123ee3e91a2811aca580",
		keys: 766,
	},
	"bg": {
		bytes: 80267,
		sha256: "cf4c66a9d26539062023b88687a28495de1657f0d42713cdb2e66e6a549d35b0",
		keys: 766,
	},
	"cs": {
		bytes: 56325,
		sha256: "dc7734d98041f533a53af2cadff911580520e4b5e793e54a12f2702ede226be8",
		keys: 766,
	},
	"da": {
		bytes: 54078,
		sha256: "68960a53b43f987aa8c6bfd2c8671a818a8162b57adf601402050fa5af98e75f",
		keys: 766,
	},
	"de": {
		bytes: 59176,
		sha256: "74673d1eca442eb6cd63064da6de950c21a109aac012f16b0294abe47e7ffcde",
		keys: 766,
	},
	"el": {
		bytes: 84573,
		sha256: "e4842cbf6b9f924a641a7baded653cf3e036372c5414cc451ab547ae6f9801c7",
		keys: 766,
	},
	"es": {
		bytes: 57547,
		sha256: "98e0524c442bba7f96255d8e707c04ec94d4a7b4ee14936a7a182f4cab8d13fe",
		keys: 766,
	},
	"fa": {
		bytes: 73761,
		sha256: "e3966a64d6209ccd210ae99b8486fcede3b315a91cd379cf298985edca7188d9",
		keys: 766,
	},
	"fi": {
		bytes: 56077,
		sha256: "c9c8bb01e0a549cb4d7a5cf25e95d506ebd3fb7af54498697cbb9a8cc9dd1499",
		keys: 766,
	},
	"fr": {
		bytes: 59858,
		sha256: "e0d7bbb23462bb5684668101f75816d585e2aaf65ea66bf137eff19f5f20029c",
		keys: 766,
	},
	"he": {
		bytes: 68813,
		sha256: "e46e5a38f8d377a6b32d91f569285a64cbef3061b6cb2221abee10a595a88379",
		keys: 766,
	},
	"hi": {
		bytes: 92525,
		sha256: "a033a4f9be9c0778639124be705ce27a0a6ead7ad9b4ed42471afa4737c9e85b",
		keys: 766,
	},
	"hu": {
		bytes: 59664,
		sha256: "58e2d665d6cc5215fdb73bf92e42a99b656c3e995ce2210722b6645403ed4229",
		keys: 766,
	},
	"id": {
		bytes: 54487,
		sha256: "71f68552581c289bc11ef7924818bcae6e2c39781b2412bbae36ad3035bb61d0",
		keys: 766,
	},
	"it": {
		bytes: 57291,
		sha256: "e22c85ce511059d4cc4d4ab8fc53069d7aec299855e8b9d535b5599fdd0506f2",
		keys: 766,
	},
	"ja": {
		bytes: 66251,
		sha256: "7122f04a69e34e78343d0caeeb6a9a989cf53918d9c166ee3c68942fb8e1a966",
		keys: 766,
	},
	"ko": {
		bytes: 60843,
		sha256: "af09538c4d8bf30a7c86a99846642370ad7893e6dd346afe734a7d009da58d94",
		keys: 766,
	},
	"ms": {
		bytes: 54332,
		sha256: "b053447b5fb4e8700e552fbfe58657ef9ae833325072fceec288428d2948ec1f",
		keys: 766,
	},
	"nb": {
		bytes: 54200,
		sha256: "3851d2c6bdd543b323871701dd8f94e9ec9ad27ee15a17799dec5f07611b0f3b",
		keys: 766,
	},
	"nl": {
		bytes: 56490,
		sha256: "0d3829cc0e60de53b5b4e67631852a1f792e4243ce6415d66383485201bcfa7c",
		keys: 766,
	},
	"pl": {
		bytes: 56623,
		sha256: "f494430f745b59ab4f312f9045bdc0c37e65403ca67263b9322a23b893098611",
		keys: 766,
	},
	"pt": {
		bytes: 57460,
		sha256: "3ebdb2c13be040fbef3ec7013482562c0febc4fe7a256e60dc7b368f3c2c9025",
		keys: 766,
	},
	"ro": {
		bytes: 58028,
		sha256: "6852415d063e75e426d0210aaebff029e5b74b16dc3a983b02b0b5285166050f",
		keys: 766,
	},
	"ru": {
		bytes: 78981,
		sha256: "f45fbcc697634156238a5bd91ef519d54932c6e2ac55cd5bbb877f82d21e104e",
		keys: 766,
	},
	"sv": {
		bytes: 55118,
		sha256: "acba65d9af85ff7d0576c5998f253c0114518a4415299d2e0392386d4353b62a",
		keys: 766,
	},
	"th": {
		bytes: 91734,
		sha256: "cb6fe4ad99e35adf90fc6fef4afef0a9bcb6bab59fd11eb6902d801048091a20",
		keys: 766,
	},
	"tr": {
		bytes: 56344,
		sha256: "1c276e4d01590a914140279140aa5bfae6e2d79e16353d699d1702a8ce50c5fa",
		keys: 766,
	},
	"uk": {
		bytes: 77368,
		sha256: "4fe27bd6bf77bafa79b0526c1ca1d3ab146e461d1a977a89381c0413999f71b1",
		keys: 766,
	},
	"vi": {
		bytes: 62336,
		sha256: "417ea24f7c01c1fac2790c73112d53838a60796a3036265fa1b1b3c7cdfea8be",
		keys: 766,
	},
	"zh": {
		bytes: 51466,
		sha256: "e333a87494f43ac5c42576eb6bab1a305c224b8fd613f433e968f134bce8a4d5",
		keys: 766,
	},
	"zhTW": {
		bytes: 51619,
		sha256: "0b225e801aa06e9ac182aaaa9e3e49176cc45cd7720a694cebab362ef510598b",
		keys: 766,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
