/**
 * tests/support/cssInjectorHarness.ts — shared scaffolding for the CSSInjector
 * suites.
 *
 * Not a `*.test.ts`, so `scripts/run-tests.mjs` never treats it as an entry
 * point; it is bundled into each suite that imports it. It exists because five
 * files need the same three things and duplicating them five times is how the
 * copies drift apart:
 *
 * - `harness()` — a registry seeded exactly as a first run seeds it, plus an
 *   injector wired to it and a typed handle on the private emitters. Those are
 *   internal to one emission pass rather than API, so the cast lives here, in
 *   one place, and the production signatures stay honest.
 * - `definition()` — one neutral user callout to vary from. Every field a test
 *   cares about is passed in; nothing is inherited by accident.
 * - `parseRules()` / `outline()` — a brace-matcher over the generated text, so
 *   assertions can talk about *rules* ("this selector carries these properties,
 *   inside `@media print`") instead of matching whitespace with regexes.
 *
 * The parser is naive on purpose: it counts braces and nothing else. That is
 * sound for this generator because no value it ever emits contains a brace —
 * `color-mix()`, `calc()`, `linear-gradient()` and percent-encoded `url("data:…")`
 * are all brace-free. It also does not care about quoting, which is what lets it
 * be pointed at the deliberately hostile IDs in cssInjectorInject.test.ts.
 */
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import { CSSInjector } from "../../src/manager/CSSInjector";
import type { App } from "obsidian";
import type {
	CalloutDefinition,
	CalloutIcon,
	CalloutRenderRole,
} from "../../src/types";

/**
 * The private emitters the suites drive directly. Reaching them keeps the tests
 * on the unit that owns each decision instead of on the megabyte of text a full
 * `inject()` produces — and lets a test name the exact method the item is about.
 */
export interface InjectorInternals {
	generateCalloutCSS(def: CalloutDefinition): string;
	generateFallbackCSS(callouts: CalloutDefinition[]): string;
	generateGlobalStyleCSS(): string;
	generateTokenColorCSS(def: CalloutDefinition): string;
	generateFoldArrowCSS(def: CalloutDefinition): string;
	/**
	 * The artwork lookup. Reachable because `calloutIconProp` takes it as an
	 * argument rather than reading it off the injector — see that module for
	 * why the `--callout-icon` value is its own decision.
	 */
	icons: {
		resolveSvg(icon: CalloutIcon, role: CalloutRenderRole): string | null;
	};
	getIconTransformCSS(def: CalloutDefinition): string;
	iconTransformSelector(id: string, role: CalloutRenderRole): string;
	iconHiddenCSS(def: CalloutDefinition): string;
	accentProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important?: boolean,
		imposed?: boolean,
	): string[];
	ownAccentProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important?: boolean,
	): string[];
	themeAccentVar(def: CalloutDefinition): string | undefined;
	bgProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important?: boolean,
	): string[];
	bgAlphaFor(def: CalloutDefinition, mode: "light" | "dark"): number | null;
	bgImageFor(
		def: CalloutDefinition,
		mode: "light" | "dark",
	): { image: string } | null;
	textGradientCss(
		def: CalloutDefinition,
		mode: "light" | "dark",
	): string | null;
	textSweepProps(image: string, under: string | null): string[];
	textSweepRules(
		def: CalloutDefinition,
		selectorsFor: (themePrefix: string) => string,
		ownsBackground: boolean,
	): string[];
	printGradientCSS(
		def: CalloutDefinition,
		selFor: (themePrefix: string, suffix: string) => string,
		hideElementGradient: boolean,
	): string;
	needsDarkBlock(def: CalloutDefinition): boolean;
	externalExclusion(): string;
}

export interface Harness {
	registry: CalloutRegistry;
	injector: CSSInjector;
	css: InjectorInternals;
}

/**
 * A registry plus an injector wired to it.
 *
 * `load(null)` rather than the bare constructor: the constructor only stocks
 * `builtInDefaults`, and it is `load` that seeds the live map with the 13
 * shipped callouts — exactly what a first run does, and what
 * `isUnmodifiedBuiltIn` needs on both sides to answer at all.
 *
 * `{} as App` is app enough for every emitter here. The app is only touched on
 * `inject()`, which these suites reach through `injectHarness()` in
 * cssInjectorInject.test.ts instead.
 *
 * Nothing is theme-owned unless a suite says so: ownership comes from
 * `registry.setThemeOwnedIds(…)`, which nobody has called, and the empty set is
 * the deliberate fail-safe — a registry that cannot see a theme styles
 * everything rather than silently standing down. A suite that wants a
 * theme-owned callout calls that method with its attribute-form id.
 */
export function harness(app: App = {} as App): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const injector = new CSSInjector(app, registry);
	return {
		registry,
		injector,
		css: injector as unknown as InjectorInternals,
	};
}

/**
 * A harness whose Obsidian reports an active theme with the given CSS.
 *
 * `app.customCss` is Obsidian's own private field — `manager/theme/customCssApi.ts`
 * is the only place it is named in `src/`, and this is the shape that file
 * reads. Handing it real theme text is what lets a suite drive the accent
 * dialect and the studio weight the way a vault does, instead of reaching past
 * them: put `rgba(var(--callout-color), .1)` in the fixture and the emitted
 * `--callout-color` becomes a triplet, because that is what the theme asked for.
 *
 * `{} as App` (the plain {@link harness}) reports no theme at all, which is the
 * 196-of-257 case and the one every pre-existing suite is written against.
 */
export function themedHarness(
	themeCss: string,
	snippetCss: readonly string[] = [],
): Harness {
	const app = {
		customCss: {
			theme: "Fixture",
			themes: { Fixture: { version: "1.0.0" } },
			styleEl: { textContent: themeCss },
			snippets: snippetCss.map((_, i) => `snippet-${i}`),
			enabledSnippets: new Set(snippetCss.map((_, i) => `snippet-${i}`)),
			extraStyleEls: snippetCss.map((text) => ({ textContent: text })),
		},
	} as unknown as App;
	return harness(app);
}

/** One neutral user-created callout. Light and dark accents differ by default,
 * because that is the ordinary case and the equal case is the interesting one
 * (see `needsDarkBlock`). */
export function definition(
	over: Partial<CalloutDefinition> = {},
): CalloutDefinition {
	return {
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "lucide-pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/** One parsed rule: its at-rule nesting, its selector, and its declarations. */
export interface CssRule {
	/** Enclosing at-rule preludes, outermost first (`["@media print"]`). */
	at: string[];
	/** The selector list, whitespace-normalized to one line. */
	selector: string;
	/** `["background-color: red", …]`, in source order. */
	decls: string[];
	/** Just the property names, in source order. */
	props: string[];
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Split generated CSS into rules. Naive brace matching — see the file header
 * for why that is sound for this generator, and why it is what the hostile-ID
 * test needs.
 */
export function parseRules(css: string): CssRule[] {
	const rules: CssRule[] = [];

	const walk = (text: string, at: string[]): void => {
		let i = 0;
		let prelude = "";
		while (i < text.length) {
			const ch = text[i];
			if (ch !== "{") {
				prelude += ch;
				i++;
				continue;
			}
			// Found a block: scan to its matching close.
			let depth = 1;
			let j = i + 1;
			while (j < text.length && depth > 0) {
				if (text[j] === "{") depth++;
				else if (text[j] === "}") depth--;
				j++;
			}
			const body = text.slice(i + 1, j - 1);
			const head = norm(prelude);
			if (head.startsWith("@")) {
				walk(body, [...at, head]);
			} else {
				const decls = body
					.split(";")
					.map(norm)
					.filter((d) => d.length > 0);
				rules.push({
					at,
					selector: head,
					decls,
					props: decls.map((d) => d.slice(0, d.indexOf(":")).trim()),
				});
			}
			prelude = "";
			i = j;
		}
	};

	// Comments carry no rules and would otherwise land in a selector.
	walk(css.replace(/\/\*[\s\S]*?\*\//g, ""), []);
	return rules;
}

/**
 * A value-free structural summary: one line per rule, at-rules first, then the
 * selector, then the property names alone.
 *
 * This is what the snapshot test compares. Dropping the values is deliberate —
 * a snapshot over raw text turns every colour tweak into a failed test and
 * teaches people to re-bless it without reading. What must not change silently
 * is which selectors are emitted, in what order, carrying which properties.
 */
export function outline(css: string): string[] {
	return parseRules(css).map((r) => {
		const at = r.at.length > 0 ? `${r.at.join(" ")} | ` : "";
		return `${at}${r.selector} { ${r.props.join(", ")} }`;
	});
}

/** Every rule whose selector list contains `needle`. */
export function rulesMatching(css: string, needle: string): CssRule[] {
	return parseRules(css).filter((r) => r.selector.includes(needle));
}

/**
 * Narrow away the `undefined` that `noUncheckedIndexedAccess` adds to every
 * index and `find`. Throwing here fails the test with the caller's own message
 * instead of a `TypeError` three lines later.
 */
export function must<T>(value: T | undefined, what = "value"): T {
	if (value === undefined) throw new Error(`expected a ${what}, got none`);
	return value;
}

/** The one rule with exactly this selector, or a thrown assertion. */
export function ruleFor(css: string, selector: string): CssRule {
	const found = parseRules(css).filter((r) => r.selector === norm(selector));
	if (found.length !== 1) {
		throw new Error(
			`expected exactly one rule for "${selector}", found ${found.length}` +
				`\n--- css ---\n${css}`,
		);
	}
	return must(found[0], "rule");
}

/** The first rule in `css`, or a thrown assertion. */
export function firstRule(css: string): CssRule {
	return must(parseRules(css)[0], `rule in\n${css}`);
}

/** The declared value of `prop` in `rule`, or undefined. */
export function valueOf(rule: CssRule, prop: string): string | undefined {
	const decl = rule.decls.find((d) => d.startsWith(`${prop}:`));
	return decl?.slice(prop.length + 1).trim();
}
