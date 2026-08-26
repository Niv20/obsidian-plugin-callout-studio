/**
 * tests/printMediaIcons.test.ts — 165: where in the media cascade each icon rule
 * lands, and why "no icon" has to land in the half that prints.
 *
 * Icons reach the screen and the page by two different routes, and the split is
 * the whole design:
 *
 * - **On screen** an icon is a CSS `::after` — a mask, a background image or an
 *   emoji glyph — driven by the generated stylesheet. Those three overrides are
 *   wrapped in `@media screen`.
 * - **In print** they are gone, and what shows instead is a self-contained copy
 *   `paintIcon` bakes into the DOM: an inline `<svg>` or a text node, coloured
 *   with an inline `!important`. Chromium's print pipeline renders that far
 *   more reliably than a CSS mask. `.cs-export-icon` is hidden on screen — again
 *   inside `@media screen` — so exactly one of the two is ever visible.
 *
 * `hideIcon` is the case that breaks the symmetry, and getting it wrong is
 * invisible until someone exports a PDF. There is no DOM copy to take over in
 * print, because the whole point is that there is no icon — so the rule that
 * hides it must be **outside** `@media screen`, or the icon the user turned off
 * comes back in every export. The same holds for the unknown-id fallback: a
 * fallback template drawn with no icon means every unrecognised callout in the
 * vault has none either, in both media.
 *
 * `hideIcon.test.ts` asserts the flag's behaviour across the registry and the
 * emitters; this file asks the one question that is about the *cascade* — and
 * asks it with a brace-aware reader over the at-rule nesting, rather than by
 * splitting the text at the first `@media`, and over the **assembled** sheet as
 * well as the individual emitters. The assembled sheet is the artefact Obsidian
 * hands to the exporter, so it is the one the claim is really about.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, el } from "./support/fakeDom";
import {
	definition,
	harness,
	parseRules,
	type CssRule,
} from "./support/cssInjectorHarness";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../src/types";

/** Rules that are in no at-rule at all, so they apply in every medium. */
const allMedia = (css: string): CssRule[] =>
	parseRules(css).filter((r) => r.at.length === 0);

/** Rules nested inside `@media screen`, so PDF export never sees them. */
const screenOnly = (css: string): CssRule[] =>
	parseRules(css).filter((r) => r.at.some((a) => /^@media screen$/.test(a)));

/** Every rule that takes `.callout-icon` out of the layout. */
const hideRules = (rules: CssRule[]): CssRule[] =>
	rules.filter(
		(r) =>
			r.selector.includes(".callout-icon") &&
			r.decls.some((d) => /^display:\s*none/.test(d)),
	);

const EMOJI = { type: "emoji" as const, value: "🌵" };

/* -------------------------------------------------------------------------- */
/* The per-callout block                                                      */
/* -------------------------------------------------------------------------- */

describe("a callout the user set to draw no icon", () => {
	const hidden = (over: Partial<CalloutDefinition> = {}): string =>
		harness().css.generateCalloutCSS(
			definition({ hideIcon: true, ...over }),
		);

	it("hides it in every medium, so the PDF has none either", () => {
		const rules = hideRules(allMedia(hidden()));
		assert.deepStrictEqual(
			rules.map((r) => r.selector),
			['.callout[data-callout="quiet"] > .callout-title > .callout-icon'],
		);
	});

	it("hides it nowhere that print cannot reach", () => {
		// The inverse, and the actual regression: an `@media screen` wrapper
		// added here for symmetry with the three ::after overrides would leave
		// the icon absent on screen and present in every export.
		assert.deepStrictEqual(hideRules(screenOnly(hidden())), []);
	});

	it("emits no screen-only icon override to be hidden in the first place", () => {
		// Nothing is painted and then covered: with the icon off, the mask and
		// glyph emitters are skipped entirely, so the screen half of this
		// callout's block is empty.
		for (const icon of [EMOJI, { type: "lucide" as const, value: "star" }]) {
			assert.deepStrictEqual(
				screenOnly(hidden({ icon })).map((r) => r.selector),
				[],
			);
		}
	});

	it("undoes the align-content indent in every medium too", () => {
		// The indent is a fixed `calc(--icon-size + gap)` that knows nothing
		// about whether there is an icon to align past. Reset only on screen, a
		// printed no-icon callout would have its body indented under nothing.
		const { registry, css } = harness();
		registry.settings.globalStyle.alignContentWithTitle = true;
		const out = css.generateCalloutCSS(definition({ hideIcon: true }));

		const reset = allMedia(out).filter((r) =>
			r.decls.some((d) => /^padding-inline-start:\s*0/.test(d)),
		);
		assert.strictEqual(reset.length, 1);
		assert.deepStrictEqual(
			screenOnly(out).filter((r) => r.props.includes("padding-inline-start")),
			[],
		);
	});

	it("covers every alias in the all-media half", () => {
		const out = hidden({ aliases: ["hush", "still"] });
		assert.deepStrictEqual(
			hideRules(allMedia(out))
				.map((r) => r.selector)
				.sort(),
			[
				'.callout[data-callout="hush"] > .callout-title > .callout-icon',
				'.callout[data-callout="quiet"] > .callout-title > .callout-icon',
				'.callout[data-callout="still"] > .callout-title > .callout-icon',
			],
		);
	});
});

describe("a callout that keeps its icon, for contrast", () => {
	it("puts its glyph override on screen only, where the baked copy replaces it", () => {
		// This is what `hideIcon` must NOT look like. The emoji ::after exists
		// so the icon shows in Reading view; in print it steps aside for the
		// DOM copy `paintIcon` bakes, which prints reliably and carries its own
		// colour.
		const out = harness().css.generateCalloutCSS(definition({ icon: EMOJI }));

		assert.ok(
			screenOnly(out).some((r) => r.selector.includes(".callout-icon::after")),
			"the emoji override should be screen-only",
		);
		assert.deepStrictEqual(hideRules(allMedia(out)), []);
	});

	it("still sets --callout-icon, which the hidden one does not", () => {
		const shown = harness().css.generateCalloutCSS(definition());
		const hidden = harness().css.generateCalloutCSS(
			definition({ hideIcon: true }),
		);

		assert.match(shown, /--callout-icon:/);
		assert.doesNotMatch(hidden, /--callout-icon:/);
	});
});

/* -------------------------------------------------------------------------- */
/* The unknown-id fallback                                                    */
/* -------------------------------------------------------------------------- */

describe("the fallback template drawn with no icon", () => {
	const fallbackCss = (over: Partial<CalloutDefinition> = {}): string => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		return css.generateFallbackCSS([
			definition({ id: "note", hideIcon: true, ...over }),
		]);
	};

	it("hides the icon of every unknown callout in every medium", () => {
		const rules = hideRules(allMedia(fallbackCss()));
		assert.strictEqual(rules.length, 1);
		assert.ok(rules[0]?.selector.startsWith("body .callout:not("));
		assert.ok(
			rules[0]?.decls.some((d) => d === "display: none !important"),
			"the :not() chain speaks in !important; the hide rule has to as well",
		);
	});

	it("adds no screen-only icon block for it", () => {
		assert.deepStrictEqual(
			screenOnly(fallbackCss({ icon: EMOJI })).map((r) => r.selector),
			[],
		);
	});

	it("resets the align indent in every medium as well", () => {
		const { registry, css } = harness();
		registry.settings.fallbackCalloutId = "note";
		registry.settings.globalStyle.alignContentWithTitle = true;
		const out = css.generateFallbackCSS([
			definition({ id: "note", hideIcon: true }),
		]);

		assert.ok(
			allMedia(out).some((r) =>
				r.decls.some((d) => /^padding-inline-start:\s*0/.test(d)),
			),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The DOM copy that would have printed                                       */
/* -------------------------------------------------------------------------- */

describe("paintIcon, the print-side half", () => {
	type Painter = {
		paintIcon(iconEl: HTMLElement, def: CalloutDefinition): void;
	};

	const painter = (): Painter =>
		harness().injector as unknown as Painter;

	it("bakes nothing for a callout with the icon off", () => {
		// The copy exists to take over in print. With `iconHiddenCSS` removing
		// the box in every medium, a copy here would only be an invisible child
		// of a `display: none` parent — and would come back the moment somebody
		// "fixed" the hide rule into `@media screen`.
		const iconEl = el({ cls: "callout-icon" });
		painter().paintIcon(asEl(iconEl), definition({ hideIcon: true, icon: EMOJI }));

		assert.deepStrictEqual(iconEl.children, []);
		assert.strictEqual(iconEl.textContent, "");
	});

	it("bakes one for the same callout with the icon on", () => {
		const iconEl = el({ cls: "callout-icon" });
		painter().paintIcon(asEl(iconEl), definition({ icon: EMOJI }));

		assert.strictEqual(iconEl.children.length, 1);
		assert.ok(iconEl.children[0]?.classList.contains("cs-export-icon"));
		assert.strictEqual(iconEl.textContent, EMOJI.value);
	});
});

/* -------------------------------------------------------------------------- */
/* The assembled stylesheet — what the exporter is actually handed            */
/* -------------------------------------------------------------------------- */

/**
 * The smallest thing `inject()` will run against.
 *
 * A recorder, not a DOM: it counts nothing and lays nothing out, it just keeps
 * the last text written to the `<style>` element. `adoptedStyleSheets` is left
 * off deliberately — that sends `ensureStyleSheet` down its early return and
 * leaves the element as the single observable target, which is also the honest
 * one, because it is the element Obsidian's PDF export reads.
 *
 * A leaner cousin of `cssInjectorInject.test.ts`'s, which observes write counts
 * and `css-change` triggers this file has no use for.
 */
function injected(build: (registry: CalloutRegistry) => void): string {
	const writes: string[] = [];
	const styleEl = {
		id: "",
		isConnected: true,
		remove(): void {
			this.isConnected = false;
		},
		get textContent(): string {
			return writes.at(-1) ?? "";
		},
		set textContent(value: string) {
			writes.push(value);
		},
	};

	let attached = false;
	const doc = {
		head: {
			appendChild(): void {
				attached = true;
			},
		},
		getElementById: (id: string) =>
			attached && id === styleEl.id ? styleEl : null,
		querySelectorAll: () => [],
		body: { classList: { contains: () => false } },
	};
	const app = {
		appId: "test-vault",
		workspace: {
			containerEl: { ownerDocument: doc },
			iterateAllLeaves: () => {},
			trigger: () => {},
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
	g.createEl = () => styleEl;
	g.HTMLStyleElement = class {} as unknown;
	g.window = {
		localStorage: { getItem: () => null, setItem: () => {} },
	};

	try {
		const registry = new CalloutRegistry();
		registry.load(null);
		// A clean install hands an unconfigured built-in to the theme, and this
		// suite is about what happens when the plugin IS painting. See
		// tests/styleMode.test.ts for the default itself.
		build(registry);
		new CSSInjector(app, registry).inject(false);
		return writes.at(-1) ?? "";
	} finally {
		Object.assign(g, saved);
	}
}

describe("the sheet as a whole", () => {
	const sheet = (): string =>
		injected((registry) => {
			registry.add(definition({ id: "quiet", hideIcon: true, icon: EMOJI }));
			registry.add(definition({ id: "loud", icon: EMOJI }));
		});

	it("was assembled at all", () => {
		// Guards the three assertions below, each of which is about the absence
		// of something.
		const css = sheet();
		assert.ok(css.length > 1000, `only ${css.length} characters emitted`);
		assert.ok(css.includes('data-callout="quiet"'));
	});

	it("mentions the no-icon callout nowhere inside @media screen", () => {
		// The end-to-end form of the claim: nothing about this callout is
		// conditional on the medium, so print and screen agree about it.
		const offenders = screenOnly(sheet())
			.filter((r) => r.selector.includes('data-callout="quiet"'))
			.map((r) => r.selector);
		assert.deepStrictEqual(offenders, []);
	});

	it("keeps its hide rule in the all-media half", () => {
		assert.ok(
			hideRules(allMedia(sheet())).some((r) =>
				r.selector.includes('data-callout="quiet"'),
			),
		);
	});

	it("still puts the neighbouring callout's glyph on screen only", () => {
		// Same sheet, same emitter: the split is per callout, not global. If
		// this stops being true the previous assertion has become vacuous.
		assert.ok(
			screenOnly(sheet()).some((r) => r.selector.includes('data-callout="loud"')),
		);
	});

	it("hides the baked export copies on screen, and only on screen", () => {
		// The other half of the two-route design. This rule *must* be
		// screen-only: it is what lets the DOM copy appear in print.
		const css = sheet();
		assert.ok(
			screenOnly(css).some((r) => r.selector.includes(".cs-export-icon")),
			"the .cs-export-icon hide rule must sit inside @media screen",
		);
		assert.deepStrictEqual(
			allMedia(css)
				.filter(
					(r) =>
						r.selector.includes(".cs-export-icon") &&
						r.decls.some((d) => /^display:\s*none/.test(d)),
				)
				.map((r) => r.selector),
			[],
		);
	});
});
