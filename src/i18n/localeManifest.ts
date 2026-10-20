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
		bytes: 115047,
		sha256: "0551b7bc67f0a83df0f7c5c74701546fdedb8036fa5dfcbd35b397a28dd4f250",
		keys: 1236,
	},
	"bg": {
		bytes: 137585,
		sha256: "a27b77827e281c6031703568c076c3f123d6bb9b633412e7b8a19f6dd660814f",
		keys: 1236,
	},
	"cs": {
		bytes: 94392,
		sha256: "6515d9294878b2fadb1db871efddfb7ff6c02d22106ef40e4c7bd79e15539992",
		keys: 1236,
	},
	"da": {
		bytes: 91226,
		sha256: "eb5c2020dc776b52b645a680ca851c27af6eff6cf0d5b0b6414b7509c359745a",
		keys: 1236,
	},
	"de": {
		bytes: 99762,
		sha256: "df17bd4968615b52326fd6990164433b1ffaa8b7432bb8136eafaf14c6214809",
		keys: 1236,
	},
	"el": {
		bytes: 145435,
		sha256: "3953bebdd74cdd3473bdae45a9e652dc6ec5b1a754cb5376a80a78704280aee1",
		keys: 1236,
	},
	"es": {
		bytes: 96587,
		sha256: "e3be846a1f51f41c4d3a348233b8d58139df15021f290656c3d489ad1238cc06",
		keys: 1236,
	},
	"fa": {
		bytes: 126047,
		sha256: "6c144c0ae75d87897266b6b1d39050a1ceb875344477e592f0f599bc27cf3d38",
		keys: 1236,
	},
	"fi": {
		bytes: 94063,
		sha256: "f361852d637e9eb9f6234ce11538dbcc64cbcccf15e403e231e84cc589c91d6d",
		keys: 1236,
	},
	"fr": {
		bytes: 101168,
		sha256: "6786c6a9947e53e32105c44adf2bb534e1a8862dc50ec8ae671a0070ea436993",
		keys: 1236,
	},
	"he": {
		bytes: 113909,
		sha256: "6f413facbbb2f804614b164dec3125b4bbb6090ddb60125b15b250a7e5c511a4",
		keys: 1236,
	},
	"hi": {
		bytes: 159609,
		sha256: "8dec55f5a448bf642b64f8e2961a805fd302e69c9b24f04dd581ca50c06813a6",
		keys: 1236,
	},
	"hu": {
		bytes: 100770,
		sha256: "7bb2df3215b892a493cef2c53cf4598c248e15b90dba3f5e4b2423621509d66a",
		keys: 1236,
	},
	"id": {
		bytes: 91229,
		sha256: "47f839d9fd9ec6b946218aabb456b4d8a10789beae48b783845acf2fe91adb0c",
		keys: 1236,
	},
	"it": {
		bytes: 96988,
		sha256: "dce55d123588472cc10dff13f67f5134e1acaef0ad7a9d26d1b16a3c35df1948",
		keys: 1236,
	},
	"ja": {
		bytes: 110577,
		sha256: "c7d6d09808ef6cc986be461cf6eed3a0b513525102cc8713edfa9f53013c6fc5",
		keys: 1236,
	},
	"ko": {
		bytes: 101477,
		sha256: "feb4ae4c7ffe4a617d1edb724a0e23026805ca3d828c606696a514965847bc9a",
		keys: 1236,
	},
	"ms": {
		bytes: 91315,
		sha256: "0de1737c19271edfd435e51486bcb44d7e515904484b5d263e5225282b83962e",
		keys: 1236,
	},
	"nb": {
		bytes: 91794,
		sha256: "9f0b622ec0594162a14c96053d2c72a341503b61a23382778c423348c8f0d580",
		keys: 1236,
	},
	"nl": {
		bytes: 95056,
		sha256: "ccfaa91a182e0f53e9c653e9cd116e85ec08b4f1dd10fc3bd9835496ec0d3135",
		keys: 1236,
	},
	"pl": {
		bytes: 95322,
		sha256: "5d2c2dbb8a1ca2aa44d4f3d5ceeb3f90fafb0812f4af10018495fc328d2f580e",
		keys: 1236,
	},
	"pt": {
		bytes: 96533,
		sha256: "33aba1eb0a22695ef24c74a83a17b954124298b0de7660f0141f973b3f36393a",
		keys: 1236,
	},
	"ro": {
		bytes: 98372,
		sha256: "c28f81f9e322b88cf366823a904dbf021ae37347e9f18d00dc7f812e80d8baf9",
		keys: 1236,
	},
	"ru": {
		bytes: 134406,
		sha256: "805e907fa3b7912e85e84b61e0844b01aa62eac52d1fe2f183860191c0025b82",
		keys: 1236,
	},
	"sv": {
		bytes: 93006,
		sha256: "b6b34e0aa4b29777fcb330e48abc7a75b132398ce117e361f82ca74292a96d98",
		keys: 1236,
	},
	"th": {
		bytes: 159395,
		sha256: "a1a8f565e5cae2a2711179c60ce28717212eec672239f0221894bb6d9799b3a3",
		keys: 1236,
	},
	"tr": {
		bytes: 94801,
		sha256: "cd9d7c89427dfe5832f4fb7af8b2d38036d69b951361d4ba11cf0a81b4b52c66",
		keys: 1236,
	},
	"uk": {
		bytes: 132121,
		sha256: "97952176892587db71615d118ed59b2ae01ff081be9be3082ec547b1b6167d5d",
		keys: 1236,
	},
	"vi": {
		bytes: 105822,
		sha256: "f31e22b00b7af8b844eccb713fc3d17391159e897ba37aa6c85c430709e74b8a",
		keys: 1236,
	},
	"zh": {
		bytes: 85699,
		sha256: "8e232a1890ee02159156b14021d66b03cf910ffe0fe29cbd4ad1e44e76296018",
		keys: 1236,
	},
	"zhTW": {
		bytes: 86018,
		sha256: "67a718afdc3544b0180934fd940cd05ac906287576d49f9cf8fc70208016924a",
		keys: 1236,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
