/**
 * tests/settingsRepaintGuards.test.ts — the two guards that decide whether the
 * callout lists repaint at all, and what a repaint is allowed to forget.
 *
 * Four subscriptions funnel into one coalesced repaint of the three lists, and
 * two of them are noisy: `css-change` fires for any theme, snippet or other
 * plugin in the vault, and `registry.onChange` fires on every sync round trip.
 * Each one used to tear all three lists down and rebuild them byte-identically,
 * above ten other sections and whoever was reading one of them.
 *
 * So `refresh` compares a signature first (`calloutListsSignature`) — and the
 * dangerous half of that is not the skipping, it is the *not* skipping. A
 * signature that changes when nothing did costs one repaint the scroll anchor
 * already hides. One that fails to change leaves a stale row on screen with
 * nothing to catch it, which is why the cases below lean on the fields a row
 * actually draws and on the two signals the signature cannot see at all.
 *
 * The second guard is the paging cursor, and it is a bug report rather than a
 * design goal: "it keeps jumping back to the top and re-collapsing the view more
 * callouts list". The cursor used to live in the controller closure, and a
 * controller lives exactly one `display()` — which re-runs for things nobody
 * asked for, `adoptExternalSettings` above all. Pressing **Load more** and then
 * scrolling was enough to lose it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { createCalloutListsController } from "../src/settings/sections/CalloutListsSection";
import { freshPaging } from "../src/settings/sections/calloutListsSignature";
import { LIST_PAGE_SIZE } from "../src/settings/sections/listPaging";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

function plainApp(): App {
	return {
		customCss: {
			theme: "",
			themes: {},
			styleEl: { textContent: "" },
			snippets: [],
			enabledSnippets: new Set<string>(),
			extraStyleEls: [],
		},
	} as unknown as App;
}

/** The slice of the settings context the three lists actually touch. */
function listsCtx(registry: CalloutRegistry, app: App) {
	registry.setThemeOwnedIds(new Set<string>());
	return {
		app,
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			app,
			registry,
			settingsWriter: { isFrozen: false },
			settings: registry.settings,
			localState: { isExpanded: () => true, setExpanded: () => {} },
			saveSettings: () => Promise.resolve(),
			refreshCallouts: () => {},
			refreshRenderModes: () => {},
			cssInjector: {
				themeCallouts: () => ({
					themeDefinedIds: () => new Set<string>(),
					patternClaims: () => [],
				}),
			},
		},
	} as never;
}

/** A vault with `count` callouts of the user's own. */
function vault(count: number): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	for (let i = 0; i < count; i += 1) {
		registry.add({
			id: `own-${String(i).padStart(3, "0")}`,
			displayName: `Own ${i}`,
			icon: { type: "lucide", value: "pencil" },
			colorLight: "#336699",
			colorDark: "#88bbee",
			foldable: false,
			defaultFolded: false,
			builtIn: false,
			source: "user",
		});
	}
	return registry;
}

/**
 * The **Load more** button, pressed.
 *
 * Found by walking the row rather than with a descendant selector, and clicked
 * with a bare object rather than a `MouseEvent`: this DOM supports neither (see
 * `fakeDom.ts`), and both are the idiom the sibling suites already use.
 */
function pressLoadMore(host: HTMLElement): boolean {
	const row = host.querySelector<HTMLElement>(".callout-studio-load-more");
	const button = row?.children[0];
	if (!(button instanceof HTMLElement)) return false;
	button.dispatchEvent({ type: "click" } as unknown as Event);
	return true;
}

/** A controller counting how many rows it has been asked to draw. */
function rig(registry: CalloutRegistry, paging = freshPaging()) {
	const host: HTMLElement = createDiv();
	let drawn = 0;
	const lists = createCalloutListsController(listsCtx(registry, plainApp()), {
		paging,
		onAddNewCallout: () => Promise.resolve(),
		renderRow: (el, def, kind) => {
			drawn += 1;
			// Marked for `rowIds` only in the user's own list: the built-in one
			// is drawn too, and counting all three would measure Obsidian's
			// thirteen alongside the page under test.
			if (kind !== "user") return;
			el.createEl("code", {
				cls: "callout-studio-row-syntax",
				text: def.id,
			});
		},
	});
	return {
		host,
		lists,
		paging,
		render: () => lists.render(host),
		/** Rows drawn across all three lists since the last call. */
		takeDrawn: () => {
			const total = drawn;
			drawn = 0;
			return total;
		},
		/** The ids currently on screen in "My callout types". */
		rowIds: () =>
			Array.from(
				host.querySelectorAll<HTMLElement>(".callout-studio-row-syntax"),
			).map((el) => el.textContent ?? ""),
	};
}

describe("a repaint that would draw the same thing is skipped", () => {
	it("draws nothing on a refresh that follows no change", () => {
		const r = rig(vault(3));
		r.render();
		assert.ok(r.takeDrawn() > 0, "the first render must draw");

		r.lists.refresh();
		assert.strictEqual(
			r.takeDrawn(),
			0,
			"nothing moved, so nothing may be torn down and rebuilt",
		);
	});

	it("redraws when a field a row actually draws has changed", () => {
		// The direction that matters. A row draws the display name, so a rename
		// the signature could not see would leave the old one on screen.
		const registry = vault(3);
		const r = rig(registry);
		r.render();
		r.takeDrawn();

		registry.update("own-000", { displayName: "Renamed" });
		r.lists.refresh();

		assert.ok(r.takeDrawn() > 0, "a renamed callout must repaint its row");
	});

	it("redraws when forced, even though nothing in the registry moved", () => {
		// This is how an icon finishing its download reaches the screen: the
		// artwork lives in a cache keyed by icon name, so the definition is
		// byte-identical before and after the bytes arrive. Without the force,
		// every row that came up on a spinner would spin for good.
		const r = rig(vault(3));
		r.render();
		r.takeDrawn();

		r.lists.refresh(true);
		assert.ok(
			r.takeDrawn() > 0,
			"a forced refresh must redraw whatever the signature thinks",
		);
	});
});

describe("the paging cursor outlives a repaint nobody asked for", () => {
	it("keeps an expanded list expanded when the tab is rebuilt", () => {
		// Report 2, exactly: press Load more, then have `display()` re-run
		// underneath you — which `adoptExternalSettings` does on every sync
		// round trip. A second controller over the *same* cursor is what a
		// rebuild is, and the rows must all still be there.
		const registry = vault(LIST_PAGE_SIZE + 6);
		const paging = freshPaging();

		const first = rig(registry, paging);
		first.render();
		assert.strictEqual(
			first.rowIds().length,
			LIST_PAGE_SIZE,
			"a fresh list shows one page",
		);

		assert.ok(
			pressLoadMore(first.host),
			"a list past one page offers Load more",
		);
		assert.strictEqual(
			first.rowIds().length,
			LIST_PAGE_SIZE + 6,
			"Load more reveals the rest",
		);

		const rebuilt = rig(registry, paging);
		rebuilt.render();
		assert.strictEqual(
			rebuilt.rowIds().length,
			LIST_PAGE_SIZE + 6,
			"a rebuild must not fold the list back to its first page",
		);
	});

	it("starts a genuinely new visit back on the first page", () => {
		// The other half, and the reason `hide()` calls `freshPaging()` rather
		// than nothing: the cursor is session-only and a reopen still resets it.
		const registry = vault(LIST_PAGE_SIZE + 6);

		const visit = rig(registry, freshPaging());
		visit.render();
		assert.ok(pressLoadMore(visit.host));
		assert.strictEqual(visit.rowIds().length, LIST_PAGE_SIZE + 6);

		const reopened = rig(registry, freshPaging());
		reopened.render();
		assert.strictEqual(
			reopened.rowIds().length,
			LIST_PAGE_SIZE,
			"a fresh cursor is a fresh page",
		);
	});
});
