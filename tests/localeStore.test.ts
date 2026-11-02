/**
 * tests/localeStore.test.ts — the one network call this plugin makes.
 *
 * Every other fetch in Callout Studio is behind an explicit button. This one is
 * not: if the language a user already reads is not on disk, the file is fetched
 * in the background at launch, because a "download your translation" button
 * would have to be pressed in a language they cannot read. That exception is
 * defensible only while five properties all hold, and all five live here:
 *
 * - **Nothing is requested when the file is already there.** Freshness is
 *   decided by SHA-256, not by version number, so a release that did not touch
 *   a language costs its readers nothing even though the URL changed with the
 *   version. This is the property that makes the exception small.
 * - **Only the exact expected bytes are accepted from the network.** The build
 *   knows each file's size and hash before it asks, so a captive portal, a
 *   truncated response or a CDN serving the wrong file is discarded.
 * - **A stale file is used, not rejected.** On disk the same hash is a
 *   *staleness* signal rather than damage: it is nearly always a copy an older
 *   build downloaded before new strings existed. Refusing it would flip a whole
 *   interface to English to avoid a handful of untranslated labels — and would
 *   do it exactly when the user is offline and cannot fix it.
 * - **A failed refresh costs nothing.** The cached file is overwritten only
 *   after its replacement has arrived *and* verified, so the working
 *   translation survives every kind of failure.
 * - **Disk is a cache, never a dependency.** A read-only vault downgrades this
 *   to session-only and says so once, rather than failing the language.
 *
 * `tests/iconPackStore.test.ts` stops where the socket begins, because the
 * stub's `requestUrl` rejects. This suite goes further by *serving* the bytes
 * itself through `__CS_REQUEST_URL__` (see tests/support/obsidianStub.ts) — no
 * socket is opened here either, but the downloader cannot tell, which is the
 * only way to test what it does with a response it must refuse.
 *
 * The fixtures are the **real** `locales/*.json`, read off disk, so the hashes
 * really are the ones in `LOCALE_MANIFEST`. A hand-written payload would verify
 * against a hand-written expectation and prove nothing.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { App, PluginManifest } from "obsidian";
import type { StubResponse } from "./support/obsidianStub";
import { LocaleStore, localeUrls } from "../src/i18n/LocaleStore";
import { LOCALE_MANIFEST, type LocaleFileId } from "../src/i18n/localeManifest";
import { en } from "../src/i18n/en";
import { getLocale, isLocaleRegistered, setLocale, t } from "../src/i18n";

/**
 * `fetchWithTimeout` reaches for `window.setTimeout` — `requestUrl` cannot be
 * aborted, so that timer is the only thing between a hung connection and a
 * language picker that spins forever. Node has no `window`, and the timer is
 * the point rather than an obstacle, so the realm is aliased instead of stubbed.
 */
const globals = globalThis as {
	window?: unknown;
	__CS_REQUEST_URL__?: (url: string) => Promise<StubResponse>;
	__CS_NOTICES__?: string[];
};
globals.window = globalThis;

const VERSION = "9.9.9";
const PLUGIN_DIR = ".obsidian/plugins/callout-studio";

/** The exact bytes this build expects for a locale. */
const realFile = (id: LocaleFileId): string => readFileSync(join(process.cwd(), "locales", `${id}.json`), "utf8");

/**
 * A well-formed file this build does *not* expect — what a device that has not
 * updated since the last string was added is holding. Dropping one key keeps
 * the shape valid and guarantees a different hash.
 */
function staleFile(id: LocaleFileId): string {
	const parsed = JSON.parse(realFile(id)) as {
		format: number;
		locale: string;
		strings: Record<string, string>;
	};
	const [first] = Object.keys(parsed.strings);
	assert.ok(first, `${id}.json has no strings`);
	delete parsed.strings[first];
	const text = JSON.stringify(parsed);
	assert.notStrictEqual(text, realFile(id));
	return text;
}

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface Harness {
	store: LocaleStore;
	/** The fake vault: path → contents. */
	files: Map<string, string>;
	/** Paths handed to `adapter.write`, in order. */
	writes: string[];
	/** Paths handed to `adapter.read`, in order. */
	reads: string[];
	/** URLs requested, in order — empty is the assertion most tests make. */
	requests: string[];
	/** URL → response body. A URL that is absent throws, like a dead host. */
	serve: Map<string, string>;
	/** Set to make every write fail, standing in for a read-only vault. */
	failWrites: { value: boolean };
	/** Paths that exist but whose read throws — a sync caught mid-write. */
	unreadable: Set<string>;
	/** `onChange` fires, counted. */
	notifications: () => number;
	path: (id: LocaleFileId) => string;
}

/**
 * A fresh store over a fresh fake vault, and the per-test reset.
 *
 * The reset lives here rather than in a `beforeEach` because `node:test`'s
 * hooks are not in this repo's `@types/node`, and because every test starts by
 * building a harness anyway — so a test that forgets it does not exist.
 */
function harness(manifestDir: string | undefined = PLUGIN_DIR): Harness {
	globals.__CS_NOTICES__ = [];
	setLocale("en");

	const files = new Map<string, string>();
	const writes: string[] = [];
	const reads: string[] = [];
	const requests: string[] = [];
	const serve = new Map<string, string>();
	const dirs = new Set<string>();
	const unreadable = new Set<string>();
	const failWrites = { value: false };
	let notifications = 0;

	const adapter = {
		exists(path: string): Promise<boolean> {
			return Promise.resolve(files.has(path) || dirs.has(path));
		},
		read(path: string): Promise<string> {
			reads.push(path);
			if (unreadable.has(path)) return Promise.reject(new Error("EIO"));
			const text = files.get(path);
			return text === undefined ? Promise.reject(new Error("ENOENT")) : Promise.resolve(text);
		},
		write(path: string, text: string): Promise<void> {
			if (failWrites.value) return Promise.reject(new Error("EROFS"));
			writes.push(path);
			files.set(path, text);
			return Promise.resolve();
		},
		mkdir(path: string): Promise<void> {
			if (failWrites.value) return Promise.reject(new Error("EROFS"));
			dirs.add(path);
			return Promise.resolve();
		},
	};

	const app = {
		vault: { adapter, configDir: ".obsidian" },
	} as unknown as App;
	const manifest = {
		id: "callout-studio",
		dir: manifestDir,
		version: VERSION,
	} as unknown as PluginManifest;

	const store = new LocaleStore(app, manifest);
	store.onChange(() => {
		notifications++;
	});

	globals.__CS_REQUEST_URL__ = (url: string): Promise<StubResponse> => {
		requests.push(url);
		const body = serve.get(url);
		return body === undefined ? Promise.reject(new Error(`no route to ${url}`)) : Promise.resolve({ text: body });
	};

	return {
		store,
		files,
		writes,
		reads,
		requests,
		serve,
		failWrites,
		unreadable,
		notifications: () => notifications,
		path: (id) => store.filePath(id),
	};
}

/** Seed every URL a locale is tried at with the same body. */
function serveEverywhere(h: Harness, id: LocaleFileId, body: string): void {
	for (const url of localeUrls(id, VERSION)) h.serve.set(url, body);
}

/* -------------------------------------------------------------------------- */
/* What is already on disk                                                    */
/* -------------------------------------------------------------------------- */

describe("a cached file this build expects costs nothing", () => {
	it("registers it and opens no connection", () => {
		// The property the whole exception rests on. If this regressed, every
		// launch of every non-English install would hit the CDN.
		const h = harness();
		h.files.set(h.path("he"), realFile("he"));

		return h.store.prepare("he").then((result) => {
			assert.strictEqual(result, "fresh");
			assert.deepStrictEqual(h.requests, []);
			assert.deepStrictEqual(h.writes, []);
			assert.strictEqual(h.store.state("he"), "ready");
			assert.ok(h.store.isReady("he"));
			assert.ok(isLocaleRegistered("he"));
		});
	});

	it("still opens none when ensure() is the one asking", async () => {
		// `ensure` is what the startup pass and the language picker both call,
		// so "no download needed" has to be decided here rather than in the UI.
		const h = harness();
		h.files.set(h.path("de"), realFile("de"));

		assert.strictEqual(await h.store.ensure("de"), true);
		assert.deepStrictEqual(h.requests, []);
		assert.strictEqual(h.store.state("de"), "ready");
	});

	it("reads the file once, not once per caller", async () => {
		const h = harness();
		h.files.set(h.path("fr"), realFile("fr"));

		await h.store.prepare("fr");
		await h.store.ensure("fr");
		assert.deepStrictEqual(h.reads, [h.path("fr")]);
	});

	it("touches neither disk nor network for English", async () => {
		// `resolveLocaleFile` answers null, which is what short-circuits both.
		const h = harness();
		assert.strictEqual(await h.store.prepare("en"), null);
		assert.strictEqual(await h.store.ensure("en"), true);
		assert.ok(h.store.isReady("en"));
		assert.deepStrictEqual(h.reads, []);
		assert.deepStrictEqual(h.requests, []);
	});

	it("caches into the plugin's own folder, not the repo's locales/", async () => {
		// During development the repository *is* the plugin folder, and
		// `locales/` there holds the committed sources this cache is built
		// from. One name for both would have the runtime overwrite them.
		const h = harness();
		assert.strictEqual(h.path("he"), `${PLUGIN_DIR}/translations/he.json`);
		assert.ok(!h.path("he").startsWith("locales/"));
		await h.store.prepare("he");
		assert.deepStrictEqual(h.reads, []); // nothing was there to read
	});

	it("reconstructs the folder when the manifest has no dir", async () => {
		const h = harness(undefined);
		assert.strictEqual(h.path("he"), ".obsidian/plugins/callout-studio/translations/he.json");
		await h.store.prepare("he");
	});
});

describe("a cached file older than this build is used anyway", () => {
	it("registers it immediately and asks the network for nothing", async () => {
		// The offline case, and the reason the disk check is a *staleness*
		// signal rather than a rejection: the user reads their own language on
		// the first paint, and `t()` fills the newer keys from English.
		const h = harness();
		h.files.set(h.path("he"), staleFile("he"));

		assert.strictEqual(await h.store.prepare("he"), "stale");
		assert.deepStrictEqual(h.requests, []);
		assert.strictEqual(h.store.state("he"), "stale");
		assert.ok(h.store.isReady("he"), "a stale translation is still readable");
		assert.ok(isLocaleRegistered("he"));
	});

	it("renders from it, filling the missing keys from English", async () => {
		const h = harness();
		const parsed = JSON.parse(realFile("he")) as {
			strings: Record<string, string>;
		};
		const sample = parsed.strings["settings.language"];
		assert.ok(sample, "settings.language is untranslated in he.json");

		h.files.set(h.path("he"), staleFile("he"));
		await h.store.prepare("he");

		setLocale("he");
		assert.strictEqual(getLocale(), "he");
		assert.strictEqual(t("settings.language"), sample);
		// The newly added key is translated in the current locale file.
		assert.strictEqual(t("locale.retry"), parsed.strings["locale.retry"]);
		setLocale("en");
	});

	it("is refreshed when ensure() runs and the network answers", async () => {
		const h = harness();
		h.files.set(h.path("it"), staleFile("it"));
		serveEverywhere(h, "it", realFile("it"));

		await h.store.prepare("it");
		assert.strictEqual(await h.store.ensure("it"), true);

		assert.strictEqual(h.store.state("it"), "ready");
		assert.deepStrictEqual(h.writes, [h.path("it")]);
		assert.strictEqual(h.files.get(h.path("it")), realFile("it"));
	});
});

describe("a cached file that is not a locale file is refused", () => {
	it("rejects one claiming a different language", async () => {
		// The shape check is what stops a JSON file of some other kind — or one
		// for another language — from being registered as this one. Nothing
		// here is ever inserted as markup, so this is the whole attack surface.
		const h = harness();
		h.files.set(h.path("ja"), realFile("ko"));

		assert.strictEqual(await h.store.loadFromDisk("ja"), "invalid");
		assert.strictEqual(h.store.state("ja"), "absent");
		assert.ok(!isLocaleRegistered("ja"));
	});

	it("rejects one that is not JSON", async () => {
		const h = harness();
		h.files.set(h.path("ru"), "<!doctype html><title>captive portal</title>");

		assert.strictEqual(await h.store.loadFromDisk("ru"), "invalid");
		assert.ok(!isLocaleRegistered("ru"));
	});

	it("rejects one whose strings are not strings", async () => {
		const h = harness();
		h.files.set(h.path("pl"), JSON.stringify({ format: 1, locale: "pl", strings: { a: 42 } }));

		assert.strictEqual(await h.store.loadFromDisk("pl"), "invalid");
		assert.ok(!isLocaleRegistered("pl"));
	});

	it("rejects an empty table", async () => {
		const h = harness();
		h.files.set(h.path("uk"), JSON.stringify({ format: 1, locale: "uk", strings: {} }));

		assert.strictEqual(await h.store.loadFromDisk("uk"), "invalid");
		assert.ok(!isLocaleRegistered("uk"));
	});

	it("rejects a format this build does not understand", async () => {
		const h = harness();
		h.files.set(h.path("sv"), JSON.stringify({ format: 99, locale: "sv", strings: { a: "b" } }));

		assert.strictEqual(await h.store.loadFromDisk("sv"), "invalid");
	});

	it("refuses a pathologically large file before parsing it", async () => {
		// A truncated sync or a stray edit must not hand the parser something
		// unbounded. The largest real locale is around 66 KB.
		const h = harness();
		h.files.set(h.path("th"), "x".repeat(1_048_577));

		assert.strictEqual(await h.store.loadFromDisk("th"), "invalid");
		assert.ok(!isLocaleRegistered("th"));
	});

	it("survives a file it cannot read at all", async () => {
		// Present according to `exists`, unreadable according to `read` — a
		// sync caught mid-write, which is a state a real vault reaches. The
		// read is inside the try, so this must be an "invalid" verdict rather
		// than an exception escaping into startup.
		const h = harness();
		h.files.set(h.path("hu"), realFile("hu"));
		h.unreadable.add(h.path("hu"));

		assert.strictEqual(await h.store.loadFromDisk("hu"), "invalid");
		assert.strictEqual(h.store.state("hu"), "absent");
		assert.ok(!isLocaleRegistered("hu"));
	});

	it("reports a language with no file at all as missing, not failed", async () => {
		const h = harness();
		assert.strictEqual(await h.store.prepare("nb"), "missing");
		assert.strictEqual(h.store.state("nb"), "absent");
		assert.ok(!h.store.isReady("nb"));
		assert.deepStrictEqual(h.requests, []);
	});
});

/* -------------------------------------------------------------------------- */
/* Downloading                                                                */
/* -------------------------------------------------------------------------- */

describe("a download is verified before it is believed", () => {
	it("pins the URL to this build's own version", () => {
		// The tag already exists — the release workflow is triggered by it — so
		// publishing new strings needs no tag work at all, and each version's
		// URL is immutable, which makes jsDelivr's permanent caching correct
		// rather than a hazard.
		const [primary, fallback] = localeUrls("he", VERSION);
		assert.ok(primary?.includes(`@${VERSION}/locales/he.json`), primary);
		assert.ok(primary?.startsWith("https://cdn.jsdelivr.net/"), primary);
		assert.ok(fallback?.includes(`/${VERSION}/locales/he.json`), fallback);
		assert.ok(fallback?.startsWith("https://raw.githubusercontent.com/"));
	});

	it("accepts and caches bytes that match the manifest", async () => {
		const h = harness();
		serveEverywhere(h, "es", realFile("es"));

		assert.strictEqual(await h.store.ensure("es"), true);
		assert.strictEqual(h.store.state("es"), "ready");
		assert.ok(isLocaleRegistered("es"));
		// Persisted whole and unaltered — the next launch reads it back and it
		// must hash to the same thing.
		assert.deepStrictEqual(h.writes, [h.path("es")]);
		assert.strictEqual(h.files.get(h.path("es")), realFile("es"));
		assert.strictEqual(Buffer.byteLength(h.files.get(h.path("es")) ?? "", "utf8"), LOCALE_MANIFEST.es.bytes);
	});

	it("tries jsDelivr first and falls through to raw.githubusercontent", async () => {
		const h = harness();
		const [primary, fallback] = localeUrls("pt", VERSION);
		assert.ok(primary && fallback);
		// Primary answers, but with the wrong file — the discard path, not an
		// error path, so it must still fall through rather than give up.
		h.serve.set(primary, realFile("ro"));
		h.serve.set(fallback, realFile("pt"));

		assert.strictEqual(await h.store.ensure("pt"), true);
		assert.deepStrictEqual(h.requests, [primary, fallback]);
		assert.strictEqual(h.store.state("pt"), "ready");
		assert.deepStrictEqual(h.writes, [h.path("pt")]);
	});

	it("discards a truncated response", async () => {
		const h = harness();
		serveEverywhere(h, "cs", realFile("cs").slice(0, -20));

		assert.strictEqual(await h.store.ensure("cs"), false);
		assert.strictEqual(h.store.state("cs"), "failed");
		assert.deepStrictEqual(h.writes, []);
		assert.ok(!isLocaleRegistered("cs"));
	});

	it("discards a well-formed file for the wrong language", async () => {
		// Byte-identical to something legitimate, and still refused: the hash
		// is checked against the id that was asked for.
		const h = harness();
		serveEverywhere(h, "da", realFile("fi"));

		assert.strictEqual(await h.store.ensure("da"), false);
		assert.strictEqual(h.store.state("da"), "failed");
		assert.deepStrictEqual(h.writes, []);
		assert.ok(!isLocaleRegistered("da"));
	});

	it("discards a captive portal's login page", async () => {
		const h = harness();
		serveEverywhere(h, "el", "<!doctype html><title>Sign in to Wi-Fi</title>");

		assert.strictEqual(await h.store.ensure("el"), false);
		assert.strictEqual(h.store.state("el"), "failed");
		assert.deepStrictEqual(h.writes, []);
	});

	it("reports failure rather than throwing when every host is dead", async () => {
		// Nothing seeded, so both URLs reject. `t()` keeps answering in
		// English, which is the whole contract: the worst outcome is an
		// untranslated UI, never a broken one.
		const h = harness();

		assert.strictEqual(await h.store.ensure("bg"), false);
		assert.strictEqual(h.store.state("bg"), "failed");
		assert.strictEqual(h.requests.length, 2);
		assert.strictEqual(t("settings.language"), en["settings.language"]);
	});
});

/* -------------------------------------------------------------------------- */
/* A failed refresh must cost nothing                                         */
/* -------------------------------------------------------------------------- */

describe("a failed refresh never damages the copy already on disk", () => {
	/**
	 * The rule is "nothing is deleted to make room", and it is structural:
	 * `persist` is only reached after `matches` and `accept` have both passed,
	 * so there is no code path on which a bad response can touch the file. Each
	 * test below is one way a refresh can fail, and all assert the same three
	 * things — bytes unchanged, no write attempted, and the language still
	 * readable.
	 */
	const survives = (h: Harness, id: LocaleFileId, before: string): void => {
		assert.strictEqual(h.files.get(h.path(id)), before, "the file was altered");
		assert.deepStrictEqual(h.writes, [], "a write was attempted");
		assert.strictEqual(h.store.state(id), "stale");
		assert.ok(h.store.isReady(id), "the language stopped being readable");
	};

	it("keeps it when the response is for another language", async () => {
		const h = harness();
		const before = staleFile("he");
		h.files.set(h.path("he"), before);
		serveEverywhere(h, "he", realFile("ar"));

		await h.store.prepare("he");
		// `true`, not `false`: the refresh failed, the *language* did not.
		assert.strictEqual(await h.store.ensure("he"), true);
		survives(h, "he", before);
	});

	it("keeps it when the response is truncated", async () => {
		const h = harness();
		const before = staleFile("nl");
		h.files.set(h.path("nl"), before);
		serveEverywhere(h, "nl", realFile("nl").slice(0, 100));

		await h.store.prepare("nl");
		assert.strictEqual(await h.store.ensure("nl"), true);
		survives(h, "nl", before);
	});

	it("keeps it when every host is unreachable", async () => {
		const h = harness();
		const before = staleFile("tr");
		h.files.set(h.path("tr"), before);

		await h.store.prepare("tr");
		assert.strictEqual(await h.store.ensure("tr"), true);
		assert.strictEqual(h.requests.length, 2, "both URLs should be tried");
		survives(h, "tr", before);
	});

	it("keeps it when the response is a plausible file with one byte changed", async () => {
		// The case a size check alone would miss: same length, different hash.
		const h = harness();
		const before = staleFile("ko");
		const real = realFile("ko");
		const tampered = `${real.slice(0, -2)}}`.padEnd(real.length, " ");
		assert.strictEqual(tampered.length, real.length);
		h.files.set(h.path("ko"), before);
		serveEverywhere(h, "ko", tampered);

		await h.store.prepare("ko");
		assert.strictEqual(await h.store.ensure("ko"), true);
		survives(h, "ko", before);
	});

	it("replaces it only once a replacement has verified", async () => {
		// The positive half of the same rule, so "unchanged" above is not
		// simply "this store never writes".
		const h = harness();
		h.files.set(h.path("vi"), staleFile("vi"));
		serveEverywhere(h, "vi", realFile("vi"));

		await h.store.prepare("vi");
		assert.strictEqual(await h.store.ensure("vi"), true);
		assert.deepStrictEqual(h.writes, [h.path("vi")]);
		assert.strictEqual(h.files.get(h.path("vi")), realFile("vi"));
		assert.strictEqual(h.store.state("vi"), "ready");
	});
});

/* -------------------------------------------------------------------------- */
/* Disk is a cache, never a dependency                                        */
/* -------------------------------------------------------------------------- */

describe("a vault that cannot be written to only loses the cache", () => {
	it("keeps the language for this session and says so once", async () => {
		// A read-only vault or a suspended mobile app must not cost the user
		// the download they just did, so a failed write downgrades this to
		// session-only rather than failing the language.
		const h = harness();
		h.failWrites.value = true;
		serveEverywhere(h, "hi", realFile("hi"));
		serveEverywhere(h, "ms", realFile("ms"));

		assert.strictEqual(await h.store.download("hi"), true);
		assert.strictEqual(h.store.state("hi"), "ready");
		assert.ok(isLocaleRegistered("hi"));
		assert.deepStrictEqual(h.writes, []);
		assert.deepStrictEqual(globals.__CS_NOTICES__, [en["locale.diskWriteFailed"]]);

		// A second failure must not tell them again.
		assert.strictEqual(await h.store.download("ms"), true);
		assert.strictEqual(globals.__CS_NOTICES__?.length, 1);
	});
});

/* -------------------------------------------------------------------------- */
/* Concurrency and notification                                               */
/* -------------------------------------------------------------------------- */

describe("concurrent callers share one request", () => {
	it("de-duplicates two downloads of the same file", async () => {
		// The startup pass and the language picker can both ask at once, and
		// `requestUrl` has no cache of its own.
		const h = harness();
		serveEverywhere(h, "ro", realFile("ro"));

		const [a, b] = await Promise.all([h.store.download("ro"), h.store.download("ro")]);
		assert.strictEqual(a, true);
		assert.strictEqual(b, true);
		assert.strictEqual(h.requests.length, 1);
	});

	it("lets a later caller start a new request once the first has settled", async () => {
		// The in-flight entry is cleared in a `finally`, so a failure does not
		// wedge the language at "loading" forever.
		const h = harness();
		assert.strictEqual(await h.store.download("fi"), false);
		assert.strictEqual(h.store.state("fi"), "failed");

		serveEverywhere(h, "fi", realFile("fi"));
		assert.strictEqual(await h.store.download("fi"), true);
		assert.strictEqual(h.store.state("fi"), "ready");
	});

	it("notifies listeners so the UI can re-render when a file lands", async () => {
		const h = harness();
		serveEverywhere(h, "id", realFile("id"));

		const before = h.notifications();
		await h.store.ensure("id");
		assert.ok(h.notifications() > before, "no listener was told");
	});

	it("refuses a file id the manifest has never heard of", async () => {
		const h = harness();
		const unknown = "kl" as LocaleFileId;
		assert.strictEqual(await h.store.download(unknown), false);
		assert.deepStrictEqual(h.requests, []);
	});
});
