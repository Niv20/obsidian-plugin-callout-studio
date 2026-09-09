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
		bytes: 67816,
		sha256: "7fae5caa332b0b3b4ecb1cf4d2cbbd1481a648c35febee35ac94a6e130a6e688",
		keys: 757,
	},
	"bg": {
		bytes: 79754,
		sha256: "fee2f0b6c2146934f0a990a762d4ce1a5aef9a834551e3639294c7792c433d05",
		keys: 757,
	},
	"cs": {
		bytes: 56068,
		sha256: "8bfea3fa14d3fc5a4de938fa7933b65d2a963feeb44db6bd23a35046998f522d",
		keys: 757,
	},
	"da": {
		bytes: 53747,
		sha256: "058faba48fe5ae571e7382f747e539ab815696bc0a5c840d72807b931c65d634",
		keys: 757,
	},
	"de": {
		bytes: 58883,
		sha256: "20b9fff35f7f0fcc8c7996a213f5088558ece094ca3ec3525e45408b5770c6b2",
		keys: 757,
	},
	"el": {
		bytes: 83680,
		sha256: "02bb4a59eeae7a722e1d380fcb01385ca27c4e549cb239c4f51f14de1528f631",
		keys: 757,
	},
	"es": {
		bytes: 57260,
		sha256: "f0a56523276805fbde667022a4c475e79971924c2fa47a3e37d247eacdef1a53",
		keys: 757,
	},
	"fa": {
		bytes: 73679,
		sha256: "bc80597a6328e1aab8bee4bbbd7812e6d9358baa56b1461a244583f3f12eb125",
		keys: 757,
	},
	"fi": {
		bytes: 55840,
		sha256: "01fea5821b9b021278e6b28b454d92541d772216f6d3c01ad7e9b1797d610424",
		keys: 757,
	},
	"fr": {
		bytes: 59484,
		sha256: "9ce3fca08fcdac1d32a74983f4e5ad42d0623003ce08865f0b5b2eabd54d10a4",
		keys: 757,
	},
	"he": {
		bytes: 68608,
		sha256: "80a566995c425b542c28ad183d915b2cc15f650befa8515b43ff9d1d4462a166",
		keys: 757,
	},
	"hi": {
		bytes: 92086,
		sha256: "4200a70f8c0fe064ed867cbee78149706b3c5212384119db3268e717745f4b5a",
		keys: 757,
	},
	"hu": {
		bytes: 59283,
		sha256: "e9328f785561beb9aded7773e70198a10706653fd8877ff1c518ad91e60f77b2",
		keys: 757,
	},
	"id": {
		bytes: 54483,
		sha256: "b84898ac46f85243247713dc9218b927348af256e746824367649462c67ed19a",
		keys: 757,
	},
	"it": {
		bytes: 56953,
		sha256: "88dad7ad9685ebd8cbce85e838c026b0d442533a94685df05c8582662714df9e",
		keys: 757,
	},
	"ja": {
		bytes: 65853,
		sha256: "ab12d8f41b917e8f62a25ef861e07c7c4bcd651257bc6c5505680ef041c32a3a",
		keys: 757,
	},
	"ko": {
		bytes: 60563,
		sha256: "62539fb9f1359d0b2b85a53782d9c0edafb9c647d51807b824457777d5cfc762",
		keys: 757,
	},
	"ms": {
		bytes: 54370,
		sha256: "d4eabd9efd5f5f0de142c7bda73434cc2dd94b93696792dc5c047bceddba1458",
		keys: 757,
	},
	"nb": {
		bytes: 53915,
		sha256: "c01d1fd9f97332db75e7f3fe84ba397837403068f08fdca1e04ae613f9c8bf0c",
		keys: 757,
	},
	"nl": {
		bytes: 56309,
		sha256: "ac04c4491c4c5c916c27bedb5b6ada25d9f9c4f641a63379e902d8930cffa51c",
		keys: 757,
	},
	"pl": {
		bytes: 56321,
		sha256: "fd20d73d079e4a529055bf6e257418cec692691998b58877f4517c245be4f2d4",
		keys: 757,
	},
	"pt": {
		bytes: 57180,
		sha256: "0068e0b36b3675f06ff3c1dbd16bfdfc3879c09407dacb2d93ffb5dc316c07e4",
		keys: 757,
	},
	"ro": {
		bytes: 57742,
		sha256: "588c8d55d8645c05ba4a14233fea114b9316bae441885df484fe932c151d32a5",
		keys: 757,
	},
	"ru": {
		bytes: 78468,
		sha256: "54312f201a0e88b9a2b3a5a192ae7129d1d770c3fe28054cc81ba5c4b8ef230c",
		keys: 757,
	},
	"sv": {
		bytes: 54834,
		sha256: "21bf62c82be4713ede6cde10d30f775aaeda9f03dd58e077af3465ec7c1c6a66",
		keys: 757,
	},
	"th": {
		bytes: 91031,
		sha256: "2b5aa30c3258f1d894a59af8f9b80f636b8a59f443b29b5b8942b6357f98e5a6",
		keys: 757,
	},
	"tr": {
		bytes: 56203,
		sha256: "2765816f527ee33baba49a3bee5c12fdb086275f477b374979b7c8ac5c90938a",
		keys: 757,
	},
	"uk": {
		bytes: 76786,
		sha256: "b334f99c466ad12fcf2b4a1585392598b1886b8c9682cf6b350d23b21968d1bc",
		keys: 757,
	},
	"vi": {
		bytes: 62084,
		sha256: "f4c4e415aa814546c99a724752012575ca352535400f9ca207f59ae1854d06af",
		keys: 757,
	},
	"zh": {
		bytes: 51531,
		sha256: "e731788fc9697f0936856b0c6089670f69e243701b2f00c013f4ac7bed30ce39",
		keys: 757,
	},
	"zhTW": {
		bytes: 51671,
		sha256: "959969bd5702a53ecd9a349eea389cd7696ca8667e0b35915dfcaf257ed64c98",
		keys: 757,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
