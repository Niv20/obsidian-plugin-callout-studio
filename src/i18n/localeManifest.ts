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
		bytes: 115320,
		sha256: "8e8d8af7dd241933bb18cc7158cb13d3ab3c0959598984eedb0c39cfd6841868",
		keys: 1244,
	},
	"bg": {
		bytes: 137877,
		sha256: "b1d38b2d033c731943eabf07587bb0b7d3a0d737584bec54b2e61ef69a9c7c10",
		keys: 1244,
	},
	"cs": {
		bytes: 94634,
		sha256: "204a1dcd657104a1cdb4dba863cf5b76e9d368c707bc03a953c08df5011e11bf",
		keys: 1244,
	},
	"da": {
		bytes: 91532,
		sha256: "51a780bed47f428d07b3f8d135ffae12e2e52caff44bab907219ed6e45500aaa",
		keys: 1244,
	},
	"de": {
		bytes: 100012,
		sha256: "c7fd4b22679ba2fd266651e5b0b3369bfff448636bbb9db957bc29ba35ebc24d",
		keys: 1244,
	},
	"el": {
		bytes: 145825,
		sha256: "e15b8f6dfbd63ab2869ba5650c4a6777bd3ca62bc62c7b08d3038ee3ea8832c3",
		keys: 1244,
	},
	"es": {
		bytes: 96861,
		sha256: "8b3b3a25d669f00d24e0a16038524ff89326f685349c448715c9403723b8e7f4",
		keys: 1244,
	},
	"fa": {
		bytes: 126295,
		sha256: "177546ff932eeb720f5d1cf227c9c32bdfbf3c401554b7615f5d94f10523d382",
		keys: 1244,
	},
	"fi": {
		bytes: 94323,
		sha256: "36817fa34a52f60b4f2bb20f72fe7327914c13dd6d643cd6dd39ac649180627a",
		keys: 1244,
	},
	"fr": {
		bytes: 101469,
		sha256: "d6426b39848bf68eacb858cac24b8e7c0e20d187af18a03b60aed2f163da0e08",
		keys: 1244,
	},
	"he": {
		bytes: 114270,
		sha256: "bbd33a893ad99122c77a5ba4e1e56af6d08df2456832c0d8cd045e3b438d942c",
		keys: 1244,
	},
	"hi": {
		bytes: 160082,
		sha256: "01d8f452279e24fa9d19f1a0a8fc213b84ec2f6ae8bc48b570627b2f187fe17d",
		keys: 1244,
	},
	"hu": {
		bytes: 100953,
		sha256: "50ab2be787937c4d803f8f52595c777857cbddb2e492a84af8c829307119bda9",
		keys: 1244,
	},
	"id": {
		bytes: 91481,
		sha256: "be84c1dd1cc9697cee249583abbf0eda386d710d46fd23aff1a45d64934d2426",
		keys: 1244,
	},
	"it": {
		bytes: 97226,
		sha256: "2dc28d70a1fb750c6c0a1456d08db6da938054b7638863848e671db02a8f6968",
		keys: 1244,
	},
	"ja": {
		bytes: 110859,
		sha256: "183f9766c5668850b75ba77439f0db482eddac8e4bcfc35d2fdcf76b69aae105",
		keys: 1244,
	},
	"ko": {
		bytes: 101760,
		sha256: "4e2870c2082c25491492f9e82eb8a9401a492ec5e1e503ad70cb75bc094a3ddf",
		keys: 1244,
	},
	"ms": {
		bytes: 91543,
		sha256: "b735db3f63b4cb845dc743774e8573ad45274d4bb9ca921d4b86d953d8c0ab30",
		keys: 1244,
	},
	"nb": {
		bytes: 92086,
		sha256: "80ad3b13c1ea37a08e37c877a81f227227b455f79b8289c67ed6a0ceffee6e73",
		keys: 1244,
	},
	"nl": {
		bytes: 95312,
		sha256: "412e5691a6165833efd72f38cbe36fb62566fdf3a38fe206b670d38c462fb7e5",
		keys: 1244,
	},
	"pl": {
		bytes: 95563,
		sha256: "d7324e175e2e4c738c3ea1ca3abf98a4ca54701c6d114158c2c51ac327cc1ff9",
		keys: 1244,
	},
	"pt": {
		bytes: 96802,
		sha256: "e9f7e650835610264f8c795d454b9d2e0014f4ccae7b8c81b2b0e43b895c1367",
		keys: 1244,
	},
	"ro": {
		bytes: 98634,
		sha256: "df03fb4132928b1b49e2af84cd8552f848440ca99ab471925dd3d10328780c83",
		keys: 1244,
	},
	"ru": {
		bytes: 134747,
		sha256: "4b9e962faed69122c68358154db65651fc6ce72eedf9e3e1b86f181621a1edc5",
		keys: 1244,
	},
	"sv": {
		bytes: 93316,
		sha256: "e6e8520dbe79f1363c9a108150bb5673c7e8f7cba93609ab96fa22b3ec0d7c63",
		keys: 1244,
	},
	"th": {
		bytes: 159803,
		sha256: "d3d6a773cd93b6a9786c61291e1bfaf15c16f606eb3004d918b9f05dbb0722e1",
		keys: 1244,
	},
	"tr": {
		bytes: 95069,
		sha256: "13b9597d346b386f0b5fe96f04a7ad8603e0c6200e205dd4286c88c35bec15bd",
		keys: 1244,
	},
	"uk": {
		bytes: 132512,
		sha256: "90f44c46fcec9ea9fa8d461f4f8a0224765671bcff416566fdcab23cd6fbcf00",
		keys: 1244,
	},
	"vi": {
		bytes: 106093,
		sha256: "8bf4ca616d2b50e3ae0bab02547dd57f01a443ca9599198809295483a1583005",
		keys: 1244,
	},
	"zh": {
		bytes: 85973,
		sha256: "9c38175d037fee98c6c7547760514f74da0fc591d75ce02c721bc609d7f56cb8",
		keys: 1244,
	},
	"zhTW": {
		bytes: 86283,
		sha256: "9425b6033d7c3e553c08b11b584f25ffd38108c8f09dab2399cd2ab000a321f8",
		keys: 1244,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
