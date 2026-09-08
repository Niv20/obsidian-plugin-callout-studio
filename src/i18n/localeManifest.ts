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
		bytes: 67120,
		sha256: "e62cad647633636243f6d2dad7385d18f308f588c91f5b17a252d03ab0b64588",
		keys: 748,
	},
	"bg": {
		bytes: 78951,
		sha256: "2b4b74a32a0e38e79b535cc4793eacc88eb81bb9d12c6377d0c82ed06f3574fd",
		keys: 748,
	},
	"cs": {
		bytes: 55448,
		sha256: "3ab715528473d9754a26268e52e782a2c64afe7a2d3dd8d861ae03e500bc5dee",
		keys: 748,
	},
	"da": {
		bytes: 53180,
		sha256: "afb49b6147a4de99b84a7837f655d5c20f2385905bcfdc6f9325f83a246f876e",
		keys: 748,
	},
	"de": {
		bytes: 58256,
		sha256: "e6e20628da8cce2223097aff4f0caafc2d1627bf8ed9230db8724308904b42dc",
		keys: 748,
	},
	"el": {
		bytes: 82847,
		sha256: "61feceb72cf522d537e31c57d7188a58dbd0e019a729a3834f89a46068ca820a",
		keys: 748,
	},
	"es": {
		bytes: 56651,
		sha256: "12787f089e41bb0b8da95c66f38041c2bb5e70eb49d1200a95f1c53393baac02",
		keys: 748,
	},
	"fa": {
		bytes: 72961,
		sha256: "a0f6cdbb7677abb7d976e052ee240dbe7db75a77749c5c59330b573201551caa",
		keys: 748,
	},
	"fi": {
		bytes: 55269,
		sha256: "b05220aad67573650c80329b5104c3fb62ee5d9169a5dcdc61cee312574c9fb6",
		keys: 748,
	},
	"fr": {
		bytes: 58850,
		sha256: "4ab2196db756782022b76c040b824aeb5ee99820fbf9fc2f1cbd6b54414083cc",
		keys: 748,
	},
	"he": {
		bytes: 67830,
		sha256: "88d0e6cd61338af0c69fc11d4e8a60992eea16c6db77bffd2d6a04e177ab452b",
		keys: 748,
	},
	"hi": {
		bytes: 91178,
		sha256: "2efad6d3eca06681ec823e143c4222f3f87cd684c9f46075b8410360f6f2d651",
		keys: 748,
	},
	"hu": {
		bytes: 58644,
		sha256: "f0a00a1f7c956a7636ba9e80a958cba5801216e85cbf4ec7d370ec25d521cc2e",
		keys: 748,
	},
	"id": {
		bytes: 53878,
		sha256: "1b86678db22389b1bd5989eb19bf4b45f9a5cd9b923e55da1cf0f4cb725b3e06",
		keys: 748,
	},
	"it": {
		bytes: 56339,
		sha256: "c02e6166f41dd84723e77ba71b8ccef51f0b6d9b787ebf62a9b164046aac485e",
		keys: 748,
	},
	"ja": {
		bytes: 65129,
		sha256: "73c2b5809edf9af47d079d00174cca760908fc666b8a59843b7ecc2ba97ce36c",
		keys: 748,
	},
	"ko": {
		bytes: 59935,
		sha256: "bc3e7bd0a224cab6bf38ca219279b323aeaa9abb2bdab73ffae5acd93b50f8d1",
		keys: 748,
	},
	"ms": {
		bytes: 53761,
		sha256: "4228f7ce91ebe187ad08ab44d13aded52d51d830d642bb183ad82c536bb3a016",
		keys: 748,
	},
	"nb": {
		bytes: 53333,
		sha256: "b133d893c36be049daa8b0cbebd0c020c56cc302d8efe5c510c4dca28ff10917",
		keys: 748,
	},
	"nl": {
		bytes: 55716,
		sha256: "eb42fa147f8664d65a26f237d0d8728fa8a0f30ede4d6ed57bbbca36a8089437",
		keys: 748,
	},
	"pl": {
		bytes: 55734,
		sha256: "0994363559d2b4ffa2ea9566d3ae383361620fc391c6f90b13b89ae7fcd5bdaa",
		keys: 748,
	},
	"pt": {
		bytes: 56573,
		sha256: "d3f2c34fa7bff0bdf505930006e8af369a7b0e05796fea1159525127723af730",
		keys: 748,
	},
	"ro": {
		bytes: 57141,
		sha256: "27d7c6fd37a123f1e4c436dca8e455ab75a1de939c15443ac03d9fe9ef1f1831",
		keys: 748,
	},
	"ru": {
		bytes: 77633,
		sha256: "62676b58efb7daa48b414b398d7f2af9930ccaea3103e4da64eee20ddf7a74a4",
		keys: 748,
	},
	"sv": {
		bytes: 54257,
		sha256: "16f27e5c06caeb2a478f2f5f8996681b04708b9630f9e44a57fbe056b22907a4",
		keys: 748,
	},
	"th": {
		bytes: 90204,
		sha256: "afd789dc4ee9dec24c8e9611e2d1a5f7c79f883a12dbc49317f04e682e89640a",
		keys: 748,
	},
	"tr": {
		bytes: 55594,
		sha256: "b9b379fe9434026f7478b94675799ca78fe324e848bf31474cacd612d20e3218",
		keys: 748,
	},
	"uk": {
		bytes: 75967,
		sha256: "ab9d5cff3769ce1f54044fc1e17e3c1c2ec8ace061cd0238f26bf3053318119e",
		keys: 748,
	},
	"vi": {
		bytes: 61449,
		sha256: "374223d55dfc82ce2e9321ffa02dbdeb81509de1db9a41f0fbad6160522a0c4b",
		keys: 748,
	},
	"zh": {
		bytes: 50948,
		sha256: "658928a7660ce2a0fcc99a7be916cfde4acc285c86bbbc0e0a1d5eb7d49e1198",
		keys: 748,
	},
	"zhTW": {
		bytes: 51079,
		sha256: "f54bc6d9e26a3008f62f9c32354cfa7cd3fbf5b3ff3fe5c2503ed814db199a52",
		keys: 748,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
