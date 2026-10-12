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
		bytes: 111848,
		sha256: "2ca5c236828c78691fd5c392643cc51ec73fff98fa82ff5886b482a1d1d7d0a2",
		keys: 1206,
	},
	"bg": {
		bytes: 133772,
		sha256: "322753b3978dda5c01463e967196d857cfa06346e273cbcb0f159d1c8a77e2c9",
		keys: 1206,
	},
	"cs": {
		bytes: 91674,
		sha256: "dfa6481131d5bcc5af55850a355857528c01b5242b609cc764fab6d820dc7798",
		keys: 1206,
	},
	"da": {
		bytes: 88764,
		sha256: "c54be541973867b1504f392a5552aa72a10f7cf1ca53f2abeb4be34c9262ebdf",
		keys: 1206,
	},
	"de": {
		bytes: 97050,
		sha256: "abf9f5a8008493ef5785ea0068d946ba11fe7317eb806fb8c09ec837b2148e76",
		keys: 1206,
	},
	"el": {
		bytes: 141720,
		sha256: "da2b022b80adaf2bb54e2c4f7abea12f1f215bea9741f171511f831ffc443fba",
		keys: 1206,
	},
	"es": {
		bytes: 94024,
		sha256: "faff9b3a49ad7e07d4ef433c5bd4e3f08ddcd07df5f0601f7b4921b08bd0aaf1",
		keys: 1206,
	},
	"fa": {
		bytes: 122282,
		sha256: "0f17a0ec7f10c77fd55e2931b3de48b56c17711ca984a5836197e5027b24c93d",
		keys: 1206,
	},
	"fi": {
		bytes: 91350,
		sha256: "8c281a6ec46726e82e14c1f61a4c40410f1555ef489807ab7f78aa9bd40d13f7",
		keys: 1206,
	},
	"fr": {
		bytes: 98523,
		sha256: "783bef8f33495174899b75ca50409e788036d005b7ba2778e75d3294d52c5feb",
		keys: 1206,
	},
	"he": {
		bytes: 110735,
		sha256: "dd7b914f68f4b2ed22973b4c7091126c57ad91025e681d543dcc482d9d956aea",
		keys: 1206,
	},
	"hi": {
		bytes: 155390,
		sha256: "0536e4531cc8fbd525dd75a0a54e07d51bd9105e54f0a68a07ca65f472d66c7c",
		keys: 1206,
	},
	"hu": {
		bytes: 97764,
		sha256: "4cb5dab1c8206b71e62b8e04f68ebabefa64490e22b99680d21620affb81ab66",
		keys: 1206,
	},
	"id": {
		bytes: 88595,
		sha256: "db12280ab73a715f83b13c16f26e5b470c6f847fb8f237bb64f39d3aec00f837",
		keys: 1206,
	},
	"it": {
		bytes: 94412,
		sha256: "faa0301ca7fc37e5f57a8ca582c37421fa6eeb98060f1b2130f61639e2b972d7",
		keys: 1206,
	},
	"ja": {
		bytes: 107633,
		sha256: "7ec7359776415c385cdff8a94c76412cd824921bbc501ff9a603a55f7ac83cb0",
		keys: 1206,
	},
	"ko": {
		bytes: 98559,
		sha256: "0847ca4c1cbac2c0966ea65b7aaf7ec6b8d59b97d82b5a6b33b6c32b5db94316",
		keys: 1206,
	},
	"ms": {
		bytes: 88682,
		sha256: "da856dd8319564ff3d048dc553b5daf05b0df289545bc9b739d0951ba1087d3f",
		keys: 1206,
	},
	"nb": {
		bytes: 89310,
		sha256: "ceb4d0f26f12c0d669723cdd94bb5ff74d0d5176e5eff619f43be965d1a8e08d",
		keys: 1206,
	},
	"nl": {
		bytes: 92503,
		sha256: "aa59a672dfdbdc0ff9dfef88860780fa8e796b97888fe4e5b252d4b8948e42c1",
		keys: 1206,
	},
	"pl": {
		bytes: 92663,
		sha256: "d896d89cb1be0580f2ee3c6667f241ec5a7822468d86d85cdc980cc48c97b70c",
		keys: 1206,
	},
	"pt": {
		bytes: 93886,
		sha256: "afc9b418b2c0dd00875eccf680556df68d32d13d326ce7c931d667cf9e8ee6c4",
		keys: 1206,
	},
	"ro": {
		bytes: 95628,
		sha256: "deb526a45a9aeb693014c2d73e9ab46e65f423083da72ee6ce5f4f0f72a94e71",
		keys: 1206,
	},
	"ru": {
		bytes: 130938,
		sha256: "75504e6f63b0504b3568f84f683aaed5a8bf00aad9e4dffbc55e6d37f886e5fb",
		keys: 1206,
	},
	"sv": {
		bytes: 90455,
		sha256: "7877e1765aa19646075e63a2ea36583b31684f96dfa264e73353947cf7b9bc21",
		keys: 1206,
	},
	"th": {
		bytes: 155247,
		sha256: "5574a75598b100e757b37be82808c4bd0277bf7a96bf46b2fa02496f45d55801",
		keys: 1206,
	},
	"tr": {
		bytes: 92101,
		sha256: "c1d277612abdcee316c2588465b655286037767787b933e9d32632b778fbe439",
		keys: 1206,
	},
	"uk": {
		bytes: 128838,
		sha256: "1d910b1c3bc9b8337e27a94ee04b75c1a6041af9e061852252e6580b77f909b1",
		keys: 1206,
	},
	"vi": {
		bytes: 103043,
		sha256: "93b510ed481115ecbe7ada6173cd9778e6ea0ceaec92ae62b0d9f0265dbc5504",
		keys: 1206,
	},
	"zh": {
		bytes: 83265,
		sha256: "3d417f096d283faa671e975bdf0c460548c81dac4534f26430239b630fc1c828",
		keys: 1206,
	},
	"zhTW": {
		bytes: 83562,
		sha256: "2d2402b3ae2aa35a3a2cd9339e8d0948fb333802fbb61151c268e62fd02043af",
		keys: 1206,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
