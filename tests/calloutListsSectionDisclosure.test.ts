/**
 * tests/calloutListsSectionDisclosure.test.ts — folding a section, and paging
 * one that runs long.
 *
 * Two behaviours meet on the same three headings and are easy to entangle, so
 * they are pinned together here:
 *
 * - each heading folds **only its own** list, and says so through
 *   `aria-expanded` as well as through the class the stylesheet reads;
 * - a list past `LIST_PAGE_SIZE` shows that many rows and a button for the
 *   rest, and the heading's "(N)" goes on naming the total either way — the
 *   count is how many the user *has*, never how many are on screen.
 *
 * A third block at the end guards the chevron's *layout* rather than its
 * behaviour — that it hangs in the gutter and leaves the title's x alone —
 * against the stylesheet, since the fake DOM has no layout engine to measure.
 *
 * The state of both lives in the controller's closure rather than the DOM,
 * which is what a repaint would otherwise throw away: `refresh()` is the path
 * a registry change and a theme switch both reach, and a list the user opened
 * must not fold itself back up under them.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { createCalloutListsController } from "../src/settings/sections/CalloutListsSection";
import { LIST_PAGE_SIZE } from "../src/settings/sections/listPaging";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

type Registry = CalloutRegistry;

function themeApp(themeIds: string[]) {
	const customCss = {
		theme: "Nord",
		themes: { Nord: { version: "1.0.0" } } as Record<
			string,
			{ version: string }
		>,
		styleEl: {
			textContent: themeIds
				.map((id) => `.callout[data-callout="${id}"] {}`)
				.join("\n"),
		},
		snippets: [] as string[],
		enabledSnippets: new Set<string>(),
		extraStyleEls: [] as unknown[],
	};
	return { customCss } as unknown as App;
}

/** The slice of the settings context the three lists actually touch. */
function listsCtx(registry: Registry, app: App, themeIds: string[]) {
	registry.setThemeOwnedIds(new Set(themeIds));
	return {
		app,
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			app,
			registry,
			settings: registry.settings,
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

function vault(): Registry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

function addUserCallout(registry: Registry, id: string): void {
	registry.add({
		id,
		displayName: id,
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	});
}

/** `count` custom callouts, named so they sort in a stable order. */
function addUserCallouts(registry: Registry, count: number): void {
	for (let i = 0; i < count; i++) {
		addUserCallout(registry, `custom-${String(i).padStart(2, "0")}`);
	}
}

function render(registry: Registry, app: App, themeIds: string[]) {
	const ctx = listsCtx(registry, app, themeIds);
	const host: HTMLElement = createDiv();
	const lists = createCalloutListsController(ctx, {
		onAddNewCallout: () => Promise.resolve(),
		renderRow: (el, def) => {
			el.createEl("code", {
				cls: "callout-studio-row-syntax",
				text: def.id,
			});
		},
	});
	lists.render(host);
	return { host, lists };
}

/* -------------------------------------------------------------------------- */
/* Reading a section back out of the DOM                                      */
/* -------------------------------------------------------------------------- */

type Section = {
	heading: HTMLElement;
	nameEl: HTMLElement;
	body: HTMLElement;
};

/** The section whose heading starts with `label`, by the parts under test. */
function section(host: HTMLElement, label: string): Section {
	const heading = Array.from(
		host.querySelectorAll<HTMLElement>(".setting-item"),
	).find((el) => (el.dataset.csName ?? "").startsWith(label));
	assert.ok(heading, `no heading starting with "${label}"`);
	const nameEl = heading.querySelector<HTMLElement>(".setting-item-name");
	assert.ok(nameEl, `"${label}" has no name element`);
	const bodyId = nameEl.getAttribute("aria-controls");
	assert.ok(bodyId, `"${label}" does not point at a body`);
	const body = host.querySelector<HTMLElement>(`#${bodyId}`);
	assert.ok(body, `"${label}" points at a body that is not there`);
	return { heading, nameEl, body };
}

const THEME = "Callouts from your theme";
const MINE = "My callout types";
const BUILT_IN = "Built-in callouts";

const expanded = (s: Section): boolean =>
	s.nameEl.getAttribute("aria-expanded") === "true";

const folded = (s: Section): boolean =>
	s.heading.hasClass("is-collapsed") && s.body.hasClass("is-collapsed");

const rowCount = (s: Section): number =>
	s.body.querySelectorAll(".callout-studio-row-syntax").length;

const headingText = (s: Section): string => s.heading.dataset.csName ?? "";

const loadMore = (s: Section): HTMLElement | null =>
	s.body.querySelector<HTMLElement>(".callout-studio-load-more button");

const click = (el: HTMLElement): void => {
	el.dispatchEvent({ type: "click" } as unknown as Event);
};

const press = (el: HTMLElement, key: string): void => {
	el.dispatchEvent({
		type: "keydown",
		key,
		preventDefault: () => {},
	} as unknown as Event);
};

/* -------------------------------------------------------------------------- */
/* Folding                                                                    */
/* -------------------------------------------------------------------------- */

describe("each list heading folds its own section", () => {
	it("starts expanded, with a chevron and the aria to match", () => {
		const registry = vault();
		addUserCallout(registry, "quiet");
		const { host } = render(registry, themeApp(["note"]), ["note"]);

		for (const label of [THEME, MINE, BUILT_IN]) {
			const s = section(host, label);
			assert.ok(
				s.nameEl.querySelector(".cs-disclosure-chevron"),
				`${label} has no chevron`,
			);
			assert.strictEqual(
				s.nameEl.getAttribute("role"),
				"button",
				`${label} is not announced as a control`,
			);
			assert.strictEqual(
				s.nameEl.getAttribute("tabindex"),
				"0",
				`${label} is not reachable by keyboard`,
			);
			assert.strictEqual(expanded(s), true, `${label} did not start open`);
			assert.strictEqual(folded(s), false, `${label} started folded`);
		}
	});

	it("folds only the section that was clicked", () => {
		const registry = vault();
		addUserCallout(registry, "quiet");
		const { host } = render(registry, themeApp(["note"]), ["note"]);

		click(section(host, MINE).nameEl);

		const mine = section(host, MINE);
		assert.strictEqual(expanded(mine), false);
		assert.strictEqual(folded(mine), true);

		for (const label of [THEME, BUILT_IN]) {
			const other = section(host, label);
			assert.strictEqual(
				expanded(other),
				true,
				`folding ${MINE} also folded ${label}`,
			);
			assert.strictEqual(folded(other), false);
		}
	});

	it("unfolds on a second click", () => {
		const registry = vault();
		const { host } = render(registry, themeApp([]), []);

		click(section(host, BUILT_IN).nameEl);
		assert.strictEqual(expanded(section(host, BUILT_IN)), false);

		click(section(host, BUILT_IN).nameEl);
		const s = section(host, BUILT_IN);
		assert.strictEqual(expanded(s), true);
		assert.strictEqual(folded(s), false);
	});

	it("answers Enter and Space, and nothing else", () => {
		const registry = vault();
		const { host } = render(registry, themeApp([]), []);

		press(section(host, BUILT_IN).nameEl, "Enter");
		assert.strictEqual(expanded(section(host, BUILT_IN)), false);

		press(section(host, BUILT_IN).nameEl, " ");
		assert.strictEqual(expanded(section(host, BUILT_IN)), true);

		press(section(host, BUILT_IN).nameEl, "a");
		assert.strictEqual(
			expanded(section(host, BUILT_IN)),
			true,
			"an ordinary key must not toggle the section",
		);
	});

	it("keeps the count in the heading while folded", () => {
		const registry = vault();
		addUserCallouts(registry, 3);
		const { host } = render(registry, themeApp([]), []);

		click(section(host, MINE).nameEl);
		assert.strictEqual(headingText(section(host, MINE)), `${MINE} (3)`);
	});

	it("survives a refresh with the fold and the count both intact", () => {
		const registry = vault();
		addUserCallouts(registry, 3);
		const { host, lists } = render(registry, themeApp([]), []);

		click(section(host, MINE).nameEl);
		addUserCallout(registry, "one-more");
		lists.refresh();

		const mine = section(host, MINE);
		assert.strictEqual(folded(mine), true, "the refresh reopened the fold");
		assert.strictEqual(expanded(mine), false);
		assert.strictEqual(headingText(mine), `${MINE} (4)`);
	});
});

/* -------------------------------------------------------------------------- */
/* Persisted fold state                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Unlike the paging cursor above, a fold is written through to
 * `settings.calloutListsExpanded` (`calloutListsFold.ts`) the moment the user
 * toggles it, so it survives past the controller's own closure — a
 * settings-tab reopen builds a brand new controller (`SettingsTab.display()`
 * does this on every visit) and a plugin reload builds a brand new registry.
 * Both are simulated below rather than asserted only against the in-memory
 * `PluginSettings` object, so a wiring mistake between the fold and the
 * settings it is supposed to read back from would show up here too.
 */
describe("a section's fold is remembered in settings", () => {
	it("defaults every section to expanded when nothing has been saved yet", () => {
		const registry = vault();
		assert.deepStrictEqual(registry.settings.calloutListsExpanded, {
			theme: true,
			user: true,
			builtin: true,
		});
	});

	it("defaults to expanded for an existing vault whose saved settings predate this field", () => {
		// A `data.json` from before this setting existed: `settings` is present
		// (an upgrading install, not a fresh one) but has no `calloutListsExpanded`
		// key at all — the exact shape `mergeSavedSettings` has to fall back on.
		const registry = new CalloutRegistry();
		registry.load({
			version: 3,
			callouts: [],
			settings: { language: "en", welcomeSeen: true },
		} as never);

		assert.deepStrictEqual(registry.settings.calloutListsExpanded, {
			theme: true,
			user: true,
			builtin: true,
		});

		const { host } = render(registry, themeApp([]), []);
		for (const label of [THEME, MINE, BUILT_IN]) {
			assert.strictEqual(
				expanded(section(host, label)),
				true,
				`${label} did not default to expanded for an upgrading install`,
			);
		}
	});

	it("saves each section's fold independently", () => {
		const registry = vault();
		const { host } = render(registry, themeApp([]), []);

		click(section(host, MINE).nameEl);
		assert.deepStrictEqual(registry.settings.calloutListsExpanded, {
			theme: true,
			user: false,
			builtin: true,
		});

		click(section(host, BUILT_IN).nameEl);
		assert.deepStrictEqual(registry.settings.calloutListsExpanded, {
			theme: true,
			user: false,
			builtin: false,
		});

		// Unfolding one leaves the other exactly where it was.
		click(section(host, MINE).nameEl);
		assert.deepStrictEqual(registry.settings.calloutListsExpanded, {
			theme: true,
			user: true,
			builtin: false,
		});
	});

	it("restores the fold when the settings tab is reopened", () => {
		const registry = vault();
		const app = themeApp([]);
		const { host: firstVisit } = render(registry, app, []);

		click(section(firstVisit, BUILT_IN).nameEl);
		assert.strictEqual(expanded(section(firstVisit, BUILT_IN)), false);

		// A reopen builds a brand new controller against the same registry —
		// exactly what SettingsTab.display() does on every visit.
		const { host: secondVisit } = render(registry, app, []);

		const builtIn = section(secondVisit, BUILT_IN);
		assert.strictEqual(
			expanded(builtIn),
			false,
			"reopening the settings tab forgot the fold",
		);
		assert.strictEqual(folded(builtIn), true);
		for (const label of [THEME, MINE]) {
			const other = section(secondVisit, label);
			assert.strictEqual(
				expanded(other),
				true,
				`reopening the tab folded ${label}, which was never touched`,
			);
		}
	});

	it("restores the fold after a plugin reload", () => {
		const registry = vault();
		const app = themeApp([]);
		const { host } = render(registry, app, []);

		click(section(host, BUILT_IN).nameEl);
		assert.strictEqual(expanded(section(host, BUILT_IN)), false);

		// A plugin reload is a brand new CalloutRegistry loading whatever the
		// last save wrote — not the same in-memory object at all.
		const reloaded = new CalloutRegistry();
		reloaded.load(registry.toSaveData());
		const { host: afterReload } = render(reloaded, app, []);

		const builtIn = section(afterReload, BUILT_IN);
		assert.strictEqual(
			expanded(builtIn),
			false,
			"the reloaded plugin forgot the fold",
		);
		assert.strictEqual(folded(builtIn), true);
		for (const label of [THEME, MINE]) {
			assert.strictEqual(expanded(section(afterReload, label)), true);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Paging                                                                     */
/* -------------------------------------------------------------------------- */

describe("a list past the page size shows the first page and a button", () => {
	it("shows every row and no button at exactly the page size", () => {
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE);
		const { host } = render(registry, themeApp([]), []);

		const mine = section(host, MINE);
		assert.strictEqual(rowCount(mine), LIST_PAGE_SIZE);
		assert.strictEqual(loadMore(mine), null, "nothing is hidden to load");
	});

	it("caps at the page size one row over, and says how many are hidden", () => {
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE + 1);
		const { host } = render(registry, themeApp([]), []);

		const mine = section(host, MINE);
		assert.strictEqual(rowCount(mine), LIST_PAGE_SIZE);
		assert.strictEqual(loadMore(mine)?.textContent, "Load more (1)");
	});

	it("reveals the rest in one press, and takes the button away", () => {
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE + 5);
		const { host } = render(registry, themeApp([]), []);

		const btn = loadMore(section(host, MINE));
		assert.strictEqual(btn?.textContent, "Load more (5)");
		click(btn);

		const mine = section(host, MINE);
		assert.strictEqual(rowCount(mine), LIST_PAGE_SIZE + 5);
		assert.strictEqual(
			loadMore(mine),
			null,
			"the button outlived the rows it was hiding",
		);
	});

	it("counts the total in the heading, not what is on screen", () => {
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE + 5);
		const { host } = render(registry, themeApp([]), []);

		const total = `${MINE} (${LIST_PAGE_SIZE + 5})`;
		assert.strictEqual(
			headingText(section(host, MINE)),
			total,
			"the capped list reported its visible rows",
		);

		click(loadMore(section(host, MINE)) as HTMLElement);
		assert.strictEqual(headingText(section(host, MINE)), total);
	});

	it("moves focus to the first row it just revealed", () => {
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE + 5);
		const { host } = render(registry, themeApp([]), []);

		click(loadMore(section(host, MINE)) as HTMLElement);

		const rows = section(host, MINE).body.querySelectorAll<HTMLElement>(
			".callout-studio-row-syntax",
		);
		const first = rows[LIST_PAGE_SIZE];
		assert.strictEqual(first?.getAttribute("tabindex"), "-1");
		assert.strictEqual(
			(first as unknown as { focusCount: number }).focusCount,
			1,
			"the press left focus on the vanished button",
		);
	});

	it("pages each section on its own cursor", () => {
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE + 5);
		// A theme claiming every built-in fills its section past the cap too.
		const themeIds = registry.getBuiltIn().map((def) => def.id);
		const { host } = render(registry, themeApp(themeIds), themeIds);

		click(loadMore(section(host, MINE)) as HTMLElement);

		assert.strictEqual(rowCount(section(host, MINE)), LIST_PAGE_SIZE + 5);
		assert.strictEqual(
			rowCount(section(host, THEME)),
			Math.min(LIST_PAGE_SIZE, themeIds.length),
			"loading one section's rest loaded another's",
		);
	});

	it("stays open across a fold, an unfold and a refresh", () => {
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE + 5);
		const { host, lists } = render(registry, themeApp([]), []);

		click(loadMore(section(host, MINE)) as HTMLElement);

		click(section(host, MINE).nameEl);
		click(section(host, MINE).nameEl);
		assert.strictEqual(
			rowCount(section(host, MINE)),
			LIST_PAGE_SIZE + 5,
			"folding and reopening put the list back behind the button",
		);

		lists.refresh();
		assert.strictEqual(rowCount(section(host, MINE)), LIST_PAGE_SIZE + 5);
		assert.strictEqual(loadMore(section(host, MINE)), null);
	});
});

/* -------------------------------------------------------------------------- */
/* The gutter                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The chevron must cost the title nothing: a heading that shifts right the day
 * a fold arrives reads as a regression, not a feature. `styles.css` buys that
 * by pulling the name line start-ward by exactly the chevron's footprint.
 *
 * The fake DOM has no layout engine, so what is checkable here is not the
 * pixel — that is measured in a browser against Obsidian's real `app.css` —
 * but the thing that would make the pixel wrong: an offset written as a number
 * instead of derived from the chevron it is supposed to cancel. One heading
 * tuned by hand is three headings that disagree at the next font-size change.
 */
describe("the fold chevron hangs in the gutter, not in the title", () => {
	const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");

	/** The declaration that does the offsetting, wherever it is written. */
	const offset = /margin-inline-start:\s*([^;]+);/g;

	it("offsets the heading by the chevron's own size and gap, and by nothing else", () => {
		const found = Array.from(css.matchAll(offset))
			.map((m) => (m[1] as string).replace(/\s+/g, " ").trim())
			.filter((v) => v.includes("--cs-disclosure"));

		assert.strictEqual(
			found.length,
			1,
			"there should be exactly one gutter offset — one per section is the bug",
		);
		assert.strictEqual(
			found[0],
			"calc( -1 * (var(--cs-disclosure-size) + var(--cs-disclosure-gap)) )",
			"the offset must be derived from the chevron's own two tokens",
		);
	});

	it("sizes the chevron from the same two tokens the offset is built from", () => {
		const rule = /\.cs-disclosure-chevron\s*\{([^}]*)\}/.exec(css);
		assert.ok(rule, "the chevron has no rule to size it");
		const body = rule[1] as string;

		for (const prop of ["inline-size", "block-size"]) {
			assert.match(
				body,
				new RegExp(`${prop}:\\s*var\\(--cs-disclosure-size\\)`),
				`the chevron's ${prop} is not the token the offset cancels`,
			);
		}
		assert.match(
			body,
			/flex:\s*0 0 auto/,
			"a chevron that may shrink is a chevron the offset no longer matches",
		);
	});

	it("gaps the title from the chevron with the token, not a loose number", () => {
		const rule =
			/\.cs-collapsible-heading \.setting-item-name\s*\{([^}]*)\}/.exec(css);
		assert.ok(rule, "the foldable heading has no layout rule");
		assert.match(
			rule[1] as string,
			/gap:\s*var\(--cs-disclosure-gap\)/,
			"the gap the offset accounts for is not the gap the heading uses",
		);
	});
});
