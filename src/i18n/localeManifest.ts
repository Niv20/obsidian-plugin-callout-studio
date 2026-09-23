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
		bytes: 68695,
		sha256: "dd269909127cdfa73401ff8daca905e22cb0c0b21911992e793d62526303048c",
		keys: 768,
	},
	"bg": {
		bytes: 80631,
		sha256: "3bbbff83c7663444a907ca28f75b668217c17b42e3f51c17936fcfd48ec407c4",
		keys: 768,
	},
	"cs": {
		bytes: 56464,
		sha256: "61c8f433ee2087419d44e842e8aabf58f0ca8b23aa0037805d6df102d1258473",
		keys: 768,
	},
	"da": {
		bytes: 54308,
		sha256: "6ae5dd8d53e975be6c636313f931462518710eccd695891670aa32e2e422046e",
		keys: 768,
	},
	"de": {
		bytes: 59389,
		sha256: "31bfbce8f79ceef0534e99721b05c8d6b6febf289f4cd36d1ed20da6665d50d4",
		keys: 768,
	},
	"el": {
		bytes: 85079,
		sha256: "7113f2a28bdbc0173468107ee34789e44386881b8e38a70866df625dc45660a6",
		keys: 768,
	},
	"es": {
		bytes: 57720,
		sha256: "940c9776900b4d7443670f8b4d7ca3db4decd9eac680923462e3625a3c1f4b8c",
		keys: 768,
	},
	"fa": {
		bytes: 74156,
		sha256: "d777d94a305ee1598f57fd6ccc543f2a12570cefb21deff4a2827018f8ce6bfb",
		keys: 768,
	},
	"fi": {
		bytes: 56319,
		sha256: "3fc05d495b39d24700ad3aaccba877298b7a20e90be8f7e3a1e8d1c99eff6ab8",
		keys: 768,
	},
	"fr": {
		bytes: 60049,
		sha256: "2bc947b9475500ecebeacdd41606d21f096163ea748f08161a48bfd7533b797e",
		keys: 768,
	},
	"he": {
		bytes: 68878,
		sha256: "9fa9a443fef8a0a7357ec2ace5081c3a56bf1153577ae9ee3d3fca382d8f2498",
		keys: 768,
	},
	"hi": {
		bytes: 93180,
		sha256: "caca552783db172a3c6553419418fd06fc1f7748f208e857536532d8ef09b693",
		keys: 768,
	},
	"hu": {
		bytes: 59856,
		sha256: "b9b2a1d9376e3ce862e29cfa907c35ae8e9227212d93fb59138b2097f03551ab",
		keys: 768,
	},
	"id": {
		bytes: 54710,
		sha256: "c3fc4a0d60757671fd0dd0a32e9f7de351a8f8cde2d136817ce3fbce15c59393",
		keys: 768,
	},
	"it": {
		bytes: 57482,
		sha256: "e094a409c27fd36fc3b11b8af9c862d1bb457b46d943c5b3c062167456e29452",
		keys: 768,
	},
	"ja": {
		bytes: 66475,
		sha256: "dc26a6a44a611d961c5885aed0987413125b76bcc1bfeb70efba37d23725cf4b",
		keys: 768,
	},
	"ko": {
		bytes: 61071,
		sha256: "50942c291715ff9333d0176420f19c375de82a141a38d16567030299fd874c82",
		keys: 768,
	},
	"ms": {
		bytes: 54587,
		sha256: "9b517685480eb4e2436dd37e488626383b3a308aa557038b714ec13c7856ab8d",
		keys: 768,
	},
	"nb": {
		bytes: 54411,
		sha256: "2cd34eb911cd23c084a76398f9f74d65d4f07938190a0400d7ef29e3462320e3",
		keys: 768,
	},
	"nl": {
		bytes: 56658,
		sha256: "0c5382a29cdb0947595a98ef2937a44ddf451a7def3bbba044caf27f969128fc",
		keys: 768,
	},
	"pl": {
		bytes: 56801,
		sha256: "e59179be8972d669a0e4fb78237638666bdf04222e799a783ef8523465d9a423",
		keys: 768,
	},
	"pt": {
		bytes: 57634,
		sha256: "89727f113a73861a5b8795765b70c96be96450a432f64a7cbc533ec0e47af05f",
		keys: 768,
	},
	"ro": {
		bytes: 58223,
		sha256: "8deabbde9d0b513c15837819908915fb40fd56da49b7e9f615e2c3cc134e8034",
		keys: 768,
	},
	"ru": {
		bytes: 79308,
		sha256: "ceeec849540a5734b8612c3049dcbe5c530cd6f8ddc1d96fef0bd91a9a7d9964",
		keys: 768,
	},
	"sv": {
		bytes: 55269,
		sha256: "e5d682bb37b805acfd30e350b2b80bccd6d94b12690bfcb6347ba568c5b23e60",
		keys: 768,
	},
	"th": {
		bytes: 92343,
		sha256: "32e157fdbfdd5dccbb46c827d16e67721e6aff92c8b9630e90770eb343e85996",
		keys: 768,
	},
	"tr": {
		bytes: 56583,
		sha256: "963c0692245f76863189fc19dfbeec8eb05a0eacb3b502864008335846e0175d",
		keys: 768,
	},
	"uk": {
		bytes: 77683,
		sha256: "6f70a481ea497a34b692e2ed84bf7dc103ad75a9b24d5aeb07105af89f914451",
		keys: 768,
	},
	"vi": {
		bytes: 62570,
		sha256: "79ff5fd5cbe178a450e5a3b1f086efbd1ec5b8873221376e447a57a27368757a",
		keys: 768,
	},
	"zh": {
		bytes: 51628,
		sha256: "205b81a1ad2668160053e989aab8545d8b7af1c9d557281ef2ee9d581a19cb9d",
		keys: 768,
	},
	"zhTW": {
		bytes: 51781,
		sha256: "cbaeb5a3168d2326ffdd911c5a5203c29dd3a465c2093b65fbdf6c50055d92da",
		keys: 768,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
