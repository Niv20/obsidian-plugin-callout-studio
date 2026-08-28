/**
 * tests/themeRowSync.test.ts — what happens, and in what order, when the
 * active styling changes.
 *
 * `themeProvidedRows.test.ts` pins the sweep as a function: given a registry
 * and a store, which rows exist afterwards. This pins the half around it —
 * `registerThemeRowSync` — where the failures are all about *timing* rather
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
 * The probe inside `registerThemeRowSync` reads real computed styles, which no
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
import { registerThemeRowSync } from "../src/manager/theme/themeRowSync";
import { UNKNOWN_APPEARANCE } from "../src/manager/theme/themeAppearance";
import type { ThemeAppearance } from "../src/manager/theme/themeAppearance";
import type { CalloutDefinition } from "../src/types";
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

/** The plugin slice `registerThemeRowSync` reaches for, plus what it did. */
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
	return { host: host as never, injects, disposers };
}

function vault(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

const themeIds = (registry: CalloutRegistry): string[] =>
	registry
		.getAll()
		.filter((d: CalloutDefinition) => d.source === "theme")
		.map((d: CalloutDefinition) => d.id)
		.sort();

describe("a theme change does not leave the outgoing theme's artwork published", () => {
	it("has cleared the readings by the time the sweep's onChange fires", () => {
		const vaultCss = '.callout[data-callout="recite"] { color: red; }';
		const t = themeHost(vaultCss);
		const registry = vault();
		const { host } = syncHost(registry, t.app);
		registerThemeRowSync(host);

		// Stand in for the probe having landed under the outgoing theme: every
		// row is carrying real measured artwork before the switch.
		const measured: ThemeAppearance = {
			accent: "rgb(1, 2, 3)",
			background: "rgb(4, 5, 6)",
			icon: { kind: "mask", image: "url(outgoing)" },
		};
		registry.setThemeAppearances(new Map([["recite", measured]]));
		assert.strictEqual(
			registry.themeAppearanceOf(registry.get("recite")!).icon.kind,
			"mask",
			"precondition: the outgoing theme's reading is published",
		);

		// What the settings tab sees, at the instant it is told to repaint.
		const seen: string[] = [];
		registry.onChange(() => {
			const row = registry.get("recite");
			seen.push(row ? registry.themeAppearanceOf(row).icon.kind : "gone");
		});

		t.setTheme({
			name: "Sanctum",
			css: '.callout[data-callout="recite"] { color: blue; }',
		});
		t.cssChange();

		assert.ok(seen.length > 0, "the tab is told to repaint at all");
		assert.deepStrictEqual(
			[...new Set(seen)],
			["unknown"],
			"no repaint may see the outgoing theme's icon",
		);
	});

	it("collapses the clear and the sweep into one repaint", () => {
		// The clear rides in the sweep's own `batch()`, so it must not cost an
		// extra pass over every row in the tab.
		const t = themeHost('.callout[data-callout="recite"] { color: red; }');
		const registry = vault();
		const { host } = syncHost(registry, t.app);
		registerThemeRowSync(host);
		registry.setThemeAppearances(
			new Map([["recite", { ...UNKNOWN_APPEARANCE, accent: "rgb(1, 2, 3)" }]]),
		);

		let repaints = 0;
		registry.onChange(() => {
			repaints++;
		});
		t.setTheme({ name: "Sanctum", css: '.callout[data-callout="quiet"] {}' });
		t.cssChange();
		assert.strictEqual(repaints, 1, "one onChange for the whole sweep");
	});

	it("says nothing when the styling did not actually move", () => {
		const css = '.callout[data-callout="recite"] { color: red; }';
		const t = themeHost(css);
		const registry = vault();
		const { host } = syncHost(registry, t.app);
		registerThemeRowSync(host);

		let repaints = 0;
		registry.onChange(() => {
			repaints++;
		});
		t.cssChange();
		assert.strictEqual(repaints, 0, "a no-op css-change must stay silent");
	});
});

describe("a reload is a change even when the name and version are not", () => {
	it("re-scans a theme edited in place", () => {
		// `stylingSignature` is name@version|snippets, and a user who edits
		// their theme and hits reload moves none of the three. Before the CSS
		// length joined the memo, the new id never got a row however many
		// `css-change` events went by.
		const t = themeHost('.callout[data-callout="recite"] { color: red; }');
		const registry = vault();
		const { host } = syncHost(registry, t.app);
		registerThemeRowSync(host);
		assert.deepStrictEqual(themeIds(registry), ["recite"]);

		t.setTheme({
			css: '.callout[data-callout="recite"] {} .callout[data-callout="chant"] {}',
		});
		t.cssChange();

		assert.deepStrictEqual(
			themeIds(registry),
			["chant", "recite"],
			"the id added by the reload has a row",
		);
	});

	it("keeps an id both the outgoing and incoming theme declare", () => {
		// Not deleted and re-minted in the middle of a switch: an id in neither
		// the stale list nor the fresh one is simply left alone.
		const t = themeHost('.callout[data-callout="recite"] { color: red; }');
		const registry = vault();
		const { host } = syncHost(registry, t.app);
		registerThemeRowSync(host);
		const before = registry.get("recite");
		assert.ok(before);

		t.setTheme({
			name: "Sanctum",
			css: '.callout[data-callout="recite"] {} .callout[data-callout="chant"] {}',
		});
		t.cssChange();

		assert.strictEqual(
			registry.get("recite"),
			before,
			"the same row object, never removed and re-added",
		);
		assert.deepStrictEqual(themeIds(registry), ["chant", "recite"]);
	});

	it("registers exactly one css-change listener, however many sweeps run", () => {
		const t = themeHost('.callout[data-callout="recite"] {}');
		const registry = vault();
		const { host } = syncHost(registry, t.app);
		registerThemeRowSync(host);
		t.setTheme({ name: "Sanctum", css: '.callout[data-callout="chant"] {}' });
		t.cssChange();
		t.cssChange();
		assert.strictEqual(t.listenerCount(), 1, "no listener may be added twice");
	});
});
