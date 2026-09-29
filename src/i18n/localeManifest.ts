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
		bytes: 106900,
		sha256: "63601f6582a7d4b9a91a01d66335a21fb884b839d8271a29b0345d22b3d964dc",
		keys: 1154,
	},
	"bg": {
		bytes: 128695,
		sha256: "abb2627639b0d7191cd8a390368450635f93259acd03f8722854c638683110d3",
		keys: 1154,
	},
	"cs": {
		bytes: 87945,
		sha256: "e5f13933c9115244ed37f0d331436a98b52cef43d332dde7057efacd4380da9a",
		keys: 1154,
	},
	"da": {
		bytes: 84647,
		sha256: "cb14578f933030764aef9f4087c513e45675bbad56cc483a69505d66d9b45de4",
		keys: 1154,
	},
	"de": {
		bytes: 92876,
		sha256: "707745767827d8f8e7da849a186fc3a735193a2ec26f17fd333f015b8498cd1c",
		keys: 1154,
	},
	"el": {
		bytes: 136129,
		sha256: "1dbb00b43828366906e8177b68306c8632b737afa8499c147dd9cbec27a1a2aa",
		keys: 1154,
	},
	"es": {
		bytes: 90282,
		sha256: "77639c9095600aa339f7a92eeeb955312f75187aa52dfe04a2449a5ae7f328dd",
		keys: 1154,
	},
	"fa": {
		bytes: 116686,
		sha256: "a5e8a583cb47243f81a9c792ae8110a9061cb0d8adadd1a0c666f9baeedc7666",
		keys: 1154,
	},
	"fi": {
		bytes: 87550,
		sha256: "d0d56116972f722d97577ae3604f804208c6a18751779a11c259fdbd632f8d86",
		keys: 1154,
	},
	"fr": {
		bytes: 94124,
		sha256: "fcd9c8ea5de87988dfe0246b7bdfa59cd1fbc079aafffc7befce66a943b2ec86",
		keys: 1154,
	},
	"he": {
		bytes: 106054,
		sha256: "01143ec3860794b4bdf659594e10f319b5cb995c114828959501dc59b1d24b1d",
		keys: 1154,
	},
	"hi": {
		bytes: 148122,
		sha256: "3e08d1f844e2ee8182fcb9ab5dffb3362763241c2dc0c73ff7d2abe24fb6de7b",
		keys: 1154,
	},
	"hu": {
		bytes: 93727,
		sha256: "d082fde20f076c377e68629f8c8c7fc9a26067c8907429a0d47dca973e9b6a98",
		keys: 1154,
	},
	"id": {
		bytes: 85069,
		sha256: "d9091dd33a262eb86938e60709624926f66d6e387e5f0c8644cbb99bacd8d6e7",
		keys: 1154,
	},
	"it": {
		bytes: 90738,
		sha256: "3f3b4022c47629abd3c6217729bbc2a4c1c8f069062cd983aeff4c78348af883",
		keys: 1154,
	},
	"ja": {
		bytes: 102922,
		sha256: "2ac413dc23507cc99bdbb1c6a2aa1272ab721bcb991c6c50ed60562845cb9a65",
		keys: 1154,
	},
	"ko": {
		bytes: 94047,
		sha256: "e51c5ac25a385dfd7fb9de4a3416d4943492ded3ff1882fec7fda8dbddfccf56",
		keys: 1154,
	},
	"ms": {
		bytes: 84729,
		sha256: "d50d64280dffe662e17f7fd7b6466ac6e92b14506f45a05b869d82e7ee093485",
		keys: 1154,
	},
	"nb": {
		bytes: 85140,
		sha256: "2cd14bcc01c2f937b8efc36b459f8093ce4ae5a5a7af5eb4d84b02f591a14331",
		keys: 1154,
	},
	"nl": {
		bytes: 88390,
		sha256: "8f646478fa9870c1059fb5c748141d5b5e2b6448a1f4d1be6f21b5b71a5228dd",
		keys: 1154,
	},
	"pl": {
		bytes: 88931,
		sha256: "41b003d84bc97fa4d6097b06647d9de4e87d4fb2268f179cac65a98c0a6fa767",
		keys: 1154,
	},
	"pt": {
		bytes: 89954,
		sha256: "276b6d2d1802331e032b667450d569d80363c72ad9ebb4ac7f5a31dca79634dd",
		keys: 1154,
	},
	"ro": {
		bytes: 91432,
		sha256: "8e6f9b4576de99c4e798436e3fc2582a1f773c6d409c1030c0f889d31d8d1e06",
		keys: 1154,
	},
	"ru": {
		bytes: 125926,
		sha256: "fe0a20971d98348c210bd61894d61fd7c59d969cbd589f438f6b59dcd5db73a7",
		keys: 1154,
	},
	"sv": {
		bytes: 86387,
		sha256: "c2a828cc19abf12cb28b84e5515f17cb33744cce580df5224e07eb9f5ffa29d9",
		keys: 1154,
	},
	"th": {
		bytes: 149295,
		sha256: "eb84648bcb12441e4d2aea2b6d2567ec80e596813de06c26c68019744e590bb0",
		keys: 1154,
	},
	"tr": {
		bytes: 87924,
		sha256: "9156b0c985f6a0f1fcaa8fbc2ddaeebb193ef01abfe426f3de7e45a39db11892",
		keys: 1154,
	},
	"uk": {
		bytes: 123993,
		sha256: "a05a9edf62a920599059f21ef3589e0457628d333778c318e22d7c8539021d61",
		keys: 1154,
	},
	"vi": {
		bytes: 98965,
		sha256: "8e8283418c53f9db1049a4527b8ec204f6fb7bd0f1cb437f1ca876a873d46c1d",
		keys: 1154,
	},
	"zh": {
		bytes: 79486,
		sha256: "6e66daa4a71bb4856f03d85967ffe028ee9291d168a5e5f68989b96298d4d598",
		keys: 1154,
	},
	"zhTW": {
		bytes: 79799,
		sha256: "b2e9df219c97cd1b9958b44e3022ec476aaa81292b270e51eb13e2ad21fc2f63",
		keys: 1154,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
