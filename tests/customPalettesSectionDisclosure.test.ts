/**
 * tests/customPalettesSectionDisclosure.test.ts — the Saved color palettes
 * heading folds and pages exactly like the three callout lists above it.
 *
 * `CustomPalettesSection.ts` is the fourth member of the fold/paging family
 * `sectionDisclosure.ts` and `listPaging.ts` provide — see
 * `calloutListsSectionDisclosure.test.ts` for the pattern this mirrors.
 * What is checked here is the family membership itself: the heading's "(N)"
 * always names the full list, the fold state round-trips through
 * `settings.calloutListsExpanded.palettes`, and a list past the page size
 * shows the first 20 and a Load more button that reveals the rest in one
 * press — while every existing palette action (new, edit, delete) keeps
 * working through the same closure.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { renderCustomPalettesSection } from "../src/settings/sections/CustomPalettesSection";
import { LIST_PAGE_SIZE } from "../src/settings/sections/listPaging";
import type { CustomPalette } from "../src/types";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

type Registry = CalloutRegistry;

function fakeApp(): App {
	return { workspace: { on: () => ({}), offref: () => {} } } as unknown as App;
}

/** The slice of the settings context the section actually touches. */
function paletteCtx(registry: Registry, app: App) {
	return {
		app,
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			app,
			registry,
			settings: registry.settings,
			saveSettings: () => Promise.resolve(),
		},
	} as never;
}

function vault(): Registry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

/** A minimally valid palette — only the fields `CustomPalette` requires. */
function makePalette(id: string): CustomPalette {
	return {
		id,
		name: id,
		colorLight: "#336699",
		colorDark: "#88bbee",
		bgColorLight: "#eef3f8",
		bgColorDark: "#1a2733",
		textColorLight: "#000000",
		textColorDark: "#ffffff",
	};
}

/** `count` palettes, named so they sort in a stable order. */
function addPalettes(registry: Registry, count: number): void {
	for (let i = 0; i < count; i++) {
		registry.settings.customPalettes.push(
			makePalette(`palette-${String(i).padStart(2, "0")}`),
		);
	}
}

function render(registry: Registry, app: App) {
	const ctx = paletteCtx(registry, app);
	const host: HTMLElement = createDiv();
	renderCustomPalettesSection(ctx, host);
	return host;
}

/* -------------------------------------------------------------------------- */
/* Reading the section back out of the DOM                                    */
/* -------------------------------------------------------------------------- */

type Section = {
	heading: HTMLElement;
	nameEl: HTMLElement;
	body: HTMLElement;
};

const HEADING = "Saved color palettes";

function section(host: HTMLElement): Section {
	const heading = Array.from(
		host.querySelectorAll<HTMLElement>(".setting-item"),
	).find((el) => (el.dataset.csName ?? "").startsWith(HEADING));
	assert.ok(heading, `no heading starting with "${HEADING}"`);
	const nameEl = heading.querySelector<HTMLElement>(".setting-item-name");
	assert.ok(nameEl, "the heading has no name element");
	const bodyId = nameEl.getAttribute("aria-controls");
	assert.ok(bodyId, "the heading does not point at a body");
	const body = host.querySelector<HTMLElement>(`#${bodyId}`);
	assert.ok(body, "the heading points at a body that is not there");
	return { heading, nameEl, body };
}

const expanded = (s: Section): boolean =>
	s.nameEl.getAttribute("aria-expanded") === "true";

const folded = (s: Section): boolean =>
	s.heading.hasClass("is-collapsed") && s.body.hasClass("is-collapsed");

const headingText = (s: Section): string => s.heading.dataset.csName ?? "";

const rowCount = (s: Section): number =>
	s.body.querySelectorAll(".cs-palette-list-row").length;

const loadMore = (s: Section): HTMLElement | null =>
	s.body.querySelector<HTMLElement>(".callout-studio-load-more button");

const click = (el: HTMLElement): void => {
	el.dispatchEvent({ type: "click" } as unknown as Event);
};

/* -------------------------------------------------------------------------- */
/* Folding                                                                    */
/* -------------------------------------------------------------------------- */

describe("the Saved color palettes heading folds like the callout lists", () => {
	it("starts expanded, with a chevron and the aria to match", () => {
		const registry = vault();
		addPalettes(registry, 3);
		const host = render(registry, fakeApp());

		const s = section(host);
		assert.ok(
			s.nameEl.querySelector(".cs-disclosure-chevron"),
			"no chevron on the palettes heading",
		);
		assert.strictEqual(s.nameEl.getAttribute("role"), "button");
		assert.strictEqual(s.nameEl.getAttribute("tabindex"), "0");
		assert.strictEqual(expanded(s), true);
		assert.strictEqual(folded(s), false);
	});

	it("folds on click and unfolds on a second click", () => {
		const registry = vault();
		addPalettes(registry, 3);
		const host = render(registry, fakeApp());

		click(section(host).nameEl);
		assert.strictEqual(expanded(section(host)), false);
		assert.strictEqual(folded(section(host)), true);

		click(section(host).nameEl);
		assert.strictEqual(expanded(section(host)), true);
		assert.strictEqual(folded(section(host)), false);
	});

	it("saves the fold to settings.calloutListsExpanded.palettes", () => {
		const registry = vault();
		const host = render(registry, fakeApp());

		assert.strictEqual(registry.settings.calloutListsExpanded.palettes, true);
		click(section(host).nameEl);
		assert.strictEqual(registry.settings.calloutListsExpanded.palettes, false);
	});

	it("restores the fold when the section is rebuilt against the same settings", () => {
		const registry = vault();
		const app = fakeApp();
		const first = render(registry, app);

		click(section(first).nameEl);
		assert.strictEqual(expanded(section(first)), false);

		// A settings-tab reopen builds the section fresh against the same
		// PluginSettings object — the exact thing that has to remember the fold.
		const second = render(registry, app);
		assert.strictEqual(expanded(section(second)), false);
		assert.strictEqual(folded(section(second)), true);
	});
});

/* -------------------------------------------------------------------------- */
/* The count                                                                  */
/* -------------------------------------------------------------------------- */

describe("the heading names the full list, never the visible slice", () => {
	it("shows the total in parentheses", () => {
		const registry = vault();
		addPalettes(registry, 5);
		const host = render(registry, fakeApp());

		assert.strictEqual(headingText(section(host)), `${HEADING} (5)`);
	});

	it("keeps the count while folded", () => {
		const registry = vault();
		addPalettes(registry, 4);
		const host = render(registry, fakeApp());

		click(section(host).nameEl);
		assert.strictEqual(headingText(section(host)), `${HEADING} (4)`);
	});

	it("counts every saved palette even when most are behind Load more", () => {
		const registry = vault();
		addPalettes(registry, LIST_PAGE_SIZE + 7);
		const host = render(registry, fakeApp());

		assert.strictEqual(
			headingText(section(host)),
			`${HEADING} (${LIST_PAGE_SIZE + 7})`,
		);
	});

	it("shows (0) with no saved palettes", () => {
		const registry = vault();
		const host = render(registry, fakeApp());

		assert.strictEqual(headingText(section(host)), `${HEADING} (0)`);
	});
});

/* -------------------------------------------------------------------------- */
/* Paging                                                                     */
/* -------------------------------------------------------------------------- */

describe("a palette list past the page size shows the first page and a button", () => {
	it("shows every palette and no button at exactly the page size", () => {
		const registry = vault();
		addPalettes(registry, LIST_PAGE_SIZE);
		const host = render(registry, fakeApp());

		const s = section(host);
		assert.strictEqual(rowCount(s), LIST_PAGE_SIZE);
		assert.strictEqual(loadMore(s), null, "nothing is hidden to load");
	});

	it("caps at the page size one palette over, and says how many are hidden", () => {
		const registry = vault();
		addPalettes(registry, LIST_PAGE_SIZE + 1);
		const host = render(registry, fakeApp());

		const s = section(host);
		assert.strictEqual(rowCount(s), LIST_PAGE_SIZE);
		assert.strictEqual(loadMore(s)?.textContent, "Load more (1)");
	});

	it("reveals the rest in one press, and takes the button away", () => {
		const registry = vault();
		addPalettes(registry, LIST_PAGE_SIZE + 5);
		const host = render(registry, fakeApp());

		const btn = loadMore(section(host));
		assert.strictEqual(btn?.textContent, "Load more (5)");
		click(btn);

		const s = section(host);
		assert.strictEqual(rowCount(s), LIST_PAGE_SIZE + 5);
		assert.strictEqual(
			loadMore(s),
			null,
			"the button outlived the palettes it was hiding",
		);
	});

	it("stays open across a fold and an unfold", () => {
		const registry = vault();
		addPalettes(registry, LIST_PAGE_SIZE + 5);
		const host = render(registry, fakeApp());

		click(loadMore(section(host)) as HTMLElement);

		click(section(host).nameEl);
		click(section(host).nameEl);
		assert.strictEqual(
			rowCount(section(host)),
			LIST_PAGE_SIZE + 5,
			"folding and reopening put the list back behind the button",
		);
		assert.strictEqual(loadMore(section(host)), null);
	});
});
