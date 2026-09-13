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
		bytes: 68119,
		sha256: "9c17a395a1a2b8b1efc15e1d32c4c24ccc8dbb03f993a91973c3476dda60bb20",
		keys: 762,
	},
	"bg": {
		bytes: 80224,
		sha256: "6b58f751c5a2cab41a6f71e801ccece115bfb43744be899e97b4cd561a847f94",
		keys: 762,
	},
	"cs": {
		bytes: 56232,
		sha256: "b153847f797725537541934bb14b15c75cffb2c3baddb62b9f9d5656be537295",
		keys: 762,
	},
	"da": {
		bytes: 53891,
		sha256: "de0fa017951dd2e762deab006aa4ee81fdf63a2204319de9af067ac0bb9360d0",
		keys: 762,
	},
	"de": {
		bytes: 59063,
		sha256: "9d3848690b929bf9702d95b6560180594e43eede62a7c6387726faa436baddeb",
		keys: 762,
	},
	"el": {
		bytes: 84179,
		sha256: "1d37b29f41c14a971ef80715583e34e179e3845b702d586026f2bb075a61cc49",
		keys: 762,
	},
	"es": {
		bytes: 57404,
		sha256: "9d1e1c3b3dbba4a81be82a313cd15cea9f6cda0b4ef48ca247692959f29f133a",
		keys: 762,
	},
	"fa": {
		bytes: 73910,
		sha256: "66c7f52bba609c2131d55e6e464e8b03d5ab40443d04cddc5a8a2e435841a578",
		keys: 762,
	},
	"fi": {
		bytes: 55927,
		sha256: "2542dea2c983df8f8db35c549f9468c0126b422d02e7128fc9bc432b95b80c1b",
		keys: 762,
	},
	"fr": {
		bytes: 59656,
		sha256: "47e8f28b3d6ee654b0d6055dce2120828b1bc0af46e6255119adcb95d4405721",
		keys: 762,
	},
	"he": {
		bytes: 68573,
		sha256: "1e5bb36f7baf4aec79487761a9abfcfa41fa401ac9dbf7ef0a502be1deffd1b4",
		keys: 762,
	},
	"hi": {
		bytes: 92563,
		sha256: "08f0e7917b0779f030b85d55a6aff93b0b795e21c2793d572bfa92120c9eaaf0",
		keys: 762,
	},
	"hu": {
		bytes: 59521,
		sha256: "eca133279f6ee89ba7f5df1840b0f88d75ddffedabd5b7df12ed1db46a56bbd9",
		keys: 762,
	},
	"id": {
		bytes: 54555,
		sha256: "fd0914bffb8834952665a547e1789b9b4eef441a0090d05ffc3e3a0fbc93b506",
		keys: 762,
	},
	"it": {
		bytes: 57156,
		sha256: "39e5a0e070fdb8db416ed400f22cb49f06fd9cbf93be5593d4d7b445dbbf7700",
		keys: 762,
	},
	"ja": {
		bytes: 66049,
		sha256: "8cfc9c6b9288df04f019352ad4b741f09e8b9ccb013e597ac6394583873a1348",
		keys: 762,
	},
	"ko": {
		bytes: 60726,
		sha256: "017b94c8d6b234d5e314c68a4e8346442b751ad5fef20e4dba4e6b21bf6b1eac",
		keys: 762,
	},
	"ms": {
		bytes: 54424,
		sha256: "8c0e90849508dbe25a0783e70a188793f0512e6064cb7b949dbeb1ad75135d97",
		keys: 762,
	},
	"nb": {
		bytes: 54055,
		sha256: "b7eff88c0304859878d716602539b88e39084dd8d555edca4d9f7381e95fddc1",
		keys: 762,
	},
	"nl": {
		bytes: 56440,
		sha256: "d74d7f1bae99f36ea0e49877e2297e18af4a79b1b0d2fbe09d04a6bd50630263",
		keys: 762,
	},
	"pl": {
		bytes: 56472,
		sha256: "0fae68d9020283e23466c66b69da9fc6f9150e033e6c5ef01f63c013589e4493",
		keys: 762,
	},
	"pt": {
		bytes: 57401,
		sha256: "738812d9df080231901c8df9bcb5a4fd5fd0a9a9835576aec216b71bd7927e06",
		keys: 762,
	},
	"ro": {
		bytes: 57865,
		sha256: "024868f5e437d3d895360be3a939bac011253654b4b8b44b616314947d04754d",
		keys: 762,
	},
	"ru": {
		bytes: 78740,
		sha256: "3b8c26533bb4a9f3d71b4b7b298a262d4a2440e402fb996888c3d4acec74772b",
		keys: 762,
	},
	"sv": {
		bytes: 55004,
		sha256: "b9fbc87ec251c1864f2b886203f8b29e2e8dcbb0603cb87f1fcd570f4c6b9225",
		keys: 762,
	},
	"th": {
		bytes: 91602,
		sha256: "6b6a5767728a78a9e0781ebd436093d4ee1d3b886e2e6e35ca06adf26691eb91",
		keys: 762,
	},
	"tr": {
		bytes: 56326,
		sha256: "66795d3ad4d64f645326dbaa51ef771f4882bfd11bffd223eec475d2847bf016",
		keys: 762,
	},
	"uk": {
		bytes: 77062,
		sha256: "3cdbeae58f5c411d9ebb48664d874b28b13af7714cdcbd0ebcd6e36a8d7005ef",
		keys: 762,
	},
	"vi": {
		bytes: 62321,
		sha256: "ddbb3b49f277be2b16e1a3a6170022820a2e4a0ace419c253b45425acef0cd9d",
		keys: 762,
	},
	"zh": {
		bytes: 51547,
		sha256: "e9df7f4e24c423bdc10c2f48ee4c2056103c2d8db86c802702fb14913d82c0a2",
		keys: 762,
	},
	"zhTW": {
		bytes: 51694,
		sha256: "19e9f73ec04f6c7b50c814d125c1dbd957e4e9fb1a002583dc924d719f1c3fee",
		keys: 762,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
