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
		bytes: 68963,
		sha256: "6cb0ef067df71806c8f21be5a74e2da443ed08ffc2c4e4a539870cf8af8a7cbd",
		keys: 771,
	},
	"bg": {
		bytes: 80950,
		sha256: "25a0fa72f7c64bce17e3cfd0fc63cc75eddb82ee7f3874da30dea4bdecd2aa3e",
		keys: 771,
	},
	"cs": {
		bytes: 56711,
		sha256: "92d14bb5e85c0d1ed3ec03d4926ee59de67bddbbc5f194ad3e8e0b9859ed602d",
		keys: 771,
	},
	"da": {
		bytes: 54540,
		sha256: "2aeecd89bccb755e7641f38d0f18326492a2a48a8c154f079d944d1b2afddeb2",
		keys: 771,
	},
	"de": {
		bytes: 59632,
		sha256: "edd6ac8b59bf01888781a6b681970dec22ac1e96b627916d840e03b83b4899de",
		keys: 771,
	},
	"el": {
		bytes: 85400,
		sha256: "b3551627216e66ac474eba699bd0b553e58920ac4119c0fcbce33707720c934a",
		keys: 771,
	},
	"es": {
		bytes: 57958,
		sha256: "6f4dcce7a67bab51652ccf10cbb9d1fe7f73a7e6a82bfc2861be025265c077f3",
		keys: 771,
	},
	"fa": {
		bytes: 74396,
		sha256: "2fbbe36517618f5e89b30c3d7721b5f525457062f4335a665459e98e9023a592",
		keys: 771,
	},
	"fi": {
		bytes: 56541,
		sha256: "5139424b395e21477db9713a19c7f37bdf04a522420061a5fd61e5e7e4c5a830",
		keys: 771,
	},
	"fr": {
		bytes: 60281,
		sha256: "1ef321af40c4999469e5b6610ae2caa57aeed2ef3017dc3dff1991cc3ff73f68",
		keys: 771,
	},
	"he": {
		bytes: 69203,
		sha256: "93464c805673ca3ea9465e173872823d216d088751b7babb1c61ed5366895098",
		keys: 771,
	},
	"hi": {
		bytes: 93525,
		sha256: "540344301e29e798a41cb5142ab6134fcd2672e67e28255b5998bb061f95e9ad",
		keys: 771,
	},
	"hu": {
		bytes: 60100,
		sha256: "733c7eb75a0a182b82635bc1e76cdb4799158fd064c4acfd497cf950222e3a55",
		keys: 771,
	},
	"id": {
		bytes: 54917,
		sha256: "c1d7c73019f6d5fcce326035a2af2ecca0f1c1ebc8f11d8c6bb00a78d0bcf526",
		keys: 771,
	},
	"it": {
		bytes: 57719,
		sha256: "3cf20071c9de5446e2d886b56c1825fa921d45a3747fdaa72e84b138d46f83dd",
		keys: 771,
	},
	"ja": {
		bytes: 66764,
		sha256: "3dbb11c5d851981a514ddde72e2f48a9535a5e1a99920bf5a01d6961e553098b",
		keys: 771,
	},
	"ko": {
		bytes: 61305,
		sha256: "44c75a67cecb9e0f1076cd0994fe8a71c118c92780e2f3244831d664c23a7837",
		keys: 771,
	},
	"ms": {
		bytes: 54795,
		sha256: "6b73e484ba3ee2fc10c1ac1296a2616733faed756954adb380bba6edf43f10a1",
		keys: 771,
	},
	"nb": {
		bytes: 54645,
		sha256: "e4eee6a5a98f23fd555efec86a4c35c5552984771263a9c275c7cc695319f662",
		keys: 771,
	},
	"nl": {
		bytes: 56886,
		sha256: "9d5f3cbb7bdb43fbcb9dac7328e6c6b6126a11d65c4c55ec104e91d56a144441",
		keys: 771,
	},
	"pl": {
		bytes: 57048,
		sha256: "e06bcf12d73a2416dbba76bcd1a77fa5e97a9336101108be6bac3e2682937d62",
		keys: 771,
	},
	"pt": {
		bytes: 57871,
		sha256: "007bd2679e6297162a4e87e51db6d5865c502e3af2cd61619f61bb96041792fc",
		keys: 771,
	},
	"ro": {
		bytes: 58473,
		sha256: "d849e9bba9a3292259e37b10977d431133106be836bb2ab6da486ec6ccd7dcbb",
		keys: 771,
	},
	"ru": {
		bytes: 79629,
		sha256: "ef354de501015898a3c38b2731d9e22be3b40a4ee6969da6b51c4a74b73bc9f3",
		keys: 771,
	},
	"sv": {
		bytes: 55499,
		sha256: "8b4ddfda47a3ba3f6944e0f9b0cb06c3d42caa55b3fc2fdea5b323ba837d797d",
		keys: 771,
	},
	"th": {
		bytes: 92733,
		sha256: "5211802cecfa1322018b9330becb4637605b5c3b97ca4e1f639cdfe3b28c28b9",
		keys: 771,
	},
	"tr": {
		bytes: 56832,
		sha256: "f5f2e2272892fb824e79c0edc76d8cec57a42bf3b6056a12cc6147ced080ab5c",
		keys: 771,
	},
	"uk": {
		bytes: 78010,
		sha256: "a44a5e284702c86316c41924dfebd8e0c93a5cb60300d5d0a2649362831a8373",
		keys: 771,
	},
	"vi": {
		bytes: 62827,
		sha256: "de708055e4968d2b0c5352168b5c989efd36ad72d52657a59d7e252522715967",
		keys: 771,
	},
	"zh": {
		bytes: 51839,
		sha256: "51e44dfdfcc8e1cbe6cfc3b24e4a6bfc578afa9b212ca1a021cff0d8d0f28a4c",
		keys: 771,
	},
	"zhTW": {
		bytes: 51992,
		sha256: "1d23d0e183fd1bc0e19fc6ef3d82659e86af91f26b78ae45cbbd4e3525d986c2",
		keys: 771,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
