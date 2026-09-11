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
		bytes: 68687,
		sha256: "6f8a3827e291fd06a3c56296add47fa5c8fc3a8a9894526fb7925d6504e0d81e",
		keys: 769,
	},
	"bg": {
		bytes: 80778,
		sha256: "92525c8a159b0e73e25e85184a76fc369f586e92e41d366f596a0b44874de91e",
		keys: 769,
	},
	"cs": {
		bytes: 56813,
		sha256: "b767493bc165f32346aaab9b9c56b32ff0d2646890dde18dcb76eae49fd29144",
		keys: 769,
	},
	"da": {
		bytes: 54508,
		sha256: "22e2d103e3f1937be94ee80ce218b22c2df58650836be0a593b8c2f46f660810",
		keys: 769,
	},
	"de": {
		bytes: 59711,
		sha256: "6edb6b115a3f0997d3014db4ae6e7854324cc6e72da1835156a0705544afcc8b",
		keys: 769,
	},
	"el": {
		bytes: 84694,
		sha256: "863c7d89040dccd2bc31e62f00eba39c0156989e3d90d7c816cb857778169b43",
		keys: 769,
	},
	"es": {
		bytes: 57988,
		sha256: "390b15bd8e13e5de35442665328900a19832e54ff84df6cf7e723ae73e4c67bb",
		keys: 769,
	},
	"fa": {
		bytes: 74595,
		sha256: "8d9a3b234220f0fe9ad379fa5e0195fc64033d9ab55b997c8ceaff9c597f705f",
		keys: 769,
	},
	"fi": {
		bytes: 56547,
		sha256: "3e587a04771249bdc21bae6d87c4ed38daeb6168dcf3dc9222e2f6e3bdaaa405",
		keys: 769,
	},
	"fr": {
		bytes: 60284,
		sha256: "60b81b5403c273ff4882daeda88d9a57c62624ea0bc1c8326a0933508cdd56fd",
		keys: 769,
	},
	"he": {
		bytes: 69464,
		sha256: "0555ee696f0dc7664e483db25862f646ecff17f785f9f143c73db9d085d64caf",
		keys: 769,
	},
	"hi": {
		bytes: 93211,
		sha256: "b1468295aa9be88cffdbd00b1850329b521c18e00a2760dbec08c39f2997c438",
		keys: 769,
	},
	"hu": {
		bytes: 60112,
		sha256: "58e89cde45f905700fd41e7d7fac0912c2aba817745090246ae6214fc251eb6b",
		keys: 769,
	},
	"id": {
		bytes: 55198,
		sha256: "7e5d3f007be1064d80cef1167096507a3eef09fc9b8f2139151bda95afc11102",
		keys: 769,
	},
	"it": {
		bytes: 57722,
		sha256: "179979b141e299537f2c4a2d723d6508afa78e47456ada717834ac5e915a4b4f",
		keys: 769,
	},
	"ja": {
		bytes: 66650,
		sha256: "1976cf9ba961d16380a55491cbc732fa5084e7212d10ba4ce315f8f7b26e205c",
		keys: 769,
	},
	"ko": {
		bytes: 61364,
		sha256: "fee5b517b8642019306eb23849d8363304b5d890f873f3966dc7a54a48a2d5b0",
		keys: 769,
	},
	"ms": {
		bytes: 55081,
		sha256: "e11e8caade78c9942bbdd34d4be69fa9e349ded9b176057fa5379dbb6b83494b",
		keys: 769,
	},
	"nb": {
		bytes: 54667,
		sha256: "4d94fce3900917b24f35e0ea2a2cc17e7ac10f373a14f29b2c540af0fa32a155",
		keys: 769,
	},
	"nl": {
		bytes: 57077,
		sha256: "793cb3696accef6f58b19a77bc064f591da8e1bc9581539205123fae63d76bfa",
		keys: 769,
	},
	"pl": {
		bytes: 57079,
		sha256: "b8084dc95c107938d87e55f7a7683ac211abdb15d3db3c5a3f1a3823c64c2732",
		keys: 769,
	},
	"pt": {
		bytes: 57967,
		sha256: "a98d8636bcc600437f556cd5e4b708e73690409e32d15814fc2d542d4e871ff1",
		keys: 769,
	},
	"ro": {
		bytes: 58500,
		sha256: "b9e35042ed538287ab6848190438c6aa3b576d80699cece3c575e4623c1e4f67",
		keys: 769,
	},
	"ru": {
		bytes: 79404,
		sha256: "74d2154991a9dba1fa1804ac5f65d9f26d283f78fc19fd6a80d4263bd7b8da6b",
		keys: 769,
	},
	"sv": {
		bytes: 55591,
		sha256: "b0e28a7baf7bb1af126514afbf64c5c7b0438de419bff9ea954f75d6c9a18c41",
		keys: 769,
	},
	"th": {
		bytes: 92133,
		sha256: "8c94a4d829e121dbec0a8ab804ea7e04752b2e088f46f5091f438eb81fa9e72a",
		keys: 769,
	},
	"tr": {
		bytes: 56957,
		sha256: "46cfbc76626f3f1ed27332c02a57625898421bbef876d0c9cc794499f6220f25",
		keys: 769,
	},
	"uk": {
		bytes: 77746,
		sha256: "c1c764a1c6a362e950b73df0498b4d5c3471d8ab97ac33034ba18a837df1c221",
		keys: 769,
	},
	"vi": {
		bytes: 62889,
		sha256: "482eaeedb157f9f8ffe9f90ec7a07cf3f0afe8bd84beb31eefe5d9d1b546b02b",
		keys: 769,
	},
	"zh": {
		bytes: 52228,
		sha256: "146f560f114601425c896d75dc6d71130fd3c7261d9ae69cd985d0a51200bdc1",
		keys: 769,
	},
	"zhTW": {
		bytes: 52366,
		sha256: "f08dc40629832362192f531af18265b88d1b55152d29b94eecb644e3c9f7e53b",
		keys: 769,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
