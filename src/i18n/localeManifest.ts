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
		bytes: 112150,
		sha256: "f0cf22d094bef3ef7f7776472cd88494f1ab670544d9ebac55d5220da8642cdd",
		keys: 1208,
	},
	"bg": {
		bytes: 134069,
		sha256: "917ed5ffbb1c7ae51084510429819fd130f8bd9f8d9b4680a6c9b5093960ef5d",
		keys: 1208,
	},
	"cs": {
		bytes: 91897,
		sha256: "68eb2c3385c3bb96e2dc32749ee7638032b5d67c905c921f4ab0b374582e13cd",
		keys: 1208,
	},
	"da": {
		bytes: 88947,
		sha256: "c95fa537811756983f819cf9610d03f4c393ae486ef92c64d8b84a94231c2db9",
		keys: 1208,
	},
	"de": {
		bytes: 97253,
		sha256: "d5dfbd27528721de3f23bc2396d54075f0e4a458d370f0a3f8524b4861b43140",
		keys: 1208,
	},
	"el": {
		bytes: 142060,
		sha256: "cc9b6b7347fd9df2efc288ddfea06f45c72885e6d395b39286307532d2c9bd4f",
		keys: 1208,
	},
	"es": {
		bytes: 94244,
		sha256: "e695874e7704143ec9e0812c4d1c554cb8d4ddb3d395fc65e84a217e869fc355",
		keys: 1208,
	},
	"fa": {
		bytes: 122615,
		sha256: "c9912cd1fafcd3aefeac24b72e1d85f4987094d3bfc356b504105eed9d2efb52",
		keys: 1208,
	},
	"fi": {
		bytes: 91571,
		sha256: "8118a626403c943ad11aa1486dc7e9e7e72102b3dc58c61aa0d8d06241d84588",
		keys: 1208,
	},
	"fr": {
		bytes: 98730,
		sha256: "4d5e8865951a2ddc00f7e81432af97ed4a7592a5340b4e4c2f9558e12e6c6cd4",
		keys: 1208,
	},
	"he": {
		bytes: 111035,
		sha256: "1e358bd035efd131b86a0f894e147ef78c0644ae08869abf05c5f841c3f1adcc",
		keys: 1208,
	},
	"hi": {
		bytes: 155751,
		sha256: "bb314d3cdfe8ad9e9803c0c91fbeeca90e6e26dea1ef7a7faf0d924fea784fc0",
		keys: 1208,
	},
	"hu": {
		bytes: 98045,
		sha256: "9bf3eca77e041b813d26e24505975af6b46aa1698282477493d4b381513d8877",
		keys: 1208,
	},
	"id": {
		bytes: 88819,
		sha256: "62b0b1425ec9a32a4770bc86babdafd008770cb8b779fff30a03d71c712bb7de",
		keys: 1208,
	},
	"it": {
		bytes: 94635,
		sha256: "b82aad50aeb6d2857b2d9af290e96415afd1a3ffc628cedf4df3676dfdd51930",
		keys: 1208,
	},
	"ja": {
		bytes: 107904,
		sha256: "26d0328633918052de8267cce60fca683eda16ad019a4ab9baa6590271e2a9ca",
		keys: 1208,
	},
	"ko": {
		bytes: 98846,
		sha256: "aa7897f0b2963ef518ca8245a2bc4c6b590f3d730914ecc26bac8247774d6f06",
		keys: 1208,
	},
	"ms": {
		bytes: 88895,
		sha256: "7e3f896a9604de4482767a0187b07dddae3ba522e6b00ff5204b9ea4d9c5995e",
		keys: 1208,
	},
	"nb": {
		bytes: 89510,
		sha256: "deafd2e431f74b77d8745308a3ad2ee6888c82f193d64b4fd06af8724ad74d7f",
		keys: 1208,
	},
	"nl": {
		bytes: 92698,
		sha256: "7c66f680d1775f105ada76e650228e30a7c72a406568758f9cb5717f61d5750e",
		keys: 1208,
	},
	"pl": {
		bytes: 92881,
		sha256: "95cdfc9630e63f3cf9886f178dd1c5c40dc97d288360b0d34a2016989b5f2c18",
		keys: 1208,
	},
	"pt": {
		bytes: 94133,
		sha256: "9b621d5da77ef3426caaf0a4d259862523da90f51f2d48aea3bf23083ef54cbb",
		keys: 1208,
	},
	"ro": {
		bytes: 95871,
		sha256: "546aab203db88b18eb6d3563302255d9ed871fe64023be32a0b7d874e11711ed",
		keys: 1208,
	},
	"ru": {
		bytes: 131267,
		sha256: "a0342a8ef65a16ad03af3ba19ebf28cb0d15052ad3d671ad9f4d1a39fd01e4ba",
		keys: 1208,
	},
	"sv": {
		bytes: 90660,
		sha256: "65576a221d0a4575a69d3e126bf8c7c71cd3a17f88a5c49982aaa807cdd316f9",
		keys: 1208,
	},
	"th": {
		bytes: 155573,
		sha256: "12fdbe5bf6a10ce6557518bf6f17dc292a803e32aa25d92f254e0eaa852acb46",
		keys: 1208,
	},
	"tr": {
		bytes: 92361,
		sha256: "69adb619f3376bbb8365f2f9c124ad1afa7ade1378734f98d341ca22a9a542e9",
		keys: 1208,
	},
	"uk": {
		bytes: 129095,
		sha256: "bf473784cd3149030364bd6cb949d0c405412a324f26670399166615f4d7b000",
		keys: 1208,
	},
	"vi": {
		bytes: 103245,
		sha256: "3ae40b2261ebaf78f5e091d634112c067da1f147e5ac1e59da5f786a9d08dd43",
		keys: 1208,
	},
	"zh": {
		bytes: 83450,
		sha256: "47df7e486343b4777f0551aa04edcad2142551328a67fe4ad19e11f31e4e293c",
		keys: 1208,
	},
	"zhTW": {
		bytes: 83750,
		sha256: "ffad3d830522729381bb0dbd00393e392de8a890622e0d839a3dbff7f9704c0b",
		keys: 1208,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
