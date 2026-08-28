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

/**
 * Stands in for `DeviceLocalStore`'s fold state, which is where the palettes
 * section's chevron is remembered — per device, not in the synced settings
 * file, so folding a section is no longer a sync event.
 */
function foldStore() {
	const state = { theme: true, user: true, builtin: true, palettes: true };
	return {
		state,
		isExpanded: (kind: keyof typeof state) => state[kind],
		setExpanded: (kind: keyof typeof state, expanded: boolean) => {
			state[kind] = expanded;
		},
	};
}

/** The slice of the settings context the section actually touches. */
function paletteCtx(
	registry: Registry,
	app: App,
	localState: ReturnType<typeof foldStore>,
) {
	return {
		app,
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			app,
			registry,
			settings: registry.settings,
			localState,
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

function render(
	registry: Registry,
	app: App,
	localState: ReturnType<typeof foldStore> = foldStore(),
) {
	const ctx = paletteCtx(registry, app, localState);
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

	it("saves the fold to this device's own state", () => {
		const registry = vault();
		const local = foldStore();
		const host = render(registry, fakeApp(), local);

		assert.strictEqual(local.state.palettes, true);
		click(section(host).nameEl);
		assert.strictEqual(local.state.palettes, false);
	});

	it("restores the fold when the section is rebuilt on the same device", () => {
		const registry = vault();
		const app = fakeApp();
		const local = foldStore();
		const first = render(registry, app, local);

		click(section(first).nameEl);
		assert.strictEqual(expanded(section(first)), false);

		// A settings-tab reopen builds the section fresh against the same
		// device-local state — the exact thing that has to remember the fold.
		const second = render(registry, app, local);
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

/* -------------------------------------------------------------------------- */
/* Pinning                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The heading pins to the top of the settings pane while its rows scroll under
 * it, the same way the three callout lists do. That is entirely the wrapper —
 * a sticky box cannot leave its containing block, so a heading wrapped with its
 * own rows is pinned for exactly as long as those rows last — which makes the
 * *structure* the contract, not the stylesheet: un-wrap it and every CSS rule
 * still parses while the behaviour silently goes away. See
 * `calloutListsSectionDisclosure.test.ts` for the same guard on the trio.
 */
describe("the Saved color palettes heading pins like the callout lists", () => {
	const rendered = () => {
		const registry = vault();
		addPalettes(registry, 3);
		return render(registry, fakeApp());
	};

	it("wraps the heading and its rows in one sticky section", () => {
		const s = section(rendered());
		const wrapper = s.heading.closest(".cs-sticky-section");
		assert.ok(wrapper, "the palettes heading is not inside a sticky wrapper");
		assert.ok(
			s.heading.hasClass("cs-sticky-heading"),
			"the palettes heading is not the box that pins",
		);
		assert.ok(
			s.heading.hasClass("cs-subheader-row"),
			"the palettes heading does not use the same tight heading box as " +
				'"My callout types" — its band renders taller and mis-spaced',
		);
		assert.strictEqual(
			s.body.closest(".cs-sticky-section"),
			wrapper,
			"the palette rows sit outside the box the heading pins in, so the " +
				"heading would let go the moment the wrapper's own content ended",
		);
	});

	it("marks the wrapper as a divider, a last section, and the palettes case", () => {
		const wrapper = section(rendered()).heading.closest(".cs-sticky-section");
		// Divider: a wrapped heading no longer reaches the generic divider rule,
		// so the hairline above it has to be asked for here.
		assert.ok(wrapper?.hasClass("cs-section-divider"), "lost its divider");
		// Last: nothing sticky follows — "Global settings" is a plain heading —
		// so the band must let go with its own last row, not hang over it.
		assert.ok(
			wrapper?.hasClass("cs-sticky-section-last"),
			"not marked as the last sticky section, so its trailing gap would " +
				"pin the band over its own empty space",
		);
		// Palettes: the one pinned section with a non-pinned section above it,
		// which supplies no gap over this divider — styles.css gives the wrapper
		// its own top margin off this class.
		assert.ok(
			wrapper?.hasClass("cs-palettes-section"),
			"not marked as the palettes case, so it would jam against Fallback " +
				"callout above with only a hairline between them",
		);
	});

	it("puts nothing after the body, so the trailing gap is the section's", () => {
		// `--cs-section-gap` on the body only stands in for the wrapper's own
		// trailing space while the body is the last thing in it — anything after
		// it would sit below the whole gap.
		const s = section(rendered());
		const wrapper = s.heading.closest(".cs-sticky-section");
		assert.strictEqual(
			wrapper?.lastElementChild,
			s.body,
			"the palettes wrapper has something after its body",
		);
	});
});
