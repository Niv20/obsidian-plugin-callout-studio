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
		bytes: 93566,
		sha256: "42e2c6c58bb7ddfc6b1ac3617e4809d0e8dece9947d66cd5dcd5c0856fc81b06",
		keys: 964,
	},
	"bg": {
		bytes: 113470,
		sha256: "788e94c53278abdf2c3fd104b5d6456de537f5b483dd4c8d648011e1cb027246",
		keys: 964,
	},
	"cs": {
		bytes: 76505,
		sha256: "45d605adc733bcccecc43598c572f13d75b575dba21a7b9d7845f4d8f8c917c2",
		keys: 964,
	},
	"da": {
		bytes: 73519,
		sha256: "3b4091080e734ef97d48bdb8b3d0dbfafda6a223e99b4ba6f5f96e88c1b16a3b",
		keys: 964,
	},
	"de": {
		bytes: 81319,
		sha256: "cea8fc73d82478544494f7372b94e64f4283e83e65f32ae38f455e0682642aa9",
		keys: 964,
	},
	"el": {
		bytes: 120215,
		sha256: "81b66012141c0b766e75d1c7f8fa842030568b08c34d2613dfb171faac1f70cd",
		keys: 964,
	},
	"es": {
		bytes: 78571,
		sha256: "d71a79085b84ab7ffaacb8f22e55aca23a99d374c92b64c720f378b1073baf37",
		keys: 964,
	},
	"fa": {
		bytes: 103453,
		sha256: "cfd6d9fa29b04867096ab5eb00753f7b283e265adeab18481a1289c2106c4c60",
		keys: 964,
	},
	"fi": {
		bytes: 76149,
		sha256: "0425559fd8fe296e2a5c099f4b6754163a324bc09387b87df4094de28c1f64d6",
		keys: 964,
	},
	"fr": {
		bytes: 82079,
		sha256: "b46a6f2e4eaef96d57a5106559fd7adbad1c1e224dc9a85ccfd14b889d6eda70",
		keys: 964,
	},
	"he": {
		bytes: 93079,
		sha256: "ae528c16ec31e578fd05c361a81501820d0114d2da13963999ba492316d92e96",
		keys: 964,
	},
	"hi": {
		bytes: 131454,
		sha256: "c44ae004a4d42e5e287b4d6897140f1969461ab19510ac9f499b8341ef622301",
		keys: 964,
	},
	"hu": {
		bytes: 81920,
		sha256: "25db76cb17ac9bc74d6d98e4b3786b05182fb3191aa02c1b5518766274b6cc65",
		keys: 964,
	},
	"id": {
		bytes: 74068,
		sha256: "675f0ae9027fa033272da8f218191498e994ce07a28a21ac802ba6cae24b31fd",
		keys: 964,
	},
	"it": {
		bytes: 78699,
		sha256: "bfc1d1d048cba3fc6366904b3f38bf178636787904179df5dd4c52957ae369d9",
		keys: 964,
	},
	"ja": {
		bytes: 90555,
		sha256: "925af53f78b45569bb23ce96a758c6f48c4ab438dc554910b3fbfcf8fad98888",
		keys: 964,
	},
	"ko": {
		bytes: 82657,
		sha256: "01c36f1e27bb9c4bc6e96e0c34157fe73dec7ddd993f4ab94ae5ec216250cdbc",
		keys: 964,
	},
	"ms": {
		bytes: 73728,
		sha256: "9816370ea3f00ca7db465ebea76c204fb7119956226d036918e31289055b6f49",
		keys: 964,
	},
	"nb": {
		bytes: 73963,
		sha256: "2d2e63b2989e42df8d657b2c9165eaaa3ac4a3dbb4af0cc339946835ae519332",
		keys: 964,
	},
	"nl": {
		bytes: 76959,
		sha256: "1a151aff11e6ad47b09f62a02a6bc295f2c0a98be299082d2b9f0c8771ad30ce",
		keys: 964,
	},
	"pl": {
		bytes: 77412,
		sha256: "d45cd443115db85be226406ad79997f33a6b48851f44189091032f01c3b087b3",
		keys: 964,
	},
	"pt": {
		bytes: 78351,
		sha256: "757614960af0f94a14762c819f1d452a7fdab7d9ebe950eb412f3962a67e3caf",
		keys: 964,
	},
	"ro": {
		bytes: 79576,
		sha256: "a95b4c140387498868b306289362fd772a05b08772252c2852e9ea3426ad7cb1",
		keys: 964,
	},
	"ru": {
		bytes: 110989,
		sha256: "472bf0c23201c4a60a3c68b6b11ede8ec943ce1e50c165de55519c8195999c7d",
		keys: 964,
	},
	"sv": {
		bytes: 75125,
		sha256: "9d05e9516490d93d2c77656ee21f74e7cd583a383418db4081db0cda8427bcbc",
		keys: 964,
	},
	"th": {
		bytes: 132405,
		sha256: "46c8ea0f786f83c133f1f59fb54dd29c313e84f78bac0338a6d63dec21964e92",
		keys: 964,
	},
	"tr": {
		bytes: 76663,
		sha256: "a4da300d4039d0da15bfbbb8d44335accd53729f2823341b8457f3f574726881",
		keys: 964,
	},
	"uk": {
		bytes: 108964,
		sha256: "4019269614e9d966f2d221db1741064b5fa081a62153f4525766fb9c8094a930",
		keys: 964,
	},
	"vi": {
		bytes: 86610,
		sha256: "ec4ab1a63b2292d7fefa3a80f95ca4c873580d54a9dbd837c2b6bceaeb18e7b2",
		keys: 964,
	},
	"zh": {
		bytes: 68935,
		sha256: "e111c4704496aa41d66c806bd6bb01762800bcb785464a2e775998efd4056f09",
		keys: 964,
	},
	"zhTW": {
		bytes: 69245,
		sha256: "ad242474406b3845b636f0aa42f9cfbe6b1e6cb2f31f5caaf4a76b30705ab2b5",
		keys: 964,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
