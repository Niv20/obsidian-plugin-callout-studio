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
		bytes: 112867,
		sha256: "2ed210e90282ba2ae6ad38da8399ba7823ca4bf2df9c6f1daf73a15664d054b6",
		keys: 1221,
	},
	"bg": {
		bytes: 135254,
		sha256: "06fb150dfb02de51188027e1e052a52c97b1b0ae60323012b28ae965a8294df4",
		keys: 1221,
	},
	"cs": {
		bytes: 92519,
		sha256: "7ad4b31f55b8f7f47299feb8ccfc0d774c2341ba1d69426693850d7d659ab3e0",
		keys: 1221,
	},
	"da": {
		bytes: 89621,
		sha256: "9bc06b4bc642870b51facc31acc287beb84b672d52c6103f28dd31d7808b5d4b",
		keys: 1221,
	},
	"de": {
		bytes: 97912,
		sha256: "8d499c1ca213e52b9256f1e97c0c2021c09557c106a0a451d8504f586d49f529",
		keys: 1221,
	},
	"el": {
		bytes: 143328,
		sha256: "6f66438f29d2a01ca32dc22f0d90ff00cab693ba1ee5ed15ced7b67c28d5c8fe",
		keys: 1221,
	},
	"es": {
		bytes: 94893,
		sha256: "fef9e0126908e8e2ca5d679ab5d216e20e3967a04d5aae10b2937af8ff91c923",
		keys: 1221,
	},
	"fa": {
		bytes: 123503,
		sha256: "dddc8f0fe53e9c5abaf1bc173fa9056b3ced4b5859e1720fdce4c86b17f27723",
		keys: 1221,
	},
	"fi": {
		bytes: 92111,
		sha256: "6927ad22650b7b815357b1510726101d68b5e3e3ccbc2d142af55975beddb5b3",
		keys: 1221,
	},
	"fr": {
		bytes: 99438,
		sha256: "9252a5492fabd2eed31dde283ab73878f6ebff3053e84e34c0c62289907acc07",
		keys: 1221,
	},
	"he": {
		bytes: 111939,
		sha256: "0c7cabf5a7ef9f2889ee12d32531101a983a63d99237c7a29668022206e5ad16",
		keys: 1221,
	},
	"hi": {
		bytes: 156912,
		sha256: "9a118f04c03da22c097d8a5e86a544f6cdb7901272f2626f3ca66ff01d2b672a",
		keys: 1221,
	},
	"hu": {
		bytes: 98678,
		sha256: "1db943ff334229e9da3a7314004cbe007148ab45042eca10a5f5ae8a5370e87a",
		keys: 1221,
	},
	"id": {
		bytes: 89278,
		sha256: "fe5b0a70d03a6ae867f649b11dd06c39db8c500bb7b2a264e1d93f4a9846405b",
		keys: 1221,
	},
	"it": {
		bytes: 95289,
		sha256: "f437e4b44702cb98f66bbc55535c3b347e06fcd7dc553309a8d22dd3e7bd1173",
		keys: 1221,
	},
	"ja": {
		bytes: 108401,
		sha256: "d0664eb91711d381eacf3f957cbdcd5b54bcd1d5ee4b27bd8aac9edc33fadb6a",
		keys: 1221,
	},
	"ko": {
		bytes: 99183,
		sha256: "da9c600264cbd0a1bf6e2cd4f855e93d7126f9d18b5d94ebbd1d56ab484ba0fd",
		keys: 1221,
	},
	"ms": {
		bytes: 89406,
		sha256: "a9145231eb2c65d0ce82934723427a1dca3eb811ec2ecc86e68347c13333ccae",
		keys: 1221,
	},
	"nb": {
		bytes: 90104,
		sha256: "96c866e33ee3508311fd79476a4448220907e9dfcde82e7330fa0e62279f9274",
		keys: 1221,
	},
	"nl": {
		bytes: 93264,
		sha256: "8da8dc2f185877ba98b4ff2691e06a30a281c40e85946b4e5232d404aabf94ae",
		keys: 1221,
	},
	"pl": {
		bytes: 93482,
		sha256: "609d7aa617c9dd824ea94a20bec1916173f99d257522e0c1cbe07130a4a6c6a0",
		keys: 1221,
	},
	"pt": {
		bytes: 94801,
		sha256: "4d37d5ec30a5713880b51e621845a8b2760b842af1c41accf7d82ff3798cb959",
		keys: 1221,
	},
	"ro": {
		bytes: 96475,
		sha256: "ca111cad67b98b5e4fc797de5864bd6a9bb4c78952bbde0f26a0aee3f8406519",
		keys: 1221,
	},
	"ru": {
		bytes: 132478,
		sha256: "493aac0ea786bb53442105de2c19312f1b7c7480804bd1508f71839398176b1f",
		keys: 1221,
	},
	"sv": {
		bytes: 91356,
		sha256: "2c17e2ad60c4673fa9974ea7daf5c48db9000acddd0f26392c35be30a2921976",
		keys: 1221,
	},
	"th": {
		bytes: 156586,
		sha256: "f856b348bd544be6b79891bf62225092481a59bac8428b84fc8a76e7a91e502e",
		keys: 1221,
	},
	"tr": {
		bytes: 93056,
		sha256: "01786a2d6f23d00375ebb5c0077da5798bfa8935001e69ef7fcf2ef71b864a77",
		keys: 1221,
	},
	"uk": {
		bytes: 130407,
		sha256: "eff4776c953bdb816729534408a6fdce97462fd02f33083c9efbf0587404e3a2",
		keys: 1221,
	},
	"vi": {
		bytes: 103814,
		sha256: "7085d85f3825e0f6b13c32f1c5dee1a72703fdc332e75785c7d8b9ee8abee0e7",
		keys: 1221,
	},
	"zh": {
		bytes: 83740,
		sha256: "fff70660c71cac26b03875db030c1fc7dca499e0e3e7990222dd379423f5f4ec",
		keys: 1221,
	},
	"zhTW": {
		bytes: 84045,
		sha256: "343f6b7f2264b188326a26adacb917ca75bb41c14a232a1033b3895ecfef2641",
		keys: 1221,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
