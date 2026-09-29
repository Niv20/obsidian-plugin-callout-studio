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
		bytes: 107052,
		sha256: "aef84ae959da09eb10c5465d4f078feb4d629e89b7eb2574f3cdfa3eb35db52b",
		keys: 1157,
	},
	"bg": {
		bytes: 128894,
		sha256: "2146457f79ff4fc522b2cff0b2c49c3ea0382c2d512e004b70cf2cc5efbcd337",
		keys: 1157,
	},
	"cs": {
		bytes: 88083,
		sha256: "24f02aec019a5a47099ba95bfd2447343ace1dddb26501e45a1298b223d82158",
		keys: 1157,
	},
	"da": {
		bytes: 84781,
		sha256: "6f36caa9242f249d444b4d950934d018948d20efd63280932dac77df368b33db",
		keys: 1157,
	},
	"de": {
		bytes: 93022,
		sha256: "8fe757bed9ed66c6f9b95229cb4f78d74affb83c241f6a78ab46dcf328b84d41",
		keys: 1157,
	},
	"el": {
		bytes: 136295,
		sha256: "0a723e6f1a4c3e6a768d1cd0be15d3604b3084669c95ef25ebcd5f4d0638dc7f",
		keys: 1157,
	},
	"es": {
		bytes: 90418,
		sha256: "a405e1a84374071c97c9447d5000d460be14a0fecac687dda3e00579d9ce5e61",
		keys: 1157,
	},
	"fa": {
		bytes: 116876,
		sha256: "8b64f5028b8dc7e5bab2e1b4729bfd6bbef62354ca06093b20cfbd2f0a7e1c96",
		keys: 1157,
	},
	"fi": {
		bytes: 87675,
		sha256: "8664e13f78f1592b409be49bd15711b37b458699d94b833469e05019dc416637",
		keys: 1157,
	},
	"fr": {
		bytes: 94274,
		sha256: "55e2c8a0be35d6ddd5ef11c2f6ff88bcdd3e6618258114fd78c3f6c8f899e894",
		keys: 1157,
	},
	"he": {
		bytes: 106243,
		sha256: "b5f37fac53018c56d60a9c1923ef347463ca29029410d97e2221d3bb0214f626",
		keys: 1157,
	},
	"hi": {
		bytes: 148313,
		sha256: "c02bc5264130f48be91a7f7c6037f12b1f83303c945aac97b3a718af97cb25f2",
		keys: 1157,
	},
	"hu": {
		bytes: 93881,
		sha256: "73b5b09966ca76da139e25ba4e54846a1be69b57c6ab74d425a14faacde028e5",
		keys: 1157,
	},
	"id": {
		bytes: 85196,
		sha256: "2470fdfe6e955a7af978db618a39b771afd2d3378714f1281f9c87df6329a76e",
		keys: 1157,
	},
	"it": {
		bytes: 90869,
		sha256: "9605f29188baf27ece70e1b03948ec818cee995f639ae87fcc35a5e9c3acd9ef",
		keys: 1157,
	},
	"ja": {
		bytes: 103083,
		sha256: "267327f0dd39df68acb472a8c308cd75671fd97247ac408c2a4cfd56b530990f",
		keys: 1157,
	},
	"ko": {
		bytes: 94191,
		sha256: "7200c628703477bcdaee8570d1c004af81f530987d59ca6b459e79a0ad2e3c62",
		keys: 1157,
	},
	"ms": {
		bytes: 84861,
		sha256: "80a0ab48caf55039a60f38af09d93113a5288f42750e4698a113d394c22567f3",
		keys: 1157,
	},
	"nb": {
		bytes: 85278,
		sha256: "8e460cf3eb551407b739648f5d5d7b22e26719576282214eb71a407ad7f3d64e",
		keys: 1157,
	},
	"nl": {
		bytes: 88534,
		sha256: "bc61f73801979f6a759c8fb87c9f1d23fb3425afdb3264c7731cf2677ea1b63e",
		keys: 1157,
	},
	"pl": {
		bytes: 89069,
		sha256: "d11b6fbe2a8858a7fee583e89c884db2073a6b46cffa8e6e5e6eb501b512416c",
		keys: 1157,
	},
	"pt": {
		bytes: 90089,
		sha256: "fb20906f27930b266da4b75a5ad841345895e2b76620b0d5bd9ed10da5a2cad1",
		keys: 1157,
	},
	"ro": {
		bytes: 91574,
		sha256: "8762347e521414324a9c5b35805c4767b00d30ab54d92751eaece148d07a53b5",
		keys: 1157,
	},
	"ru": {
		bytes: 126084,
		sha256: "ac77cf473177394e04608ec9d866f861c16d2264cc48e6cecf3ee2f6ad1ab41b",
		keys: 1157,
	},
	"sv": {
		bytes: 86522,
		sha256: "d65f8494e8942e6ab9b485db936014228ffcb12428d3732dcc930bcbbcc4f73e",
		keys: 1157,
	},
	"th": {
		bytes: 149466,
		sha256: "7f878868a0a7b0c402abd5ace69c2bb61f9e5594c3004f72a99008ccc5816fd8",
		keys: 1157,
	},
	"tr": {
		bytes: 88078,
		sha256: "cfab4ef55d728c67bb721cb9975ac27527d2108892da64da2fe79ce3f91e9034",
		keys: 1157,
	},
	"uk": {
		bytes: 124153,
		sha256: "bebfb990bda78df7919d70c2e0c0658ea250a8984548df38ed7f1b4a1b4cecb6",
		keys: 1157,
	},
	"vi": {
		bytes: 99095,
		sha256: "9f0989671e27148810df205586d9ce5627d267bd6cb04f9061144ca36a0dd58e",
		keys: 1157,
	},
	"zh": {
		bytes: 79617,
		sha256: "161f3c8e2460cae0dfc8e7f5dd5e03cdb70568f3923f634b3010571a7d5fc7be",
		keys: 1157,
	},
	"zhTW": {
		bytes: 79930,
		sha256: "2fc4e7cb340dc6ca0a2dd0158397db2fe32299626647b4e9ae68b8417230d47d",
		keys: 1157,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
