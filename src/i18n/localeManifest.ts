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
		bytes: 80622,
		sha256: "5715328b4cfb598fc1bd93f311b046cc43d4ff5c775272487094916800435413",
		keys: 869,
	},
	"bg": {
		bytes: 96005,
		sha256: "71379e26a48e36acb247c3a02a92d0dde3a823262955504f65c994d42a91cd54",
		keys: 869,
	},
	"cs": {
		bytes: 65687,
		sha256: "93a55f70cdd565f2617eabac34fe330995bfdddd460524802f3c2fd7ea59d17b",
		keys: 869,
	},
	"da": {
		bytes: 63368,
		sha256: "093920b527a0dfb58e1322636b3198696f0f33a4e991c3ad7b399be0ffc52924",
		keys: 869,
	},
	"de": {
		bytes: 69489,
		sha256: "449e7a8dca5f511a0eefa1b6696e4550a8b7271a6e16f8f75396fdbbd3bdccc0",
		keys: 869,
	},
	"el": {
		bytes: 101428,
		sha256: "e710e3f1b391de157e47579b4fb0b8f078d35f9a6c0e660c1ac19e945a0576a9",
		keys: 869,
	},
	"es": {
		bytes: 67272,
		sha256: "ea7f6eb3fedb689b14fda028b07c8f08a98691410683d8f17712a8227836afa0",
		keys: 869,
	},
	"fa": {
		bytes: 87665,
		sha256: "e4f437acf4d2ff513094b66d9bd8288d6befc39643a5ae72de506639d6325822",
		keys: 869,
	},
	"fi": {
		bytes: 65441,
		sha256: "91dcbce0290b95a523c883422c223514534b6b6a25f51832796d98fdde59002d",
		keys: 869,
	},
	"fr": {
		bytes: 70162,
		sha256: "ec4cb68478c22a0bc030fd1e6d4198e9650605dd6abc2db14e1f66ec3a7cc7cf",
		keys: 869,
	},
	"he": {
		bytes: 80077,
		sha256: "bc6e70d390f8e6ef9c6db1c604bef2c8013388aeb6d6c92a4d775af94c0fc264",
		keys: 869,
	},
	"hi": {
		bytes: 111095,
		sha256: "df5af1542ef60f9a849009a5d6893b4f02d70f205e1e5d3086b65e9d5c966c4e",
		keys: 869,
	},
	"hu": {
		bytes: 70042,
		sha256: "2ed76821652295638cd48ce36951045760a25882a67e764553e97e6aa376384b",
		keys: 869,
	},
	"id": {
		bytes: 63487,
		sha256: "634953dff431c849046bb756c647d4ab11964928090cd2a83d7757a87bdd24ab",
		keys: 869,
	},
	"it": {
		bytes: 67083,
		sha256: "9e144044fe62067121adcd3f4bfb2b1ec757e71294002ea3cc88c4e26dfa419f",
		keys: 869,
	},
	"ja": {
		bytes: 77441,
		sha256: "f61eab99e9facb6d1934cea414f7d0b1ab4a7d4275cec4a3cd966b973d59b7cb",
		keys: 869,
	},
	"ko": {
		bytes: 71089,
		sha256: "d61099896179ad52cb9c8f1996b3039cf724bca70e7f2ff5066c347755d4ddc5",
		keys: 869,
	},
	"ms": {
		bytes: 63328,
		sha256: "2b88d0749ee2864d4ceeff38a07495932c27f7eaaab621f59b851cc36ebb1624",
		keys: 869,
	},
	"nb": {
		bytes: 63584,
		sha256: "f878ab3c32f524134a25bbce9e5362e5ffe7e7e9d01001afb8ad8308efd345dc",
		keys: 869,
	},
	"nl": {
		bytes: 65930,
		sha256: "3b7e5e5b5f2a3dffc499c7dd93ea98ae0116cde68dbd67fbdff9bfc154784ea0",
		keys: 869,
	},
	"pl": {
		bytes: 66402,
		sha256: "737bb32bbc59d1a4e869740582e34cdc1430485807a8d76313925477b3374ded",
		keys: 869,
	},
	"pt": {
		bytes: 67075,
		sha256: "88f1ab137df161710119738b04772fee3b60ff2f755424fa5c55a9f92d6aeed0",
		keys: 869,
	},
	"ro": {
		bytes: 68202,
		sha256: "4f1d23127c426ceb946e9aebe9dc6be4d87aee4d71adbcda817145fe555270a5",
		keys: 869,
	},
	"ru": {
		bytes: 94129,
		sha256: "649b0947b9eaf3e661982a2233e50652b97ffd6108432cc18e132bee255f4170",
		keys: 869,
	},
	"sv": {
		bytes: 64527,
		sha256: "593efc8a1f1751de1d216150401499378a36c17a6842420d28fcb99e00bf3ce7",
		keys: 869,
	},
	"th": {
		bytes: 110753,
		sha256: "03f1e39a46f622c2ed824ca547e9aa7de9945d5be570d086541b2ae31bad9fe6",
		keys: 869,
	},
	"tr": {
		bytes: 66031,
		sha256: "76e10455563689a73be25e0e3e231d22bdf2d01174d52a2fac6852f0cf01997b",
		keys: 869,
	},
	"uk": {
		bytes: 92265,
		sha256: "b52bb39e6060376ecfd22b433bf62dd192cee9f3280e2badbc0def1400109805",
		keys: 869,
	},
	"vi": {
		bytes: 73656,
		sha256: "62fee5e9ad78bd377cd6f431a5edf224c552592827c14466cd00c61add0ad0fb",
		keys: 869,
	},
	"zh": {
		bytes: 59558,
		sha256: "fa4ad8d69dc7c03429f81897fbc201748c180095e2fb6a389bfb722259949aea",
		keys: 869,
	},
	"zhTW": {
		bytes: 59778,
		sha256: "f706f4168b48cef523f62c08d9358a52ad0d970f818d491eb9a5903befc26445",
		keys: 869,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
