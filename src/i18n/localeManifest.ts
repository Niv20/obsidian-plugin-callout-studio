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
		bytes: 78598,
		sha256: "b4c8368a43637ecc26f3eca9b349a0748a64eb51b6e7ce440bd287626d970737",
		keys: 860,
	},
	"bg": {
		bytes: 93314,
		sha256: "60a62e81caf56f93833f95fbef8595bbfe5aef57e07fe63df1b4fc8abc5bfc14",
		keys: 860,
	},
	"cs": {
		bytes: 64121,
		sha256: "3e9d65c1ef1df921ae4e80c0596a55d6ee452dafa3f6223bbf84d9a40a59608c",
		keys: 860,
	},
	"da": {
		bytes: 61864,
		sha256: "2ca1e4d60b57ebc647c624ebaa09a59ad4e7c05c802cb87a850aa202956ee995",
		keys: 860,
	},
	"de": {
		bytes: 67779,
		sha256: "db8b7e5d6e1e1b8a2efb3a9b863d5308e6ae64b28d0e13e8fdecb6d9330dcfc7",
		keys: 860,
	},
	"el": {
		bytes: 98584,
		sha256: "549b27aacc2f4a03c4bfeee5e7942158be0004e537394f9727ca9711272030eb",
		keys: 860,
	},
	"es": {
		bytes: 65640,
		sha256: "c89b9005f84002094be978e59b3ffbd9bfc0400e9dc22e3b05a4b95243a7978e",
		keys: 860,
	},
	"fa": {
		bytes: 85272,
		sha256: "355d25a65b17f392321569af5f6654a22aae5c633cb595dedbc8b679a029fdfb",
		keys: 860,
	},
	"fi": {
		bytes: 63945,
		sha256: "ffbda417c451f22092654709a44dfc5db97feb1f2b3d01107e82417a51e9a620",
		keys: 860,
	},
	"fr": {
		bytes: 68403,
		sha256: "0efe2d02b61877bb4e422b9345ad2d1ecbe03964e986c2aab8b5555bbf2c0bef",
		keys: 860,
	},
	"he": {
		bytes: 78303,
		sha256: "f836b18748b58ce5db4efaeb12e5c981f5e3d9e2f427965a93da483f1c24acfc",
		keys: 861,
	},
	"hi": {
		bytes: 108034,
		sha256: "14b64d7c54b5dc2ebbffa6aecd3efe285cad35154c609c0695d890bd9b45e31a",
		keys: 860,
	},
	"hu": {
		bytes: 68217,
		sha256: "ae60b0a66804aef142af622207a1068d8ba581631bd76289ad5baea9e3ca90d3",
		keys: 860,
	},
	"id": {
		bytes: 61946,
		sha256: "d9d950ef84d6383d9fc2af737de42ab7a9e820f5c83c80083ba45c65c122e3dd",
		keys: 860,
	},
	"it": {
		bytes: 65440,
		sha256: "874635f7f4d6566fb550a2cf6106a69947524e8402a1da0931bbc9688044ced7",
		keys: 860,
	},
	"ja": {
		bytes: 75551,
		sha256: "41e91e448d1f86d860a2a7e90a59d28a8f3fc87806be1cd89df7b845734fb7f0",
		keys: 860,
	},
	"ko": {
		bytes: 69442,
		sha256: "d67be1c1a8c658a73a8783ea01ec3e0a216340e6c6318eba88d81fb3705fb7d4",
		keys: 860,
	},
	"ms": {
		bytes: 61781,
		sha256: "3c9074985dff25240befb23120a5b0611e771817dc2aeed6a581fc943c313ed9",
		keys: 860,
	},
	"nb": {
		bytes: 62024,
		sha256: "d0cc9b973045008b5d2130deb81ae85a7ce103ffc2392e7428ab521b24921333",
		keys: 860,
	},
	"nl": {
		bytes: 64328,
		sha256: "ca14460795c63b98e0eb17fa785038be831354326848e78f05098b4bf6487582",
		keys: 860,
	},
	"pl": {
		bytes: 64782,
		sha256: "09c4c88acbe9ed1c4481cf4eadb4ca1abc9cfeee66691ff9b766c7912b396de5",
		keys: 860,
	},
	"pt": {
		bytes: 65411,
		sha256: "677a3cc28338de4ca1ad6f547d381c2e1cf31006e490e2ab0654b1e46877b285",
		keys: 860,
	},
	"ro": {
		bytes: 66523,
		sha256: "ea1ab4413e6286e510949710e29b0eb5da3d7cbe59235e244996915683bb8a73",
		keys: 860,
	},
	"ru": {
		bytes: 91484,
		sha256: "2843f6975e6a400acfc80578a6642b8fd691d261eaa2aacf44977eda51f52d76",
		keys: 860,
	},
	"sv": {
		bytes: 62944,
		sha256: "3c9f1242193503ef4bc482844f041ad0c1a9715c483edf4e695552425ac532ac",
		keys: 860,
	},
	"th": {
		bytes: 107430,
		sha256: "9e1231e473f46d43a754345330d4c2f3f4ff547747b5132c24a7f898e3ae2efc",
		keys: 860,
	},
	"tr": {
		bytes: 64500,
		sha256: "586b434289bbec5f281865ee1040f86b4bc69b28bde68dc7d29c8ae33260b6eb",
		keys: 860,
	},
	"uk": {
		bytes: 89695,
		sha256: "c9aa43b82037c218efd42fd8b370b98a154561b73753f683119ff7b548b2f447",
		keys: 860,
	},
	"vi": {
		bytes: 71785,
		sha256: "d314f82ecd88ad4bf379782fa3f4b6652dae3d3c2a7c12c6d0b395ded5f96424",
		keys: 860,
	},
	"zh": {
		bytes: 58258,
		sha256: "c168da4560c2013c9e71e98d3e6a791930fb4d21179dc1f1e3a9ee111a7476e8",
		keys: 860,
	},
	"zhTW": {
		bytes: 58493,
		sha256: "d3e504b8d799248b1510e1c78fd837af4e30c3f47f3f8e879077e235e37f9b93",
		keys: 860,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
