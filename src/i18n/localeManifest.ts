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
		bytes: 68345,
		sha256: "83fa7331b40a3a765632896e311f58eef7af2054bc6958225936d37766bb7283",
		keys: 762,
	},
	"bg": {
		bytes: 80412,
		sha256: "6608eae1f80e49eb62442771a7bbbb59043f8a6c597970ce74dc57bbc2ce851e",
		keys: 762,
	},
	"cs": {
		bytes: 56292,
		sha256: "7cab07f67979079941ec8f2082c1ed44b4d108d6e99663bea13f53d3b2fc7474",
		keys: 762,
	},
	"da": {
		bytes: 54046,
		sha256: "6af5b914abaf4035f95872d308b467486facf6435ceb22ed94debf8abc766ea3",
		keys: 762,
	},
	"de": {
		bytes: 59295,
		sha256: "ea9ee72a4d345d9aa6842a62d6dfb54ee2b21927ada203d91d66074b48ead696",
		keys: 762,
	},
	"el": {
		bytes: 84514,
		sha256: "7cb3b26ee0a145be434a6f2e58888d4da59aeb07eb2d05b42c5cd25fddcfbb83",
		keys: 762,
	},
	"es": {
		bytes: 57523,
		sha256: "67903470e5da64b6b27af0eb498dbca6b35a9bc72d1e6744f0503609367e87bd",
		keys: 762,
	},
	"fa": {
		bytes: 74068,
		sha256: "aca82fea254fd857fa78e1d9c437dc3ce90402e64d68e199ffb126dccb394270",
		keys: 762,
	},
	"fi": {
		bytes: 56117,
		sha256: "674f10e259c79c1ec93881e1938c634a6d9765039487144d5e7013718734b49d",
		keys: 762,
	},
	"fr": {
		bytes: 59842,
		sha256: "3c3bc03e4cef2e7fa0e56c05678ebeeb4505698fbc712aae2d52b1120fe98924",
		keys: 762,
	},
	"he": {
		bytes: 68845,
		sha256: "c68088d1f428cb8618e9cb66e6f17aa4b7c6a9422b47a91d765c15ec8e6c9f2d",
		keys: 762,
	},
	"hi": {
		bytes: 92667,
		sha256: "270cc40df475a1d739118ce9e426e507e4060fd7681c89c767ce1b2411c38b48",
		keys: 762,
	},
	"hu": {
		bytes: 59579,
		sha256: "4e0f0a2bb85e8babc0474e55d27314fc894261d6f8088e0f35ce20088ffa95e6",
		keys: 762,
	},
	"id": {
		bytes: 54611,
		sha256: "8636f4af4802800b68e86d7f27e41f01aac109091fa17c813abc1b9494db5053",
		keys: 762,
	},
	"it": {
		bytes: 57282,
		sha256: "83de43ce4284736bd8687e4cce143ccf6c3d1592fae2e3484534009cb042a0a7",
		keys: 762,
	},
	"ja": {
		bytes: 66237,
		sha256: "8312930c86fe9da06cdaffa65c2c4dbdf2172270f5fcb14faa03e65e21fa6d2b",
		keys: 762,
	},
	"ko": {
		bytes: 60909,
		sha256: "99fa8b1728a76fe3c1c261d076fc482563396f5565e21f6ccf1265fb21e17a3c",
		keys: 762,
	},
	"ms": {
		bytes: 54491,
		sha256: "9f86b7028dadcff243afdddbc9c24fc877ee0698aab7d19b922352824a863e99",
		keys: 762,
	},
	"nb": {
		bytes: 54202,
		sha256: "29fea625704bc11a3ec707930c554436566fcf32bd9c8f8ab84677ad06991713",
		keys: 762,
	},
	"nl": {
		bytes: 56579,
		sha256: "f1e1f9c5ce2bbcfcdc948f48c5c8f64f4b20f346290533101242650a6dcb4454",
		keys: 762,
	},
	"pl": {
		bytes: 56604,
		sha256: "f2202c941e550d70e362a47104234d53d963542fba1f87431bfbe458b18aaf97",
		keys: 762,
	},
	"pt": {
		bytes: 57545,
		sha256: "a9c6234f2bce2e27cefcfb5365ac0ae276a74b35d362a3f4374eb05a92afb056",
		keys: 762,
	},
	"ro": {
		bytes: 58038,
		sha256: "c4be4f799fd72c0195c16cb3e91e0be29f9d2caf921ed520a98096f638047b85",
		keys: 762,
	},
	"ru": {
		bytes: 78963,
		sha256: "32451ca508312da03610e19fe3b78a8feb8d716d6834529cc3be67abb8c8553e",
		keys: 762,
	},
	"sv": {
		bytes: 55124,
		sha256: "a40cbb955906037164526e5c0d3135f90d577ca8b4e0845b4855d57375e56e8b",
		keys: 762,
	},
	"th": {
		bytes: 91821,
		sha256: "e09288bdeadd4651788ca6caf29bb002b9959dde009a30f6c77532d036b02eaf",
		keys: 762,
	},
	"tr": {
		bytes: 56393,
		sha256: "9714083472bc66026ef6f85b86996bb67a27bd09bb683ad3fb89fe00a0ad780a",
		keys: 762,
	},
	"uk": {
		bytes: 77314,
		sha256: "b99cb2e79607d2dff26e0dfcd0c4cc406bfbc9d695a29e4e956c835cf9f83087",
		keys: 762,
	},
	"vi": {
		bytes: 62439,
		sha256: "f074daf3dcd2a1ec1ccdbfe0fb049692391bd085b0aec2a495cfbdbedb4e1be1",
		keys: 762,
	},
	"zh": {
		bytes: 51634,
		sha256: "a20f1d3ff3016de8fa03b5b60734310c65c54776e1ff7b3242d9272a7bcac6ca",
		keys: 762,
	},
	"zhTW": {
		bytes: 51760,
		sha256: "ed3ed9e4c665bde8f07b3d045d4e5f55139e31a62d22634a77de61be1b1fb0bc",
		keys: 762,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
