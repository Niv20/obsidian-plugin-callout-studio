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
		bytes: 125319,
		sha256: "9382bcb5c67cbcce8f462bfa01b453c87806d4f71dddd92a7110317bc7e4c886",
		keys: 1366,
	},
	"bg": {
		bytes: 149278,
		sha256: "006c0223f3409d8bf4b7d9e8bb7f9e8e53df1ecd48a36710f5a638156192d122",
		keys: 1366,
	},
	"cs": {
		bytes: 102965,
		sha256: "c4ff5bde583444af2ff6bd6b2b5a3a4d69d4c742ce24e11311ebf387fc17f98e",
		keys: 1366,
	},
	"da": {
		bytes: 99540,
		sha256: "aa632e95a7bbc7fe9d6620f05d096fb2ea6ceeb5b7114d8cf5360bd627d7d574",
		keys: 1366,
	},
	"de": {
		bytes: 109003,
		sha256: "ecc26e7eb4fa644efc8f243e9ab948aeda2f72e64ba10f04f7192c203ffa9842",
		keys: 1366,
	},
	"el": {
		bytes: 158781,
		sha256: "83fbb220337317ebd5d4d24748ffa466918787dd52cbfcae4300d63f04655055",
		keys: 1366,
	},
	"es": {
		bytes: 105216,
		sha256: "f96db79dc4ca54b929eb9653e56f5b33b8c7fea45cc8b8c222bec210c3992f29",
		keys: 1366,
	},
	"fa": {
		bytes: 137923,
		sha256: "753acda01d1e5f72223a5dc1e9ef354ad14866a095080d1e1ae747c12911e1a2",
		keys: 1366,
	},
	"fi": {
		bytes: 102776,
		sha256: "8cb8347fd8fe40ce77f941649729f87dbf2d74e9fb5135650ce494d327b38418",
		keys: 1366,
	},
	"fr": {
		bytes: 110101,
		sha256: "8ae1ec982e9d7e96a3296fe1419b25d1e34844291aa09c947918e3657a84d9b1",
		keys: 1366,
	},
	"he": {
		bytes: 124076,
		sha256: "6ce2c53e467d376232ccc782581190b770294c792e919a386a9bbbcb561e4d09",
		keys: 1366,
	},
	"hi": {
		bytes: 173819,
		sha256: "dc3688ac8818723ae0318ddcd5275d98683a89e1fdfbb5e2ea1c01fac9c2516d",
		keys: 1366,
	},
	"hu": {
		bytes: 110150,
		sha256: "e8c7726d5da97afc12f355e85277f27ea8587e54b58e8b7d3571e2dffb6cf607",
		keys: 1366,
	},
	"id": {
		bytes: 99662,
		sha256: "6984b62be7cbc80e655343b9ce9c5fbd95aea56ac12a29ca366132f0fc94ad35",
		keys: 1366,
	},
	"it": {
		bytes: 105574,
		sha256: "9ec07d09bea00973ae555975d465fa3cf4f4aba286a39dd64fb1c18f699e1bed",
		keys: 1366,
	},
	"ja": {
		bytes: 120881,
		sha256: "cc01880933fc64c0809d3d6d2cd32072bd731097ac5c648b3432c007ba29bbc4",
		keys: 1366,
	},
	"ko": {
		bytes: 110890,
		sha256: "0880a9f36dcbf50b75874dae339c3086225fb56cbf660be5d0b8c081d458274a",
		keys: 1366,
	},
	"ms": {
		bytes: 99870,
		sha256: "f77ec179c7095bdc15bfb6e5622bd105bab83c5361ce4a95f46e0eb510d23bff",
		keys: 1366,
	},
	"nb": {
		bytes: 100230,
		sha256: "01be7623202aad4a10a1af41a3d7227815127cc10009cc72309c0f4843b8e7ea",
		keys: 1366,
	},
	"nl": {
		bytes: 103639,
		sha256: "754c6a3ff306921a3919aad8282c3ae1ed2aef5b585b456d8f31d86cb78db572",
		keys: 1366,
	},
	"pl": {
		bytes: 103964,
		sha256: "0988884a367a99c1cb294bdd342cc0645571a1e060777bda1c7c556e541921bb",
		keys: 1366,
	},
	"pt": {
		bytes: 105181,
		sha256: "cf61e624be419a80fdd90f288f7604b741898556f10a8c00f81b4d8c5a155697",
		keys: 1366,
	},
	"ro": {
		bytes: 107446,
		sha256: "b7e20fc608bc60ab004d3355de328b7cfd0843b15d18bb626ec8948dd206226b",
		keys: 1366,
	},
	"ru": {
		bytes: 145771,
		sha256: "a4f357428e51837cc3db2b39aa605c0c6cc95fe70d9fc087e374020f094319fd",
		keys: 1366,
	},
	"sv": {
		bytes: 101611,
		sha256: "6412ef6a2b897964c6d83a0d2432e79370bea9b8f60c15b9930d5f8b87d52324",
		keys: 1366,
	},
	"th": {
		bytes: 172621,
		sha256: "f5a9c754156598a15150e570d24fa15e669c363c0a46839655241b5743403c35",
		keys: 1366,
	},
	"tr": {
		bytes: 103416,
		sha256: "34b417c242b96a3776a3bcd53c19328f62ad4db4adc10f8a1f2111c51b20a85c",
		keys: 1366,
	},
	"uk": {
		bytes: 143325,
		sha256: "4b9824f8451bf95f2d56685056d80cf5f211df7836f522d4c35b3f522b41fad2",
		keys: 1366,
	},
	"vi": {
		bytes: 115058,
		sha256: "e9bdcb8bd4f51cf410b111dd65c8cf315c44a47b503f89502ad50bdcbf623c25",
		keys: 1366,
	},
	"zh": {
		bytes: 94165,
		sha256: "00e10537ca81770586b7fd11d63be3884be7bd1b337dae93948204e39d637f6d",
		keys: 1366,
	},
	"zhTW": {
		bytes: 94477,
		sha256: "3a660a107c40412c3dc83cab040bad1989dd4009790661ddde58030f6945a662",
		keys: 1366,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
