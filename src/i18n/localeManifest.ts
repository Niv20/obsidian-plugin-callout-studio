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
		bytes: 59571,
		sha256: "c194f38f5d94dfe2a05160a6c4e27425a4387fe3a31bb04f3458a0cd66704dd3",
		keys: 717,
	},
	"bg": {
		bytes: 68317,
		sha256: "f5510338ee75b32bc773a062935f086b58f5be129056d303c376e55e0ff75a12",
		keys: 717,
	},
	"cs": {
		bytes: 49243,
		sha256: "bf4c7c6184ae97de70a58190e6241482fa2c7694993115a94e95d85593462cef",
		keys: 717,
	},
	"da": {
		bytes: 47470,
		sha256: "a120755353cbc74bae347032728dd4617c33205458948bb256b08f0b114d0841",
		keys: 717,
	},
	"de": {
		bytes: 51397,
		sha256: "f6091c83deea81abd87baa0c9c719eabf1c784a444d1b54d8a5c335a72d30914",
		keys: 717,
	},
	"el": {
		bytes: 71719,
		sha256: "ce77b6a3b7a42ec7f9938612f33b8f543452dac11501c929d460ca8bcca9d43f",
		keys: 717,
	},
	"es": {
		bytes: 50307,
		sha256: "b76e0ff261bbae78d9023742a571516cb72fba4be0ba965330e78d936bd50550",
		keys: 717,
	},
	"fa": {
		bytes: 63814,
		sha256: "bef2a35c0f0e2f4c1f1c24850ea5f8c075cd310ee9eea9d92a86523850a50423",
		keys: 717,
	},
	"fi": {
		bytes: 49378,
		sha256: "9f8ab5fd33fcc5f8f14c20e8ddbc9b7ca787bfe7668700b125fe42ce0ad8176a",
		keys: 717,
	},
	"fr": {
		bytes: 52020,
		sha256: "d6d39dbe43c5c9d04ddbd8d4b4a1fce60ec880c4b3f84dae38de67c164eb04c4",
		keys: 717,
	},
	"he": {
		bytes: 61111,
		sha256: "bf45b6801e704272708ab2d1f93a1ab8d5408d7bcf8272b920c1d3b05f504b01",
		keys: 720,
	},
	"hi": {
		bytes: 78937,
		sha256: "56e161c750ab50e2e689ed1f8dad6742893332d008a13801fac6e5f32e413e3a",
		keys: 717,
	},
	"hu": {
		bytes: 52025,
		sha256: "ee971ff6033208acf90b34cc0e8c5b558090515de488973731d9355c918787cc",
		keys: 717,
	},
	"id": {
		bytes: 48169,
		sha256: "15be061ff0c2e4046763f1e95e9a6ad6260419fcef99fd57b41dfa198633d3ce",
		keys: 717,
	},
	"it": {
		bytes: 49932,
		sha256: "b7bf863a066734319558cdb485c249716e81b571d432b8a9e19e422fc29db1e5",
		keys: 717,
	},
	"ja": {
		bytes: 57693,
		sha256: "a5c93eed1725813f27b66e69fe4238ea1f30d0b09a49664fbb6a3514e135451e",
		keys: 717,
	},
	"ko": {
		bytes: 53461,
		sha256: "636d9679e36b3e6c4706983fa650e259ee6ae749e03e756cc0411c186f2b3698",
		keys: 717,
	},
	"ms": {
		bytes: 48131,
		sha256: "33378ba8ac5f74440ec1e8e93abf41568ec21b6d266dce74910afddcaca756c0",
		keys: 717,
	},
	"nb": {
		bytes: 47528,
		sha256: "503621b0cb49c31e33a6211fdd11acd0a095669bc77baf5999f402efda48cedb",
		keys: 717,
	},
	"nl": {
		bytes: 49551,
		sha256: "6d8f89a62ed7445e0fb4f47b2e8208e91b70e3cc7a74276549a1403a1f3c5586",
		keys: 717,
	},
	"pl": {
		bytes: 49396,
		sha256: "bc7807ab919c6ef425c87d070a6241589203bc2b4658deb39cd15e4e3ddfbdc5",
		keys: 717,
	},
	"pt": {
		bytes: 50069,
		sha256: "3dc3ace9d01fca12321db33956b2887e0794723ee53c50697fbc8f4760d38d43",
		keys: 717,
	},
	"ro": {
		bytes: 50785,
		sha256: "4d277632cd8cbe2b34679f301631ec8f26ee51ca70b6055195ff839471d4c4e1",
		keys: 717,
	},
	"ru": {
		bytes: 67447,
		sha256: "eb2171e6b785d73894028cc7657774ede5837910c088892993744a90e77f13c3",
		keys: 717,
	},
	"sv": {
		bytes: 48151,
		sha256: "73f59ac383c66ba6e00e6da24da095f3c649c993b0c61992f4e343b1f4de439f",
		keys: 717,
	},
	"th": {
		bytes: 77070,
		sha256: "1821bf098a50607f5ef02d797a22e0630ee3606045071203ae608f03390de5d8",
		keys: 717,
	},
	"tr": {
		bytes: 49562,
		sha256: "87f760befe47207afeb5aff9ca622bf0ae4c7cf5a181d8e3c66e202e61c18e77",
		keys: 717,
	},
	"uk": {
		bytes: 66188,
		sha256: "43af000743fb963576b7388449c66f48a82ea9aab4a9b2af1cfced7edce09dca",
		keys: 717,
	},
	"vi": {
		bytes: 54482,
		sha256: "7eab27b6bc273152c88a7ef4cf19db4a1e40bbd48283fb423b31e3afa8b35878",
		keys: 717,
	},
	"zh": {
		bytes: 45998,
		sha256: "3d2f5e9c0547b50200ec5a1b695d1c1f7e908f0d968a24a40216d0104ebc02ab",
		keys: 717,
	},
	"zhTW": {
		bytes: 46150,
		sha256: "9c072d1e3ee4ef787b34f4a733c42863945e62e8be7241650040e2bf3e305aeb",
		keys: 717,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
