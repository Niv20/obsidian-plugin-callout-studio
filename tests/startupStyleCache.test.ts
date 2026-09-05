/**
 * tests/startupStyleCache.test.ts — the startup snapshot, and the one read of it.
 *
 * `StartupStyleCache` is the only layer left of what used to be two (the vault
 * CSS snippet is gone — see `legacyStartupSnippet.ts` and its suite). It exists
 * for a window nothing else can cover: on mobile Obsidian paints the restored
 * note *before* community plugins finish loading, so every custom callout in it
 * renders unstyled until the first `inject()`. The snapshot shortens that to the
 * synchronous read below.
 *
 * Four properties are what make the layer safe to have always on, with no
 * settings toggle to switch it off, and each is pinned here:
 *
 * - **It is scoped per vault.** The key mirrors `App.loadLocalStorage`'s own
 *   `${appId}-${key}` convention, which we cannot call directly (it needs
 *   Obsidian 1.8.7 and `minAppVersion` is 1.6.6). localStorage is per *device*,
 *   not per vault, so an unscoped key would paint one vault's callout colours
 *   over another's for the first frames of every launch.
 * - **It never throws.** A refused write (quota, private mode, storage disabled)
 *   costs the fast path and nothing else — the ordinary inject still runs, so
 *   styling is never actually lost.
 * - **It is deduped**, because `inject()` runs far more often than the CSS
 *   changes and `setItem` is synchronous. `cssInjectorInject.test.ts` pins that
 *   from the injector's side; this file pins the memo itself, including the two
 *   places it is deliberately *not* a cache of what is on disk.
 * - **`injectFromCache()` reads it with an empty registry**, before `loadData()`
 *   is awaited. So it must install text it did not generate, emit no
 *   `css-change`, paint no icons — and must not arm the injector's no-op guard,
 *   or the real CSS moments later would be skipped as "already installed".
 *
 * Both halves need ambient browser globals Node has none of (`window`,
 * `activeDocument`, `createEl`). Everything below is a recorder rather than a
 * DOM: it counts writes and hands back the text.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import { StartupStyleCache } from "../src/manager/StartupStyleCache";
import { must } from "./support/cssInjectorHarness";

/** The single key, as `StartupStyleCache` spells it before scoping. */
const CSS_KEY = "callout-studio-css";

/* ────────────────────────────────────────────────────────────────────────────
 * A localStorage that records, and can be told to refuse
 * ──────────────────────────────────────────────────────────────────────────── */

interface FakeStorage {
	/** What is actually stored — only successful writes land here. */
	held: Map<string, string>;
	/** Every `setItem` ATTEMPT, refused ones included. */
	writes: Array<{ key: string; value: string }>;
	/** Every key `getItem` was asked for. */
	reads: string[];
	/** Make the next writes throw, as a full or disabled store does. */
	failWrite: boolean;
	/** Make reads throw, as a store disabled by browser policy does. */
	failRead: boolean;
}

function storage(): FakeStorage {
	return {
		held: new Map(),
		writes: [],
		reads: [],
		failWrite: false,
		failRead: false,
	};
}

/** The `window` object a store is reached through, or one with no store at all. */
function windowFor(store: FakeStorage | null): Record<string, unknown> {
	if (!store) return {};
	return {
		localStorage: {
			getItem(key: string): string | null {
				store.reads.push(key);
				if (store.failRead) throw new Error("SecurityError");
				return store.held.get(key) ?? null;
			},
			setItem(key: string, value: string): void {
				// Recorded before the refusal so a test can tell "never tried"
				// from "tried and was turned away".
				store.writes.push({ key, value });
				if (store.failWrite) throw new Error("QuotaExceededError");
				store.held.set(key, value);
			},
		},
	};
}

/**
 * Run `body` with `window` seeded, restoring the ambient global afterwards
 * whatever happens.
 *
 * A wrapper rather than a `t.after()` hook, for the reason
 * cssInjectorInject.test.ts gives: the pinned `@types/node@16` does not type
 * `TestContext.after`, and wrapping also restores on a thrown assertion.
 */
function withWindow(store: FakeStorage | null, body: () => void): void {
	const g = globalThis as Record<string, unknown>;
	const saved = g.window;
	g.window = windowFor(store);
	try {
		body();
	} finally {
		g.window = saved;
	}
}

/** An app identified the way Obsidian identifies one. */
function app(over: { appId?: string; vaultName?: string } = {}): App {
	return {
		...(over.appId === undefined ? {} : { appId: over.appId }),
		vault: { getName: () => over.vaultName ?? "My Vault" },
	} as unknown as App;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The key
 * ──────────────────────────────────────────────────────────────────────────── */

describe("StartupStyleCache — the key is scoped to the vault", () => {
	it("prefixes the key with `appId`", () => {
		const store = storage();
		withWindow(store, () => {
			new StartupStyleCache(app({ appId: "abc123" })).persist("/* css */");
			assert.strictEqual(must(store.writes[0]).key, `abc123-${CSS_KEY}`);
		});
	});

	it("prefers `appId` over the vault's name, which the user can rename", () => {
		const store = storage();
		withWindow(store, () => {
			new StartupStyleCache(
				app({ appId: "abc123", vaultName: "Renamed Tomorrow" }),
			).persist("/* css */");
			assert.strictEqual(must(store.writes[0]).key, `abc123-${CSS_KEY}`);
		});
	});

	it("falls back to the vault name when `appId` is absent", () => {
		// `appId` is undocumented. It has been stable for years, but the whole
		// point of reading it through a fallback is that a build without it must
		// still get a per-vault key rather than a shared one.
		const store = storage();
		withWindow(store, () => {
			new StartupStyleCache(app({ vaultName: "Work" })).persist("/* css */");
			assert.strictEqual(must(store.writes[0]).key, `Work-${CSS_KEY}`);
		});
	});

	it("reads back the exact key it wrote", () => {
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "abc123" }));
			cache.persist("/* css */");
			cache.loadCachedCss();
			assert.deepStrictEqual(store.reads, ["abc123-callout-studio-local", `abc123-${CSS_KEY}`]);
		});
	});

	it("keeps two vaults on one device out of each other's snapshot", () => {
		// The failure this prevents: localStorage is per device, so an unscoped
		// key would paint vault A's callout colours over vault B for the first
		// frames of every launch — and the mis-styling self-heals only once the
		// real inject lands, which is precisely the window this layer covers.
		const store = storage();
		withWindow(store, () => {
			new StartupStyleCache(app({ appId: "vault-a" })).persist(".a{}");
			const b = new StartupStyleCache(app({ appId: "vault-b" }));

			assert.strictEqual(b.loadCachedCss(), null);
			b.persist(".b{}");
			assert.strictEqual(
				new StartupStyleCache(app({ appId: "vault-a" })).loadCachedCss(),
				".a{}",
			);
		});
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The round trip
 * ──────────────────────────────────────────────────────────────────────────── */

describe("StartupStyleCache — persist → loadCachedCss", () => {
	it("hands back exactly the text it was given", () => {
		// Byte-exact matters: the snapshot IS what the adopted stylesheet gets,
		// so the handoff to the live-generated CSS is only invisible if the two
		// are the same string.
		const css = [
			"/* Callout Studio */",
			'.callout[data-callout="a b"] { --cs-accent: #336699; }',
			'.callout[data-callout="פתק"]::before { content: "\\201C"; }',
			'--callout-icon: url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E");',
		].join("\n");
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist(css);
			assert.strictEqual(cache.loadCachedCss(), css);
		});
	});

	it("returns null before anything was ever persisted", () => {
		withWindow(storage(), () => {
			assert.strictEqual(
				new StartupStyleCache(app({ appId: "v" })).loadCachedCss(),
				null,
			);
		});
	});

	it("reads the newest snapshot, not the first", () => {
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist(".old{}");
			cache.persist(".new{}");
			assert.strictEqual(cache.loadCachedCss(), ".new{}");
		});
	});

	it("treats an empty snapshot as no snapshot", () => {
		// Empty text would install an empty stylesheet and then be handed to
		// `replaceSync` for nothing. `injectFromCache` bails on null, and this is
		// what makes it bail on "" too.
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist("");
			assert.strictEqual(store.held.get(`v-${CSS_KEY}`), "");
			assert.strictEqual(cache.loadCachedCss(), null);
		});
	});

	it("survives the session — a new launch reads the previous one's write", () => {
		// The whole point: `persist` runs in session N and `loadCachedCss` in
		// session N+1, against a fresh instance holding no memo at all.
		const store = storage();
		withWindow(store, () => {
			new StartupStyleCache(app({ appId: "v" })).persist(".x{}");
			assert.strictEqual(
				new StartupStyleCache(app({ appId: "v" })).loadCachedCss(),
				".x{}",
			);
		});
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * The dedupe
 * ──────────────────────────────────────────────────────────────────────────── */

describe("StartupStyleCache — the write is deduped", () => {
	it("writes identical CSS exactly once", () => {
		// `setItem` is synchronous and the snapshot is the whole stylesheet
		// (~100KB in a customized vault). Every external `css-change` lands in
		// `inject()`, so without this the cost is paid for nothing repeatedly.
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			for (let i = 0; i < 5; i++) cache.persist(".same{}");
			assert.strictEqual(store.writes.length, 1);
		});
	});

	it("writes again the moment the text really moves", () => {
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist(".a{}");
			cache.persist(".b{}");
			assert.strictEqual(store.writes.length, 2);
		});
	});

	it("is a one-slot memo, not a set — going back re-writes", () => {
		// Which is right for what it guards: the previous value is the only one
		// that can be on disk, so equality with it is the only test that can
		// prove a write is redundant. Toggling a colour back and forth really is
		// two different snapshots.
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist(".a{}");
			cache.persist(".b{}");
			cache.persist(".a{}");
			assert.strictEqual(store.writes.length, 3);
		});
	});

	it("is per instance, so each launch persists once even when nothing changed", () => {
		// Pinned as found, and deliberate rather than a gap: the memo is about
		// this session's repeat injects, and reading localStorage back to compare
		// would cost the very synchronous access the memo exists to avoid. One
		// redundant write per launch is the price.
		const store = storage();
		withWindow(store, () => {
			new StartupStyleCache(app({ appId: "v" })).persist(".same{}");
			new StartupStyleCache(app({ appId: "v" })).persist(".same{}");
			assert.strictEqual(store.writes.length, 2);
		});
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * Storage that refuses
 * ──────────────────────────────────────────────────────────────────────────── */

describe("StartupStyleCache — a store that refuses", () => {
	it("swallows a full localStorage rather than failing the inject", () => {
		// `persist` is called from the tail of `inject()`. Throwing here would
		// take the stylesheet swap down with it, so a quota error would cost the
		// user their actual styling — not just the fast path.
		const store = storage();
		store.failWrite = true;
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			assert.doesNotThrow(() => cache.persist(".x{}"));
			assert.strictEqual(store.writes.length, 1, "it did try");
			assert.strictEqual(cache.loadCachedCss(), null, "nothing landed");
		});
	});

	it("returns null when the read itself throws", () => {
		const store = storage();
		store.failRead = true;
		withWindow(store, () => {
			assert.strictEqual(
				new StartupStyleCache(app({ appId: "v" })).loadCachedCss(),
				null,
			);
		});
	});

	it("copes with a window that has no localStorage at all", () => {
		withWindow(null, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			assert.doesNotThrow(() => cache.persist(".x{}"));
			assert.strictEqual(cache.loadCachedCss(), null);
		});
	});

	it("retries the same text once the store stops refusing", () => {
		// The memo is raised only after `setItem` returns. Raised before the
		// `try` it remembered a refused write as a landed one, and since the
		// memo is exactly what turns a repeat inject into a no-op, that text was
		// never offered to storage again for the rest of the session — so a
		// store that frees up mid-session went on launching without a snapshot
		// until a style edit happened to change the CSS.
		const store = storage();
		store.failWrite = true;
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist(".x{}");
			store.failWrite = false;
			cache.persist(".x{}");

			assert.strictEqual(store.writes.length, 2, "it tried again");
			assert.strictEqual(cache.loadCachedCss(), ".x{}");
		});
	});

	it("still writes a text that landed exactly once", () => {
		// The other half: the memo has to keep doing its own job, which is to
		// collapse the no-op injects that follow every external css-change.
		const store = storage();
		withWindow(store, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist(".x{}");
			cache.persist(".x{}");
			cache.persist(".x{}");

			assert.strictEqual(store.writes.length, 1);
		});
	});

	it("a window with no localStorage at all is retried too", () => {
		// `window.localStorage` being absent throws on property access, before
		// `setItem` is ever reached — the memo must not be raised there either.
		const store = storage();
		withWindow(null, () => {
			const cache = new StartupStyleCache(app({ appId: "v" }));
			cache.persist(".x{}");
			withWindow(store, () => {
				cache.persist(".x{}");
				assert.strictEqual(store.writes.length, 1);
			});
		});
	});
});

/* ────────────────────────────────────────────────────────────────────────────
 * injectFromCache — the read, with an empty registry
 * ──────────────────────────────────────────────────────────────────────────── */

/** A constructed stylesheet, as `replaceSync` sees it. */
class FakeSheet {
	text = "";
	replaceSync(css: string): void {
		this.text = css;
	}
}

interface FakeStyleEl {
	id: string;
	textContent: string;
	isConnected: boolean;
}

interface Recorder {
	registry: CalloutRegistry;
	injector: CSSInjector;
	/** Text writes that reached the `<style>` element, in order. */
	writes: string[];
	/** Every `workspace.trigger` name, in order. */
	triggers: string[];
	/** How many times the icon repaint walked the open leaves. */
	leafWalks: number;
	/** Whether a `<style>` element was ever created at all. */
	created: () => boolean;
	/** The adopted sheet, when the document supports one. */
	sheet: () => FakeSheet | undefined;
	store: FakeStorage;
	restore: () => void;
}

/**
 * The smallest world `injectFromCache()` touches.
 *
 * `adopted` chooses between the two style targets the injector keeps in step:
 * with it off, `ensureStyleSheet` takes its early return and the `<style>`
 * element (the one Obsidian's PDF export actually reads) is the single
 * observable target; with it on, both are.
 */
function harness(opts: { cached?: string; adopted?: boolean } = {}): Recorder {
	const writes: string[] = [];
	const triggers: string[] = [];
	const store = storage();
	let leafWalks = 0;
	let created = false;

	const styleEl: FakeStyleEl = {
		id: "",
		isConnected: true,
		get textContent() {
			return writes.at(-1) ?? "";
		},
		set textContent(value: string) {
			writes.push(value);
		},
	};

	let attached = false;
	const doc: Record<string, unknown> = {
		head: {
			appendChild(el: FakeStyleEl) {
				attached = true;
				el.isConnected = true;
			},
		},
		getElementById: (id: string) =>
			attached && id === styleEl.id ? styleEl : null,
		querySelectorAll: () => [],
		body: { classList: { contains: () => false } },
	};
	if (opts.adopted) {
		doc.adoptedStyleSheets = [] as FakeSheet[];
		doc.defaultView = { CSSStyleSheet: FakeSheet };
	}

	const app = {
		appId: "test-vault",
		vault: { getName: () => "Test Vault" },
		workspace: {
			containerEl: { ownerDocument: doc },
			iterateAllLeaves: () => {
				leafWalks++;
			},
			trigger: (name: string) => triggers.push(name),
		},
	} as unknown as App;

	const g = globalThis as Record<string, unknown>;
	const saved = {
		activeDocument: g.activeDocument,
		createEl: g.createEl,
		HTMLStyleElement: g.HTMLStyleElement,
		window: g.window,
	};
	g.activeDocument = doc;
	g.createEl = (tag: string) => {
		assert.strictEqual(tag, "style");
		created = true;
		return styleEl;
	};
	g.HTMLStyleElement = class {} as unknown;
	g.window = windowFor(store);

	if (opts.cached !== undefined) {
		store.held.set(`test-vault-${CSS_KEY}`, opts.cached);
	}

	const registry = new CalloutRegistry();
	const injector = new CSSInjector(app, registry);

	return {
		registry,
		injector,
		writes,
		triggers,
		store,
		created: () => created,
		get leafWalks() {
			return leafWalks;
		},
		sheet: () => (doc.adoptedStyleSheets as FakeSheet[] | undefined)?.[0],
		restore() {
			Object.assign(g, saved);
		},
	};
}

function withHarness(
	opts: { cached?: string; adopted?: boolean },
	body: (h: Recorder) => void,
): void {
	const h = harness(opts);
	try {
		body(h);
	} finally {
		h.restore();
	}
}

describe("injectFromCache — the startup fast path", () => {
	it("installs the previous session's CSS into the <style> element", () =>
		withHarness({ cached: ".cached{}" }, (h) => {
			h.injector.injectFromCache();
			assert.deepStrictEqual(h.writes, [".cached{}"]);
		}));

	it("does it with an EMPTY registry — nothing here is generated", () =>
		withHarness({ cached: ".cached{}" }, (h) => {
			// `main.ts` calls this as the very first statement of onload, before
			// `loadData()` is awaited: the registry has not even been seeded with
			// the 13 built-ins yet. Text the injector could not possibly produce
			// is what proves the read is doing the work.
			assert.deepStrictEqual(h.registry.getAll(), []);
			h.injector.injectFromCache();

			assert.deepStrictEqual(h.writes, [".cached{}"]);
			assert.deepStrictEqual(h.registry.getAll(), [], "registry untouched");
		}));

	it("emits no css-change and paints no icons", () =>
		withHarness({ cached: ".cached{}" }, (h) => {
			// Both are the expensive half of a real inject: core answers
			// `css-change` by rebuilding EVERY open editor, and the icon repaint
			// walks every leaf. Neither is useful for CSS that is already a frame
			// old, and the workspace may not even be laid out yet.
			h.injector.injectFromCache();
			assert.deepStrictEqual(h.triggers, []);
			assert.strictEqual(h.leafWalks, 0);
		}));

	it("does not write the snapshot back", () =>
		withHarness({ cached: ".cached{}" }, (h) => {
			h.injector.injectFromCache();
			assert.deepStrictEqual(h.store.writes, []);
		}));

	it("does nothing at all — not even create the element — with no snapshot", () =>
		withHarness({}, (h) => {
			h.injector.injectFromCache();
			assert.strictEqual(h.created(), false);
			assert.deepStrictEqual(h.writes, []);
		}));

	it("treats an empty snapshot the same way", () =>
		withHarness({ cached: "" }, (h) => {
			h.injector.injectFromCache();
			assert.strictEqual(h.created(), false);
			assert.deepStrictEqual(h.writes, []);
		}));

	it("writes the adopted stylesheet too, when the document has one", () =>
		withHarness({ cached: ".cached{}", adopted: true }, (h) => {
			// The two targets exist for different readers — `adoptedStyleSheets`
			// for the screen, the `<style>` element for PDF export — and the
			// snapshot has to land in both or the fast path only half applies.
			h.injector.injectFromCache();
			assert.strictEqual(must(h.sheet(), "adopted sheet").text, ".cached{}");
			assert.deepStrictEqual(h.writes, [".cached{}"]);
		}));

	it("never leaves the injector believing the snapshot is the current CSS", () =>
		withHarness({}, (h) => {
			// The handoff has to happen even in the case that looks like a no-op:
			// a launch where nothing changed produces CSS byte-identical to the
			// snapshot, and `inject()`'s guard would skip it if the read had armed
			// `lastCssText`. The snapshot below IS the generated text, so nothing
			// but that guard could distinguish the two.
			h.registry.load(null);
			h.injector.inject();
			const generated = must(h.writes[0], "generated CSS");
			h.restore();

			withHarness({ cached: generated }, (fresh) => {
				fresh.injector.injectFromCache();
				fresh.registry.load(null);
				fresh.injector.inject();

				assert.deepStrictEqual(
					fresh.writes,
					[generated, generated],
					"the real inject must still write, byte-identical or not",
				);
				assert.strictEqual(fresh.triggers.length, 1, "and emit css-change once");
			});
		}));

	it("is replaced by the real CSS moments later", () =>
		withHarness({ cached: "/* last session */" }, (h) => {
			h.injector.injectFromCache();
			h.registry.load(null);
			h.injector.inject();

			assert.strictEqual(h.writes.length, 2);
			assert.ok(
				!must(h.writes[1], "live CSS").includes("/* last session */"),
				"the snapshot is replaced, never appended to",
			);
		}));
});
