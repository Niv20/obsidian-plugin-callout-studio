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
		bytes: 80622,
		sha256: "fec2df668bcb9161883c596c2906de01ad30321329531369a272c191e296e4c9",
		keys: 869,
	},
	"bg": {
		bytes: 96003,
		sha256: "a177b56fcb9a58ca9663b806718d4ba187f0a5e67949e8bcc1e9b8a506cf4134",
		keys: 869,
	},
	"cs": {
		bytes: 65687,
		sha256: "93a55f70cdd565f2617eabac34fe330995bfdddd460524802f3c2fd7ea59d17b",
		keys: 869,
	},
	"da": {
		bytes: 63367,
		sha256: "59e317d5eb1571839129a069ed28d39b1ac56d0a989f1a7e9ea230f3ab0556f8",
		keys: 869,
	},
	"de": {
		bytes: 69487,
		sha256: "3aa94d5d083fdac545d1d081d756fe8fe412bac2cd59f9ea6e81edd70dc1f42b",
		keys: 869,
	},
	"el": {
		bytes: 101423,
		sha256: "c9e74cea6b8b963df233e26e74ce0bf2797e128e9a05b420372c3e52be9cd6ca",
		keys: 869,
	},
	"es": {
		bytes: 67272,
		sha256: "388fabd2f6abc1c8dbae6f4c38105f43a69a95eb117021e4cdf6b6b544f6216b",
		keys: 869,
	},
	"fa": {
		bytes: 87664,
		sha256: "71477d9cd5004092d35a201f07d5ea9554c68aa6517a8f6372308bec36a744ce",
		keys: 869,
	},
	"fi": {
		bytes: 65440,
		sha256: "194d92eba836cc84fff829a7d1a7e027e791cde0a1e2d888e897988f94b3b554",
		keys: 869,
	},
	"fr": {
		bytes: 70161,
		sha256: "64804de33bf47cff1a01bdd708403d35218553322afcff92836da72bea80a003",
		keys: 869,
	},
	"he": {
		bytes: 80081,
		sha256: "91b8f3d9307e9e80905d7be4983633eb9fc84d51ea17936e6ef2eacb7c964e02",
		keys: 869,
	},
	"hi": {
		bytes: 111090,
		sha256: "36fd94260117a219ce45642654d2bdb3951978b7fb2dda1ece42463e80913499",
		keys: 869,
	},
	"hu": {
		bytes: 70040,
		sha256: "1eb64e626ca54c7bb45b29a9d9f438b8e7fa4181408c4e1e0415bfc8484f6276",
		keys: 869,
	},
	"id": {
		bytes: 63485,
		sha256: "5c459bdcf7f8fb8f7cbb91268457602c3eea3533529768a380b994fe3d3360ca",
		keys: 869,
	},
	"it": {
		bytes: 67082,
		sha256: "d769d4fa018ed3f243defa5210955ae7d53507d3863aaa43ac26e1aae5e7d442",
		keys: 869,
	},
	"ja": {
		bytes: 77441,
		sha256: "a10bfb4dd60f492a5797bca236fa2a4497a4bd704053bd3c69a7b32647ab8d70",
		keys: 869,
	},
	"ko": {
		bytes: 71087,
		sha256: "563ebc4b297a655d9d69cfa9e8646d105d34ef0002b304a8cbf512b18aa398a1",
		keys: 869,
	},
	"ms": {
		bytes: 63326,
		sha256: "075b154c9afe28180b941aa26fa5b21c975b65cf132a148f836425fa7ec723c9",
		keys: 869,
	},
	"nb": {
		bytes: 63583,
		sha256: "2972e98b0185942f4d548e6564e9d7807eeea99eb653dca8f089da279764585d",
		keys: 869,
	},
	"nl": {
		bytes: 65929,
		sha256: "2e0cc948d6d4649958fa8c438d9f212b42483592bc5d3f617b21822b03278bc5",
		keys: 869,
	},
	"pl": {
		bytes: 66402,
		sha256: "b943dd85eb9d78e1c5a85791bfd535a0570a4973ba132d486ed8b1c345ed8a41",
		keys: 869,
	},
	"pt": {
		bytes: 67075,
		sha256: "3e02d2342c45792d41632292a2ad2101e97e5f40129d3130ba84757b0fb35753",
		keys: 869,
	},
	"ro": {
		bytes: 68200,
		sha256: "a54650e79178e461dc3845c40a8efaee896441ef3f4d19fb944d2a44d37142ea",
		keys: 869,
	},
	"ru": {
		bytes: 94128,
		sha256: "583b71d554b5fd8ef76b5fc32c223c713f5ba1750a906c61582f65143f9227a3",
		keys: 869,
	},
	"sv": {
		bytes: 64525,
		sha256: "2fe3be0076b0d44cde06fef6a7b967358665413c65b1ec8294d6c2b7e953009c",
		keys: 869,
	},
	"th": {
		bytes: 110747,
		sha256: "36e54e2d8fc557b126bbe79c460b1484ab31e34dcdd0708575d01c60546fdc3a",
		keys: 869,
	},
	"tr": {
		bytes: 66030,
		sha256: "451fcf859683858c1672bc51fa47590f8d1fff9fc7b525832bcb01c5ba5bdf81",
		keys: 869,
	},
	"uk": {
		bytes: 92264,
		sha256: "29ca471999ef2ef952245d452caeb261afbb2213318acf087f902d41951b0a81",
		keys: 869,
	},
	"vi": {
		bytes: 73654,
		sha256: "a174eef8b029856797f156c6d4ded7867d31b066f14c8882dd21d56ad9044f82",
		keys: 869,
	},
	"zh": {
		bytes: 59558,
		sha256: "d0fae3ddfa72da6fa5c88ae4f0354f1050046c9411a720f714ba0067652f291d",
		keys: 869,
	},
	"zhTW": {
		bytes: 59778,
		sha256: "e66fc1c5380cfb9680dbf74a6135ed68f072525bcda7d76e1a1a068a705e5f5f",
		keys: 869,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
