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
		bytes: 67858,
		sha256: "2ff2a7173887b1ca9598d0cbd7f3b4faa6f42ba5701990a87548edd1bb56569d",
		keys: 757,
	},
	"bg": {
		bytes: 79806,
		sha256: "9647327df4182f94f42af067c9cca021edc91d415c5eebb3aa7b2aa2a042cda3",
		keys: 757,
	},
	"cs": {
		bytes: 56101,
		sha256: "1b4649382331499789c84ff83eb510e5ddc6962f7b253f2d418b8220f9925c0e",
		keys: 757,
	},
	"da": {
		bytes: 53772,
		sha256: "90f080c009a6888f5d804e31382f5eda4437133a9c8468d1d6656586c04b9873",
		keys: 757,
	},
	"de": {
		bytes: 58912,
		sha256: "c20118831f4f483764a4fe4cf00d7d0872b0f41a5b08f169b4d80a01a4751681",
		keys: 757,
	},
	"el": {
		bytes: 83725,
		sha256: "bfbf794199d5a02bcc05faba24fa85ce991be4d3b400f2a43598218172714ea4",
		keys: 757,
	},
	"es": {
		bytes: 57285,
		sha256: "9fa5b3dd19825b60b8f5ea92d7fd0fa65dcfdec2be994dc3fed50dc02f860d3c",
		keys: 757,
	},
	"fa": {
		bytes: 73725,
		sha256: "52a02b0d9b384b4bdb8f7c071bac44a023292f1fd42d2219b5094c0d76b810ae",
		keys: 757,
	},
	"fi": {
		bytes: 55869,
		sha256: "dafd1a5287a233a48f3db2f92558cb27805fc000f0b8e643ce3d84f115660989",
		keys: 757,
	},
	"fr": {
		bytes: 59510,
		sha256: "32dd5536ea0f931b4abbaee54e521ca4eaa321d51a729205468bf3e980de4ced",
		keys: 757,
	},
	"he": {
		bytes: 68641,
		sha256: "7861b2f564df000307790686f7ac750b23cc0cefd568ed575809debd6e5045c8",
		keys: 757,
	},
	"hi": {
		bytes: 92146,
		sha256: "0db1505b1abfbc73e65ff42686327be7b174ceb8f07129f8305da690895a9445",
		keys: 757,
	},
	"hu": {
		bytes: 59316,
		sha256: "4e7fd88c3727a5eee2aee66c4419233559e8f7e339d243d1c6c9414de5d8d895",
		keys: 757,
	},
	"id": {
		bytes: 54509,
		sha256: "b150596a379d76d8d451e0bbcdc35c940e25bcc190dbdc659cbb17295de4a78d",
		keys: 757,
	},
	"it": {
		bytes: 56979,
		sha256: "8ef1be2378828de4977a6ba4906394488bddcd2d8e66330fd5406c249d030ea4",
		keys: 757,
	},
	"ja": {
		bytes: 65886,
		sha256: "c5621de8e17ac4c55b3944ba559ee2b042eeb1b15ef7c69c6ed29b982a713427",
		keys: 757,
	},
	"ko": {
		bytes: 60590,
		sha256: "210ab75c9083a4260f9c43f606f07beb554f751349dd05a33a79897669654722",
		keys: 757,
	},
	"ms": {
		bytes: 54399,
		sha256: "396d640919ae0faee100b3f075c31d1b08dd359126ac5f181e4ca1a2bdf5e695",
		keys: 757,
	},
	"nb": {
		bytes: 53940,
		sha256: "fbc0ee4b5c0e1f475817a609766843653a0adeebeca50594d908e9e2b735b171",
		keys: 757,
	},
	"nl": {
		bytes: 56336,
		sha256: "c5fe3bdf2929ea91794f950b78a2178553940a0d6349ba502f3612b358528386",
		keys: 757,
	},
	"pl": {
		bytes: 56351,
		sha256: "2adf15386bb876e412da17fd3c32ab7894f8b62f5762b7d672c3ca487eccd42f",
		keys: 757,
	},
	"pt": {
		bytes: 57205,
		sha256: "f6fdda0c5e57a893cf5e749bd11f6585d676b1cb6b10573eb82daff96c85ff4b",
		keys: 757,
	},
	"ro": {
		bytes: 57769,
		sha256: "5591d250d844e365bd5c885de57cb12613b75b9b85e4c23de7afbba0168979e7",
		keys: 757,
	},
	"ru": {
		bytes: 78521,
		sha256: "63919554e2fc73d6f8a0f5e7e7e74cdb2eb5ae3fe59c362462f1567641765e7b",
		keys: 757,
	},
	"sv": {
		bytes: 54861,
		sha256: "66c259c79b1c3262a7bf3208f4f3d51e0fd261261d25bf42e7608631f624793f",
		keys: 757,
	},
	"th": {
		bytes: 91082,
		sha256: "4707b21563bd303804fcfe5aa8409a22ffcf8acbad18cb2e2cbb13697d29d86f",
		keys: 757,
	},
	"tr": {
		bytes: 56225,
		sha256: "506e3f3a2b0079503e1113e1009a106b0c375652a3bf39d66aaf68adffa3ec5f",
		keys: 757,
	},
	"uk": {
		bytes: 76831,
		sha256: "1b6424bac904f4ad86c507a5071ccaa839862829a828e653014fb469a32ee2cd",
		keys: 757,
	},
	"vi": {
		bytes: 62104,
		sha256: "1cfdf8dd80b4f4995ca0a7cc6ea5f785427db131c0738fed556126f2cf6ed976",
		keys: 757,
	},
	"zh": {
		bytes: 51550,
		sha256: "ee565e979c6ceff8958054c9d055752f467403583d72bf31a54a508fb2d1c168",
		keys: 757,
	},
	"zhTW": {
		bytes: 51690,
		sha256: "0dd8f5c0f85f95ddc44d28a53af6240c90790939758c3c874f50a701f58c14d1",
		keys: 757,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
