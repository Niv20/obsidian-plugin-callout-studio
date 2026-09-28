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
		bytes: 93534,
		sha256: "8996e6d3b2350d0016467e394b237a11925495e1c97025be5443606a12fc08b1",
		keys: 964,
	},
	"bg": {
		bytes: 113433,
		sha256: "8525343f8ec15ff780d393811f159d19fcdf578890cc70fd060f86243e20cb6f",
		keys: 964,
	},
	"cs": {
		bytes: 76478,
		sha256: "8932664d1ebe816b4861272447c868840ebcd778aefafd2dae0713f8bf0e2109",
		keys: 964,
	},
	"da": {
		bytes: 73497,
		sha256: "7b01ae81dad9d9e3ede6da58f0bd9c6e826b48b74f236998825b06a9993fd323",
		keys: 964,
	},
	"de": {
		bytes: 81291,
		sha256: "2956b4488141089dd2eb32cbeb80ea8b412544ef0dbbd2aeebee9646fb99af28",
		keys: 964,
	},
	"el": {
		bytes: 120178,
		sha256: "09e6282645f31b5857fe256527773cd9832a4bf958524439adc602b0aeaf8c4a",
		keys: 964,
	},
	"es": {
		bytes: 78548,
		sha256: "786afe655938ce58beabfa647d2350afeb86fcb54dd798e77be52ca52d992656",
		keys: 964,
	},
	"fa": {
		bytes: 103416,
		sha256: "48f0061ad81a506d66321903d0a72333d81eb48235b0732da1cad470d214d8c8",
		keys: 964,
	},
	"fi": {
		bytes: 76125,
		sha256: "f4fb592c8f26ea314e48a6998e4d169dee5d340e7179d5c5c54eec7e485e2301",
		keys: 964,
	},
	"fr": {
		bytes: 82056,
		sha256: "d35f810c1ef358c3deaf96440c4facb3995e79044f4b4dc4490f0095b12a0b8f",
		keys: 964,
	},
	"he": {
		bytes: 93039,
		sha256: "eafb08003620ac8de951eb468e9085f03878a2316db4d34bcab253cbee915273",
		keys: 964,
	},
	"hi": {
		bytes: 131404,
		sha256: "08df35f8a4aff79b33707b75ab01de31adc8779d2d1418c24123f65ea675842d",
		keys: 964,
	},
	"hu": {
		bytes: 81893,
		sha256: "8cdf2846e41b61add6b85436db2a8e06fce902601b6df5981155258c7705f18c",
		keys: 964,
	},
	"id": {
		bytes: 74043,
		sha256: "c0a41e13be3f4f6eadbc1b89a997140e9c6463fcf8d4f3fd270d0a96789f1071",
		keys: 964,
	},
	"it": {
		bytes: 78666,
		sha256: "9194637f6be5db539d4f75383745d97f97b2a13bdaa8345b1b468217db453000",
		keys: 964,
	},
	"ja": {
		bytes: 90531,
		sha256: "4d9f74ead7c5b0feb2e8b892fe7409f82e22e609b18fc6e17f0470359a10d7c8",
		keys: 964,
	},
	"ko": {
		bytes: 82625,
		sha256: "50d3c319819bdee8c11a19f41918ef955beef8c7f0a84b7ed095a819d2694b1a",
		keys: 964,
	},
	"ms": {
		bytes: 73699,
		sha256: "8e6cb249fb9a3deca9fcf1d908b7432b1367eee993b7c785228ad76ab0827789",
		keys: 964,
	},
	"nb": {
		bytes: 73942,
		sha256: "183a44b190d77431ca972f2cf95f95418f8da8f1b9c933ee72f0649b2117ca1c",
		keys: 964,
	},
	"nl": {
		bytes: 76938,
		sha256: "127171315062970e4cc618ba635dcdb32589c4094db894862697fa1d73e3651f",
		keys: 964,
	},
	"pl": {
		bytes: 77389,
		sha256: "22f9c326a87cc829e71d1f1eadab6700c94a244e0a6959df8606714f01978502",
		keys: 964,
	},
	"pt": {
		bytes: 78328,
		sha256: "5a49b6ecd2235249f157f3bd3ec57b0b7de1fd3c77608ba5ddfaf15802e67c4f",
		keys: 964,
	},
	"ro": {
		bytes: 79550,
		sha256: "5b89bc96bc5c21883ac41025a8143f4df94a228a9d96cf97f9819440189384b0",
		keys: 964,
	},
	"ru": {
		bytes: 110960,
		sha256: "1c8e3fcd65cffe65ee6113c6938e470a731bf39ce6565799d8367316a0aec57d",
		keys: 964,
	},
	"sv": {
		bytes: 75103,
		sha256: "309b174012bf5c91ffecd8f955a21da9f49ad31ef5b360131b9c0253f8056ae1",
		keys: 964,
	},
	"th": {
		bytes: 132366,
		sha256: "16afd939fa4f59a701a94a70c2d6b12e8058322476846d235df355ece1e6f92d",
		keys: 964,
	},
	"tr": {
		bytes: 76637,
		sha256: "a9ddc2d9c148a9ebe7ab577da08b6d62c11a21578de9328b378851d7f30f9b7d",
		keys: 964,
	},
	"uk": {
		bytes: 108929,
		sha256: "8dabaf037e4b9b968b0f4057dba3da2d3b6a27a520ac078a9d60b4034c5b1965",
		keys: 964,
	},
	"vi": {
		bytes: 86583,
		sha256: "e5c2a7c60c4307b57bfbdf5f34d1413dd92d5cb6fb99bd4d39d3e6f316b90693",
		keys: 964,
	},
	"zh": {
		bytes: 68908,
		sha256: "63dcbe1060f06429d9f5cdf9b75926fe9f16797b3be52b52f67d5b10ffbfa711",
		keys: 964,
	},
	"zhTW": {
		bytes: 69218,
		sha256: "a80cb835ce056bc70b9123e535d2f0f3fa189cfd7cd0e24a2589314491470cb6",
		keys: 964,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
