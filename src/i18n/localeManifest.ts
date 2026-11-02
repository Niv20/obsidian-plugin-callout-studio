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
		bytes: 116974,
		sha256: "78034f26340683c9f040d755d772a1c4decfd3cb75334d52e7dfcc6e13342390",
		keys: 1273,
	},
	"bg": {
		bytes: 139452,
		sha256: "dc0ec6c87f76bc44e0d6f0fca13666553066bca2fddac38c607789c75ee92188",
		keys: 1273,
	},
	"cs": {
		bytes: 95986,
		sha256: "60798ff5cbbf30e43ae96458c530c92f0ebc8604a97c07a9778e0a7eee7a68a1",
		keys: 1273,
	},
	"da": {
		bytes: 92989,
		sha256: "9603f695476469946d62cb08061ac9170e92cf7c6d03306bff64a818c6f80a85",
		keys: 1273,
	},
	"de": {
		bytes: 101431,
		sha256: "8bbf3baf6f667094fc9f34439f2bca2d247f4232d075be3a1c612e8f7df3faa5",
		keys: 1273,
	},
	"el": {
		bytes: 147969,
		sha256: "253b48d62673cc4b4b164439cddf3ee3934a2b9437d99a728cdfcd04d7a8218a",
		keys: 1273,
	},
	"es": {
		bytes: 98234,
		sha256: "bcf4f97a130faa58168975614792367b6064b5f810d4836452cbf9873f573180",
		keys: 1273,
	},
	"fa": {
		bytes: 128202,
		sha256: "bd465ca437985a782aabf1c4d45be804fe977983cd9547ede435bdedb9c829e5",
		keys: 1273,
	},
	"fi": {
		bytes: 95741,
		sha256: "daa90b1ebf54f8008a47cf979e0fa4a6755b41372f3018e69433169fcc8b9051",
		keys: 1273,
	},
	"fr": {
		bytes: 102812,
		sha256: "d6db8487dfc3892afcc782626de347e7de7c3c9598167130d44f5e93d84abf46",
		keys: 1273,
	},
	"he": {
		bytes: 115710,
		sha256: "2fc483b04609f22f3218215d3e1b3357ff671f93fc61b0a8a15a1e502f2bb3c4",
		keys: 1273,
	},
	"hi": {
		bytes: 161719,
		sha256: "c800172051b47527128457a33a23b22ba0e3bc2a815c09a28d20cf9fd258a481",
		keys: 1273,
	},
	"hu": {
		bytes: 102442,
		sha256: "ec4ecb8c397a22811ba6c0e67a9b1498255489b51f7f7dc3705ec6749523bd0a",
		keys: 1273,
	},
	"id": {
		bytes: 92872,
		sha256: "52afb95002bcc0fd957e21dab31c70218a3320c7677e06440d9b7c36bcdc55a7",
		keys: 1273,
	},
	"it": {
		bytes: 98691,
		sha256: "17044179482baf5ff97bb1a2fd17cb1ef2172201942328d6a5e233da5e8e60f7",
		keys: 1273,
	},
	"ja": {
		bytes: 112458,
		sha256: "1e0ab9b83463def7a5ca5d04597c1ab0f2883da1f5e3febcbfcab121fac7b2ac",
		keys: 1273,
	},
	"ko": {
		bytes: 103156,
		sha256: "aa23598141cb993bff456cf2d14f4073f7567bdc4ce2996d4c20daa8b5c1e481",
		keys: 1273,
	},
	"ms": {
		bytes: 93066,
		sha256: "986b817ed43cf7dc6a9cc54202eb0b9c27c67fceff7ab1b72aeec2743843682f",
		keys: 1273,
	},
	"nb": {
		bytes: 93576,
		sha256: "c7f683bd44767f4b1c71160e1c09cc45afdec9ff70505ecb995660e4432d108f",
		keys: 1273,
	},
	"nl": {
		bytes: 96789,
		sha256: "75dac55b2fe27138a4fc31ac418be0deb2adff6bf3a0412c250b96ec0cea328c",
		keys: 1273,
	},
	"pl": {
		bytes: 96984,
		sha256: "a464fbc5da6ecb5ff05373056df6ff46e81bb8953348caf435b470858f260b74",
		keys: 1273,
	},
	"pt": {
		bytes: 98233,
		sha256: "4d3027e5966ef29c04afa25906fde9542f0527265a1fd5315eb730b7fdc98462",
		keys: 1273,
	},
	"ro": {
		bytes: 100212,
		sha256: "2fe3467ddf6ec3d28421c5f75c111ce3a47cff2a9525d39c6314f1051cebbaac",
		keys: 1273,
	},
	"ru": {
		bytes: 136357,
		sha256: "e2b83b51ee2e352ff3f4b197a216f58b2b44583128d2949db14f1ad96c081d15",
		keys: 1273,
	},
	"sv": {
		bytes: 94690,
		sha256: "ae02377f55a970fd04477ff9a8e70417a91ef6becfd8970e5e0c063541d32460",
		keys: 1273,
	},
	"th": {
		bytes: 161200,
		sha256: "2d2487ba509098dbd1a2687994d9d100c3bc691b2945f7b71241adddb1c4dc6f",
		keys: 1273,
	},
	"tr": {
		bytes: 96350,
		sha256: "18f21ae6b2ea9e217ddc7433599b7c4881a8362b2449dfd3d73484818a9d5c89",
		keys: 1273,
	},
	"uk": {
		bytes: 134078,
		sha256: "6f29d9f2c657ec26eb723352c1465755d2f5b7dccf23889630b320c7f5bf5aa5",
		keys: 1273,
	},
	"vi": {
		bytes: 107522,
		sha256: "3df2498568a65e155632b4356caef2235a19ef76e65484d573fdb89abe0b62c5",
		keys: 1273,
	},
	"zh": {
		bytes: 87411,
		sha256: "f826ba43eb21771b22c98fcc97a469b7c521c643cbdf43a7f1d8dcf006576908",
		keys: 1273,
	},
	"zhTW": {
		bytes: 87732,
		sha256: "cb659bfb09a54729497fcfb1e3fd3c2760b466d958dd1ed79ab4b4211f62e948",
		keys: 1273,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
