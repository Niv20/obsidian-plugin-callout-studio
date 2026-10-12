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
		bytes: 109578,
		sha256: "1b038b16e568ef7d74efd5e9a9419feabea7cce2f773d3ab7a8f30dcefa70fd4",
		keys: 1185,
	},
	"bg": {
		bytes: 131215,
		sha256: "216b89fb6bc77c2a5dd20960a70d0c6f5f0726d4be4e4a95ed845a38485f72f0",
		keys: 1185,
	},
	"cs": {
		bytes: 89862,
		sha256: "79bf096f1c074542b3cb9847cd0ac7c9202715d6a1f950cfcc8c744b85efb03d",
		keys: 1185,
	},
	"da": {
		bytes: 87072,
		sha256: "5d8865c54ba3061aa48a0aceb077afdc89a4c5672432a809446ced0afc9bf902",
		keys: 1185,
	},
	"de": {
		bytes: 95156,
		sha256: "0a88ad051c76a37365d4438aa871d3330faac2b255cde53e34a4939f6c76793f",
		keys: 1185,
	},
	"el": {
		bytes: 138936,
		sha256: "43778d5fc6a10a40b285dcf1a95e2533fcaae716b6e58e705023984de91f4be3",
		keys: 1185,
	},
	"es": {
		bytes: 92236,
		sha256: "641f4b504e31ff3d55699e6631e6670aed6f32e15e7374e4533b48f6b63ee8b7",
		keys: 1185,
	},
	"fa": {
		bytes: 119708,
		sha256: "01b41529b9003764bd0df30bd2379dd89edef1c5a005f4fa69af1b192d32bd20",
		keys: 1185,
	},
	"fi": {
		bytes: 89495,
		sha256: "8d2d0c962a7038e6b98b0f55f25c14052f43cb7e23be03351ec966389208013b",
		keys: 1185,
	},
	"fr": {
		bytes: 96603,
		sha256: "32313787a01eea51060d7a1e43893d49e7f018a4d423ae3e2a0ae9a5002b8963",
		keys: 1185,
	},
	"he": {
		bytes: 108520,
		sha256: "336ecfc208e77b3607a7e9aa95ba2e11b075ef23f0733113f80baeea48198b54",
		keys: 1185,
	},
	"hi": {
		bytes: 152210,
		sha256: "b3bc6dab16227e1aa47f414221f780296ae346f471f76d8d028d037df0d4b0c9",
		keys: 1185,
	},
	"hu": {
		bytes: 95911,
		sha256: "0aeb34864e6510a5042c53c7c758b063f69ddfba69ae17d851b12d68b8a8fa13",
		keys: 1185,
	},
	"id": {
		bytes: 86869,
		sha256: "67c31b01cd7074f0ff7ba6a3190a353dedf6b88672e4bd3f4283223bdccd8ee0",
		keys: 1185,
	},
	"it": {
		bytes: 92670,
		sha256: "a7594ea3b369e252f7de2088f0701eb601f96e11c4a79c28e096aaf50b5c1bc0",
		keys: 1185,
	},
	"ja": {
		bytes: 105389,
		sha256: "dd44510f867798ecf988e70d2e8911415c25619afdb14a1e98bd3b57d3345573",
		keys: 1185,
	},
	"ko": {
		bytes: 96494,
		sha256: "5d511d6922b6fe31ebee7df9f8e3e81700584461e89f658ae484f72144eb7f10",
		keys: 1185,
	},
	"ms": {
		bytes: 86885,
		sha256: "6bb3d078bb33fa84bdf95b1ba6fadf9b505dfdecd09c5cc466067881055dfe3c",
		keys: 1185,
	},
	"nb": {
		bytes: 87595,
		sha256: "f51eeeb16910c3b29ee1e0e1d9aff6f4c676c5173185d6ad1fdd5c9f51e97545",
		keys: 1185,
	},
	"nl": {
		bytes: 90758,
		sha256: "fb9a5704896ee720c7a3fc34890a803eb72895c67d7aa95162c11f58d3751668",
		keys: 1185,
	},
	"pl": {
		bytes: 90858,
		sha256: "8d0b49eb4e8e14f3f24c39d1c9cd80d6b8cc182f73910ad2316950658e8dcfe9",
		keys: 1185,
	},
	"pt": {
		bytes: 92153,
		sha256: "c0b78b05b652b63e35297e459bed104d3f73924c2b0fa1fc105fbf2daa8f7769",
		keys: 1185,
	},
	"ro": {
		bytes: 93819,
		sha256: "c72142e0d8489071f8a292444b2456d3d150c82d14d4220d009dde8db1ee810f",
		keys: 1185,
	},
	"ru": {
		bytes: 128391,
		sha256: "079ecc0daec458da38edc2886c7f6c1ea0c587b510f4f1a6942f6525938a3bb5",
		keys: 1185,
	},
	"sv": {
		bytes: 88679,
		sha256: "f2d010bbe700b8ea4d5d3295b9cfc2e9c48f331b5842e3a4fa39766b74cab744",
		keys: 1185,
	},
	"th": {
		bytes: 152324,
		sha256: "cfd273590591d52332888a63c97cb2d24da40f797a989ad1b348cafd446ed226",
		keys: 1185,
	},
	"tr": {
		bytes: 90281,
		sha256: "198d8fd6e89108e98dfef717d8d1e57f9aafb9ed03d48e8f8e4b32ad591e10ed",
		keys: 1185,
	},
	"uk": {
		bytes: 126418,
		sha256: "7e057c0b62d11e57b524609b9c305ce0ef7730b9cb77f2af33a65518d797717f",
		keys: 1185,
	},
	"vi": {
		bytes: 101011,
		sha256: "c8b350d721fed315137a92e8f3619b5d27f5d5d8e9b80bd56218011fb51743cd",
		keys: 1185,
	},
	"zh": {
		bytes: 81545,
		sha256: "6f52ec60ba2ed945d9110a6be3a415de52d97d35d3e5a4f712a1dcb97b9dbedb",
		keys: 1185,
	},
	"zhTW": {
		bytes: 81827,
		sha256: "3514333ae9807b7e4c43ac32c1956f5ef198c3fbc7b140bd7966eaeb191d15ca",
		keys: 1185,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
