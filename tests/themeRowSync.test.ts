/**
 * tests/themeRowSync.test.ts — what happens, and in what order, when the
 * active styling changes.
 *
 * `themeOverlayRows.test.ts` pins the sweep as a function: given a registry
 * and a set of declared ids, which rows exist afterwards. This pins the half
 * around it —
 * `registerThemeAppearance` — where the failures are all about *timing* rather
 * than about the result, and so are invisible to a test that only inspects the
 * end state:
 *
 * - the settings tab repaints on the sweep's own `onChange`, one turn before
 *   the probe's readings can land, so anything still published at that instant
 *   is what the reader sees. Publishing the outgoing theme's artwork there is
 *   the "stuck on the last theme" bug, and it looks perfectly correct once the
 *   probe finally lands.
 * - the memo that decides whether to sweep at all keys on the theme's *name*
 *   and *version*, neither of which moves when a theme is reloaded after being
 *   edited in place.
 *
 * The probe inside `registerThemeAppearance` reads real computed styles, which no
 * fake DOM supplies — and does not have to here, because the `obsidian` stub's
 * `MarkdownRenderer.render` produces no DOM, so a measured pass legitimately
 * finds nothing and reports an empty map. What that leaves visible is exactly
 * this file's subject: the scheduling.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { ThemeCalloutStore } from "../src/manager/theme/ThemeCalloutStore";
import { registerThemeAppearance, watchPageClasses } from "../src/manager/theme/themeAppearanceSync";
import type { ClaimCheckRequest } from "../src/manager/theme/ThemeClaimCheck";
import { OWN_CSS_CHANGE } from "../src/manager/ownCssChange";
import { discovered, definition } from "./support/discoveryHarness";
import { installFakeDom } from "./support/fakeDom";
import { manualClock } from "./support/manualClock";
import type { ThemeAppearance } from "../src/manager/theme/themeAppearance";

installFakeDom();

/** A mutable `customCss` so a test can switch or reload the theme in place. */
function themeHost(css: string, name = "Nord", version = "1.0.0") {
	const customCss = {
		theme: name,
		themes: { [name]: { version } } as Record<string, { version: string }>,
		styleEl: { textContent: css },
		snippets: [] as string[],
		enabledSnippets: new Set<string>(),
		extraStyleEls: [] as unknown[],
	};
	const listeners: ((data?: unknown) => void)[] = [];
	const app = {
		customCss,
		workspace: {
			containerEl: document.body,
			on: (name_: string, cb: (data?: unknown) => void) => {
				if (name_ === "css-change") listeners.push(cb);
				return { name: name_ } as never;
			},
		},
	} as unknown as App;
	return {
		app,
		setSnippet(css: string) {
			customCss.snippets = ["custom"];
			customCss.enabledSnippets = new Set(["custom"]);
			customCss.extraStyleEls = [{ textContent: css }];
		},
		/** Point the vault at a different theme, or the same one re-read. */
		setTheme(next: { css: string; name?: string; version?: string }) {
			if (next.name !== undefined) customCss.theme = next.name;
			const key = customCss.theme;
			customCss.themes[key] = { version: next.version ?? version };
			customCss.styleEl.textContent = next.css;
		},
		/** Fire what Obsidian fires for a theme switch, toggle or reload. */
		cssChange(data?: unknown) {
			for (const cb of [...listeners]) cb(data);
		},
		listenerCount: () => listeners.length,
	};
}

/** The plugin slice `registerThemeAppearance` reaches for, plus what it did. */
function syncHost(registry: CalloutRegistry, app: App) {
	const store = new ThemeCalloutStore(app);
	const injects: boolean[] = [];
	const disposers: (() => void)[] = [];
	const host = {
		app,
		registry,
		// The retirement list is per device now — see manager/DeviceLocalStore.
		localState: { retiredThemeIds: [] as string[] },
		cssInjector: {
			themeCallouts: () => store,
			inject: (emit?: boolean) => injects.push(emit !== false),
		},
		registerEvent: () => {},
		register: (cb: () => void) => disposers.push(cb),
	};
	return { host: host as never, injects, disposers, store };
}

function vault(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

describe("theme appearance updates never persist anything", () => {
 it("refreshes claims when an enabled snippet is edited without a name or length change", () => {
  const t = themeHost("");
  t.setSnippet('.callout[data-callout="probe"] { color:tan; }');
  const registry = vault(); const { host, store, disposers } = syncHost(registry, t.app);
  registerThemeAppearance(host);
  assert.ok(store.claimedProps("probe").has("color"));
  t.setSnippet('.callout[data-callout="probe"] { width:1px; }'); t.cssChange();
  assert.ok(store.claimedProps("probe").has("width"));
  assert.ok(!store.claimedProps("probe").has("color"));
  assert.ok(!store.themeDefinedIds().has("probe"));
  assert.strictEqual(registry.get("probe"), undefined);
  for (const dispose of disposers) dispose();
 });
 it("mints an overlay row for a theme id without persisting it", () => {
  const t = themeHost('.callout[data-callout="recite"] { color: red; }');
  const registry = vault(); const saved = registry.toSaveData();
  const { host } = syncHost(registry, t.app);
  registerThemeAppearance(host);
  const row = registry.get("recite");
  assert.ok(row, "the theme's own type is listed without a scan");
  assert.strictEqual(row.source, "theme");
  assert.strictEqual(registry.themeOwns(row), true);
  assert.deepStrictEqual(registry.toSaveData(), saved, "data.json did not move");
 });
 it("leaves an existing row's source alone when the theme declares its id", () => {
  const t = themeHost('.callout[data-callout="recite"] { color: red; }');
  const registry = vault(); registry.add(discovered("recite"));
  const saved = registry.toSaveData();
  const { host } = syncHost(registry, t.app);
  const refresh = registerThemeAppearance(host); refresh();
  assert.strictEqual(registry.get("recite")?.source, "fallback");
  assert.strictEqual(registry.themeOwns(registry.get("recite")!), true);
  assert.deepStrictEqual(registry.toSaveData(), saved);
 });
 it("retires only the rows it minted when the theme lets go", () => {
  const t = themeHost('.callout[data-callout="recite"] { color: red; }');
  const registry = vault(); const { host } = syncHost(registry, t.app);
  registerThemeAppearance(host);
  assert.strictEqual(registry.get("recite")?.source, "theme");
  const saved = registry.toSaveData();
  t.setTheme({ css: "" }); t.cssChange();
  assert.strictEqual(registry.get("recite"), undefined, "the overlay went with the theme");
  assert.deepStrictEqual(registry.toSaveData(), saved, "data.json did not move");
 });
 it("preserves saved rows when a theme stops defining them", () => {
  const t = themeHost('.callout[data-callout="recite"] { color: red; }');
  const registry = vault(); registry.add(discovered("recite"));
  const saved = registry.toSaveData(); const { host } = syncHost(registry, t.app);
  registerThemeAppearance(host); t.setTheme({ css: "" }); t.cssChange();
  assert.ok(registry.get("recite")); assert.strictEqual(registry.themeOwns(registry.get("recite")!), false);
  assert.deepStrictEqual(registry.toSaveData(), saved);
 });
 it("recognizes a theme edited in place even when its length is unchanged", () => {
  const t = themeHost('.callout[data-callout="alpha"] { color: red; }');
  const registry = vault(); registry.add(discovered("alpha")); registry.add(discovered("bravo"));
  const { host } = syncHost(registry, t.app); registerThemeAppearance(host);
  t.setTheme({ css: '.callout[data-callout="bravo"] { color: red; }' }); t.cssChange();
  assert.strictEqual(registry.themeOwns(registry.get("alpha")!), false);
  assert.strictEqual(registry.themeOwns(registry.get("bravo")!), true);
 });
});


describe("theme rows after transient editors and removals", () => {
	it("restores a theme row when a new-callout draft closes, even with fallback disabled", () => {
		const t = themeHost("");
		const registry = vault();
		registry.settings.fallbackCalloutId = "";
		const { host, disposers } = syncHost(registry, t.app);
		registerThemeAppearance(host);
		registry.setPreviewDefinition(definition({ id: "recite" }));
		t.setTheme({ css: '.callout[data-callout="recite"] { color: red; }' });
		t.cssChange();
		registry.setPreviewDefinition(null);
		assert.strictEqual(registry.get("recite")?.source, "theme");
		assert.ok(!registry.toSaveData().callouts.some(row => row.id === "recite"));
		for (const dispose of disposers) dispose();
	});

	it("reconciles a removed saved row without requiring a different theme stylesheet", () => {
		const t = themeHost('.callout[data-callout="recite"] { color: red; }');
		const registry = vault();
		registry.add(discovered("recite"));
		const { host, disposers } = syncHost(registry, t.app);
		registerThemeAppearance(host);
		registry.remove("recite");
		t.cssChange();
		assert.strictEqual(registry.get("recite")?.source, "theme");
		for (const dispose of disposers) dispose();
	});
});

/** A claim check that only counts how often it was asked, and for what. */
function countingClaims() {
	const asked: string[][] = [];
	return {
		asked,
		invalidate: () => {},
		pageRootOff: () => new Set<string>(),
		unstyled: () => new Set<string>(),
		hasUnmeasured: (ids: Iterable<string>) => [...ids].some((id) => !asked.some((a) => a.includes(id))),
		check: (request: ClaimCheckRequest) => {
			asked.push([...request.ids]);
			return Promise.resolve();
		},
		destroy: () => {},
	};
}

describe("a page class that moves without a css-change", () => {
	// Obsidian moves `is-focused` and `is-fullscreen` on <body> by itself and a
	// plugin may set a class of its own, with no event. A theme rule behind
	// `body.some-class` is claimed only while the class is on.
	function start() {
		const t = themeHost('body.opt .callout[data-callout="note"] { color: red; }');
		const registry = vault();
		const { host, disposers } = syncHost(registry, t.app);
		let off = new Set<string>(["note"]);
		const claims = { ...countingClaims(), pageRootOff: () => new Set(off) };
		let pageChanged = (): void => {};
		let watching = 0;
		const clock = manualClock();
		registerThemeAppearance(host, {
			claims,
			schedule: clock.schedule,
			watchPage: (onChange) => {
				pageChanged = onChange;
				watching++;
				return () => watching--;
			},
		});
		return {
			registry,
			claims,
			clock,
			disposers,
			setOff: (ids: string[]) => {
				off = new Set(ids);
			},
			pageChanged: () => pageChanged(),
			watching: () => watching,
		};
	}

	it("hands a callout to the theme when the class arrives, and back when it goes", () => {
		const s = start();
		const note = (): boolean => s.registry.themeOwns(s.registry.get("note")!);
		assert.strictEqual(note(), false, "the option is off");
		s.setOff([]);
		s.pageChanged();
		assert.strictEqual(note(), true, "the class arrived");
		s.setOff(["note"]);
		s.pageChanged();
		assert.strictEqual(note(), false, "and went");
	});

	it("does nothing for a class change no theme condition depends on", () => {
		const s = start();
		s.clock.advance(1000);
		const asked = s.claims.asked.length;
		s.pageChanged();
		s.clock.advance(1000);
		assert.strictEqual(s.claims.asked.length, asked);
	});

	it("watches only the class attribute of <body> and <html>", () => {
		const observed: Array<[unknown, unknown]> = [];
		let disconnected = 0;
		let fire = (): void => {};
		class Observer {
			constructor(cb: () => void) {
				fire = cb;
			}
			observe(el: unknown, init: unknown): void {
				observed.push([el, init]);
			}
			disconnect(): void {
				disconnected++;
			}
		}
		const doc = { defaultView: { MutationObserver: Observer }, body: "BODY", documentElement: "HTML" };
		let changes = 0;
		const stop = watchPageClasses(doc as unknown as Document, () => changes++);
		assert.deepStrictEqual(observed, [
			["HTML", { attributes: true, attributeFilter: ["class"] }],
			["BODY", { attributes: true, attributeFilter: ["class"] }],
		]);
		fire();
		assert.strictEqual(changes, 1);
		stop();
		assert.strictEqual(disconnected, 1);
	});

	it("stops watching when the plugin unloads", () => {
		const s = start();
		assert.strictEqual(s.watching(), 1);
		for (const dispose of s.disposers) dispose();
		assert.strictEqual(s.watching(), 0);
	});
});

describe("the claim check across a burst of css-change", () => {
	/** A theme that names a built-in, so there is something to measure. */
	const CSS = '.callout[data-callout="note"] { color: red; }';

	function start() {
		const t = themeHost(CSS);
		const registry = vault();
		const { host, disposers } = syncHost(registry, t.app);
		const claims = countingClaims();
		const clock = manualClock();
		registerThemeAppearance(host, { claims, schedule: clock.schedule });
		return { t, claims, clock, disposers };
	}

	it("measures the built-ins the theme names, at startup", () => {
		const { claims } = start();
		assert.deepStrictEqual(claims.asked, [["note"]]);
	});

	it("measures the first step of a drag at once and the rest once, when it goes quiet", () => {
		const { t, claims, clock } = start();
		clock.advance(1000);
		const before = claims.asked.length;
		for (let i = 0; i < 30; i++) {
			t.cssChange({ source: "style-settings" });
			clock.advance(40);
		}
		assert.strictEqual(claims.asked.length, before + 1, "30 steps, one pass so far");
		clock.advance(250);
		assert.strictEqual(claims.asked.length, before + 2, "and one more when the drag stopped");
	});

	it("measures a different theme at once, even inside a burst", () => {
		const { t, claims, clock } = start();
		clock.advance(1000);
		t.cssChange();
		t.cssChange();
		const before = claims.asked.length;
		t.setTheme({ css: '.callout[data-callout="tip"] { color: red; }', name: "Other" });
		t.cssChange();
		assert.strictEqual(claims.asked.length, before + 1);
		assert.deepStrictEqual(claims.asked[claims.asked.length - 1], ["tip"]);
		clock.advance(10_000);
		assert.strictEqual(claims.asked.length, before + 1, "and nothing was left owing");
	});

	it("starts no pass for this plugin's own css-change", () => {
		const { t, claims, clock } = start();
		clock.advance(1000);
		const before = claims.asked.length;
		t.cssChange(OWN_CSS_CHANGE);
		t.cssChange(OWN_CSS_CHANGE);
		clock.advance(10_000);
		assert.strictEqual(claims.asked.length, before);
	});

	it("measures a name that arrived since the last pass, on this plugin's own css-change", () => {
		// The user makes the theme's `mine` a callout of their own (or imports
		// one, or another plugin adds one): it carries a design now, and until
		// a pass asks, it would count as the theme's.
		const t = themeHost('.callout[data-callout="note"], .callout[data-callout="mine"] { color: red; }');
		const registry = vault();
		const { host } = syncHost(registry, t.app);
		const claims = countingClaims();
		const clock = manualClock();
		registerThemeAppearance(host, { claims, schedule: clock.schedule });
		assert.deepStrictEqual(claims.asked, [["note"]], "a theme row carries no design of its own");
		clock.advance(1000);
		registry.batch(() => {
			registry.remove("mine");
			registry.add(definition({ id: "mine", source: "user" }));
		});
		t.cssChange(OWN_CSS_CHANGE);
		assert.deepStrictEqual([...(claims.asked[claims.asked.length - 1] ?? [])].sort(), ["mine", "note"]);
		const before = claims.asked.length;
		t.cssChange(OWN_CSS_CHANGE);
		clock.advance(10_000);
		assert.strictEqual(claims.asked.length, before, "and asks once, not at every css-change");
	});

	it("leaves nothing armed once the plugin unloads", () => {
		const { t, claims, clock, disposers } = start();
		t.cssChange();
		t.cssChange();
		for (const dispose of disposers) dispose();
		const before = claims.asked.length;
		clock.advance(10_000);
		assert.strictEqual(claims.asked.length, before);
		assert.strictEqual(clock.pending(), 0);
	});
});

/**
 * A probe that records what it is asked, and answers from `results` at once.
 * `invalidate` is logged with the one option that matters, so a test can say
 * which of the two kinds of event it was told about.
 */
function recordingProbe(results = new Map<string, ThemeAppearance>()) {
	const log: string[] = [];
	return {
		log,
		results: () => results,
		set(next: Map<string, ThemeAppearance>) {
			results = next;
		},
		invalidate: (options?: { keepAnswers?: boolean }) => {
			log.push(options?.keepAnswers ? "invalidate(keep)" : "invalidate");
		},
		ensure: (_ids: readonly string[], onReady: () => void) => {
			log.push("ensure");
			onReady();
			return Promise.resolve();
		},
		destroy: () => {},
	};
}

describe("what a css-change re-reads, and how often", () => {
	const CSS = '.callout[data-callout="note"] { color: red; }';
	const reading = (accent: string): Map<string, ThemeAppearance> =>
		new Map([["note", { accent, background: null, icon: { kind: "unknown" } }]]);

	function start(results = new Map<string, ThemeAppearance>()) {
		const t = themeHost(CSS);
		const registry = vault();
		const published: Array<ReadonlyMap<string, ThemeAppearance>> = [];
		const publish = registry.setThemeAppearances.bind(registry);
		registry.setThemeAppearances = (map) => {
			published.push(map);
			return publish(map);
		};
		const { host, injects, disposers } = syncHost(registry, t.app);
		const probe = recordingProbe(results);
		const claims = countingClaims();
		const clock = manualClock();
		registerThemeAppearance(host, { appearance: probe, claims, schedule: clock.schedule });
		clock.advance(1000);
		probe.log.length = 0;
		published.length = 0;
		injects.length = 0;
		return { t, probe, claims, clock, published, injects, disposers };
	}

	it("reads once at startup, with nothing to invalidate", () => {
		const t = themeHost(CSS);
		const { host } = syncHost(vault(), t.app);
		const probe = recordingProbe();
		registerThemeAppearance(host, { appearance: probe, claims: countingClaims(), schedule: manualClock().schedule });
		assert.deepStrictEqual(probe.log, ["ensure"]);
	});

	it("keeps the readings across a nudge and reads again at once", () => {
		const { t, probe, published } = start(reading("red"));
		t.cssChange();
		assert.deepStrictEqual(probe.log, ["invalidate(keep)", "ensure"]);
		assert.ok(
			published.every((map) => map.size > 0),
			"nothing was published as empty in between",
		);
	});

	it("drops the readings and clears the registry's when the theme text moved", () => {
		const { t, probe, published } = start(reading("red"));
		t.setTheme({ css: '.callout[data-callout="note"] { color: blue; }' });
		t.cssChange();
		assert.deepStrictEqual(probe.log, ["invalidate", "ensure"]);
		assert.strictEqual(published[0]?.size, 0, "the outgoing theme's readings are cleared first");
	});

	it("folds a drag of nudges into one more read, when it goes quiet", () => {
		const { t, probe, clock } = start(reading("red"));
		for (let i = 0; i < 30; i++) {
			t.cssChange({ source: "style-settings" });
			clock.advance(40);
		}
		assert.strictEqual(probe.log.filter((l) => l === "ensure").length, 1, "the first step read at once, the rest are owed");
		assert.ok(!probe.log.includes("invalidate"), "never the dropping kind");
		clock.advance(250);
		assert.strictEqual(probe.log.filter((l) => l === "ensure").length, 2);
		assert.strictEqual(probe.log[probe.log.length - 2], "invalidate(keep)", "applied when the read runs");
	});

	it("does not discard a read in flight for a step that is folded away", () => {
		const { t, probe, clock } = start();
		t.cssChange();
		const applied = probe.log.filter((l) => l === "invalidate(keep)").length;
		t.cssChange();
		t.cssChange();
		assert.strictEqual(
			probe.log.filter((l) => l === "invalidate(keep)").length,
			applied,
			"a folded step leaves the probe alone until the read it is folded into",
		);
		clock.advance(250);
		assert.strictEqual(probe.log.filter((l) => l === "invalidate(keep)").length, applied + 1);
	});

	it("reads at once for this plugin's own css-change, even inside a burst", () => {
		const { t, probe } = start();
		t.cssChange();
		t.cssChange();
		probe.log.length = 0;
		t.cssChange(OWN_CSS_CHANGE);
		assert.deepStrictEqual(probe.log, ["invalidate(keep)", "ensure"]);
	});

	it("announces readings only when they moved, and regenerates only for those", () => {
		const { t, probe, injects } = start(reading("red"));
		t.cssChange(); // the same readings come back
		assert.strictEqual(injects.length, 1, "the handler's own inject, and none for equal readings");
		injects.length = 0;
		probe.set(reading("blue"));
		t.cssChange({ source: "style-settings" }); // outside the quiet window? no - folded
		assert.strictEqual(injects.length, 1);
	});

	it("regenerates for readings that moved", () => {
		const { t, probe, injects, clock } = start(reading("red"));
		clock.advance(1000);
		probe.set(reading("blue"));
		t.cssChange({ source: "style-settings" });
		assert.strictEqual(injects.length, 2, "the handler's inject, and one for the new readings");
	});
});
