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
		bytes: 69131,
		sha256: "e2d85fd759175090c416c7727b5cf706ccfd4dbd606387a05bc4ecfe4a8bd74b",
		keys: 771,
	},
	"bg": {
		bytes: 81142,
		sha256: "bafed6988f15a7dd40d5da693e5d66905a9aa1c940ddf5d2011fde54409327f8",
		keys: 771,
	},
	"cs": {
		bytes: 56860,
		sha256: "19a685a8d76254a2326442454b01c5c3e5ea7137d44c52215fba13aa8210d391",
		keys: 771,
	},
	"da": {
		bytes: 54578,
		sha256: "58453ca2acb64731e47e013c7dd4f60e5addd0222de20a9188ce5d9200135829",
		keys: 771,
	},
	"de": {
		bytes: 59830,
		sha256: "495f6f2177aa5e9877e59fffbaf7142a1c13a4086b833dc85bf93e7eabc0aa4e",
		keys: 771,
	},
	"el": {
		bytes: 85362,
		sha256: "8a0161f9ccac5797397f32ce4002e4ff4d3e81b3bfdde820cda9a81d6b5c46ff",
		keys: 771,
	},
	"es": {
		bytes: 58096,
		sha256: "c0f44da9549100417553d0b3bc23c35df9139c2402a624dccbd195566275b66d",
		keys: 771,
	},
	"fa": {
		bytes: 74722,
		sha256: "bc09518b6cda405ded23cb3c7922d642b9c2468b6276e31338859612987c2990",
		keys: 771,
	},
	"fi": {
		bytes: 56694,
		sha256: "a0a21f3a6d72955a5526c3ab437e0173b4c283d6facdaeb6c435a24cbd860118",
		keys: 771,
	},
	"fr": {
		bytes: 60458,
		sha256: "e9cd3106b82e09b3d6fdfcca21802c234b444414f6801dbffca82f770ff5554a",
		keys: 771,
	},
	"he": {
		bytes: 69503,
		sha256: "9d66be51af69bc4597a183a4b434d98d9d05bf3d4a238c3672eb0eb70d55f43a",
		keys: 771,
	},
	"hi": {
		bytes: 93488,
		sha256: "2c11e9959c8c1e4c3aefdcda8da11b3f008ef3f3edd048daca6bd19153047c59",
		keys: 771,
	},
	"hu": {
		bytes: 60233,
		sha256: "3e57c62e6c80cd8e18dd641a5dc8ac8f2bea2c048a20362471269daad55704eb",
		keys: 771,
	},
	"id": {
		bytes: 55127,
		sha256: "cd30f76cf8fff74e7de39665a370b9fb685e921a16c11216b51cc1c8e8f8eeae",
		keys: 771,
	},
	"it": {
		bytes: 57849,
		sha256: "dd0b169aa54c15e415f4ac9157b5f17bf2cbdf76808e15b689677c985d648137",
		keys: 771,
	},
	"ja": {
		bytes: 66887,
		sha256: "4b8bc092c13b228bf7ffb7259c8788e047c257f8dae8e8e32ecd80d6b0e05171",
		keys: 771,
	},
	"ko": {
		bytes: 61511,
		sha256: "7b1b6a3f31bfc6e208902094a8cc07c889e65f41fd18d52f698319189f47a1d4",
		keys: 771,
	},
	"ms": {
		bytes: 54985,
		sha256: "b7b6af174b382ab5ba1e9d1ce94d1265b45c5f61be0ae5ff18f257dbc3edeb3f",
		keys: 771,
	},
	"nb": {
		bytes: 54743,
		sha256: "26b1e9d53f66be330846b616846e504d37800777272efcfce461969278ec62d8",
		keys: 771,
	},
	"nl": {
		bytes: 57112,
		sha256: "423419581da2ccc047cd9ceea18303aeb4c8e9052a6bd1dec359a1eaabafeb81",
		keys: 771,
	},
	"pl": {
		bytes: 57189,
		sha256: "58cd0f29b45c7507af98c452caf8d62cb259a9c7733d6e1e0da1c6e19ed2dcc4",
		keys: 771,
	},
	"pt": {
		bytes: 58078,
		sha256: "7cb8c80789fbcb5ffa75b770f8687dc030fc9e7d5a04fbecfbf24938d3598d6a",
		keys: 771,
	},
	"ro": {
		bytes: 58592,
		sha256: "fdecf3e083eb277638565bafd84be52589e1565b2b12ca885696cfd340b235a8",
		keys: 771,
	},
	"ru": {
		bytes: 79849,
		sha256: "82aaaf3cf8b1a37d4d965c36dfdaad16d08b1e95efc3a090fdad54650e49b36d",
		keys: 771,
	},
	"sv": {
		bytes: 55659,
		sha256: "6962538e321821353589b3967845d5ba046a29f334e26031de969bce31f09ef2",
		keys: 771,
	},
	"th": {
		bytes: 92665,
		sha256: "3217c55bc49c8dd1d64edfd6627068f47a0ca4e5f37967bfa1ffb7d825a64462",
		keys: 771,
	},
	"tr": {
		bytes: 56987,
		sha256: "8dafa2e467abd634f59f52ef216f4966fbc259c5ef2dda82949cceb08f2f4a7b",
		keys: 771,
	},
	"uk": {
		bytes: 78226,
		sha256: "513e7b7b746ec4f1698103e040940a88b9c0400508aadb37b3ddfe4b984152d0",
		keys: 771,
	},
	"vi": {
		bytes: 63050,
		sha256: "a8260bdcf43eb4da9ed3cef77f8f8198b3aea46bbb3df13ef9f7f2efbc463809",
		keys: 771,
	},
	"zh": {
		bytes: 52130,
		sha256: "0eb24667e38ccf9cdc75fce23f4e0f6cc96e57eccd14839c016424ce0ee71570",
		keys: 771,
	},
	"zhTW": {
		bytes: 52250,
		sha256: "d0fe23e9992a4ef0bb5b74aaf41416d7294621806cb1bd98b7f60b371545dd7b",
		keys: 771,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
