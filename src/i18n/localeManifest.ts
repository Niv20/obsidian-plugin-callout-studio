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
		bytes: 66208,
		sha256: "69767b9fc4110e92e56294873cd441501b8e1af616427055a708d7cac5a2708b",
		keys: 744,
	},
	"bg": {
		bytes: 77698,
		sha256: "9e793a3bff14b635a297859c4c98c716dc44b67ea794ef985c95bba6436e7f50",
		keys: 744,
	},
	"cs": {
		bytes: 54735,
		sha256: "737b10b4b3e68dddb85df81cbd6aef9c65ef92b731c71b5a76ad68b23b47b0c0",
		keys: 744,
	},
	"da": {
		bytes: 52561,
		sha256: "3fc8f8d1af1c4220f084f1909d46b864318adf1ea66684e94ffeaf8fbfa82da0",
		keys: 744,
	},
	"de": {
		bytes: 57453,
		sha256: "b58e5b4a580bcacf400d276ec5181eae2162977f9eb401724c89b05aaa43b312",
		keys: 744,
	},
	"el": {
		bytes: 81479,
		sha256: "1d1cdde753d11a0fe538d351a6db319b85701b5ca33ccb525d5092bfab1a4beb",
		keys: 744,
	},
	"es": {
		bytes: 55994,
		sha256: "e382ecd1d785a4c2cf4da7db72b4b3ba753783fcce63949c3af11ce381b248b4",
		keys: 744,
	},
	"fa": {
		bytes: 71895,
		sha256: "b208399defdfa9cfc6d064ff485eeba65f0915d33d478b688c28535a98391e71",
		keys: 744,
	},
	"fi": {
		bytes: 54594,
		sha256: "f50b74e03a168797a3dd94cb55651c0d4d40706f58dc381ee4eb85c0dedd782a",
		keys: 744,
	},
	"fr": {
		bytes: 58094,
		sha256: "fd0cf4bc55c5b4dca9efc4676d828d370bcbfbe22466171936d8cd06f87f579d",
		keys: 744,
	},
	"he": {
		bytes: 67051,
		sha256: "ca7654ec6b2d4228bda2ccbbbd5ed49413404310d56b50d9d937487f8e53f95f",
		keys: 744,
	},
	"hi": {
		bytes: 89629,
		sha256: "607f2ceb711db2676f58a1b0d6464006ac3f9bfee61b40ed7c8b2acfd435532f",
		keys: 744,
	},
	"hu": {
		bytes: 57909,
		sha256: "2c551c2994f70b6cb748df9f39c56cdbf633bfcf1cf6817ed047cf89ec56bb78",
		keys: 744,
	},
	"id": {
		bytes: 53245,
		sha256: "18923dc0451e59ef077d97f8bd494423a3f7eaadfdf4240f6a552ac475091d79",
		keys: 744,
	},
	"it": {
		bytes: 55656,
		sha256: "7db9ae3865818b4d3f74ceef50b98d6763fc87a69d43136bdf4ae331b8aec0e9",
		keys: 744,
	},
	"ja": {
		bytes: 64266,
		sha256: "afa8faa0957868ece62ac2531121b04f30afc06e463da6247aa3ed67cf7a1023",
		keys: 744,
	},
	"ko": {
		bytes: 59197,
		sha256: "6823e9eb8e1680710d050875feb700e5d95af2da095b054e0152f361d4697cc2",
		keys: 744,
	},
	"ms": {
		bytes: 53127,
		sha256: "743c095342a09c7e09374694179933f7d7c7df4327b1f4823cb88ee88a88dc97",
		keys: 744,
	},
	"nb": {
		bytes: 52697,
		sha256: "387328a07f1efe093b17da0eb2ac106d0af253635b7b2b826c1addea4ae566b5",
		keys: 744,
	},
	"nl": {
		bytes: 55026,
		sha256: "4ce268a011512808027b9aea9f7295832f5a06f4c54f5eaeb8a5a5d10be21468",
		keys: 744,
	},
	"pl": {
		bytes: 54999,
		sha256: "e7f9184e3f141a77494774842e63f8bd150f13f785d5568f89a78587c21c5300",
		keys: 744,
	},
	"pt": {
		bytes: 55899,
		sha256: "102fb2e04cb707fcfe28968762d8d01600349c04f23ac3cc32c0a75dafa29d22",
		keys: 744,
	},
	"ro": {
		bytes: 56401,
		sha256: "8e88972b65925b16228f0d8922794e8a26c30312826c4ac491d52006748ca6a5",
		keys: 744,
	},
	"ru": {
		bytes: 76421,
		sha256: "b43972ea87f480c01e0f09209c2189a6703f27b13e6a828cacb5a563d4641314",
		keys: 744,
	},
	"sv": {
		bytes: 53572,
		sha256: "9a09e5afa870c8e96d9b0d97971cb08111fa3c3d978c2abafc642b1b1ee346c7",
		keys: 744,
	},
	"th": {
		bytes: 88616,
		sha256: "3297fff39ad55a13830921ec76610595539b1681c2b4926744136e47dd0f4d97",
		keys: 744,
	},
	"tr": {
		bytes: 54989,
		sha256: "fae9f705eeeeaedcca8ed176fe52adcb904f86f717bb2f0978835bb845f11a71",
		keys: 744,
	},
	"uk": {
		bytes: 74856,
		sha256: "2429900412b65689ac7fbd859256e66164db0301aec8454aaede6f3a1e5765ab",
		keys: 744,
	},
	"vi": {
		bytes: 60668,
		sha256: "7f2c952608551b6c3c1a523ebe3c07903607575d00f89070fdeca3fc51141dee",
		keys: 744,
	},
	"zh": {
		bytes: 50421,
		sha256: "e4fcd8a0be0045f402f627ba84b05b06913a8f80ffbe0a47810862b2c6eb8de2",
		keys: 744,
	},
	"zhTW": {
		bytes: 50561,
		sha256: "6688b1f02ca0ea5234a4f651c929611667987bcd2579e0db927dead82dc486bc",
		keys: 744,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
