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
		bytes: 68328,
		sha256: "fcbb65d7beb4f527e6c7777ad59a4be531256049c79b1b95308b7ec4da84af83",
		keys: 762,
	},
	"bg": {
		bytes: 80377,
		sha256: "e19b533ca5213fff8e288dbda2b97e043ea4385b084cf621109c6651e4bc608a",
		keys: 762,
	},
	"cs": {
		bytes: 56294,
		sha256: "21ba439c0031a9e7592003d7e9bb24229b3ee6a5a83a7420dce050e926814da9",
		keys: 762,
	},
	"da": {
		bytes: 54047,
		sha256: "c1273b6a248052edbae81650cafc639529347b4bcfddcf1cd3e6064b980ee451",
		keys: 762,
	},
	"de": {
		bytes: 59283,
		sha256: "982c653ab8b4d184865a5178665b6c3550bad9c8a29cd2f7c24abcb2b4de0012",
		keys: 762,
	},
	"el": {
		bytes: 84485,
		sha256: "4ede26d8cb1896cb15e808a22125a7942d95f596f806273187684947830132e5",
		keys: 762,
	},
	"es": {
		bytes: 57532,
		sha256: "19a194396fd1b2af7de3a8ded77ba34b01903869213b5ceb13b3bd4ad60a2c8c",
		keys: 762,
	},
	"fa": {
		bytes: 74055,
		sha256: "a68ab7c050b870aa0566ada90467db6ceb010453516686f3a9a89d481c40ed58",
		keys: 762,
	},
	"fi": {
		bytes: 56108,
		sha256: "8ec84ed538fa13e295e7da231d639740eddae2091cee788c646c4d852f9f5d64",
		keys: 762,
	},
	"fr": {
		bytes: 59841,
		sha256: "f57182942637b2ca695aa03e98440af0766a17142729c93db5f2641e0bdd6f1e",
		keys: 762,
	},
	"he": {
		bytes: 68830,
		sha256: "e5be8db85a095eac495a450bdd8b0f5fd593eaf22973b94a2840704eff0009e7",
		keys: 762,
	},
	"hi": {
		bytes: 92633,
		sha256: "a9cf6e87abd96dcbf5b0c2b3a4ace3b3095bd0298823e2d179a49c1076e69041",
		keys: 762,
	},
	"hu": {
		bytes: 59566,
		sha256: "daa78f4dea4afa21f386b7b0af9e3be5c5af10f86acf2f79f5e63bad18c5f64d",
		keys: 762,
	},
	"id": {
		bytes: 54605,
		sha256: "02dd2fb9eeb54d5d111d47e9a5676516b2fe6fdd7bf3e04f6b0cadc75338666c",
		keys: 762,
	},
	"it": {
		bytes: 57277,
		sha256: "f28ee45c4df6eb2dc8c0b3da6008eb25b30fa1ab55b78f40316561d8d74c2acf",
		keys: 762,
	},
	"ja": {
		bytes: 66207,
		sha256: "cd41ec13efdd91874d17313092f1f0272be6d907d9080639eef855977fea4979",
		keys: 762,
	},
	"ko": {
		bytes: 60893,
		sha256: "efffd1105f77655ce1caf9949f746b6cb33999ccbf7def36d3ef3e2ad8d194dd",
		keys: 762,
	},
	"ms": {
		bytes: 54479,
		sha256: "f48d8bd262efed109ee6656d9b833e1fb2824b91fe2854fc9c61e56ffed9af28",
		keys: 762,
	},
	"nb": {
		bytes: 54198,
		sha256: "bd601be909e73105f48e8c636df0d41a5ddab77da30cd9d2b1de2cabeede03f4",
		keys: 762,
	},
	"nl": {
		bytes: 56577,
		sha256: "5217a425be4de9b46f38ba615a2b6da268ca7e8e6fca38c23c1f4f42bfbc643d",
		keys: 762,
	},
	"pl": {
		bytes: 56606,
		sha256: "82bde36b4393dce920fc0df7f0f76e03e56e4018527b9c369b905ef824d3a15f",
		keys: 762,
	},
	"pt": {
		bytes: 57544,
		sha256: "dcaf6ca58ee060da45ca8a4a4fa0da839cdca2660ea98057c48f74223bc8b6ad",
		keys: 762,
	},
	"ro": {
		bytes: 58021,
		sha256: "da191413048ff510f26d1e3e8656fcad778887f30cb7435528ef65dd40aa5150",
		keys: 762,
	},
	"ru": {
		bytes: 78944,
		sha256: "8c097ed59af3c08d0955223118efb9e5d556a1517b5d480a9b949eba949a5c70",
		keys: 762,
	},
	"sv": {
		bytes: 55116,
		sha256: "e86fcbf7423462769e33683664a9eb0548bf09b1e5af3a60e922a43888f301d9",
		keys: 762,
	},
	"th": {
		bytes: 91788,
		sha256: "3cf66b6e6da3ee360b4d0129cd9b182b960c1aca6657917b68f7444fb9a7ef3b",
		keys: 762,
	},
	"tr": {
		bytes: 56388,
		sha256: "2320326d0e5601a720676afcc2cfa9011615b1aab55ce91ca291e1143e423d04",
		keys: 762,
	},
	"uk": {
		bytes: 77301,
		sha256: "c70e68ce0050aaddaba09145e10c2ec91b0de684a27b2dcf026a7d95c380ea52",
		keys: 762,
	},
	"vi": {
		bytes: 62434,
		sha256: "b2426cf25434988a2489c0507f9c53d9c4a15f82cbff91971147900b0bfb6b03",
		keys: 762,
	},
	"zh": {
		bytes: 51622,
		sha256: "21c2731fdcf72284e5c174118aa495624d044cc4399c76ad70ad909e18f7839f",
		keys: 762,
	},
	"zhTW": {
		bytes: 51751,
		sha256: "122580e8c8b0f62691a71680355f24aa9b7f98f858bcb49d2e7f46f993b1e540",
		keys: 762,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
