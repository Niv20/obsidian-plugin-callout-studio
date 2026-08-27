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
		bytes: 58921,
		sha256: "b1b846ab4bda366b56e1b71f4bdb5c0bdb7d29be1c24ac6d6a69355a07ea92f4",
		keys: 719,
	},
	"bg": {
		bytes: 67945,
		sha256: "204ee9594d703afc21bb91e9fa7dd23f6a5b926d5ff83000dad085c3dcc8e2ac",
		keys: 719,
	},
	"cs": {
		bytes: 48533,
		sha256: "eeb174263172063453b012b1f505dacf555371f81ff7cf01b1844fd082cd113a",
		keys: 719,
	},
	"da": {
		bytes: 46716,
		sha256: "ccafe9f4ade750adf55b97d49059c23cc2b002f5bd0e243a1ddfefe7defc0b14",
		keys: 719,
	},
	"de": {
		bytes: 50696,
		sha256: "1d81a4e045d8025420b4f2cfb1975a28f7f5f04ebe6304e2b517533bb5bbede9",
		keys: 719,
	},
	"el": {
		bytes: 71096,
		sha256: "b0dabad11b6ecb1d7df9bed3e5bf29071470d4bef139a247de5a4b61a68dd848",
		keys: 719,
	},
	"es": {
		bytes: 49623,
		sha256: "a8873791f31c06199949c0d361034ae97a8105c87d51e98d7026094b362d77f7",
		keys: 719,
	},
	"fa": {
		bytes: 63237,
		sha256: "823d86efe2e53bf66a11b79df10ef8d7da294c3783565d533d2f38750d0f3857",
		keys: 719,
	},
	"fi": {
		bytes: 48668,
		sha256: "7b089e78fb41593106a4a321157aad32a454ec0fa1651d68e56bc5c553a601c4",
		keys: 719,
	},
	"fr": {
		bytes: 51385,
		sha256: "b9b33c78cf4f805e9e04a069f639045c73bce929a0c69913e460d3cf182bdc31",
		keys: 719,
	},
	"he": {
		bytes: 59528,
		sha256: "5b34aeaeb250bd026e5a95045a3c4f8b57aa7f263ae9d2fdd5325a4bd6d1ac22",
		keys: 719,
	},
	"hi": {
		bytes: 78686,
		sha256: "8ab9a9e502a09f129c6e5f78bc999243fcce5a598c15e9061bcebb7f6856cc38",
		keys: 719,
	},
	"hu": {
		bytes: 51367,
		sha256: "377e5d32a9859a7d55c2e96e27909c96a1f772e0c26ae7bef1bc592b9cb805d9",
		keys: 719,
	},
	"id": {
		bytes: 47515,
		sha256: "c3ff1cdbd322486c50e998fbc4c040b3dcdda82dda84671d08bcce919e9a7ed4",
		keys: 719,
	},
	"it": {
		bytes: 49190,
		sha256: "e3695c0141de6b9df70923c9bc7b8d39fa3b1f80ebd558e4b89fb33e6d1c76da",
		keys: 719,
	},
	"ja": {
		bytes: 56921,
		sha256: "f28565c14a41a32272acff489b396c5577ae118089af17a62b1f2432fdf8101d",
		keys: 719,
	},
	"ko": {
		bytes: 52750,
		sha256: "1141bd4eb8c68094c5636aa6d17814b1e72f0c347d8e9ca106a54308acfcaa78",
		keys: 719,
	},
	"ms": {
		bytes: 47471,
		sha256: "10efd9f4e2dc6faa8f04d0c95b29267528d040f85a3c5b71d57fa5a1eb10d9f0",
		keys: 719,
	},
	"nb": {
		bytes: 46791,
		sha256: "b3d6ec031b035440bfcbf17311dfb51b9fdcf445b599cade66f62a35c88abdc7",
		keys: 719,
	},
	"nl": {
		bytes: 48830,
		sha256: "2e29313966b78a80b3c944d9ebd575ce20de6a39492642ae80d83fec1c858a6d",
		keys: 719,
	},
	"pl": {
		bytes: 48661,
		sha256: "697528053ea8f30afe5480f2e8b2b01c88984c672c13cb5d8294783159746aa5",
		keys: 719,
	},
	"pt": {
		bytes: 49390,
		sha256: "1bd01c12f134e11f3d9d793b9c97f1720b6d58a1eb0ee310053a39af0b96f69b",
		keys: 719,
	},
	"ro": {
		bytes: 50028,
		sha256: "f4480fbd5923117e46ea6bbd0ae1abe01b0ffb127a703be2f3100ba9226c8439",
		keys: 719,
	},
	"ru": {
		bytes: 67080,
		sha256: "4c608ce0c52daf41008215580d6a333e5d3144a291b758173ad671b2bc542f24",
		keys: 719,
	},
	"sv": {
		bytes: 47397,
		sha256: "062d7bc968f19d642ab6cf17d24c8060c69fcd5e9b5c4295ecf04377b43ce677",
		keys: 719,
	},
	"th": {
		bytes: 76709,
		sha256: "5f6b9f1fb80c4777d5befe88732010b51c36545eb9c055ea6398a4e7369246ea",
		keys: 719,
	},
	"tr": {
		bytes: 48866,
		sha256: "635669e64ea216f5c62cdd4db1894fb7b543810db52cfb28483f9bc6d811a97d",
		keys: 719,
	},
	"uk": {
		bytes: 65814,
		sha256: "973af1a83e856704994960d01d52f4c8c6b0c044fcebf55a3231768978b9acf9",
		keys: 719,
	},
	"vi": {
		bytes: 53710,
		sha256: "fb1b31df7604bf5e465a66705cf08e7145654785ce29dd7bc1ecbe5add59be04",
		keys: 719,
	},
	"zh": {
		bytes: 45220,
		sha256: "11ffc684e0ce2a1a8d06a74eeea7b0226d0c0fe7485da4c8ddd29bd164431208",
		keys: 719,
	},
	"zhTW": {
		bytes: 45388,
		sha256: "d1574c6554ae41be15848840862df26fc708002d4b98431ab0f5de791e1664ae",
		keys: 719,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
