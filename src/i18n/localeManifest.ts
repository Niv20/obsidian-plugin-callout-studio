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
		bytes: 58537,
		sha256: "910aafb5a1631f49ddbb90db6cc37e2f2ed461d3ac72b447e540756c186c8367",
		keys: 715,
	},
	"bg": {
		bytes: 67490,
		sha256: "92268d1546a32d0cecd66dfe256621fd174c7f8832e99373e9e14b5572d2a694",
		keys: 715,
	},
	"cs": {
		bytes: 48192,
		sha256: "4f836832b37ff166f3e7769b1964ab2ccfaba9152c33353fd427d0248dba7eff",
		keys: 715,
	},
	"da": {
		bytes: 46428,
		sha256: "58f5711f266183d3891b50ad68382c7be20612bd27461bbd21614dc0b56af581",
		keys: 715,
	},
	"de": {
		bytes: 50374,
		sha256: "a00b7813c0a6c2029f3fef09c80f13918f5d4cf59120522b9d62523977ed1910",
		keys: 715,
	},
	"el": {
		bytes: 70674,
		sha256: "60dc6a49d3563d8038e41479bd71d24980eed4125809802d52b91d9cbce17963",
		keys: 715,
	},
	"es": {
		bytes: 49298,
		sha256: "398cd780518df3da65603782d5bd58d2f40794546f3bc19d7df6c2f84d410865",
		keys: 715,
	},
	"fa": {
		bytes: 62907,
		sha256: "dfe0cd7ed234265baabddd2fe5af2d4ad303f1f310b43f558d8fb8e308893220",
		keys: 715,
	},
	"fi": {
		bytes: 48352,
		sha256: "98256a0f8e89fe2e9d9d1053d9d24356cc1b6bff992cf80d5ad3ca1b49a8db3e",
		keys: 715,
	},
	"fr": {
		bytes: 51080,
		sha256: "2957fb94fe76d3e88d1488fa2479fa2287b1faf62a1a74014bdb1fd8aeb6558d",
		keys: 715,
	},
	"he": {
		bytes: 59067,
		sha256: "1dfc50be63dc6e1d68ab96c98140a4f04aebe1f2cb50a0c8e637efa8c93a52b3",
		keys: 715,
	},
	"hi": {
		bytes: 78210,
		sha256: "8718a531f56c3790314dd2fb1c4f68779fc8283260a348c3db6d8caa117164d1",
		keys: 715,
	},
	"hu": {
		bytes: 51011,
		sha256: "322bc8999bfc1282210c95886119096a8a6b0611f4a510ae139275120fac145c",
		keys: 715,
	},
	"id": {
		bytes: 47255,
		sha256: "e5f21169c44b0d01b6cd7ea2567e960de577776d23c806cb1c09d4182515116d",
		keys: 715,
	},
	"it": {
		bytes: 48881,
		sha256: "f3d908bac408d02fa28d79ce1b2b64524a9182f84df3e1f85fadceb155de3d8d",
		keys: 715,
	},
	"ja": {
		bytes: 56572,
		sha256: "9d18a5add3d217bfb15e97afeb413c6ae5f0d925760e61743566fbb6bddbfc2e",
		keys: 715,
	},
	"ko": {
		bytes: 52352,
		sha256: "3b1257e0e16ac5a08c1c0f4f3acc790bd3f4186198f2e667c737d8648fe0480e",
		keys: 715,
	},
	"ms": {
		bytes: 47169,
		sha256: "fe6dc89d535becfcce296d4e17a05583f020bc981b7da82898bf5f6ac8f8a6a6",
		keys: 715,
	},
	"nb": {
		bytes: 46475,
		sha256: "56953fc6dfa4c97b22269f6bda471681881e83f631b653171e2b42f54252fe63",
		keys: 715,
	},
	"nl": {
		bytes: 48550,
		sha256: "72a8fc0a55fd2b3580e277323419c5f108f6161c9cb7f2df9fde8c52ce8d38f1",
		keys: 715,
	},
	"pl": {
		bytes: 48325,
		sha256: "57286b9eab6a9201cecb4c7f0681d082ef8848f7161c2056df3152fdef8ffc80",
		keys: 715,
	},
	"pt": {
		bytes: 49078,
		sha256: "d5896311524c3812b9ed8570f786ac554f24417080ddc47794a5f727dbabda43",
		keys: 715,
	},
	"ro": {
		bytes: 49678,
		sha256: "d3b5c44d72fa1597394ab0c96a1ebbfafc467c49997d3eaf4fca75fec69ba4e0",
		keys: 715,
	},
	"ru": {
		bytes: 66573,
		sha256: "dea07c64512da511e5b76e7ea1fc8daf0c9697a4c4dd8412e202e00f6cb76275",
		keys: 715,
	},
	"sv": {
		bytes: 47069,
		sha256: "65ac794bb66fb48949b02630c15559d88a157a5e9042b242e0c469ef9b19bd10",
		keys: 715,
	},
	"th": {
		bytes: 76158,
		sha256: "aa7ec239110c7f5cfc9bf0b6aed9443a7840b2c7f01a507d9905c54a07dad720",
		keys: 715,
	},
	"tr": {
		bytes: 48590,
		sha256: "0f08604a05a21500b788674a2446522b7331c2780df1124b49f4ad6d3edace81",
		keys: 715,
	},
	"uk": {
		bytes: 65290,
		sha256: "1459b82ca56e12ff388399ec9cf33ba9b6d38a24e3fdef9f4070b1d8466fda3f",
		keys: 715,
	},
	"vi": {
		bytes: 53440,
		sha256: "b7c1edb535be634ee8ecaa9bd4d5976e05e06af1b54cb8048ba4cf465b6be7b3",
		keys: 715,
	},
	"zh": {
		bytes: 45004,
		sha256: "46a89e60d1093daa5fa9cd71073fbb625d730ee08ac061e4021c28bcc41868a4",
		keys: 715,
	},
	"zhTW": {
		bytes: 45146,
		sha256: "d5b866fbad80d57c614226165224a163a7e392f1270ec6e9026d99336f776d3a",
		keys: 715,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
