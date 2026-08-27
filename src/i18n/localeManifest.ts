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
		bytes: 59183,
		sha256: "651e868dd839a136e1fa5f44628416a4e5cfe5411c8ea5444ee686d43b2d18a1",
		keys: 719,
	},
	"bg": {
		bytes: 68299,
		sha256: "492d6673049cd10ab5f5968c1c1f84ff50f6489c4e2d0ef78845840c7ebb9890",
		keys: 719,
	},
	"cs": {
		bytes: 48703,
		sha256: "caf85b1b18a9b9a674b5bf21aab5799798bd9a3f09807822afc6e8de1697e021",
		keys: 719,
	},
	"da": {
		bytes: 46934,
		sha256: "60f8d12d1fe243b6608d6aba7fb8e223fea354648950a6ef1e18654717a29d42",
		keys: 719,
	},
	"de": {
		bytes: 50933,
		sha256: "ec4e253d0a1d90bf272b6642805bb675eb6236e0f9be8a72c9cd163c3e7adba9",
		keys: 719,
	},
	"el": {
		bytes: 71516,
		sha256: "798d4ad03a50d48c20e6e382f3123d853b1eaac4267cb62c40ea7979469d97e7",
		keys: 719,
	},
	"es": {
		bytes: 49848,
		sha256: "236f244cc6f98d16e24f4e8f7a1b6b45e90aca63e5b99161cf32b47504a9d5d1",
		keys: 719,
	},
	"fa": {
		bytes: 63600,
		sha256: "7e4549e8b20ef638bb24a113c95bc615d24a37506c0a88ef0fcebbc776c381aa",
		keys: 719,
	},
	"fi": {
		bytes: 48892,
		sha256: "b4f77a307d7b465626337c1920925cb4c8193cc818170a956f95c840085b619d",
		keys: 719,
	},
	"fr": {
		bytes: 51615,
		sha256: "622d6db597f45fe421fcf227f58cc66ab4e70aed6ca703cb35e86e10d54bc0fe",
		keys: 719,
	},
	"he": {
		bytes: 59752,
		sha256: "5b58112fa9830e173c8cdf033cd2a371f0487ad97e039b3cbec0fb170b5858f9",
		keys: 719,
	},
	"hi": {
		bytes: 79193,
		sha256: "e8998899e76663fb6d9dc9e4bec232e633f5d6f489bfd7106eb7f2d20b4e8d20",
		keys: 719,
	},
	"hu": {
		bytes: 51577,
		sha256: "3d6d8fb51b1a7c776c29efd0728637cb8791d8a3f563dbf34b3c8f0dae496086",
		keys: 719,
	},
	"id": {
		bytes: 47755,
		sha256: "1202a24c2039d3e83238dea8a757750c971cc1f2c359285a0696ca80e1d9ab73",
		keys: 719,
	},
	"it": {
		bytes: 49418,
		sha256: "7e9b6bab5f4393c2c91b854686cf39ba2955ccb913292de6b23fc2179e9b223d",
		keys: 719,
	},
	"ja": {
		bytes: 57170,
		sha256: "df43d6f7709fb1f0aaf7c171acbe005c7e1095981e7e10b2d55a15f6afded8da",
		keys: 719,
	},
	"ko": {
		bytes: 52949,
		sha256: "b28deec3166753f17ab29db4c434df42243c344ede8fc9806d2ff24c8def8d0e",
		keys: 719,
	},
	"ms": {
		bytes: 47679,
		sha256: "2a68e50bb2b30b179fa20be32f3c41549f30fe7c62cde0fe6e10d32d9aa7bfbf",
		keys: 719,
	},
	"nb": {
		bytes: 46990,
		sha256: "902ef319a5b9ba1518837eec0228e535e85f391c0194861a5d0d983102523879",
		keys: 719,
	},
	"nl": {
		bytes: 49069,
		sha256: "b4d355c1e009441d1289cc9fa6f825b91ad18a0e762764553365b07ec964ca88",
		keys: 719,
	},
	"pl": {
		bytes: 48889,
		sha256: "d83f91afa1e6d22b58166bb21e786acaf29e5c66af1fb88f283f6046f94775d4",
		keys: 719,
	},
	"pt": {
		bytes: 49651,
		sha256: "e8e027b19db51bf5569411d5559e000a183241c5dcdde903b03e5b7e529c6bfc",
		keys: 719,
	},
	"ro": {
		bytes: 50214,
		sha256: "495828250809b1f50f6d0c98c424460e3f680029a87782d14a362e62fffab09d",
		keys: 719,
	},
	"ru": {
		bytes: 67430,
		sha256: "929d44fcc06cc271186d98d68cd5829314fad2a0f84c270d824d3b44fe776f17",
		keys: 719,
	},
	"sv": {
		bytes: 47602,
		sha256: "8ce94763692a3d8ab9367394caabf0d321d51984a986007d72378b6439a3c721",
		keys: 719,
	},
	"th": {
		bytes: 77185,
		sha256: "c0da499dc378a0939f053305c76675be20c893aa7e92632013977d4a3cac2323",
		keys: 719,
	},
	"tr": {
		bytes: 49123,
		sha256: "bbc390f6962bbc24338a3c3876b5a1f53c4500aa435c3e5f24c18325f852fbb4",
		keys: 719,
	},
	"uk": {
		bytes: 66152,
		sha256: "7b309f4d4115e3f7cab3f18e83114f15dd835e283a30bac426e82da4728c7a3a",
		keys: 719,
	},
	"vi": {
		bytes: 53985,
		sha256: "977f699b8a6f0d38068face3cd5e176c6d1397c4cfe84fcfcb5f696638a7fa19",
		keys: 719,
	},
	"zh": {
		bytes: 45435,
		sha256: "dfed4afac80dbe2d47fe231da622229d584d9a53b9d8c3e5487c3beb20e8c858",
		keys: 719,
	},
	"zhTW": {
		bytes: 45594,
		sha256: "43ef75dbb8f3943b5389e98937b1462d6be74f3f212b19b9eae2f5f6169ec934",
		keys: 719,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
