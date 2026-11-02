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
		bytes: 116720,
		sha256: "870ec42bf9c2de30173d66207f5c3cb5ecb4a1e4d3de12820612b44e98d978b0",
		keys: 1271,
	},
	"bg": {
		bytes: 139167,
		sha256: "d0721e95b375a4f2437815c17b2cb065c3096b3d8818df35abbf2848bf27634f",
		keys: 1271,
	},
	"cs": {
		bytes: 95788,
		sha256: "14dd881505069de63032eab3bbfe8eea75ad49be16c78db6904ebd26f4d09820",
		keys: 1271,
	},
	"da": {
		bytes: 92784,
		sha256: "858a1c68a9806730d92b110ca928f62d2ae07da782b54dc6405ac788f8e0dfff",
		keys: 1271,
	},
	"de": {
		bytes: 101215,
		sha256: "c67bedeb5a50bc7927aaacd7654e51c36fdb6ac4fb16f8e664d3fcb5c59df552",
		keys: 1271,
	},
	"el": {
		bytes: 147595,
		sha256: "a8f9ddf8ff08ffb76383c22167dba5cbca140ba1f8380f127be5c7452ed2ee05",
		keys: 1271,
	},
	"es": {
		bytes: 98036,
		sha256: "fba0f359dc7d7edbbb1cc391ba17c4c523e9b6a040cea88e37af2c3ce7e423ac",
		keys: 1271,
	},
	"fa": {
		bytes: 127903,
		sha256: "4c1c13af57114e0adb0033dae7da3c09c4512f3398e6fb95c41fff4510b405be",
		keys: 1271,
	},
	"fi": {
		bytes: 95536,
		sha256: "c4e69e913feff7c8433bdeaec9c193857948782d35eb263f8990b4e652cde6d6",
		keys: 1271,
	},
	"fr": {
		bytes: 102586,
		sha256: "9a1ad2c15ee465800816f6797bbd7f1d1347b832f7fb557b1ad70a8d1e936b3d",
		keys: 1271,
	},
	"he": {
		bytes: 115437,
		sha256: "9c955723c6a38248a834608ad7317942f4e16df6f6f49490532de77ab974e43c",
		keys: 1271,
	},
	"hi": {
		bytes: 161320,
		sha256: "db764b35b938bef0aca207b6a6144a07f91186de3e0fbd2a0779977a66c678d6",
		keys: 1271,
	},
	"hu": {
		bytes: 102219,
		sha256: "6b05dc0d929376a97cb1c30d5dca1adca80cfa4406fcacad0f047075fc026ad4",
		keys: 1271,
	},
	"id": {
		bytes: 92668,
		sha256: "bcc80b5cf0eb6ee3fdf27b2a0c4bc111946173b7980f58edd280d0694cd9ce84",
		keys: 1271,
	},
	"it": {
		bytes: 98483,
		sha256: "2720164084ee93535692076f7215965c2bdfade106e9fba9d83942a31ff849ef",
		keys: 1271,
	},
	"ja": {
		bytes: 112193,
		sha256: "ea509fb53b25be288601b1b204dea6b91ee13ed3228618f15c574638d81804a8",
		keys: 1271,
	},
	"ko": {
		bytes: 102921,
		sha256: "9a10eeb4aef702986d01afd2de24510a22df619b168194fa8e8bb29e9accd8d9",
		keys: 1271,
	},
	"ms": {
		bytes: 92855,
		sha256: "3478ef82329755708251463602e2c77175a0b87f6d53457d970d976e5583c064",
		keys: 1271,
	},
	"nb": {
		bytes: 93376,
		sha256: "f21ec4906b924890c6a88f846ad2cccb94d0b473c314e647ed1264eca4f33c42",
		keys: 1271,
	},
	"nl": {
		bytes: 96565,
		sha256: "79e07521bfec1aba72ef423e5efc89bae413553173bd49762b8af4bd8906bc18",
		keys: 1271,
	},
	"pl": {
		bytes: 96783,
		sha256: "6631b617f06aeb15e5551fdde6e7bd8eef55a82e71c765b2f65976a9d85f3837",
		keys: 1271,
	},
	"pt": {
		bytes: 98036,
		sha256: "342ad28ec4842ff0209a39d62125bb932bd77b8fd1ec56fec49076c8e3249b4e",
		keys: 1271,
	},
	"ro": {
		bytes: 99985,
		sha256: "a34a08ff21714770d20139d4594bef34110868e4c0a75c9e75524c91366e1e7a",
		keys: 1271,
	},
	"ru": {
		bytes: 136044,
		sha256: "ebdeb5d2d07281bfbcbe9f16c57d3237501f4764eda41b1d24d5397e0d53afc6",
		keys: 1271,
	},
	"sv": {
		bytes: 94494,
		sha256: "532cf141ffa7c01ad50d5dc6d043d9f3df55b42df1ed3589b5197de89c8b900d",
		keys: 1271,
	},
	"th": {
		bytes: 160847,
		sha256: "32bbbb1f0b0e3afdbdff3409ce84ba7e1551b973eacb8573acc221a59cf1f1ff",
		keys: 1271,
	},
	"tr": {
		bytes: 96129,
		sha256: "3220919d898ef6acca6808206a19afbd454ce0c28b48027d340c5e54c114ed23",
		keys: 1271,
	},
	"uk": {
		bytes: 133777,
		sha256: "94103e251d5ef53d670c44c4cd1f71f8ce66d5f417656de6023bc1c2bf35887a",
		keys: 1271,
	},
	"vi": {
		bytes: 107247,
		sha256: "8869a56ba9d247f2021f71d5241900f7c2403112bb69afc9bcd85ba8de72641e",
		keys: 1271,
	},
	"zh": {
		bytes: 87215,
		sha256: "c3331c3aea3d002f0cce3f80e83d6e313e0cccc7b4dc726c157613966426ac3e",
		keys: 1271,
	},
	"zhTW": {
		bytes: 87536,
		sha256: "72ec123463b60b8ff540867ebabef92205cf527a70e9b6b8d98f740146e084fd",
		keys: 1271,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
