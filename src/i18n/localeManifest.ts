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
		bytes: 58959,
		sha256: "4bf21e835cd6403efb532107bfd49973265adc851190fd5690ed1d1f3dc632e3",
		keys: 717,
	},
	"bg": {
		bytes: 68028,
		sha256: "ceb6964ce6e832a3d0929d9715237a67188548e1a6b872953d9300235e42ad33",
		keys: 717,
	},
	"cs": {
		bytes: 48508,
		sha256: "8c7f5ef0dd23776fe54c96a569cc044b7d816d9fd47d89945eddcb8e2d45bdfe",
		keys: 717,
	},
	"da": {
		bytes: 46744,
		sha256: "8373b9f047039844a61922ce63567a54661a0bc64c93170e2c30ea952ca227de",
		keys: 717,
	},
	"de": {
		bytes: 50727,
		sha256: "15f457df0df3931cf2a667dd4c73e14a777f5d1918a8af5515ecf2fbba11bb84",
		keys: 717,
	},
	"el": {
		bytes: 71198,
		sha256: "82741b4526d3362455ddaa971fa8babecc672468ec9f8fa643a25e3afd505e2b",
		keys: 717,
	},
	"es": {
		bytes: 49650,
		sha256: "6fcaedbed12e176406aa3c961f2d3296e5e27de885df6a3b8224cf610c236485",
		keys: 717,
	},
	"fa": {
		bytes: 63367,
		sha256: "7a7be0be85e2a5a1106ffbd86b231d63870381b72612d354a0d5edfc574d8c0d",
		keys: 717,
	},
	"fi": {
		bytes: 48690,
		sha256: "d51fdbebfc03ed52ce6ec410adb36b71f2df2210a2e5b25aae2a75556af2206e",
		keys: 717,
	},
	"fr": {
		bytes: 51424,
		sha256: "8f01018ced3e9b77e4ef5da53b3843f72f70b83f6646c20b6dc021c2e2968b52",
		keys: 717,
	},
	"he": {
		bytes: 59492,
		sha256: "93761c2a9e5fb7201487a0609d2c5fdce011a1477a3a53ea8bccc1b53069f4f1",
		keys: 717,
	},
	"hi": {
		bytes: 78863,
		sha256: "1da28d4db1cc9f1b41c2e4c69bd3ad11bc31cb863f6ec9a42347b26cd15f623b",
		keys: 717,
	},
	"hu": {
		bytes: 51376,
		sha256: "d1e6d267c642bdb3d680889c305d13fd6a5cfc404758f8c63bc845fc33eb9341",
		keys: 717,
	},
	"id": {
		bytes: 47575,
		sha256: "45fc872eee326d807102ac45b5c927a8bd70243fe304e9245ad357e3297df44e",
		keys: 717,
	},
	"it": {
		bytes: 49220,
		sha256: "ba20601767de0fed721747019472538d780fb08aa2076b61d5e7767129f59b42",
		keys: 717,
	},
	"ja": {
		bytes: 56945,
		sha256: "fff922c902b4f17090c5a6bdf62723f583b94c1481bd2fb7a5795b90dc8529e0",
		keys: 717,
	},
	"ko": {
		bytes: 52722,
		sha256: "8a0a75d8e2f4ac0245873565563db95c9566a8262707b97f6513e9c63407c0dd",
		keys: 717,
	},
	"ms": {
		bytes: 47491,
		sha256: "0941c93975e7bf76ccf62c95195ddb973c4db7c1ab9b7743c1d1e7ea6d25ce1b",
		keys: 717,
	},
	"nb": {
		bytes: 46799,
		sha256: "19317c41d67ca4c123f5fb52a4a77335fb1fae74301d0b2b932a149e5a0c6254",
		keys: 717,
	},
	"nl": {
		bytes: 48882,
		sha256: "b990cc23b9bccb338d65b00c6693ce430f796d3d46cecb24cce10545afba6200",
		keys: 717,
	},
	"pl": {
		bytes: 48673,
		sha256: "0884491a2f59b3e606ac4c211cc8eb6fedd2db3a5dc1446271e224a78d32e3bb",
		keys: 717,
	},
	"pt": {
		bytes: 49439,
		sha256: "a72aaf179e40cf85b0288fcce15eeab97ce5b233d701fb50c6a1ebfb3b84f658",
		keys: 717,
	},
	"ro": {
		bytes: 50001,
		sha256: "4f7acb4d8f474366bcaa46cffa2e11c9b5b013e9e56bf795d38c94d016a01442",
		keys: 717,
	},
	"ru": {
		bytes: 67160,
		sha256: "4313188d54ffd8c4b18049c6e77bc826bc52cfbbb3aa6b3220bd375602c3ffd8",
		keys: 717,
	},
	"sv": {
		bytes: 47395,
		sha256: "b66f59414c581d8a57ccb5499c8a147ae4e895d2a794e69bdd4a5a9f2484d711",
		keys: 717,
	},
	"th": {
		bytes: 76854,
		sha256: "92977b0e7efda3cae31e9fabff1d462646b7a4e2a9b63d9288f71ba49f0a2e5e",
		keys: 717,
	},
	"tr": {
		bytes: 48915,
		sha256: "2b66371fcca26403d04499d6af8e68720651d9bd4b448b865873409a69a0336f",
		keys: 717,
	},
	"uk": {
		bytes: 65881,
		sha256: "4488cd9404246a0408ec7b6b6d2b8f360730f1620b8253469fb16114b8f8cee0",
		keys: 717,
	},
	"vi": {
		bytes: 53786,
		sha256: "5858f014013ecd1061365d4f670b11c4daf8d4d3fc5e4b711f1057f91efa8a84",
		keys: 717,
	},
	"zh": {
		bytes: 45267,
		sha256: "eb3acc02b2ae648ca92908e0408c67b2ef69e0cb5092b083838f47eba9b19188",
		keys: 717,
	},
	"zhTW": {
		bytes: 45424,
		sha256: "a5278ae7d7c8d45367821331f579a9aa1dddffaba8b7634245dcb69c6ed20ca9",
		keys: 717,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
