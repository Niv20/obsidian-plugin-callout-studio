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
		bytes: 71516,
		sha256: "4ba912241f37dd2d45b54bed2a5de0309874f2421585da5ea5b0c6aa788b0946",
		keys: 799,
	},
	"bg": {
		bytes: 84191,
		sha256: "57706a2e3380d7434f731e2184ebaa2b8fe00788685bbe81c720c72399be6e1c",
		keys: 799,
	},
	"cs": {
		bytes: 58507,
		sha256: "6afebe83e3da2be34934eb6df4a7bf3fe156c7e92b18b961c00f9729fcf90634",
		keys: 799,
	},
	"da": {
		bytes: 56332,
		sha256: "dc01a991e791d256ecd809a414c66e033772c5cd02a9513156e39dcf3923c742",
		keys: 799,
	},
	"de": {
		bytes: 61576,
		sha256: "1e8cca02df38e24832cceee419a3254b12cd10aeabc424a2edafb647339eba20",
		keys: 799,
	},
	"el": {
		bytes: 88791,
		sha256: "dd9da9191226e833ea54b15abb1d69111ff8ce9a9e5cb73e7d2acc8e9556bcc4",
		keys: 799,
	},
	"es": {
		bytes: 59806,
		sha256: "1a734cd2854064418921f7a322542b3d4bb14ed3d7205ca31fb18cb00c01e0f9",
		keys: 799,
	},
	"fa": {
		bytes: 77314,
		sha256: "2deb5edcc9c644189063ed037597d9ae1d3d2850d3638fb2d41856d2ac6c17db",
		keys: 799,
	},
	"fi": {
		bytes: 58283,
		sha256: "fd2052c4f3f7191e10a681462cc9831507753f41a94d11e44186add812ea32db",
		keys: 799,
	},
	"fr": {
		bytes: 62322,
		sha256: "4989de3bb5532ce855987278482093c7f838bb08c0b9f0e12d6b758a7229d50e",
		keys: 799,
	},
	"he": {
		bytes: 71596,
		sha256: "5d75856dfe7d75ef3788cc4e87dcfe632ce719826d8c22c6a0490f390ce23121",
		keys: 799,
	},
	"hi": {
		bytes: 97625,
		sha256: "d1b50cb2a8639952613df682ac4ff2fe2fe89c4d1835552100377f25872b8115",
		keys: 799,
	},
	"hu": {
		bytes: 62120,
		sha256: "d3e26ade21ba6092281b0d52e042419530c659cd54e34d76d165b6e851d634dd",
		keys: 799,
	},
	"id": {
		bytes: 56548,
		sha256: "2ce781cd2832f9cb6fa4b55edd04f94d1416d3fd088f5b9edfa7fb4563dbed5b",
		keys: 799,
	},
	"it": {
		bytes: 59573,
		sha256: "a2030899f3e4c4abeab728b01f7c3138839d370a95a161a80e102b2175ddd5ac",
		keys: 799,
	},
	"ja": {
		bytes: 69037,
		sha256: "83152285a5fa33a214dc1e498889c2cd2f6c4aa3d127110ccb80130339200587",
		keys: 799,
	},
	"ko": {
		bytes: 63301,
		sha256: "a59dbb824a8adcd87637797f380a778f3393d96efc8871266acd7cfd6cb11747",
		keys: 799,
	},
	"ms": {
		bytes: 56394,
		sha256: "9a6c8eceaec59032ba48320b73e0eedc377e6321679d9b6b1a91151c95a7a8c0",
		keys: 799,
	},
	"nb": {
		bytes: 56443,
		sha256: "944a1f81fb282a78fc1bb0a2b74feb0e44905b3ed408415e1417d8d5e278d32c",
		keys: 799,
	},
	"nl": {
		bytes: 58770,
		sha256: "0ac61e173d6c32ea6cb47d29f73dd3e0ad4dce86fe51609c7061a8f1154d914f",
		keys: 799,
	},
	"pl": {
		bytes: 58925,
		sha256: "7f7a4044147003aa4ae6cfb7c6f6e0361371479173619dbaeed069257f52819f",
		keys: 799,
	},
	"pt": {
		bytes: 59709,
		sha256: "0d2b8de5209872ddaaf04cc3a42f12cbd739a73ffcde6c41f7a0a799b17c7ecd",
		keys: 799,
	},
	"ro": {
		bytes: 60589,
		sha256: "e68ee6408e1d65416d163f4699805a32b3d6478d9a769d4124b238fec517a0f8",
		keys: 799,
	},
	"ru": {
		bytes: 82795,
		sha256: "80a8f5a0483883bfb23b2dc3b7282c7673e6ea18b8c28bf6cfecbd3b494e0315",
		keys: 799,
	},
	"sv": {
		bytes: 57286,
		sha256: "5961216e93a4dec4053a05b5851b8dc3ae77d94621a53c9a27c5e6b003bc1754",
		keys: 799,
	},
	"th": {
		bytes: 96807,
		sha256: "3536e561ed2314226dcd3580af5406ccf67394f022b1ccc08519481bcffeaaad",
		keys: 799,
	},
	"tr": {
		bytes: 58599,
		sha256: "1452c197d9fe51527575e96890633f4f5895b2abc8ced2a1bc77ec5dd9d98613",
		keys: 799,
	},
	"uk": {
		bytes: 81106,
		sha256: "3120b7c72eaa929aeab5b21a73a8425c2975abe5a4872f6a701462347acc8d20",
		keys: 799,
	},
	"vi": {
		bytes: 64962,
		sha256: "54dbe4f675ed6dd75fe877f3a576b46e535532d06a64f92b66a6c4f5ef928539",
		keys: 799,
	},
	"zh": {
		bytes: 53331,
		sha256: "037bec2c52ed4ba908cfbe13a931fb9baa2691a68edafcbd7fd64fa7185b2ae8",
		keys: 799,
	},
	"zhTW": {
		bytes: 53542,
		sha256: "24f41a37e2d915aed784fd613d6a5dbd524023fe4c2a0a02b72d3764e5746cb7",
		keys: 799,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
