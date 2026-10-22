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
		bytes: 116393,
		sha256: "0ac744ca7d7ce0aa60ab4c748b9bdc140951f7e861d3980ee7c77cde97ab2dd2",
		keys: 1246,
	},
	"bg": {
		bytes: 139115,
		sha256: "3f12f51bb723e7c0391d9625c35387d03eb88c504f8225c264308412c2eb0bcf",
		keys: 1246,
	},
	"cs": {
		bytes: 95477,
		sha256: "33c8f769ce634bb2b56c1d7423aa5017c7eb7ebb173a7b81f34552c9a80b4263",
		keys: 1246,
	},
	"da": {
		bytes: 92252,
		sha256: "621aee41c789ca8ff4be2390ad92190463e0ef6dc832c6888c856c7ac0572fcd",
		keys: 1246,
	},
	"de": {
		bytes: 100894,
		sha256: "98fc01f98ce4e89a959e6be216d9ade3ecf06b35aba00413f17461b6c6ac50a7",
		keys: 1246,
	},
	"el": {
		bytes: 147113,
		sha256: "5d3c3bdbc09d7db1bb4f9b089f923fe1bb2da11243eb8c492afe31e5168a6c8b",
		keys: 1246,
	},
	"es": {
		bytes: 97701,
		sha256: "fd8a577bbad24178aac4a629089ea49644955ef37863c4ea22ef234386759b8b",
		keys: 1246,
	},
	"fa": {
		bytes: 127630,
		sha256: "f35bcfd0c1b112d7c6e0504a6678f781dfb49aa1ac0e27273fa976e253646b0e",
		keys: 1246,
	},
	"fi": {
		bytes: 95132,
		sha256: "14fdbca6bddab00d45b4df2710a5e9ddbfd576afed600eaa4144ee58d71d53e5",
		keys: 1246,
	},
	"fr": {
		bytes: 102314,
		sha256: "1f77b30e33d6955f8003194a865e0a56cb5dd954a509bc088bb2565fe2ce71be",
		keys: 1246,
	},
	"he": {
		bytes: 115408,
		sha256: "093e152e6e01eb7344b6e11213145ed8875b0cb0e4c84447ab4d56fb82af1933",
		keys: 1246,
	},
	"hi": {
		bytes: 161590,
		sha256: "463bbee84265518a1190efae1d8c5956117b05ce54d9ac097c655bdb6d3c95c5",
		keys: 1246,
	},
	"hu": {
		bytes: 101911,
		sha256: "c736fe9a4d091039862158e56415f714e92b7be1ff3c4f7def80d39cea67f19a",
		keys: 1246,
	},
	"id": {
		bytes: 92305,
		sha256: "9810379161d2a43a90e32fb7e43de79af1be084400d1aeaf7d06291b639a272c",
		keys: 1246,
	},
	"it": {
		bytes: 98095,
		sha256: "de8ccf47396e894d0ea1b20f0b5df94f69d0beda55501b62feeef6fdb0485db6",
		keys: 1246,
	},
	"ja": {
		bytes: 111837,
		sha256: "8c60d1b77303c5541d29393e099ab662cfec2fa32987f21516a5f74401d54163",
		keys: 1246,
	},
	"ko": {
		bytes: 102630,
		sha256: "1fa6056be025b08cc90cf25d84e0cccb522fe6fbbeabb8ee0406e2e4b569b952",
		keys: 1246,
	},
	"ms": {
		bytes: 92386,
		sha256: "85e5694575f8bc91f4c0f0e0fb112d8fa15a0c318cfa45c57a4015f59f20a3a3",
		keys: 1246,
	},
	"nb": {
		bytes: 92873,
		sha256: "ca223687c4381ab3a9e5b25891d30ad38e83cb0491fbd03f399f84a9bf0f62c0",
		keys: 1246,
	},
	"nl": {
		bytes: 96110,
		sha256: "e4972bd74719ee99ace54b1a126512258199183d327c3a5b9b7d25a5bf559eae",
		keys: 1246,
	},
	"pl": {
		bytes: 96382,
		sha256: "100c7f2579f784911459840778285826e4a380789202a096cef821b0a6ae358a",
		keys: 1246,
	},
	"pt": {
		bytes: 97629,
		sha256: "5f2f6589d4fe86f2f384574c8e6b3f230498187e8600d3215d326deb4b47f212",
		keys: 1246,
	},
	"ro": {
		bytes: 99523,
		sha256: "1ef06bede2a1f10c330467c7ee5fcc8fb2d9e0e860d4661804ff0ae40b81fcd7",
		keys: 1246,
	},
	"ru": {
		bytes: 135917,
		sha256: "ddd5df61cee0773f27be2d6e3f89ec6fffa4162d9dc1e3df6443eaf7dcbc11d9",
		keys: 1246,
	},
	"sv": {
		bytes: 94084,
		sha256: "273cea5dcd53e324d3cef407a8d99a8521700b6d4f4c93ba9bad15df12302100",
		keys: 1246,
	},
	"th": {
		bytes: 161179,
		sha256: "221d0613624221adf0542ff6fbfefced0d2e36b22b76dbec9a7992b70557c2eb",
		keys: 1246,
	},
	"tr": {
		bytes: 95905,
		sha256: "a06eee6491a900c03b2f3438e61e71e92fd45abe1179eafd05f4b387e2fa8b41",
		keys: 1246,
	},
	"uk": {
		bytes: 133610,
		sha256: "4db97adbdde993b42e4a091f109b65366b46457a0c82a32ebbf80ade0f332cb2",
		keys: 1246,
	},
	"vi": {
		bytes: 107026,
		sha256: "0deb82aface0c3613485518757c31891b94b59b23c60090b69c697cbfd168f83",
		keys: 1246,
	},
	"zh": {
		bytes: 86725,
		sha256: "34caca3cf15ed0ce7d736c899c7a077d2bf7862b78028d8fc5ad1f43ca325ee7",
		keys: 1246,
	},
	"zhTW": {
		bytes: 87084,
		sha256: "92166dbd84e1edf7ba960623f65fcc71a953fca6d8af08904cbf8b068ac05ce3",
		keys: 1246,
	},
} as const satisfies Record<string, LocaleManifestEntry>;
