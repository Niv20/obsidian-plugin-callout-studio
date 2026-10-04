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
		bytes: 109429,
		sha256: "8ad7126f1effc698c997157d8375a81c36aff8fbb80a70060c2c3ba8f9a814d1",
		keys: 1184,
	},
	"bg": {
		bytes: 131112,
		sha256: "52997bbb030ee11dd0219877789c7e66fedce4e16c6e88f4148ac57af086936c",
		keys: 1184,
	},
	"cs": {
		bytes: 89788,
		sha256: "d833bcf169c7351d4c6e05ef8d3049c980632cc97463fc35ec7df445727338a7",
		keys: 1184,
	},
	"da": {
		bytes: 86973,
		sha256: "4fa13117bd82c525d4fb37feb35d75e83dc37597dc153ccc6a8c3aa549bdafae",
		keys: 1184,
	},
	"de": {
		bytes: 95123,
		sha256: "0244d9b6584534d30757afc67e12692b77f011089eb6ba71e5a881cf9b76714b",
		keys: 1184,
	},
	"el": {
		bytes: 138815,
		sha256: "49594bf1326919f9189289665240e6b5aac7f3e3be7ec2e762ba97e386e847cf",
		keys: 1184,
	},
	"es": {
		bytes: 92108,
		sha256: "62b87458151ddad8451ac047505ef3010109e622f8be98993981f2db9a87546c",
		keys: 1184,
	},
	"fa": {
		bytes: 119549,
		sha256: "fd476d73fd7dface995be8c08bbf49781be656b4794d86840d2f953da7abf288",
		keys: 1184,
	},
	"fi": {
		bytes: 89428,
		sha256: "12e17e180cd1ac9d3edef9f8e58411f942fed4880e5d94113e9674932a365425",
		keys: 1184,
	},
	"fr": {
		bytes: 96507,
		sha256: "a162f92b64a5f52bfedcae7e16844145903aecdbe5d74e3fbf078651a4f8d649",
		keys: 1184,
	},
	"he": {
		bytes: 108420,
		sha256: "abd43f94f9d611518a68fd3976dde298a69b52ea31340daeab1b5bb050ae8d1c",
		keys: 1184,
	},
	"hi": {
		bytes: 151973,
		sha256: "617e467c6140df92b0cd3e10afbe71f8511d4c6f566f578b1fb355b50d62e853",
		keys: 1184,
	},
	"hu": {
		bytes: 95797,
		sha256: "642b64203d1449f7730d49d7c282d6af6a3822777721d29e732cd7c89c927fc9",
		keys: 1184,
	},
	"id": {
		bytes: 86833,
		sha256: "0eaa4dd5a2accea243525c001f1577d61c9cda8c9d270191571a03ac9d40f8a2",
		keys: 1184,
	},
	"it": {
		bytes: 92574,
		sha256: "f3a617d5b1c06219489d82158ade1bff48ef834000eaed45805a29aa64ab8912",
		keys: 1184,
	},
	"ja": {
		bytes: 105272,
		sha256: "e45359fa28204a00125872f79f19f8e982dfd61b8a090bc2c5ccb0959b0894ca",
		keys: 1184,
	},
	"ko": {
		bytes: 96389,
		sha256: "f0c63a0e219b90953989f7c22d8c1b7a58f296ec09c107eac7ef96598de31f67",
		keys: 1184,
	},
	"ms": {
		bytes: 86873,
		sha256: "6a8eaab7622fabbe2da110afaba8ccd4e96f83e5cf2e2c7b59b5d184731e9068",
		keys: 1184,
	},
	"nb": {
		bytes: 87472,
		sha256: "6eb8d52c951a1fe4a277d676924d473fcaccf1d5cd3f6dfe0ddc7aff5980a0a6",
		keys: 1184,
	},
	"nl": {
		bytes: 90676,
		sha256: "d6746e6a23c6a1323798827acb83802c4ce2a2454f2eddd5ddd0fce141e71b17",
		keys: 1184,
	},
	"pl": {
		bytes: 90765,
		sha256: "cd766e7681eb0bf7459fb368e24c5bdc2dee53da8180007a782d1b04c482cebe",
		keys: 1184,
	},
	"pt": {
		bytes: 92037,
		sha256: "ceb45b37cdff966ab61586a51e837099b1018da0919c74c9a4dcaa39ad9f4eb2",
		keys: 1184,
	},
	"ro": {
		bytes: 93720,
		sha256: "5979b0b349bfe96be94ef20c9fccc87b997d469d4c06e2fdb93808671d9e63f5",
		keys: 1184,
	},
	"ru": {
		bytes: 128296,
		sha256: "8a5187aaec101ac8998dbfe3c4334751a5ef171e9101b79a0c686d6ac9f76543",
		keys: 1184,
	},
	"sv": {
		bytes: 88601,
		sha256: "cafdcc1c022b990bd95acb25338503d1aff8d661bfd688d7c4723f0a550a6e74",
		keys: 1184,
	},
	"th": {
		bytes: 152005,
		sha256: "69f1746c91a0cffe261ffc983531800fa119d3e9805b0a947bd756816d48f6a3",
		keys: 1184,
	},
	"tr": {
		bytes: 90172,
		sha256: "c6e321789f6567fc653814cc4876c7778731da096e1ee11254a347b9ebbf90f8",
		keys: 1184,
	},
	"uk": {
		bytes: 126344,
		sha256: "87f42001d18f511aaa7162165e2617a08f7b9b025b9cb0992f7a5c66f0b1f56f",
		keys: 1184,
	},
	"vi": {
		bytes: 100865,
		sha256: "1cd953c0832b2ae57474787a1531e715903afbbcc3e2f516a202eea8e2551133",
		keys: 1184,
	},
	"zh": {
		bytes: 81453,
		sha256: "293adb604301eb7ed262ef1e7d434b0c96b457059a640cd70201dcd00dff9a06",
		keys: 1184,
	},
	"zhTW": {
		bytes: 81743,
		sha256: "843d593cabf7338dbd76b362d0d98030619e6e878ee93501416a35773a8bec13",
		keys: 1184,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
