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
		bytes: 71495,
		sha256: "3aa051678501cedeebf9741d3f5390c242a87882e527357fdac06f44a3ff1bda",
		keys: 799,
	},
	"bg": {
		bytes: 84168,
		sha256: "e2fb91eb6dc690511d2f47cd27b986ecc868cba93bafe5a1e9eea2da27b40b0b",
		keys: 799,
	},
	"cs": {
		bytes: 58486,
		sha256: "5100586de907031931281b0bbede5f499f259f0bb4e3e001d51213fe97ae36b2",
		keys: 799,
	},
	"da": {
		bytes: 56315,
		sha256: "b7ce750be71e4fd55668e00426d36d6f7b7bfaa888b06a02d7e247fa32c64235",
		keys: 799,
	},
	"de": {
		bytes: 61556,
		sha256: "05f526657f14df27dcb631ac6cf637798b863d93b4ab85f11e5afdf05366c22d",
		keys: 799,
	},
	"el": {
		bytes: 88764,
		sha256: "33a3822c2b342aae6ba39c8361dc4bba496b7e89def91898bcbbaca0e567f46d",
		keys: 799,
	},
	"es": {
		bytes: 59785,
		sha256: "658b3c937062a508001bc325e83f445c89a77fb4e18ca2bbbcb10b62d8fab10f",
		keys: 799,
	},
	"fa": {
		bytes: 77282,
		sha256: "6768621293ecffc2a62d489da331dc0266c6fbcf18b96f115aaf769382c4634d",
		keys: 799,
	},
	"fi": {
		bytes: 58262,
		sha256: "94447599be8950872ccdb52fd548291c3b88a4de5bd5623a44d7e2df7c24aadf",
		keys: 799,
	},
	"fr": {
		bytes: 62298,
		sha256: "f12ed37c2548a438e23efab39152e7c7e042bfb27787c38b9ec8a39fa135cc8a",
		keys: 799,
	},
	"he": {
		bytes: 71572,
		sha256: "acef091700a576ad86d5a3c22f5646d8f14ccb3a7774af072dd8ef9e5eb3f95f",
		keys: 799,
	},
	"hi": {
		bytes: 97584,
		sha256: "d446d5aff7330ee1642a0e52055a734ebd3517d1d95b7704d436e86f07495b17",
		keys: 799,
	},
	"hu": {
		bytes: 62102,
		sha256: "410090e1732ef62487c348691aab450831b5e4998978be43cb1b021065f0c8df",
		keys: 799,
	},
	"id": {
		bytes: 56531,
		sha256: "ef9fb567dea1c6b313dd3671a59b947653a6e7648ab91110b987f5fd29d158af",
		keys: 799,
	},
	"it": {
		bytes: 59556,
		sha256: "408d4856600896cbfe9323f944c4442b6602e67d7c3a8da9734a79cba34172d3",
		keys: 799,
	},
	"ja": {
		bytes: 69005,
		sha256: "4c15510bb6e168ae3326e11f3f580f562baa75898db505a526e8a80e94f5c223",
		keys: 799,
	},
	"ko": {
		bytes: 63273,
		sha256: "159798a0303489e949272fa5e6ea5fd2a5b6f2cf8c5915d6fc99228efbc78397",
		keys: 799,
	},
	"ms": {
		bytes: 56374,
		sha256: "5f34cb81303a9d2eff79f1116e907841f30067af08dbb72ba4aa3ac3951aacfa",
		keys: 799,
	},
	"nb": {
		bytes: 56426,
		sha256: "470177bb636c2fc508ee4fa1e0d34e9b9bd5315126af98776542a0ef53c93294",
		keys: 799,
	},
	"nl": {
		bytes: 58748,
		sha256: "fd38f0fa3074c56e17f0009807a964d509783476332a32312e088a36e8d29184",
		keys: 799,
	},
	"pl": {
		bytes: 58906,
		sha256: "bc5781850d9ef6f31e40c1537ff09dfbb03754dae5fdf87278451bfd4c07e86a",
		keys: 799,
	},
	"pt": {
		bytes: 59688,
		sha256: "009e6c5bc1015a3c030d8c2867ac67ac75cbabf3f09845d609fedde7af250fec",
		keys: 799,
	},
	"ro": {
		bytes: 60567,
		sha256: "1861db63a1540c97acffa21300845445927dbc6ac512e6a86b334bc149d497f1",
		keys: 799,
	},
	"ru": {
		bytes: 82770,
		sha256: "6d256083b12a8f9deea386d65ed69b30e2afdd884348fb6ba37c3001ad9c7db6",
		keys: 799,
	},
	"sv": {
		bytes: 57269,
		sha256: "157e87c5def7ea6c4c008e50f53d3ab3d336135352f21ca34eb125f96ecb21d9",
		keys: 799,
	},
	"th": {
		bytes: 96760,
		sha256: "5ed20ae9f95f578e8e9c62bb929eefe579bded69edbf02fa1a25379674271d68",
		keys: 799,
	},
	"tr": {
		bytes: 58582,
		sha256: "d2ab5d211153ee7edeee9e0092f65e736c9a3fe027cc23d8b956f12e32bb493b",
		keys: 799,
	},
	"uk": {
		bytes: 81081,
		sha256: "0ae905f5974724dcd5482f17387e9dc0570253c8d4552d3216681fae02f8763c",
		keys: 799,
	},
	"vi": {
		bytes: 64941,
		sha256: "f01336038fdf4f9b515e31133ea6a03f35dfdf4066acb76f88af34d7ef6939bf",
		keys: 799,
	},
	"zh": {
		bytes: 53301,
		sha256: "b79939e73f8643526977dc488a6fc4f974f4e4b8993d8823ceb2ebb7b8a04ee8",
		keys: 799,
	},
	"zhTW": {
		bytes: 53512,
		sha256: "9f7fe3c109d88d56df78b2cc19a12cfed39bb50faad2618cf4a0785c0c2cc4e7",
		keys: 799,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
