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
		bytes: 68946,
		sha256: "6cee755aa80c7288563011bcff6eda2cc4cc0cd5eaa32de8c676551c0cf03f71",
		keys: 771,
	},
	"bg": {
		bytes: 80916,
		sha256: "5eb22a1747372845a56e1f6a5de68e47a5288aac57f74237bb9e9e38c4b2f2c3",
		keys: 771,
	},
	"cs": {
		bytes: 56688,
		sha256: "cab5aaa493cf3f35f00482d4c09d29425828e527767f7138ba26cad5c566a77c",
		keys: 771,
	},
	"da": {
		bytes: 54520,
		sha256: "7d417c29c5826f860cf1e8ba8b83528bed91fa64e5c7500430527f58b5cffe52",
		keys: 771,
	},
	"de": {
		bytes: 59609,
		sha256: "8ccc301b5cc5fbf5db84defda3383c8353909d4aea030f79be8c70202e017445",
		keys: 771,
	},
	"el": {
		bytes: 85368,
		sha256: "9789a55fb4b17c19d410ad1a7299b26736e5d9d8c270a81a21b461d855ac0470",
		keys: 771,
	},
	"es": {
		bytes: 57942,
		sha256: "77e764eafec202bc9be0da7cb95dc352ac8a40bfadf222e1bc31375f1f8f5793",
		keys: 771,
	},
	"fa": {
		bytes: 74372,
		sha256: "3c8aab35eecf9c84291b564bf3c48b1df556f06550fc1c4a251ca56b766207ca",
		keys: 771,
	},
	"fi": {
		bytes: 56525,
		sha256: "a993ebbe0dee9e7cea75c9e2ce68379889821a8efaf3ef26359a4a40f5235cb0",
		keys: 771,
	},
	"fr": {
		bytes: 60263,
		sha256: "ceabfa258b9f91778adcff422d082f5dcd8f79ec2a5a5047f31f5e1935a2cc26",
		keys: 771,
	},
	"he": {
		bytes: 69176,
		sha256: "4dee4aa5d7b5f088b3c869acb2ff8c7c794cffb0e4f6aa97eddf72a7bc3e3e94",
		keys: 771,
	},
	"hi": {
		bytes: 93494,
		sha256: "a3e86526b9a0e22877165d5c4bbda685c1ccdc346dff05ad4ca1d2137e47f6e2",
		keys: 771,
	},
	"hu": {
		bytes: 60073,
		sha256: "709376409b17ded0448779c9cb934ea6af7137b83ce030405dfa0d719557f20d",
		keys: 771,
	},
	"id": {
		bytes: 54899,
		sha256: "f3a7cea9fc74eff94a3fd275725da5b482e743d754e24b10ff2ee9c5e3bad3b6",
		keys: 771,
	},
	"it": {
		bytes: 57704,
		sha256: "af3e875956359cd687ab47e78ef5cc76b3d4c4828912f542c7ebb8b793def819",
		keys: 771,
	},
	"ja": {
		bytes: 66741,
		sha256: "ae59955795c3ed731ed6ef768adcb93dd374bd67168175b27e07e07d123e2382",
		keys: 771,
	},
	"ko": {
		bytes: 61280,
		sha256: "cae1a40352b469cf274f573c4beb54335768dd2d7fef1483501d4b0c656de466",
		keys: 771,
	},
	"ms": {
		bytes: 54776,
		sha256: "27c56899c5358202488821b40cc8ef6a79adad62e0c285a31cba6ba6b867178b",
		keys: 771,
	},
	"nb": {
		bytes: 54623,
		sha256: "cec7dce25ce3128a58fcd1c6354f7e260f5abb29a5c20f1dbe24c13acbb87b3e",
		keys: 771,
	},
	"nl": {
		bytes: 56869,
		sha256: "6d5f3068068e6b0d19f0bd4990a4373db4187d84e9807e40e78974dcb55db5c0",
		keys: 771,
	},
	"pl": {
		bytes: 57028,
		sha256: "40a3d7876eee5f042ee6044b86d179708115de7f846edde71d23211566f59399",
		keys: 771,
	},
	"pt": {
		bytes: 57854,
		sha256: "0f61a2ec5fa7bab6f94ec1204322fc16039b32e3f86346dbe586ef0edb99a7b6",
		keys: 771,
	},
	"ro": {
		bytes: 58450,
		sha256: "711c7be8a11773c2b092bcbf8622cbabff0b90f628f170e3c8ee5e6858d7d079",
		keys: 771,
	},
	"ru": {
		bytes: 79595,
		sha256: "13bb0ef74210ed3210b8f60a7ba6c0f83b8e997fd8d345bf5af6deb3beeb35e6",
		keys: 771,
	},
	"sv": {
		bytes: 55479,
		sha256: "5183f5f0347f31fc0e3dd15a389d408076fabf5125e9a395828d6cb7bb5329a6",
		keys: 771,
	},
	"th": {
		bytes: 92698,
		sha256: "805ebfe7bc579e7ce5e1741599f6d9bb4f0a164ac484b8e5e9cee7522c3b8385",
		keys: 771,
	},
	"tr": {
		bytes: 56810,
		sha256: "c5ecffa38f063a23dc86ddf9e0274905e7502c288663686baf698cfb1225685a",
		keys: 771,
	},
	"uk": {
		bytes: 77972,
		sha256: "af92a08de14cf903c1703d6573d3c09f737ae8052ff59e2a4f13dbb99b4065ac",
		keys: 771,
	},
	"vi": {
		bytes: 62806,
		sha256: "bb39c051d57fd2cc0bb485f585ff512af14ebacf685ebc42645e53d0591443eb",
		keys: 771,
	},
	"zh": {
		bytes: 51822,
		sha256: "0494aa4511d06cff3b5a58355dc3c7333dea309f84d2c3c789a180905904f08a",
		keys: 771,
	},
	"zhTW": {
		bytes: 51975,
		sha256: "b55da85b64b598eaf549785f7ec8fa3eea6ada825c2ad7da616567576fbcfe33",
		keys: 771,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
