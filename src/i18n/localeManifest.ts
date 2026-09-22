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
		bytes: 67794,
		sha256: "98bc09481f4ec42568e3e3112592dfb0a49546540f588e5cac620d05e2b5d968",
		keys: 763,
	},
	"bg": {
		bytes: 79558,
		sha256: "6c1336c142f42718c2ce780223e185ecba2a45709d6c6baa87e7b654310c60ac",
		keys: 763,
	},
	"cs": {
		bytes: 55781,
		sha256: "42fb5d01df4f1ea3d798a022f360a16824b49b2977470eacc5bcce22c7d679d6",
		keys: 763,
	},
	"da": {
		bytes: 53571,
		sha256: "a152aba03990bd57a4a81c36612fa584bce308a3f479810989c900330076ee83",
		keys: 763,
	},
	"de": {
		bytes: 58676,
		sha256: "ded266335f78f2feb2e314167a3f1a40d390e80cf1e8706caeee9d848691f5d5",
		keys: 763,
	},
	"el": {
		bytes: 83768,
		sha256: "9e2ca66af5cb9dadb751e7948eac39fdc43a6a9419ed94a438365bde315d3429",
		keys: 763,
	},
	"es": {
		bytes: 57021,
		sha256: "dc1908a77b3543040d6dc8576aa02e5b4ea953dc2e58181951abc9df492a26c5",
		keys: 763,
	},
	"fa": {
		bytes: 73013,
		sha256: "83dee39d6166577f436b735ef54bdc5e11763f0876598d74cec4b65476171fa4",
		keys: 763,
	},
	"fi": {
		bytes: 55553,
		sha256: "711a23d858e00ea96e6859fcfe5e1e2831df1f9c277ea4bc4e8f209c536a87fc",
		keys: 763,
	},
	"fr": {
		bytes: 59302,
		sha256: "c1393ccff294eef5ae22d606a8b85fb76558e010ee25ccc7c1d4688b1b651621",
		keys: 763,
	},
	"he": {
		bytes: 68408,
		sha256: "ea3edd782cac2f27c5bbd2b527207307997aa07a384772a9807d9d0594e29704",
		keys: 764,
	},
	"hi": {
		bytes: 91602,
		sha256: "e93bd3eb88ff8cf5782afbee0e4a648248505a65889c7b848ca24b2960dc83e3",
		keys: 763,
	},
	"hu": {
		bytes: 59168,
		sha256: "69269e3f1acf3f7ee9480cba15a624948d33c968d0c2bfa2c7b7799649695eeb",
		keys: 763,
	},
	"id": {
		bytes: 54022,
		sha256: "63823c02de9465f1fda0f1cb1dfb0f382d9260b6e4e3e490f91b74db28c2910f",
		keys: 763,
	},
	"it": {
		bytes: 56750,
		sha256: "1f59d65c0e22eeb7e30f2b50ce9f45fdc97dc323dc35e6603b13e6d100d92201",
		keys: 763,
	},
	"ja": {
		bytes: 65636,
		sha256: "b66862891ab1de383b518c32637b97a2d07392ab179e4ce8a61ebebf4eff6a75",
		keys: 763,
	},
	"ko": {
		bytes: 60249,
		sha256: "d0d0dee4222bbe4ceb5a41dc3fefd7bcf30fa7cb5dc145fd0b187d05f460f088",
		keys: 763,
	},
	"ms": {
		bytes: 53867,
		sha256: "1187fe5687326e057cea1446c8e8b5f0e9b48e543fb8717683d9bef42fc6ed7d",
		keys: 763,
	},
	"nb": {
		bytes: 53711,
		sha256: "cd91bfad0c830511b748623f27df5a033f85d01932c6dce5bb63476fb3570068",
		keys: 763,
	},
	"nl": {
		bytes: 56004,
		sha256: "313fb30cebf6de94afbd4fd90041d86a339790b232d77f45b5e082164e65b417",
		keys: 763,
	},
	"pl": {
		bytes: 56080,
		sha256: "2f91144e37a544ec18dca4738e7e43b97827677ac670b5296dd240e8b86addd2",
		keys: 763,
	},
	"pt": {
		bytes: 56964,
		sha256: "826ea5ddfed766bdd88919afbb2c9c46d5ff62bc71e9778bf08a2cd0dc002c3e",
		keys: 763,
	},
	"ro": {
		bytes: 57475,
		sha256: "89e6e750026ffc297c0f39b55bb210da450886088157273d0c42a9fba49249db",
		keys: 763,
	},
	"ru": {
		bytes: 78245,
		sha256: "37fcd398278f2df4a84d4a2c5f0665157b653a4fdaf79f9fcba794486d606e00",
		keys: 763,
	},
	"sv": {
		bytes: 54622,
		sha256: "9aa04838babfdbd7ba1b35907cc04a9c04a8194f96e83aa52bb02ad97568e4e6",
		keys: 763,
	},
	"th": {
		bytes: 90748,
		sha256: "4d48ebb4a203d170d5b3d316422c12fcea292649ad763797fa570af0d97c5d12",
		keys: 763,
	},
	"tr": {
		bytes: 55828,
		sha256: "05b44d83eae868b41c72c7d67aba9051a2e5e2e90a6412fe5512db468d2b3226",
		keys: 763,
	},
	"uk": {
		bytes: 76643,
		sha256: "76d15675bac3109a22ba990de37d3ef5611b54b5cb1dc92cc422fc1b60ffef7a",
		keys: 763,
	},
	"vi": {
		bytes: 61727,
		sha256: "209b8ee24eb11c5f51d9331cb189a12c4973f6df95c1ba02728f6662bec43ed3",
		keys: 763,
	},
	"zh": {
		bytes: 50994,
		sha256: "d1c5f23e0ab7a64f7a45ff21b3b1a075c16a4b420d53b0f611c16df713c8e405",
		keys: 763,
	},
	"zhTW": {
		bytes: 51116,
		sha256: "3abde26fa8db8ea5d6b768e6083bc88af1bce2c63965d0358c6eae87061a76c0",
		keys: 763,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
