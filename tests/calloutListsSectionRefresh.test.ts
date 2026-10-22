/**
 * tests/calloutListsSectionRefresh.test.ts — what the theme section re-reads
 * when it is refreshed rather than rebuilt.
 *
 * `SettingsTab` has two different repaints and they are not interchangeable.
 * `display()` empties the container and builds every section again; `refresh()`
 * — which is what the tab's `registry.onChange` and `css-change` listeners
 * reach, on a coalesced frame — calls `CalloutListsController.refresh`, which
 * only re-fills the three lists. Anything computed in `render()` and never
 * again therefore survives a theme change that changed it.
 *
 * The heading is exactly that: it names the active theme, so after a switch it
 * went on naming the outgoing one while the rows below it already showed the
 * incoming theme's — and the built-in list's empty state, which *does* re-read
 * the name, contradicted it on the same screen.
 *
 * The other half of the pair is that refreshing must not *duplicate* anything.
 * `renderAll` empties before it fills, so a second refresh has to leave the
 * list exactly as the first did; a regression there is invisible until a user
 * happens to switch theme twice.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	createCalloutListsController,
} from "../src/settings/sections/CalloutListsSection";
import { freshPaging } from "../src/settings/sections/calloutListsSignature";
import { installFakeDom } from "./support/fakeDom";
import { createdToggles } from "./support/obsidianStub";

installFakeDom();

/** An `App` whose active theme can be swapped between renders. */
function themeApp(name: string, css: string) {
	const customCss = {
		theme: name,
		themes: { [name]: { version: "1.0.0" } } as Record<
			string,
			{ version: string }
		>,
		styleEl: { textContent: css },
		snippets: [] as string[],
		enabledSnippets: new Set<string>(),
		extraStyleEls: [] as unknown[],
	};
	return {
		app: { customCss } as unknown as App,
		switchTo(next: string, nextCss: string) {
			customCss.theme = next;
			customCss.themes[next] = { version: "1.0.0" };
			customCss.styleEl.textContent = nextCss;
		},
	};
}

/** The slice of the settings context the three lists actually touch. */
function listsCtx(registry: CalloutRegistry, app: App, themeIds: string[]) {
	registry.setThemeOwnedIds(new Set(themeIds));
	return {
		app,
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			app,
			registry,
			settingsWriter: { isFrozen: false },
			settings: registry.settings,
			// The settings-list fold is per device now — see DeviceLocalStore.
			localState: {
				isExpanded: () => true,
				setExpanded: () => {},
			},
			saveSettings: () => Promise.resolve(),
			refreshCallouts: () => {},
			refreshRenderModes: () => {},
			cssInjector: {
				themeCallouts: () => ({
					themeDefinedIds: () => new Set(themeIds),
					patternClaims: () => [],
				}),
			},
		},
	} as never;
}

function vault(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

/** Every row the theme section is currently showing, by id. */
function themeRowIds(host: HTMLElement): string[] {
	return Array.from(
		host.querySelectorAll<HTMLElement>(".callout-studio-row-syntax"),
	).map((el) => el.textContent ?? "");
}

/**
 * The copy the theme section is carrying. It lives in its own paragraph next
 * to the heading now, not on the heading itself — see `.cs-theme-desc` in
 * CalloutListsSection.ts — so that a description naming the active theme can
 * scroll normally instead of staying pinned with the sticky heading above it.
 */
function headingDesc(host: HTMLElement): string {
	const el = host.querySelector<HTMLElement>(".cs-theme-desc");
	return el?.textContent ?? "";
}

describe("the theme heading follows the active theme across a refresh", () => {
	it("names the incoming theme, not the one it was built under", () => {
		const t = themeApp("Nord", '.callout[data-callout="note"] {}');
		const registry = vault();
		const ctx = listsCtx(registry, t.app, ["note"]);
		const host: HTMLElement = createDiv();
		const lists = createCalloutListsController(ctx, {
			paging: freshPaging(),
			onAddNewCallout: () => Promise.resolve(),
			renderRow: (el, def) => {
				el.createEl("code", {
					cls: "callout-studio-row-syntax",
					text: def.id,
				});
			},
		});

		lists.render(host);
		assert.ok(
			headingDesc(host).includes("Nord"),
			`built under Nord, got: ${headingDesc(host)}`,
		);

		t.switchTo("Sanctum", '.callout[data-callout="note"] {}');
		lists.refresh();

		assert.ok(
			headingDesc(host).includes("Sanctum"),
			`after the switch the heading must name Sanctum, got: ${headingDesc(host)}`,
		);
		assert.ok(
			!headingDesc(host).includes("Nord"),
			"and must not still name the outgoing theme",
		);
	});

	it("does not duplicate a row when refreshed twice", () => {
		// `renderAll` empties before it fills. A theme change fires more than
		// one repaint by design — the sweep's, then the probe's — so this has
		// to hold for the second one as much as the first.
		const t = themeApp("Nord", '.callout[data-callout="note"] {}');
		const registry = vault();
		const ctx = listsCtx(registry, t.app, ["note"]);
		const host: HTMLElement = createDiv();
		const lists = createCalloutListsController(ctx, {
			paging: freshPaging(),
			onAddNewCallout: () => Promise.resolve(),
			renderRow: (el, def, kind) => {
				if (kind !== "theme") return;
				el.createEl("code", {
					cls: "callout-studio-row-syntax",
					text: def.id,
				});
			},
		});

		lists.render(host);
		const once = themeRowIds(host);
		assert.deepStrictEqual(once, ["note"], "one row to begin with");

		// Forced, so the point of this case survives the signature guard added
		// later: `refresh` now skips a repaint that would draw the identical
		// thing, and what is under test here is what happens when it does NOT
		// skip — that `renderAll` empties before it fills.
		lists.refresh(true);
		lists.refresh(true);
		assert.deepStrictEqual(
			themeRowIds(host),
			once,
			"two refreshes leave exactly the rows one render did",
		);
	});
});

/** The theme section's wrapper — the element `cs-hidden` goes on. */
function themeSection(host: HTMLElement): HTMLElement {
	const el = host.querySelector<HTMLElement>(".cs-sticky-section");
	assert.ok(el, "the theme section is the first sticky section");
	return el;
}

/** A controller over `app` whose theme owns `themeIds`, rendered into a fresh host. */
function renderLists(app: App, registry: CalloutRegistry, themeIds: string[]) {
	const ctx = listsCtx(registry, app, themeIds);
	const host: HTMLElement = createDiv();
	const lists = createCalloutListsController(ctx, {
		paging: freshPaging(),
		onAddNewCallout: () => Promise.resolve(),
		renderRow: (el, def, kind) => {
			if (kind !== "theme") return;
			el.createEl("code", { cls: "callout-studio-row-syntax", text: def.id });
		},
	});
	createdToggles.length = 0;
	lists.render(host);
	return { host, lists };
}

describe("Use your theme's callout styles sits under the theme heading", () => {
	it("is the theme section's first row, above its callouts, and survives a refresh once", () => {
		const t = themeApp("Nord", '.callout[data-callout="note"] {}');
		const { host, lists } = renderLists(t.app, vault(), ["note"]);
		lists.refresh(true);
		lists.refresh(true);

		// Inside the body, so it folds with the section; the test's rows are
		// bare `<code>`s, so the body's one setting row is the switch.
		const body = themeSection(host).querySelector<HTMLElement>(".cs-section-body");
		assert.ok(body, "the theme section has a fold body");
		const switches = body.querySelectorAll(".setting-item");
		assert.equal(switches.length, 1, "one switch, however many repaints");
		assert.equal(body.firstElementChild, switches[0], "the body opens with it");
		assert.deepStrictEqual(themeRowIds(host), ["note"], "the rows follow it");
	});

	it("keeps the section on screen while off, so it can be turned back on", () => {
		const t = themeApp("Nord", '.callout[data-callout="note"] {}');
		const registry = vault();
		const { host, lists } = renderLists(t.app, registry, ["note"]);

		// Off, the theme names nothing: its rows leave the section.
		const toggle = createdToggles[0];
		assert.ok(toggle, "the switch is a toggle");
		void toggle.commit(false);
		assert.equal(registry.settings.themeCalloutStyles.enabled, false, "the press is saved");
		registry.setThemeOwnedIds(new Set());
		lists.refresh();

		assert.ok(!themeSection(host).classList.contains("cs-hidden"), "the section stays");
		assert.deepStrictEqual(themeRowIds(host), [], "with no rows in it");
		assert.ok(
			host.querySelector(".cs-theme-desc")?.classList.contains("cs-hidden"),
			"and without the sentence that describes rows",
		);

		// Back on with a theme that still names nothing: nothing left to show.
		void toggle.commit(true);
		lists.refresh();
		assert.ok(themeSection(host).classList.contains("cs-hidden"), "the empty section goes");
	});

	it("is not shown off in Obsidian's default theme, where it has nothing to take away", () => {
		const t = themeApp("", "");
		const registry = vault();
		registry.settings.themeCalloutStyles.enabled = false;
		const { host } = renderLists(t.app, registry, []);
		assert.ok(themeSection(host).classList.contains("cs-hidden"));
	});

	it("shows a value changed under the open tab", () => {
		const t = themeApp("Nord", '.callout[data-callout="note"] {}');
		const registry = vault();
		const { lists } = renderLists(t.app, registry, ["note"]);
		assert.equal(createdToggles[0]?.getValue(), true);

		// Another device's settings, or Reset — not a press on this toggle.
		registry.settings.themeCalloutStyles.enabled = false;
		lists.refresh();
		assert.equal(createdToggles[0]?.getValue(), false);
	});
});
