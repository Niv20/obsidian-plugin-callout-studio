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
		bytes: 105350,
		sha256: "8623496a9804f83f3208b2ccc11a217b56d82c968ed5b94cb3727a372659672b",
		keys: 1134,
	},
	"bg": {
		bytes: 126524,
		sha256: "ec859df18865e0f3e07c349172301b6e775caede575725c901b96fd6a663021b",
		keys: 1134,
	},
	"cs": {
		bytes: 86449,
		sha256: "193503e6da118ff0b633e917509c965a175966a2c613cac40f651527c3ca2af0",
		keys: 1134,
	},
	"da": {
		bytes: 83601,
		sha256: "206882e86f3de3658d04286aea938eb7378bdfb06a688fb4ead4b4cf641f2593",
		keys: 1134,
	},
	"de": {
		bytes: 91408,
		sha256: "32a4acc588a6591d78736abe267ff893347c349b56a7e0ed570f76efffa48ea2",
		keys: 1134,
	},
	"el": {
		bytes: 134173,
		sha256: "cbfcde39927f330d85913335facc100a7f8470dad371ff70dc93c5e2f2a102f0",
		keys: 1134,
	},
	"es": {
		bytes: 88723,
		sha256: "0a2aab66ae179f7b574e7ac3c91eefc7b4dbb98bcc9538e330b860091d9638bf",
		keys: 1134,
	},
	"fa": {
		bytes: 114932,
		sha256: "0a6f122c920a129ca1e622821cbd121a00dffab5831059d7c998bff7f64457b2",
		keys: 1134,
	},
	"fi": {
		bytes: 86043,
		sha256: "36f16e1c4104700fe9ad5fe36634a9cda16ceb7da4ee4db5acceb7077b7fbec5",
		keys: 1134,
	},
	"fr": {
		bytes: 92716,
		sha256: "53457d8c0d97fd5d986595df442840dcf152291ebc89ae9be8615af68466630d",
		keys: 1134,
	},
	"he": {
		bytes: 104277,
		sha256: "7aad76ac98c884aaeff747306d75a025a045f40bb21bfabfdf68b32861aacfce",
		keys: 1134,
	},
	"hi": {
		bytes: 145973,
		sha256: "321dfa27a9c8dbb0a363e54ae7eebeeecd1ecce778c0a55670ffcfc1e8f25e18",
		keys: 1134,
	},
	"hu": {
		bytes: 92170,
		sha256: "8cea8f1afa1c7c11f0c43bcec005f7b63ddeded5bbe560c4f06b6e707961c607",
		keys: 1134,
	},
	"id": {
		bytes: 83656,
		sha256: "246eef3693f8b7d5b1b3d4915f686f8d5be99caeae40801fcbd904598b9bf562",
		keys: 1134,
	},
	"it": {
		bytes: 89135,
		sha256: "5860756b5f2654b2716d1f9d42938e2b81ce20a729b13af0ebaa1e772bc60ede",
		keys: 1134,
	},
	"ja": {
		bytes: 101145,
		sha256: "8bccc3c092185da68059806f47af95116c566c6084447bba2e61197d28f4c45e",
		keys: 1134,
	},
	"ko": {
		bytes: 92440,
		sha256: "41c174c841ef552af370b0392162b72360ba793526f80da5e4cb094004e5a4f1",
		keys: 1134,
	},
	"ms": {
		bytes: 83443,
		sha256: "d34dfcdbb549be9cadaf2b6497f8618a2d079fde917b69ec66d37fba6f64eb19",
		keys: 1134,
	},
	"nb": {
		bytes: 84120,
		sha256: "895fc795fb486a5715ae5848bf2ffc61bd50c59f21b1c6e00f6ad45e0a43ed68",
		keys: 1134,
	},
	"nl": {
		bytes: 86964,
		sha256: "49c16a156da49b453b4dd94b279cdd7aea1f4144386cd6e4a78797c08154ae29",
		keys: 1134,
	},
	"pl": {
		bytes: 87444,
		sha256: "5ba1aad9f5a807daa65bdf4abcb1354788b187f84f1e9b05e6592bd331130a3a",
		keys: 1134,
	},
	"pt": {
		bytes: 88429,
		sha256: "e6a2326f5845480a0b569a7ec1bc8dc8b9a1e12b26226d98a653aad1817dd313",
		keys: 1134,
	},
	"ro": {
		bytes: 90144,
		sha256: "6cf45010313d036e296ead2156789e99e227b5d79fb6b60265d4c964c4e6c133",
		keys: 1134,
	},
	"ru": {
		bytes: 123727,
		sha256: "bc5802a1b5335c1460d37dc3912f2ce092d7dafe703922f2db8763b4f12660f7",
		keys: 1134,
	},
	"sv": {
		bytes: 85304,
		sha256: "1f347cd458e593aa3ed14c8f4948ee4394e3e2905e43dbd421030992a75a5da3",
		keys: 1134,
	},
	"th": {
		bytes: 146950,
		sha256: "f9262461a9e5ddd228076fef8b7bfd964a618231b79e5460b34d725a9a9772e6",
		keys: 1134,
	},
	"tr": {
		bytes: 86486,
		sha256: "e32422209c21f25f8253fe2ca90feed2ea4a49769d5fcf66f0f3860c79775ab2",
		keys: 1134,
	},
	"uk": {
		bytes: 121853,
		sha256: "034b93c7fd49aad67fffd2cbd1f7bd5856e5113bef961847b710d8a153900fd9",
		keys: 1134,
	},
	"vi": {
		bytes: 97176,
		sha256: "eade6d02ff672eac866aeb0cb5f2de8185f8d5523ece64f141161a21f8889c64",
		keys: 1134,
	},
	"zh": {
		bytes: 78336,
		sha256: "adbed03e4b80de1b32acf632ba88ad3f417656b3d7b8991ed9cd27caee7aaea0",
		keys: 1134,
	},
	"zhTW": {
		bytes: 78632,
		sha256: "e50c58d0e5ed547a9a45c733bdbe3dc94bb229efb8133ecafd6dda6bebed54da",
		keys: 1134,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
