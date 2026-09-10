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
		bytes: 68478,
		sha256: "892ce3c814621137dd48412326a8ef0389dddba09ffb9c0f432eb598629cc706",
		keys: 766,
	},
	"bg": {
		bytes: 80526,
		sha256: "da86712a6b308b0bde2aa79ae4c26d573f6b9fe1c03f95d8e4609b22097be342",
		keys: 766,
	},
	"cs": {
		bytes: 56639,
		sha256: "9c939e53aa5c853c3c205ff1fabfebca656dd4cc492c29ec2120a8684e54cd2b",
		keys: 766,
	},
	"da": {
		bytes: 54343,
		sha256: "d6b828d2705482fb66aec4d10a7cd55deab7fe5f6ad7362975b11eb04a443fe5",
		keys: 766,
	},
	"de": {
		bytes: 59524,
		sha256: "7ce1541588699abc1c3885e88f407ef2fa42f1e0e09bd6c800e835c9af3ef5f1",
		keys: 766,
	},
	"el": {
		bytes: 84451,
		sha256: "5488b1aa759df0921ca205424873539234c7a4907b357ae51abd1696a10340a1",
		keys: 766,
	},
	"es": {
		bytes: 57823,
		sha256: "b30389ad35ae7527f1a986d2f579f6250f12e8c67bf4a335ce3cc773b27eb0b0",
		keys: 766,
	},
	"fa": {
		bytes: 74346,
		sha256: "aee318b388f0aff7ce5eabbe9a1c06655da180c87e5cea8944ba5921abcc107c",
		keys: 766,
	},
	"fi": {
		bytes: 56389,
		sha256: "c4b240704c40544b0fde74caf40455a8dabaac7fc6a1013604f510d8cd549651",
		keys: 766,
	},
	"fr": {
		bytes: 60102,
		sha256: "37429205d8961ea30d2751fe76ae939a75fb7afb439ff31cb5baec44f668dbf0",
		keys: 766,
	},
	"he": {
		bytes: 69246,
		sha256: "c4a7fd4762051900a0a0fa015e495b5b264a30dfe06cb1d7bcddd05e4076d1d0",
		keys: 766,
	},
	"hi": {
		bytes: 92886,
		sha256: "8782be80b2a3428861af9c59549a970b408a938d2f0d4b9e875837a6df9b71cd",
		keys: 766,
	},
	"hu": {
		bytes: 59910,
		sha256: "898f13ca42a9bcab0ab07d3b9bf922b4098efa07544075b31de0f9fe9b6b9c38",
		keys: 766,
	},
	"id": {
		bytes: 55037,
		sha256: "03ffcd7aec7af333ccf5b281f38a5625b912e4a51a729d56b99aec6c15bf3d39",
		keys: 766,
	},
	"it": {
		bytes: 57566,
		sha256: "84fec8ae4ae14ab22b6ff509a3d0c5f4a3d0030153d49ba3ee4f52a5c8a612d6",
		keys: 766,
	},
	"ja": {
		bytes: 66469,
		sha256: "b2e18d3ee21eb0983d252261d304065e900f4ad86ba37a0f52f16f2e33d82541",
		keys: 766,
	},
	"ko": {
		bytes: 61169,
		sha256: "227b37002439fba3b6d7e747064e0f3c2e7832741b596aaed7c185bab9846814",
		keys: 766,
	},
	"ms": {
		bytes: 54906,
		sha256: "7d5adab803e89a44d093f1ec834bb6ca822ca762a763828a09fd6eb02b1f881e",
		keys: 766,
	},
	"nb": {
		bytes: 54504,
		sha256: "031befdc801cff32b69dadf0cc5b615a0277c06be1f59d393053cf8371cdc2ef",
		keys: 766,
	},
	"nl": {
		bytes: 56907,
		sha256: "4f8605d9054bbdbb9d6b8b994de197d31d77c90fae30aa4ebf52da023c3a52b5",
		keys: 766,
	},
	"pl": {
		bytes: 56905,
		sha256: "fb12c886010fd7e44fc30680b8191d5643b4dcf1c5fb519d123e599f59ac4a46",
		keys: 766,
	},
	"pt": {
		bytes: 57791,
		sha256: "b9d481e6be1df81b6fe2657d55831d4fccc9dc4572d40970db827a478f65fa02",
		keys: 766,
	},
	"ro": {
		bytes: 58326,
		sha256: "3a1f3cbaeba4601817e7aa75a382c9e249df6f3ff06ab255611d8b5b1107bca9",
		keys: 766,
	},
	"ru": {
		bytes: 79169,
		sha256: "bd65cc1de0d64b4ccad194fc60601d9099ed8e8a522376e2dd4746f803124f13",
		keys: 766,
	},
	"sv": {
		bytes: 55423,
		sha256: "1c725b873c36073469236c382ef3a261b4325c47d4110ca44d2f6b8314db758e",
		keys: 766,
	},
	"th": {
		bytes: 91853,
		sha256: "c0f921fd17d9b1f3fbf85b19ddd85cae3b3e153b4fc1e4290588d70be0535171",
		keys: 766,
	},
	"tr": {
		bytes: 56772,
		sha256: "b95b7b7505851265c739202676ff1a29aece380bdebe35d1b2a57ce93238d9ba",
		keys: 766,
	},
	"uk": {
		bytes: 77501,
		sha256: "dfeb24f12fc6d131d5e3a9c16accd9b8387b9161765bb4f007c2d194d1518d43",
		keys: 766,
	},
	"vi": {
		bytes: 62690,
		sha256: "0012e249515793405b5ee059b505e718ded9aa93c99ab6dcb44c998f06dbb0f1",
		keys: 766,
	},
	"zh": {
		bytes: 52062,
		sha256: "242b7fe62a99334c50238b8261ee2e6b87cd12d022e52c834b3382330b6e99ef",
		keys: 766,
	},
	"zhTW": {
		bytes: 52200,
		sha256: "f267261c4f4c82df9e29b5d21141b0acac9f2525fb527e891ec5fe32d50ab53a",
		keys: 766,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
