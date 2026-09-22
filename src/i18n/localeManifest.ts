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
		bytes: 67728,
		sha256: "0d715b1a70f25af8721499ebddd45389e501060c0765abdea21d46076990bfcd",
		keys: 763,
	},
	"bg": {
		bytes: 79457,
		sha256: "8325b01e0774d8ba020b25f303ef5bed6d0ca0ae9abba47b0ebc369ec99a43b1",
		keys: 763,
	},
	"cs": {
		bytes: 55754,
		sha256: "995bb3f68be7756ad1399025388d88e33dd4a8cd29a44a7b32f8ec8f153c7635",
		keys: 763,
	},
	"da": {
		bytes: 53529,
		sha256: "6cc4e766379f8e758823040f7a0427da08f39d9e149fa81f2f5ab198ecca3b1a",
		keys: 763,
	},
	"de": {
		bytes: 58619,
		sha256: "493d023ea267ed27ba25acae9a25b0dfcd00056d850c8d9e3979b7047e299edf",
		keys: 763,
	},
	"el": {
		bytes: 83660,
		sha256: "c72c7a79cf829194739f62c1b1b4dd79d2de2a716e6c1f3c14034715c15f3b9c",
		keys: 763,
	},
	"es": {
		bytes: 56971,
		sha256: "29514cf06694301ba3d1ec18ee30b042ca4174b8499b007f4498643cf8c64592",
		keys: 763,
	},
	"fa": {
		bytes: 72934,
		sha256: "4e8272aa7da993aa3e90d2a8c82bd46dd6393f4b4742ab50eb7757d278a588e8",
		keys: 763,
	},
	"fi": {
		bytes: 55527,
		sha256: "40211b8a229dff3e3774f56d13c294b15b5a930a3a9bb4d1e876fb76dccc8b41",
		keys: 763,
	},
	"fr": {
		bytes: 59257,
		sha256: "afe74014cb3266d39e01d35283a99c71dc1553af453f10ed5695873e95dae479",
		keys: 763,
	},
	"he": {
		bytes: 68366,
		sha256: "91edc97c827e8bab0a050cf43d18f7beb43611c85b9169a5aae81b313da7867e",
		keys: 764,
	},
	"hi": {
		bytes: 91458,
		sha256: "ea5ac7935d6fe2a612b57cf374e5e8d198f48f12498da91dedd76d60c50eff86",
		keys: 763,
	},
	"hu": {
		bytes: 59098,
		sha256: "5bd08cf4f8822163d714e5645872225432e3094bbae53ec5cd121eec6a25d7c2",
		keys: 763,
	},
	"id": {
		bytes: 53973,
		sha256: "aed53e4e5663c31d82a0b292c8ef10d7793675d5ccb703f98318a6c678b765ec",
		keys: 763,
	},
	"it": {
		bytes: 56684,
		sha256: "c2b4501c4a9cc6e42f6847e5145c522a9ee309eabc5f3657e86cb4e78f5d8a8c",
		keys: 763,
	},
	"ja": {
		bytes: 65560,
		sha256: "02217eae3d3129ab13320b11b2728bd6de7aff7ae512c2929e8d939d1f8ba194",
		keys: 763,
	},
	"ko": {
		bytes: 60218,
		sha256: "1b0715d9be9675306fbe629707c3692e8a166419ba903d348c36f621af4df282",
		keys: 763,
	},
	"ms": {
		bytes: 53833,
		sha256: "e8b1147ca33cb4faa7b70d89f5595107dedd4a91f53c1b12c500d13340f64f82",
		keys: 763,
	},
	"nb": {
		bytes: 53661,
		sha256: "3aad1624f118e2cd7a0eacbc6e6bb5ce4c8c470685abf7d3dda7bb0153c537a5",
		keys: 763,
	},
	"nl": {
		bytes: 55945,
		sha256: "b417a85ff96979b84d0ec3caea2d76b4f3aabbe662a9359bd8c0931e687a7ce0",
		keys: 763,
	},
	"pl": {
		bytes: 56016,
		sha256: "d2c2e3b8f755144cc8088d94732fa09a7f57c7cd08bf8e674faecc344bddb001",
		keys: 763,
	},
	"pt": {
		bytes: 56929,
		sha256: "b2937d83c0fc78a4f4d4d1557ae49d3356ae3d95c84e5c5e58e3c63925d12501",
		keys: 763,
	},
	"ro": {
		bytes: 57429,
		sha256: "b86679b18adb6f4c277477a88e17806417ee63b22d94c32089de1b2471c733dd",
		keys: 763,
	},
	"ru": {
		bytes: 78174,
		sha256: "eedfc485f3f6ce2e3426323a4aba7d30cc63a2d1ddf444f22cdba9ebead5b0c2",
		keys: 763,
	},
	"sv": {
		bytes: 54585,
		sha256: "aaa735c99e3413e5300d9ce82785a251bc0fa6720b15829f4460665465a662b5",
		keys: 763,
	},
	"th": {
		bytes: 90627,
		sha256: "b479395827ad3ad576cbf4f8dfe84c0275b2f9580d51c694a29e94dbd3a1f35d",
		keys: 763,
	},
	"tr": {
		bytes: 55794,
		sha256: "817dd2bda765f6c3725d15ec96dddc7d74cb8bf27d2960ce8ce4685eb251da2e",
		keys: 763,
	},
	"uk": {
		bytes: 76575,
		sha256: "f50ac722d827918bd938164a75d197e09e494f83214562469d60b7fd0b192c8a",
		keys: 763,
	},
	"vi": {
		bytes: 61678,
		sha256: "4e9de981020a550c6858b8f3c49b19172919a700871071e69e2e3133d6d536f9",
		keys: 763,
	},
	"zh": {
		bytes: 50997,
		sha256: "5b368e5227e41e6d323efdd2d79b23a2912faba0e35613b5d82529ae88181f9f",
		keys: 763,
	},
	"zhTW": {
		bytes: 51107,
		sha256: "29d4430d6efd217704cf98acd834867dad434dfc6e02c8379e0402c4f89e81f0",
		keys: 763,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
