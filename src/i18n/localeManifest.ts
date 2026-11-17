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
		bytes: 125300,
		sha256: "0647aa785a185a749a34920e36b3e724677600c17a6c9afaf77e84a58cb2516e",
		keys: 1365,
	},
	"bg": {
		bytes: 149267,
		sha256: "d744770244e13694c7ac0bcb633416b896e13c94b0e94052a67053ded8b493ad",
		keys: 1365,
	},
	"cs": {
		bytes: 102918,
		sha256: "09c144481ceb4b1611917c0a2c0efc754381456e8ebadc97ff734dd333a0fa80",
		keys: 1365,
	},
	"da": {
		bytes: 99482,
		sha256: "9f893b5a695a8e59f4d05fef37e3f8f8f4ac2e7f8633a06439fc444fa5c3788a",
		keys: 1365,
	},
	"de": {
		bytes: 108962,
		sha256: "87625982bc76f1111e4f26e29b2164e434a72ced330a3c6ac2b598834dce9af0",
		keys: 1365,
	},
	"el": {
		bytes: 158754,
		sha256: "f56cb71f03b5608e03430ac46ce50fbef49214d977d3289f10254b887e1a63b8",
		keys: 1365,
	},
	"es": {
		bytes: 105165,
		sha256: "cb9115343ce55acfbc89e7bef697e22af36057a13f72c4fc1062e4f32561b369",
		keys: 1365,
	},
	"fa": {
		bytes: 137898,
		sha256: "19b83dc6b82f578019b1168d7573161413887b45764c125f771a1b476a9a5271",
		keys: 1365,
	},
	"fi": {
		bytes: 102736,
		sha256: "cb85a3f842e504d8a3ff0c18e04a560b09b1fcbef2ebbdf44b61c1b21b230105",
		keys: 1365,
	},
	"fr": {
		bytes: 110073,
		sha256: "a1d7f20a64b4cc3b36fcc2ad3b26bb455ee3c937214e5b91c5735e71cda41e54",
		keys: 1365,
	},
	"he": {
		bytes: 124037,
		sha256: "1b561ce51b7612b93836ec972a6eb90ae775e8be443d01a2c40431e7c1e51a63",
		keys: 1365,
	},
	"hi": {
		bytes: 173849,
		sha256: "6a53567027621966e7819848bae21167359463dc8ba49ca1d9d6e5cbf6568bda",
		keys: 1365,
	},
	"hu": {
		bytes: 110126,
		sha256: "45fed25b6a4d73bb6637b24631384dd60279beb5f224c16b3b88719f99ce305b",
		keys: 1365,
	},
	"id": {
		bytes: 99611,
		sha256: "17c5315819547413ee43dfa6a866ffff68aac6d01953f20319d6324114d7b7af",
		keys: 1365,
	},
	"it": {
		bytes: 105517,
		sha256: "c9b08881e6b8bed1ce5e8ec5f83054aa7d86d63ea4b0c35bf03d9f309cd4ad78",
		keys: 1365,
	},
	"ja": {
		bytes: 120852,
		sha256: "61d000517ef8b589664c8e5eef8900719aac1be4c76e19279c2bb21289a6540f",
		keys: 1365,
	},
	"ko": {
		bytes: 110871,
		sha256: "9290efd1643942f56c848b3c4880280a6ab84477f523190e31db1e2631be6ae3",
		keys: 1365,
	},
	"ms": {
		bytes: 99816,
		sha256: "34a6d0a42729d15dd6301210ebeaebea1f75cf685bac6d0ecf93b26e5208be65",
		keys: 1365,
	},
	"nb": {
		bytes: 100184,
		sha256: "b8f69ac7119b5fc18a2e165a673314f8f9e966514991c52ab68d92ed06a4becc",
		keys: 1365,
	},
	"nl": {
		bytes: 103597,
		sha256: "1b691422817a7e83c88b964b9308b139e475945f2733820bf99a39d2fe2c3c8c",
		keys: 1365,
	},
	"pl": {
		bytes: 103914,
		sha256: "c17433dd331b90dd2d848996819451a6ff6992f669723b12a119c84b23d495f4",
		keys: 1365,
	},
	"pt": {
		bytes: 105125,
		sha256: "bcc0801bdb767043913d81822a9c40519dc4b1a0e21bae8406411942d97b30d7",
		keys: 1365,
	},
	"ro": {
		bytes: 107405,
		sha256: "1f11f4ef08788d37bd90f05e7825d301b1c52c56cf942401dd387fe741a166be",
		keys: 1365,
	},
	"ru": {
		bytes: 145768,
		sha256: "0f5ca5e516a3d855ed54e86437db9871c283f1e50a931ed3454fdb328f062ce2",
		keys: 1365,
	},
	"sv": {
		bytes: 101559,
		sha256: "43c65899b0fffcd67104311602a7b974d3a39a22fab59215be3c1d9c79ffd669",
		keys: 1365,
	},
	"th": {
		bytes: 172604,
		sha256: "0618ca9974470da441c3fdd6a68fe6e20209cead9a82d54faa333147a9048a73",
		keys: 1365,
	},
	"tr": {
		bytes: 103377,
		sha256: "d88e8049d0e51cedd3cbddc36b7fe449338ff545029554942bd12956d4e9c055",
		keys: 1365,
	},
	"uk": {
		bytes: 143320,
		sha256: "f61751c70f4f002694b9e64312d3aa6f4b37d89cdc8c73da128e3f97847cf7c3",
		keys: 1365,
	},
	"vi": {
		bytes: 115038,
		sha256: "56e26215897dbbc6e37a48a47351e0ceabcb06515bf1635c7748880a7505faec",
		keys: 1365,
	},
	"zh": {
		bytes: 94115,
		sha256: "cfaf7ea0524176bb3947fb9278591865964927bc24bbc0b0efee0bcea3ba1887",
		keys: 1365,
	},
	"zhTW": {
		bytes: 94427,
		sha256: "7434935ec1af121524320530caacd35e3b9f2b471fe07f3f7ef71f6276c82ace",
		keys: 1365,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
