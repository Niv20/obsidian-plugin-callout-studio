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
		bytes: 111731,
		sha256: "a4a28bff7ee6b8b1163bfa7e3e5bb75af003e972e54e59700ebd7a34214db08c",
		keys: 1205,
	},
	"bg": {
		bytes: 133649,
		sha256: "c1575125383b5d274fdd16bd458e1ece2a09fe5acc5af21b1eb28b7bf80becfc",
		keys: 1205,
	},
	"cs": {
		bytes: 91583,
		sha256: "9dc6a7dee82722d292a128048f6c5e877681ac730f520d4e1b009f5839837713",
		keys: 1205,
	},
	"da": {
		bytes: 88684,
		sha256: "600f95999cf10e192355e9166c5d6ea603e76c8999b0f2f167634bab8d9d2a44",
		keys: 1205,
	},
	"de": {
		bytes: 96959,
		sha256: "d527eff325e743c224b98b17adae42a3ade42d9104a8cdbde566f8f6c68461b4",
		keys: 1205,
	},
	"el": {
		bytes: 141577,
		sha256: "f32f0e5419ea6903a26a513760356493f44feeeef9abd255ee09992875454146",
		keys: 1205,
	},
	"es": {
		bytes: 93932,
		sha256: "bfd487030625598924357461af2c7dd72abd52917edc301bfbf5ca4ec385a06c",
		keys: 1205,
	},
	"fa": {
		bytes: 122153,
		sha256: "4269190ec7745203ece42230c7a4fc3d7bab8ee229244a91a67083d48796a075",
		keys: 1205,
	},
	"fi": {
		bytes: 91269,
		sha256: "da871d062d3f00bf494930dfdcc308925dc18bc2da6465b9b2541efe01a0d6d1",
		keys: 1205,
	},
	"fr": {
		bytes: 98424,
		sha256: "254eb4c9bc0ac664bd2ac1a311c046b392a168f1d4f751748afadc642b2fd99e",
		keys: 1205,
	},
	"he": {
		bytes: 110629,
		sha256: "84bea735cbc5a4800b54882376088324f97305687f9dd2bd27480facb3ffeb99",
		keys: 1205,
	},
	"hi": {
		bytes: 155233,
		sha256: "49352fd1b58d24625f7ff14f6252b8e0dab8ff4e102d0a823538f9e8bfd6c9ff",
		keys: 1205,
	},
	"hu": {
		bytes: 97656,
		sha256: "0885812f87cfc5d9c25fea01e0d51ebeb32345baa6294d355d49ae87d83085f9",
		keys: 1205,
	},
	"id": {
		bytes: 88510,
		sha256: "36202722469d5557b0d3072dc0b2d3c906cf076cc114dc274f668540c6847a98",
		keys: 1205,
	},
	"it": {
		bytes: 94325,
		sha256: "d01f029fdd319f13a9bd709e06b3d5e5489d953c099b7b85d752a014be32f22e",
		keys: 1205,
	},
	"ja": {
		bytes: 107490,
		sha256: "9e5730089fc1b7525df12ac7bf2cb05b3d2820199d60571d0e28e3cd6c491c91",
		keys: 1205,
	},
	"ko": {
		bytes: 98455,
		sha256: "3ca4ced3b84d1bc9979f339fc8a767fe462265c57ba393f892ce0f2e0730e716",
		keys: 1205,
	},
	"ms": {
		bytes: 88599,
		sha256: "72ee87886e2fa1fb6cabc63d49b051ed813b0f6e090409504948521f0bdb12f8",
		keys: 1205,
	},
	"nb": {
		bytes: 89232,
		sha256: "01367548bcba3efd6a5bd1d6776caa70a6b6b78fa8c3b890223976280d7bd635",
		keys: 1205,
	},
	"nl": {
		bytes: 92417,
		sha256: "80095ee2f92fa567c79eaaa23ad501390e1ec96251c194724d95eea92a8453b6",
		keys: 1205,
	},
	"pl": {
		bytes: 92573,
		sha256: "467a7f4d40a16032838871914692b1cf6a5b38a700ad072493c0245f3b08eba9",
		keys: 1205,
	},
	"pt": {
		bytes: 93801,
		sha256: "4e85491cb3a3c6f33997c1d47855c35e9b6a086ce9a84242a5000591a4898377",
		keys: 1205,
	},
	"ro": {
		bytes: 95536,
		sha256: "71cbfc78dbc53811414078bf36833c37f5235aa72a1921698ddbc5226b65c1f7",
		keys: 1205,
	},
	"ru": {
		bytes: 130804,
		sha256: "aad7d307a169b6d61db12d6cde77c1876076cc54e39308818dcfe5897a500162",
		keys: 1205,
	},
	"sv": {
		bytes: 90374,
		sha256: "5d2dbf871cb506eb103e67adb72526c39a80d31c4f339046b61ec90ca5239d96",
		keys: 1205,
	},
	"th": {
		bytes: 155126,
		sha256: "e348128ed91cfb36f0afba3364daf58ad11b3f36b2949272450507374ca265ba",
		keys: 1205,
	},
	"tr": {
		bytes: 92002,
		sha256: "d0a5907976676f6689bb53ea74f97c9f8b2aa5cdd252b9586fc06482f72e0c8e",
		keys: 1205,
	},
	"uk": {
		bytes: 128694,
		sha256: "a3eda7f7ac28f6958943a7f61f9471ee3bb70b93caedc8326df7e7bb9f680dac",
		keys: 1205,
	},
	"vi": {
		bytes: 102951,
		sha256: "84da1c6deed302e0176ade581cbd1227cddfcba0cf5efc415ed03cf84702b7eb",
		keys: 1205,
	},
	"zh": {
		bytes: 83185,
		sha256: "817f75ca8669870255844bd57f8ec73b1ee86cc27048de5341338357482837ce",
		keys: 1205,
	},
	"zhTW": {
		bytes: 83482,
		sha256: "defc3509bf737978a534c0fae121b14b2dc49771b26a2de53327a722442b85f2",
		keys: 1205,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
