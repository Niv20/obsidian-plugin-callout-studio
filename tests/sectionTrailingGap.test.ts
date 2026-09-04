/**
 * tests/sectionTrailingGap.test.ts — every callout-list section ends the same
 * distance above the divider under it.
 *
 * The three sections have four endings between them — a full list, a list
 * behind a **Load more** button, a line of empty-state text, and a folded
 * heading with nothing under it at all — and they used to measure four
 * different distances to the same hairline. The gap was spent in three places
 * that could not see one another: `--cs-section-gap` on two of the section
 * bodies, the list's own 24px bottom margin inside them, and, for the last
 * section, a `margin-top` on the unrelated heading *below* it. Which produced
 * exactly the three complaints this file exists to keep from coming back:
 *
 * - the two paged sections sat 24px lower than the built-in one, because their
 *   list margin added to a padding while the built-in one's collapsed away into
 *   the following heading's margin and cost nothing;
 * - the empty state sat 12px lower again, on its own bottom padding;
 * - and folding "Built-in callouts" left 40px under it that no content
 *   justified, because a margin on the next heading cannot see a fold.
 *
 * The fix is one sentence — **the section's body owns the whole gap and nothing
 * inside it carries any** — and it is checked here from both ends.
 *
 * The stylesheet half is the arithmetic, and it is a rule-shape check rather
 * than a measurement: the fake DOM has no layout engine (`tests/support/
 * fakeDom.ts` says so), so the pixel is settled in a browser against Obsidian's
 * real `app.css` and what is guarded here is the thing that would make the
 * pixel wrong — a gap spent somewhere the fold cannot reach, or a second place
 * quietly re-adding one.
 *
 * The DOM half is the part a stylesheet cannot defend on its own. Both rules
 * that take the trailing space back off reach through a child combinator, so a
 * wrapper div slipped between a section body and its list stops them matching,
 * silently, with every selector still valid and every test that only reads
 * classes still green.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	createCalloutListsController,
} from "../src/settings/sections/CalloutListsSection";
import { freshPaging } from "../src/settings/sections/calloutListsSignature";
import { LIST_PAGE_SIZE } from "../src/settings/sections/listPaging";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

/* -------------------------------------------------------------------------- */
/* The stylesheet                                                             */
/* -------------------------------------------------------------------------- */

/** Comments stripped, then whitespace flattened so multi-line selectors match. */
const css = readRepoFile("styles.css")
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, " ");

type Spender = { selector: string; prop: string };

/**
 * Every declaration in the sheet that spends `--cs-section-gap`, paired with
 * the selector it lands on. A census rather than a lookup: the failure this
 * file is about was an *extra* spender, in a place nobody thought to look at
 * when reasoning about the two they knew.
 */
function gapSpenders(): Spender[] {
	const out: Spender[] = [];
	for (const m of css.matchAll(/([a-z-]+)\s*:\s*var\(--cs-section-gap\)/g)) {
		const before = css.slice(0, m.index);
		const open = before.lastIndexOf("{");
		const prev = before.lastIndexOf("}");
		out.push({
			selector: before.slice(prev + 1, open).trim(),
			prop: m[1] as string,
		});
	}
	return out;
}

/** The declarations of the rule whose flattened selector is exactly `selector`. */
function ruleFor(selector: string): string {
	const at = css.indexOf(`${selector} {`);
	assert.notStrictEqual(at, -1, `no rule for "${selector}"`);
	const open = at + selector.length + 1;
	const close = css.indexOf("}", open);
	return css.slice(open + 1, close);
}

const NOT_LAST =
	".callout-studio-settings .cs-sticky-section:not(.cs-sticky-section-last) > .cs-section-body";
const LAST =
	".callout-studio-settings .cs-sticky-section-last > .cs-section-body";
const BELOW_LAST =
	".callout-studio-settings .cs-sticky-section-last + .setting-item.setting-item-heading:not(.cs-header-row):not( .cs-subheader-row ):not(.cs-sticky-heading)";

describe("the gap under a section is spent in one place", () => {
	it("spends it on the section's own body, and nowhere else", () => {
		const spenders = gapSpenders();

		assert.deepStrictEqual(
			spenders.map((s) => s.selector).filter((s) => !s.endsWith(".cs-section-body")),
			[],
			"a section's trailing gap is written somewhere other than its own body. " +
				"Anywhere else and it cannot fold away with the section: a gap on the " +
				"wrapper, or on the heading below, is still there when the body is not",
		);
		assert.strictEqual(
			spenders.length,
			2,
			`--cs-section-gap is spent ${spenders.length} times; there are two ` +
				"section bodies to spend it on (the last one, and every other one)",
		);
	});

	it("gives the last section a margin where the others get padding", () => {
		const spenders = gapSpenders();
		const last = spenders.find((s) => s.selector === LAST);
		const rest = spenders.find((s) => s.selector === NOT_LAST);

		assert.strictEqual(
			rest?.prop,
			"padding-bottom",
			"padding is what keeps the gap inside the box the heading pins in, so a " +
				"section stays pinned the whole way across its own trailing space " +
				"instead of handing over to a band with nothing pinned to it",
		);
		assert.strictEqual(
			last?.prop,
			"margin-bottom",
			"the last section's gap must be a margin: padding would extend the " +
				"containing block its heading is clamped to, and the band would hang " +
				"over its own trailing space instead of letting go with its last row",
		);
	});

	it("leaves the heading below the last section carrying no gap of its own", () => {
		// Where this gap used to live, and the reason folding "Built-in
		// callouts" left 40px underneath it: a margin on the next heading is
		// spent whether or not the section above has any content to justify it.
		const decls = ruleFor(BELOW_LAST);
		assert.match(
			decls,
			/margin-top:\s*0\s*;/,
			"the heading under the last section is back to carrying a top margin — " +
				"the generic 36px divider rule, or a `--cs-section-gap` of its own. " +
				"Either one double-spaces an open section and mis-spaces a folded one",
		);
		assert.match(
			decls,
			/padding-top:\s*var\(--cs-sticky-heading-pad-top\)/,
			"its title has to sit as far below the hairline as a sticky band's does",
		);
	});
});

describe("the one section with no sticky section above it carries its own leading gap", () => {
	// "Saved color palettes" is pinned like the trio but sits below "Fallback
	// callout", which is not — so no section body hands a --cs-section-gap over
	// its divider the way "My callout types" does for "Built-in callouts". The
	// wrapper carries that space itself, as a *margin* (it has to survive a fold,
	// unlike the trailing gap on a body) — the one place a sticky wrapper is
	// allowed one. The value tracks --cs-section-gap, less the 0.75em the plain
	// `.setting-item` above already contributes below its own text, so the
	// divider lands the same 40px from the last row as the trio's do.
	const PALETTES =
		".callout-studio-settings .cs-sticky-section.cs-palettes-section";

	it("gives the palettes wrapper a top margin off the shared section gap", () => {
		assert.match(
			ruleFor(PALETTES),
			/margin-top:\s*calc\(\s*var\(--cs-section-gap\)\s*-\s*0\.75em\s*\)/,
			"the palettes section's leading gap no longer tracks --cs-section-gap, " +
				"so it drifts out of step with the trio the day that variable moves",
		);
	});

	it("keeps that gap out of the trailing-gap census", () => {
		// It must not read as a `prop: var(--cs-section-gap)` spender — those are
		// the *body* rules that fold away with the section. Wrapped in calc(), it
		// is a leading margin that stays put through a fold.
		assert.doesNotMatch(
			ruleFor(PALETTES),
			/[a-z-]+:\s*var\(--cs-section-gap\)/,
			"the palettes leading gap is written as a bare --cs-section-gap spender",
		);
	});
});

describe("nothing a section ends with carries trailing space of its own", () => {
	const ENDINGS =
		".callout-studio-settings .cs-sticky-section > .cs-section-body > .callout-studio-callout-list, " +
		".callout-studio-settings .cs-sticky-section > .cs-section-body > .callout-studio-empty-state";

	it("takes the list's margin and the empty state's padding back off", () => {
		const decls = ruleFor(ENDINGS);
		for (const prop of ["margin-bottom", "padding-bottom"]) {
			assert.match(
				decls,
				new RegExp(`${prop}:\\s*0\\s*;`),
				`a section's last child keeps its own ${prop}, so the section is ` +
					"that much taller than a section that ends with something else",
			);
		}
	});

	it("leaves the list its margin where a list ends mid-section", () => {
		// The override is scoped rather than removed at source on purpose: the
		// Saved color palettes list is followed by the Unlinked colors groups
		// inside the same body, and the Quick insert window's list is not in a
		// section at all. Both still need the 24px.
		assert.match(
			ruleFor(".callout-studio-callout-list"),
			/margin-bottom:\s*24px/,
			"the paged list lost the bottom margin that separates it from whatever " +
				"follows it inside the same body",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The DOM those selectors have to reach                                      */
/* -------------------------------------------------------------------------- */

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

function listsCtx(registry: CalloutRegistry, app: App, themeIds: string[]) {
	registry.setThemeOwnedIds(new Set(themeIds));
	return {
		app,
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			app,
			registry,
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

function addUserCallouts(registry: CalloutRegistry, count: number): void {
	for (let i = 0; i < count; i++) {
		registry.add({
			id: `custom-${String(i).padStart(2, "0")}`,
			displayName: `custom-${i}`,
			icon: { type: "lucide", value: "pencil" },
			colorLight: "#336699",
			colorDark: "#88bbee",
			foldable: false,
			defaultFolded: false,
			builtIn: false,
			source: "user",
		});
	}
}

function render(registry: CalloutRegistry, app: App, themeIds: string[]) {
	const host: HTMLElement = createDiv();
	const lists = createCalloutListsController(listsCtx(registry, app, themeIds), {
		paging: freshPaging(),
		onAddNewCallout: () => Promise.resolve(),
		renderRow: (el, def) => {
			el.createDiv({ cls: "callout-studio-row", text: def.id });
		},
	});
	lists.render(host);
	return { host, lists };
}

const THEME = "Callouts from your theme";
const MINE = "My callout types";
const BUILT_IN = "Built-in callouts";

/** A section's body, reached the way the stylesheet reaches it. */
function bodyOf(host: HTMLElement, label: string): HTMLElement {
	const heading = Array.from(
		host.querySelectorAll<HTMLElement>(".setting-item"),
	).find((el) => (el.dataset.csName ?? "").startsWith(label));
	assert.ok(heading, `no heading starting with "${label}"`);
	const bodyId = heading
		.querySelector<HTMLElement>(".setting-item-name")
		?.getAttribute("aria-controls");
	assert.ok(bodyId, `"${label}" does not point at a body`);
	const body = host.querySelector<HTMLElement>(`#${bodyId}`);
	assert.ok(body, `"${label}" points at a body that is not there`);
	return body;
}

/** The element the section actually ends with, as a class name. */
function endsWith(host: HTMLElement, label: string): string {
	const kids = Array.from(bodyOf(host, label).children) as HTMLElement[];
	assert.ok(kids.length > 0, `"${label}" renders an empty body`);
	return (kids[kids.length - 1] as HTMLElement).className;
}

describe("a section ends in something the trailing-space rule can reach", () => {
	/**
	 * Both `.cs-section-body > …` rules are child combinators, so this is the
	 * one way the fix breaks without breaking anything else: wrap the list in a
	 * scroller, a group or a fieldset and every selector still parses, every
	 * class is still on the element it was always on, and the section quietly
	 * grows 24px again.
	 */
	const REACHABLE = ["callout-studio-callout-list", "callout-studio-empty-state"];

	const cases: [string, () => { host: HTMLElement }, string[]][] = [
		[
			"with every row on screen",
			() => {
				const registry = vault();
				addUserCallouts(registry, 3);
				return render(registry, themeApp(["note"]), ["note"]);
			},
			[THEME, MINE, BUILT_IN],
		],
		[
			"with a Load more button ending the list",
			() => {
				const registry = vault();
				addUserCallouts(registry, LIST_PAGE_SIZE + 5);
				return render(registry, themeApp([]), []);
			},
			[MINE, BUILT_IN],
		],
		[
			"with nothing to list",
			() => {
				// No callouts of the user's own, and a theme claiming every
				// built-in — the two sections that answer in words instead of
				// disappearing.
				const registry = vault();
				const ids = registry.getBuiltIn().map((def) => def.id);
				return render(registry, themeApp(ids), ids);
			},
			[MINE, BUILT_IN],
		],
	];

	for (const [what, build, labels] of cases) {
		for (const label of labels) {
			it(`"${label}" ${what}`, () => {
				const { host } = build();
				const cls = endsWith(host, label);
				assert.ok(
					REACHABLE.includes(cls),
					`"${label}" ends in <div class="${cls}">, which neither ` +
						"`.cs-section-body > .callout-studio-callout-list` nor " +
						"`> .callout-studio-empty-state` reaches — its trailing space " +
						"is no longer the section's to spend",
				);
			});
		}
	}

	it("keeps the Load more button inside the list, not beside it", () => {
		// A sibling of the list would sit *below* the space the section spends
		// and need spacing of its own to look right — one more number to keep
		// in step with `--cs-section-gap`, and the one the user reported.
		const registry = vault();
		addUserCallouts(registry, LIST_PAGE_SIZE + 1);
		const { host } = render(registry, themeApp([]), []);
		const body = bodyOf(host, MINE);

		const more = body.querySelector<HTMLElement>(".callout-studio-load-more");
		assert.ok(more, "no Load more button to place");
		assert.strictEqual(
			more.parentElement?.hasClass("callout-studio-callout-list"),
			true,
			"the Load more row has been lifted out of the list it pages",
		);
		assert.strictEqual(
			more.parentElement?.lastElementChild,
			more,
			"the Load more row is no longer what the list ends with",
		);
	});

	it("puts the body inside the wrapper the gap is measured from", () => {
		// `--cs-section-gap` on the body only stands in for the wrapper's own
		// trailing space while the body is the last thing in it. The theme
		// section's description is the deliberate exception at the *top* — it is
		// a sibling above the body, never below it.
		const { host } = render(vault(), themeApp(["note"]), ["note"]);
		for (const label of [THEME, MINE, BUILT_IN]) {
			const body = bodyOf(host, label);
			const wrapper = body.closest(".cs-sticky-section");
			assert.ok(wrapper, `"${label}" has no wrapper`);
			assert.strictEqual(
				wrapper.lastElementChild,
				body,
				`"${label}" has something after its body, which would sit below ` +
					"the whole of the section's trailing gap",
			);
		}
	});
});
