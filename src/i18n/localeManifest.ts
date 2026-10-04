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
		bytes: 109481,
		sha256: "b5c1c835f227fdcfa23e2aafdc816607a7fd27b91829e5e30eabcfec0509097e",
		keys: 1185,
	},
	"bg": {
		bytes: 131176,
		sha256: "c55dba28af72dff9bd377521ced0f331411193d6e7e18a9424ef9725e6529204",
		keys: 1185,
	},
	"cs": {
		bytes: 89834,
		sha256: "48e46068183fb14dc747f4244c842f687757b04d534c2463c1c21a338a50bb97",
		keys: 1185,
	},
	"da": {
		bytes: 87019,
		sha256: "245e935b587cd0c7d52e156df6f02e9fb3ee675efa788f6df396c1ad8020ab61",
		keys: 1185,
	},
	"de": {
		bytes: 95173,
		sha256: "32da34800750b6dd78b394772223d85ae22427908ea5ac4c7b5045e6f6881ff7",
		keys: 1185,
	},
	"el": {
		bytes: 138887,
		sha256: "29cb30b49bd30d28a7b0d2660e0514040ccc5d3c833d51313c644513520edd3e",
		keys: 1185,
	},
	"es": {
		bytes: 92157,
		sha256: "f6693497cb8f0b0fef27111c05d6ec0119475a6fe0cc51011b9ab7d1a4c3a8f6",
		keys: 1185,
	},
	"fa": {
		bytes: 119612,
		sha256: "172c4ceb962957cf5fd4a627d36fdc9200a5da515c3b838ba482cd260e189862",
		keys: 1185,
	},
	"fi": {
		bytes: 89475,
		sha256: "1267a9d4365a9a8de7a2d46b06a83921fda9d0c9a7e9c45f922bc362e83a44a9",
		keys: 1185,
	},
	"fr": {
		bytes: 96560,
		sha256: "bcb6a78925b29b0d6b9989bbae6cfe671f93bb9df64af10030ac58d03d123c2c",
		keys: 1185,
	},
	"he": {
		bytes: 108474,
		sha256: "47540920bfac20f15d11caf2e800ffda2693016c2ab8251574202eda9777cee2",
		keys: 1185,
	},
	"hi": {
		bytes: 152049,
		sha256: "d6d6ebeb9ca5e6d34c5657c82f0549338d989f1be77aaf1b46c314731d1307dd",
		keys: 1185,
	},
	"hu": {
		bytes: 95845,
		sha256: "0c2b70a7325fbeabd92262bba0abd8276fa769c65415288864d29c7bff48e90a",
		keys: 1185,
	},
	"id": {
		bytes: 86882,
		sha256: "75f80d4854a7af027ac9d41a844571d1e727e3cca07d58d846a3025e47741170",
		keys: 1185,
	},
	"it": {
		bytes: 92621,
		sha256: "fa4b78e7cb26854bb85b8c708f0411b53d240f12898aa215bf79e98f9add653a",
		keys: 1185,
	},
	"ja": {
		bytes: 105331,
		sha256: "b9496a381c9b6e262329dd0f9884d999ae6fa9ec100ca9f4f097c3f39acecffe",
		keys: 1185,
	},
	"ko": {
		bytes: 96443,
		sha256: "742449ab9fe130d127510e164dd57ebc8f6cf5cb22e172cfa29aaa341815a189",
		keys: 1185,
	},
	"ms": {
		bytes: 86922,
		sha256: "5c949c8426b80c2edd602102912ff7cdba5a0d7cc6a868befa6baaf9bddbea0d",
		keys: 1185,
	},
	"nb": {
		bytes: 87518,
		sha256: "fbc5d0f6ca2de99a4dc2b0c1ac0b811c5fde3cb0e35805a262000d90162a75d0",
		keys: 1185,
	},
	"nl": {
		bytes: 90728,
		sha256: "a833156493a14cc6b9c5e8e8b2426c46a7c9ae5bf20a89f728684b62d04ff49d",
		keys: 1185,
	},
	"pl": {
		bytes: 90814,
		sha256: "cba76aefd573e94a0814cbcc02b1c0c02f80edb7c1d4b6876ee199f571cea6d7",
		keys: 1185,
	},
	"pt": {
		bytes: 92086,
		sha256: "925892a5d203610b05eebcadc701eb6cc5e8b79592cfd10d562b506238672eb6",
		keys: 1185,
	},
	"ro": {
		bytes: 93770,
		sha256: "b5939622fe02cde1227bc36b5bf2fc0af06c5229f0b618f30faefa828de9ac75",
		keys: 1185,
	},
	"ru": {
		bytes: 128364,
		sha256: "d1f58d4a0e604ad8eeec3cb6cecec91d2c388f7fc76a9660c31d5154ab19ecce",
		keys: 1185,
	},
	"sv": {
		bytes: 88649,
		sha256: "9d1bf55030371c0fdcdfaea31772dbf9cce831e64f20609aa98470b34d6e7d04",
		keys: 1185,
	},
	"th": {
		bytes: 152070,
		sha256: "71b417df8664ea10811dbf72f9190c4e7a472031796695b93bc12292ef3843cf",
		keys: 1185,
	},
	"tr": {
		bytes: 90220,
		sha256: "809417369f7aeee4485c84e2c01af7384262e5081012573b3305590cbf7c2c1c",
		keys: 1185,
	},
	"uk": {
		bytes: 126410,
		sha256: "7f40c5e014de9ff5f06b75819f23be060468183ee2a99097a5cd81999ea5568f",
		keys: 1185,
	},
	"vi": {
		bytes: 100915,
		sha256: "0f80d1e028ca89dfbe20cd6816072dcfc798f8aac4cac2ba269ce0dbae64f8e4",
		keys: 1185,
	},
	"zh": {
		bytes: 81503,
		sha256: "d561408377b876aaa4db6b7fcb3bc4e5eff5c742a09dd67b88be82be63c3daa5",
		keys: 1185,
	},
	"zhTW": {
		bytes: 81793,
		sha256: "054ba6828e73711a4642802bb6ac7702673ba9be4a730707d5642de11d581ef6",
		keys: 1185,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
