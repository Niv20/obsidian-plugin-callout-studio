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
import { registerThemeAppearance } from "../src/manager/theme/themeAppearanceSync";
import { discovered, definition } from "./support/discoveryHarness";
import { installFakeDom } from "./support/fakeDom";

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
	const listeners: (() => void)[] = [];
	const app = {
		customCss,
		workspace: {
			on: (name_: string, cb: () => void) => {
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
		cssChange() {
			for (const cb of [...listeners]) cb();
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
