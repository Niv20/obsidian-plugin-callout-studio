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
		bytes: 68080,
		sha256: "978b0cc839cd581e730293fc96b75080cf000907bc7f0114c7540f822055ee76",
		keys: 763,
	},
	"bg": {
		bytes: 80104,
		sha256: "0caa44f23e06b8f29935c591b105e27ffd53048bb9d9b3ac2e5bb367571315d4",
		keys: 763,
	},
	"cs": {
		bytes: 56341,
		sha256: "cbffe77cfe1014b397b86bb9b95817ac3f3aceb100c1a12803f8651b19cb39d6",
		keys: 763,
	},
	"da": {
		bytes: 54042,
		sha256: "b45c549c22feeed4e0d09ec5b2a625aa5a90c58d3cb9935d952d20a8cfb8860b",
		keys: 763,
	},
	"de": {
		bytes: 59153,
		sha256: "a38b9f60cf7fa51cc1e590ea2fd72e557e9e08358f898aefdee546a89bd87ba2",
		keys: 763,
	},
	"el": {
		bytes: 83973,
		sha256: "2ac24175101e5a9ce0e32bbf87e11f5c00e2522272982f0db5bbf298fa0a01a5",
		keys: 763,
	},
	"es": {
		bytes: 57499,
		sha256: "934acbda0e5e9b92ff248baaf15d9f9d39717fb0a4115ed5ddc5bde46127a44b",
		keys: 763,
	},
	"fa": {
		bytes: 73896,
		sha256: "40739db02f91a9bd566f5d285a0392a2fcd8ed3850dae07b97100c8cca57c74e",
		keys: 763,
	},
	"fi": {
		bytes: 56051,
		sha256: "f5fe62e2c8309253738768d9dad77149deec8491703d638f46949be60194f734",
		keys: 763,
	},
	"fr": {
		bytes: 59741,
		sha256: "c3654fdf3bb0a8871b2b2ddb38f79326b9f5d6b46ba365a9d47c183385f032a2",
		keys: 763,
	},
	"he": {
		bytes: 68861,
		sha256: "6c17ab18eee578cab0e6554c94e63ac63e616fa50fb2ea9c2520f87b457e7aa0",
		keys: 763,
	},
	"hi": {
		bytes: 92370,
		sha256: "39b3df3297edd40e67672546924fe842b02ca89550af8a9f0dd07a237d338dc8",
		keys: 763,
	},
	"hu": {
		bytes: 59568,
		sha256: "f02934af1dfa3dcfcc96ba10fff96c6c1a390ed8d1119ecec2798830fe709080",
		keys: 763,
	},
	"id": {
		bytes: 54702,
		sha256: "8f0dd1e5e559da49418d6a3b0f858766137779f929cf215f8ed1e25b432e9c83",
		keys: 763,
	},
	"it": {
		bytes: 57244,
		sha256: "270127c22e481b076eb4d19f8fb8ba5c685dfc720e4618b321f64878ad61c286",
		keys: 763,
	},
	"ja": {
		bytes: 66111,
		sha256: "ce35f5d5f98c1580b4a10d123940cb1f57cbb3a57197a8d3834eedc5ccff3eb0",
		keys: 763,
	},
	"ko": {
		bytes: 60847,
		sha256: "26e8256d12cd0c3f392affcf8c5ec3222eb6251d7e31fa14c77979510637008f",
		keys: 763,
	},
	"ms": {
		bytes: 54583,
		sha256: "e422c7b1b7ecfbbf74344e720dae2ddd5eeb0113008d2c428c681443659113b9",
		keys: 763,
	},
	"nb": {
		bytes: 54191,
		sha256: "8b1f4b7c0cb212edc72e7d0da8439732a90cd8a7d51d081164411dfaf89b26a0",
		keys: 763,
	},
	"nl": {
		bytes: 56573,
		sha256: "4a491c669e789ac5c9023d4ecae2c1b23801937697e5afa4cf732da3f3626b10",
		keys: 763,
	},
	"pl": {
		bytes: 56573,
		sha256: "c792f7b100fd45fb65058f6c280de8bab87c0c46920d9f70dc1784e4f4b66a03",
		keys: 763,
	},
	"pt": {
		bytes: 57505,
		sha256: "8ab44744b2f2cd6f6d5b84087a3341552c4d6ccffc2e31cd4c0314f8b00e5179",
		keys: 763,
	},
	"ro": {
		bytes: 57972,
		sha256: "d718c922c304d95c9ac60b99aa29b2d0c1464996ee6dedc7c6a8f39ce0c70e30",
		keys: 763,
	},
	"ru": {
		bytes: 78694,
		sha256: "9a415cd24963e4789fa33e03168860eb8a4bf89b5f3056642edeed2bd1b95f4b",
		keys: 763,
	},
	"sv": {
		bytes: 55114,
		sha256: "9476c51706720de21943e44ee7e55045afa53055a0d385d6b094185caf2c98b7",
		keys: 763,
	},
	"th": {
		bytes: 91276,
		sha256: "59d264cb49fe55163a92e9358a0a53d1618e9efaadfc35051a5c4b3ee59b57dd",
		keys: 763,
	},
	"tr": {
		bytes: 56460,
		sha256: "cbdb0722e02c83d6ad42e45c5c62d896ae4daf8048e562703f13c9ef9c35835e",
		keys: 763,
	},
	"uk": {
		bytes: 77048,
		sha256: "e298126fe216a6653ec43b6b1354913d79051f2d0b593742ecbd7952bd8383f6",
		keys: 763,
	},
	"vi": {
		bytes: 62404,
		sha256: "9faf7055be9645fa4a65b10e2f48d55f3a465f725bc803770253d77f731fd78e",
		keys: 763,
	},
	"zh": {
		bytes: 51764,
		sha256: "e831ca1ab4492689adb8528a8459f9f4ddd79bc63dd631353257d11c1407f384",
		keys: 763,
	},
	"zhTW": {
		bytes: 51899,
		sha256: "44e416374447aa80e2accbe3e94a68522000957e51a835ed34020008756732ea",
		keys: 763,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
