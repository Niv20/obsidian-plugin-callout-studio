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
		bytes: 68196,
		sha256: "c1e0f5be47a0dac2c18bfc5fee629af1bb692982669305a326489e0c7d51e537",
		keys: 761,
	},
	"bg": {
		bytes: 80247,
		sha256: "06c4965260b0e21571dc964d4f9fb567529b6a06fb78123cabf8feec8ac16339",
		keys: 761,
	},
	"cs": {
		bytes: 56378,
		sha256: "d336876e0249b11539ce50344b961353c3fb598eb32da4f76f6f28ec3ba2b0c0",
		keys: 761,
	},
	"da": {
		bytes: 54079,
		sha256: "40f22fc83c7938b7a929efc3e23dc2eb4ada18072d3f1725d46d22bfd7f7345c",
		keys: 761,
	},
	"de": {
		bytes: 59253,
		sha256: "12f31030dbfdf892ed723d9869bfe6845c871fbbec5b5ecdf525c1f84be24fba",
		keys: 761,
	},
	"el": {
		bytes: 84171,
		sha256: "660bab928a6ae05721ff3fb6cb126819adedb24e0078b3a111e0f1f9a4d5d163",
		keys: 761,
	},
	"es": {
		bytes: 57562,
		sha256: "eef1cff5cefb2976707e5d196cc7985521bcae4924d70dad9726e76840b715aa",
		keys: 761,
	},
	"fa": {
		bytes: 74064,
		sha256: "01f5dc084b0dd3af0c492285246177ca22b7f9b115f782d2dc9e386e35242058",
		keys: 761,
	},
	"fi": {
		bytes: 56129,
		sha256: "cdf701d040611f1d1c00f0af46e58fe3f72bf2c44a4c151a6d48bdee211b8579",
		keys: 761,
	},
	"fr": {
		bytes: 59831,
		sha256: "1db5d38ba4e34c53ee1866f1c7ae9d91fafa52a44907665607a6773f18b2cf23",
		keys: 761,
	},
	"he": {
		bytes: 68969,
		sha256: "af29b4109367d70be029c6ab320e04666f09b60552b41dc3c623b9d07115d1d7",
		keys: 761,
	},
	"hi": {
		bytes: 92619,
		sha256: "6f6338f3a659c877d9fa7f73fc5a7752e79c1ab926edaccb9e6745f91d93e245",
		keys: 761,
	},
	"hu": {
		bytes: 59638,
		sha256: "ab71edf3e8ef02a91d9dfb018db6782386545b66d5b2bbc71080a814285e746d",
		keys: 761,
	},
	"id": {
		bytes: 54781,
		sha256: "a95f9b0694da7a4cb7f5866182934b00bfa7b734a087dd1c1997c5bff72d30bb",
		keys: 761,
	},
	"it": {
		bytes: 57309,
		sha256: "de0f7ec69efa6b2c987fdbe72ded743de26cbd14c7b0f24e1a40559e0bfcaa35",
		keys: 761,
	},
	"ja": {
		bytes: 66211,
		sha256: "35a08779353eff97d10d5372bb9910e574526ee7f158d3559ef16e5bdb2f3eb1",
		keys: 761,
	},
	"ko": {
		bytes: 60908,
		sha256: "1fb3594c7f85807aca2aacafc92c1e37c28a96f8161119fec1867f3a9a315546",
		keys: 761,
	},
	"ms": {
		bytes: 54652,
		sha256: "4efcd2243060a1fe94209a37158f825a2e5c725e95b2d42dd13be14d62f76eb9",
		keys: 761,
	},
	"nb": {
		bytes: 54238,
		sha256: "461712ce6ed6e3e5aa87e33d0e4e36fe69d92b28f148be10904db4f117045239",
		keys: 761,
	},
	"nl": {
		bytes: 56649,
		sha256: "ce93a92366a1d527f1ae16ec586a42bce8895b8a4eabfa5758f81f1c7a65e87a",
		keys: 761,
	},
	"pl": {
		bytes: 56645,
		sha256: "c9bcf23e400e40f606acdfa2c09ff7b4da75e1e1981ef9c912ce8f511b8b1f18",
		keys: 761,
	},
	"pt": {
		bytes: 57523,
		sha256: "546c9e60bc3d02f17312e8950e0ba58a1a19f1d29bed775ce1376f4457e37468",
		keys: 761,
	},
	"ro": {
		bytes: 58057,
		sha256: "ece14416bc34c223c50b27790c6a054eb43a4f975684a0e9392f0a36ad3d3853",
		keys: 761,
	},
	"ru": {
		bytes: 78907,
		sha256: "7f71b67551f01427a1f1b8f28d1a991ca471e02cfd102f0cddb30a547ddc00b0",
		keys: 761,
	},
	"sv": {
		bytes: 55163,
		sha256: "fca76e3c3282f2c464886d37653d134aa94fa854360534994dbe39c547adccc1",
		keys: 761,
	},
	"th": {
		bytes: 91583,
		sha256: "933ef8dca0c386187fe282a35ed4f12925f446403c8557de0b09cd1408b82470",
		keys: 761,
	},
	"tr": {
		bytes: 56518,
		sha256: "0b1f86e47cd346e54df56b9981e666cbe777a57d63dc863e1c2b2004005f5afd",
		keys: 761,
	},
	"uk": {
		bytes: 77239,
		sha256: "fe3d1356da3ba70a1639b11c683cc7282e291f7d7e96e801629e226a5e6fd216",
		keys: 761,
	},
	"vi": {
		bytes: 62421,
		sha256: "06196e14d1b59a3ce3c9bdc310e6083af5e0552299901a5e843226d976acbcdb",
		keys: 761,
	},
	"zh": {
		bytes: 51801,
		sha256: "2c1874ef06ce319fb6a91b2a313de7d5e014bdb21cd978473beaa0cf03d3efd0",
		keys: 761,
	},
	"zhTW": {
		bytes: 51941,
		sha256: "6344adaf556058a39ecd03fbb08632ae32b485cb81203f7780b6fab59f09ac70",
		keys: 761,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
