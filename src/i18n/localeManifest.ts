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
		bytes: 84851,
		sha256: "692eb3ae9c917012d532fb466e1d89b88f7722b774c4e6b09b650e14c20c1219",
		keys: 905,
	},
	"bg": {
		bytes: 101357,
		sha256: "89e30c9cb838bb739d8b956653bed0698b8b25489c0f89be73a01442fe37cddd",
		keys: 905,
	},
	"cs": {
		bytes: 69198,
		sha256: "8a332f806faf475e666b34d2c44a1acb4a67e83cd5680a67dee88f9c3fafe772",
		keys: 905,
	},
	"da": {
		bytes: 66655,
		sha256: "114e932ff4239ddce4b55cdefb69deb36f0b93fc13afb4069de9fd1e890fa9a2",
		keys: 905,
	},
	"de": {
		bytes: 73254,
		sha256: "1bdd9ceaf95df8f98fbe2a4d4dabe1aa684321b4c8891383606d4f0bf8edd542",
		keys: 905,
	},
	"el": {
		bytes: 107184,
		sha256: "daefc64eb6f86b4ec681de40cd094a1438694ef04092a29eae2399151976ea3b",
		keys: 905,
	},
	"es": {
		bytes: 70752,
		sha256: "f57ed7723760569fa768f5d1580bc665d81319f9ccd81093d8f062dcb5cf81c0",
		keys: 905,
	},
	"fa": {
		bytes: 92666,
		sha256: "a76a500672c14582b06284a3975889abef95c0bbd5d65bbf4cbf024342282eea",
		keys: 905,
	},
	"fi": {
		bytes: 68806,
		sha256: "ae01a46961491f4187ab9542c3cfbe96da3e104c0d1dcbe3a368b892edf5e24f",
		keys: 905,
	},
	"fr": {
		bytes: 73870,
		sha256: "625254e0b23d14629697055fa21596453b1559d8168549174b3e55f5984a5ce0",
		keys: 905,
	},
	"he": {
		bytes: 84206,
		sha256: "659098511eb51d2d16f98a636dde2e416c3a59d9401235cc9c66e7f6e3047fd2",
		keys: 905,
	},
	"hi": {
		bytes: 117695,
		sha256: "3250fc4c5b65c0e2fc3aaf38c982bb70c64bf49729d375245279faed2db5ace9",
		keys: 905,
	},
	"hu": {
		bytes: 73826,
		sha256: "41827b569981a88758c7b8c4f05d1adc68ecf0df83a3b29defe06cb3043c7c6c",
		keys: 905,
	},
	"id": {
		bytes: 66836,
		sha256: "90cb1573eaee24c99f9e20ee41f2fc78ccace3830cc3a52d1eb8cc2a87516ca4",
		keys: 905,
	},
	"it": {
		bytes: 70637,
		sha256: "97420be2cbcaca2045c8d8acfd5b1f3bdd79159da322715e33ebd010ee9b4e8b",
		keys: 905,
	},
	"ja": {
		bytes: 81776,
		sha256: "42604e677c9ca930f671fe7c4455fd1554c2875fd976ba000675263e70637e41",
		keys: 905,
	},
	"ko": {
		bytes: 74889,
		sha256: "5a8bab3c1cad8933d8e15e78767e823b7f9943668d8bc997626a7ebdab13d615",
		keys: 905,
	},
	"ms": {
		bytes: 66682,
		sha256: "8744c2918707cd30ba1f1689a0b1d71ebb74f05c2805b82539016b9708e176c1",
		keys: 905,
	},
	"nb": {
		bytes: 66874,
		sha256: "49becc1d18ce7597869a644c657bde0707cc9c561f24383de18fff948b7f38e6",
		keys: 905,
	},
	"nl": {
		bytes: 69549,
		sha256: "28327d902ddbb2240a4719c3fb109f47cbc03158ded40b3f83df4114505def46",
		keys: 905,
	},
	"pl": {
		bytes: 69845,
		sha256: "088bbcfc284cde7307852e5acdbbf308df9a15018e656d4568a7e4801a3e3456",
		keys: 905,
	},
	"pt": {
		bytes: 70667,
		sha256: "006873712326d040105ded680be6343279c9600ee76babae6c8704b19752ed6b",
		keys: 905,
	},
	"ro": {
		bytes: 71793,
		sha256: "ab03ea2362a95b231c2ae994c491cccca9f7284ec587bd695e3ffd58f16ee65b",
		keys: 905,
	},
	"ru": {
		bytes: 99442,
		sha256: "aa59b42a5f55694016073ef154e03154f197577d3602828d570cd46f7c974218",
		keys: 905,
	},
	"sv": {
		bytes: 67927,
		sha256: "cc00b64a7a574f056e76832859d5376fb2eea14e13047ae55c7b8b7422e02470",
		keys: 905,
	},
	"th": {
		bytes: 116969,
		sha256: "0deb5c939ee4f26b3dcb979258c7660c774f646c0ff3f2ca2c95eac0a611c8f6",
		keys: 905,
	},
	"tr": {
		bytes: 69395,
		sha256: "808e2a09a97996e2c13766aad6e90c990993842cf47b51fed010b9bc5195d5a4",
		keys: 905,
	},
	"uk": {
		bytes: 97407,
		sha256: "2c8f891a79bada23ad0ac738fea904681b831df1cc6b975f907a1ccfedc6068f",
		keys: 905,
	},
	"vi": {
		bytes: 77652,
		sha256: "5c84f319b640dd66f4031db4e432d500e6e2100d6c170d5bbb919e690f2e38d7",
		keys: 905,
	},
	"zh": {
		bytes: 62594,
		sha256: "f88d67585c7d7dce08c2cbd2fdf4d8b5248303e5b1fbc604d4e08ef96b1cd118",
		keys: 905,
	},
	"zhTW": {
		bytes: 62847,
		sha256: "9804f6ec1e641d6dc3cbe25feff85c888cdc8378032513925c38ed9c6a8c46c3",
		keys: 905,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
