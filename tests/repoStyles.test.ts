/**
 * tests/repoStyles.test.ts — keeping `styles.css` and `src/` talking about the
 * same names.
 *
 * `styles.css` is 171 KB and hand-maintained, and the code that uses it refers
 * to it only by string. Nothing anywhere fails when the two drift: a class
 * renamed in the code leaves an orphan rule that styles nothing, and a rule
 * deleted from the stylesheet leaves an element with a class and no appearance.
 * Both survive review, both survive `tsc`, and both are found by a user
 * noticing that something looks wrong.
 *
 * Two halves, and they are not equally decidable:
 *
 * **Custom properties are checkable exactly.** `var(--cs-x)` with no fallback
 * has to resolve or the declaration is dropped by the browser; `var(--cs-x, y)`
 * *is* the escape hatch — several exist on purpose, so a user's CSS snippet can
 * nudge the fold chevron or the icon gap without the plugin shipping a setting
 * for it. That distinction makes the rule crisp: **a fallback-less read must
 * have a writer.** It found one immediately — `--cs-icon-transform`, read bare
 * by `.callout-studio-icon-transformed`, written by nothing, in a rule no code
 * applied. Both halves have since been deleted, and the rule now holds with no
 * exceptions at all.
 *
 * **Class names cannot be, and this file says so rather than pretending.** Some
 * are assembled from a prefix and a variant (`cs-import-issue-${severity}`),
 * some are pure JS hooks with no styling by design, some are ids or filenames
 * that merely share the naming convention (`callout-studio-do-not-delete` is a
 * *file*, `callout-studio-dynamic-css` is a stylesheet id). So both directions
 * are ratchets over a frozen list of today's exceptions, each grouped by the
 * reason it is exempt. The lists are long, and their length is the finding: it
 * is the accumulated cost of two names for one thing.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	at,
	lineOf,
	literals,
	pluginSourceFiles,
	readRepoFile,
	report,
} from "./support/sourceScan";

const files = pluginSourceFiles();
/** `styles.css` with its comments blanked — several discuss class names. */
const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, (m) =>
	m.replace(/[^\n]/g, " "),
);
const cssRaw = readRepoFile("styles.css");

/**
 * The two prefixes this plugin owns. Everything else in the file is Obsidian's.
 *
 * The lookbehind is what keeps this from reading the tail of a longer
 * identifier as a class of its own. `src/` is full of them and they are not
 * classes: `--cs-material-font` is a custom property, `data-cs-svg` and
 * `data-cs-material-font` are attribute names. Without it, all three arrive
 * here as classes that `styles.css` has never heard of.
 */
const OWNED = /(?<![-\w])(?:cs|callout-studio)-[A-Za-z0-9_-]*/;

/* -------------------------------------------------------------------------- */
/* Custom properties                                                          */
/* -------------------------------------------------------------------------- */

describe("--cs-* custom properties", () => {
	/** `--cs-x:` in a declaration position, in either file. */
	const DECLARED = /(?:^|[;{)\s])(--cs-[A-Za-z0-9-]+)\s*:/g;
	/** `var(--cs-x)` — the `,` or `)` says whether a fallback follows. */
	const READ = /var\(\s*(--cs-[A-Za-z0-9-]+)\s*([,)])/g;

	const written = new Set<string>();
	const readBare = new Map<string, string>();
	const readWithFallback = new Set<string>();

	for (const m of css.matchAll(DECLARED)) written.add(m[1] as string);
	for (const m of css.matchAll(READ)) {
		const name = m[1] as string;
		if (m[2] === ",") readWithFallback.add(name);
		else if (!readBare.has(name)) {
			readBare.set(name, `styles.css:${lineOf(cssRaw, m.index ?? 0)}`);
		}
	}

	for (const f of files) {
		// The code writes these in two ways, and both count: as a declaration
		// inside a generated stylesheet (`--cs-accent: #fff;`, built by
		// CSSInjector as a string) and as a name handed to setProperty. The
		// second is often held in a constant — `GRAD_CHAR_PROP = "--cs-gch"` —
		// so the rule is simply that the name appears in the source somewhere
		// other than inside a `var(` read.
		for (const lit of literals(f.text)) {
			for (const m of lit.value.matchAll(/--cs-[A-Za-z0-9-]+/g)) {
				const name = m[0];
				const beforeInLit = lit.value.slice(0, m.index ?? 0);
				if (/var\(\s*$/.test(beforeInLit)) continue;
				written.add(name);
			}
			for (const m of lit.value.matchAll(READ)) {
				const name = m[1] as string;
				if (m[2] === ",") readWithFallback.add(name);
				else if (!readBare.has(name)) readBare.set(name, at(f, lit.start));
			}
		}
	}

	it("found both sides", () => {
		assert.ok(written.size > 5, "no --cs-* declarations found at all");
		assert.ok(readBare.size + readWithFallback.size > 5, "no --cs-* reads found");
	});

	it("every fallback-less read has a writer", () => {
		// No exceptions, deliberately. There was one — `--cs-icon-transform`,
		// read bare by `.callout-studio-icon-transformed` and written by nothing.
		// Both halves were dead: the shared-class-plus-variable pair that
		// `ccf79a4` built the icon offset/size controls on, left behind when
		// `CSSInjector.getIconTransformCSS` took the feature over and started
		// baking the computed `transform` straight into a per-callout, per-role
		// rule. Deleting the rule retired the exception with it, and an empty
		// allowance is worth more as a closed door than as an open one.
		const orphans = [...readBare.entries()]
			.filter(([name]) => !written.has(name))
			.map(([name, where]) => `${name}  (${where})`);
		assert.deepStrictEqual(
			orphans,
			[],
			report(
				"These resolve to nothing, so the declaration reading them is dropped entirely. Either set the property, or give the read a fallback and make it a deliberate escape hatch:",
				orphans,
			),
		);
	});

	/**
	 * Written on purpose for readers *outside* this repository, and so read by
	 * nothing inside it.
	 *
	 * `--cs-color-rgb` is the legacy bare triplet `CSSInjector.ownAccentProps`
	 * still emits beside `--cs-accent`, kept one release for user snippets and
	 * other plugins that read it; the source says in as many words that nothing
	 * here depends on it any more. It looked read until the dead
	 * `.cs-global-preview-callout` mock was deleted — that rule matched no
	 * element in any build, so it was never really a reader, only the thing
	 * hiding that there wasn't one.
	 *
	 * Pinned by name, and asserted still-written below, so that retiring the
	 * variable fails here and takes this entry with it.
	 */
	const COMPAT_EXPORTS = new Set(["--cs-color-rgb"]);

	it("every property that is written is also read", () => {
		// The other direction. A property nothing reads is either a rule that
		// was deleted around it, or a name that was changed on one side.
		const unread = [...written]
			.filter(
				(n) => !readBare.has(n) && !readWithFallback.has(n) && !COMPAT_EXPORTS.has(n),
			)
			.sort();
		assert.deepStrictEqual(
			unread,
			[],
			report("Written but never read — dead custom properties:", unread),
		);
	});

	it("the compatibility exports are still written", () => {
		// Otherwise the allowance outlives the variable it was granted for and
		// silently permits the next write-only property to join it.
		for (const name of COMPAT_EXPORTS) {
			assert.ok(
				written.has(name),
				`${name} is listed as a compatibility export but nothing writes it any more — delete the entry`,
			);
		}
	});

	it("the documented escape hatches still have their fallbacks", () => {
		// These are the properties a user's CSS snippet is meant to set: the
		// plugin never writes them, and the fallback is the default. Losing the
		// fallback turns "unset" into "broken", which is why they are pinned by
		// name rather than merely allowed to be unwritten.
		const HATCHES = [
			"--cs-heading-fold-offset",
			"--cs-heading-icon-offset",
			"--cs-regular-icon-gap",
		];
		for (const name of HATCHES) {
			assert.ok(
				readWithFallback.has(name),
				`${name} is documented as a snippet escape hatch but is no longer read with a fallback`,
			);
			assert.ok(
				!readBare.has(name),
				`${name} is read somewhere without a fallback, which defeats the point of it being optional`,
			);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Class names                                                                */
/* -------------------------------------------------------------------------- */

describe("class names in styles.css and src/ agree", () => {
	/**
	 * Names built by concatenation, so the full class never appears anywhere as
	 * a literal. Any CSS rule starting with one of these is considered emitted.
	 */
	const PREFIXES = [
		"cs-import-issue-",
		"cs-settings-group",
		"cs-palette-menu-item",
		"cs-border-side-btn",
	];

	/**
	 * Names in `src/` that use the plugin's prefix but are not classes.
	 *
	 * Every one is an identifier of some other kind, which is exactly why they
	 * look like violations: the naming convention is shared, the namespace is
	 * not.
	 */
	const NOT_A_CLASS = new Set([
		"callout-studio-css", // localStorage key for the startup CSS snapshot
		"callout-studio-dynamic-css", // <style> element id
		"callout-studio-do-not-delete", // the legacy vault snippet's filename
		"callout-studio-custom", // the exported vault snippet's filename
		"callout-studio-welcome", // obsidian:// URI action
		"callout-studio-context-menu", // Menu section id
		"callout-studio-export", // export filename stem
	]);

	/**
	 * Classes the code applies that *nothing* styles.
	 *
	 * Not all of these are wrong — a class can exist purely as a query hook or
	 * as a stable handle for a user's own snippet — but the list is frozen so a
	 * *new* one has to be a decision. When you style one of these, delete its
	 * line here.
	 */
	const EMITTED_WITHOUT_RULES = new Set([
		"callout-studio-credit-license",
		"callout-studio-delete-modal",
		"callout-studio-delete-modal-hint",
		"callout-studio-delete-modal-warning",
		"callout-studio-firstrun-heavy-note",
		"callout-studio-firstrun-later-hint",
		"callout-studio-footer-tagline",
		"callout-studio-more-btn",
		"callout-studio-replace-modal",
		"cs-callout-name",
		"cs-cm-widget",
		"cs-command-editor",
		"cs-fold-dropdown",
		"cs-fold-trigger",
		"cs-heading-title",
		"cs-icon-source",
		"cs-source-name",
		"cs-welcome-hero",
		"cs-welcome-panel",
	]);

	/**
	 * Styled, but not from `styles.css` — so absent for a reason this file's
	 * scan structurally cannot see, and *not* the same finding as the list
	 * above.
	 *
	 * `styles.css` is only half of this plugin's CSS. `CSSInjector` builds the
	 * other half as strings and hands it to `adoptedStyleSheets`, and a rule
	 * that has to name a *user's* callout id can only be written there. Two
	 * classes are dressed entirely from that side:
	 *
	 * - `cs-export-icon` — the baked print copy of a callout's artwork, hidden
	 *   on screen and shown in print (`CSSInjector.ts:340` and `:345`).
	 * - `cs-unknown` — the accent and background an unresolved `[!id]` token
	 *   borrows from the fallback callout, which is a *setting*, so the rule
	 *   cannot be static (`CSSInjector.ts:2172` onwards).
	 *
	 * Kept apart from `EMITTED_WITHOUT_RULES` because the two say opposite
	 * things: that list is debt, and this one is the design working. Merging
	 * them would mean a genuinely unstyled class could be waved through by
	 * citing the wrong reason.
	 */
	const STYLED_BY_GENERATED_CSS = new Set(["cs-export-icon", "cs-unknown"]);

	/**
	 * Rules in `styles.css` that nothing in `src/` applies.
	 *
	 * Empty, and it stays that way. All 22 have been deleted: the orphans of
	 * five features that were rewritten without their CSS — the settings
	 * toolbar and its search box, the compact colour grid, the old swatch and
	 * kebab buttons, the pre-`LiveCalloutPreview` global-style mock
	 * (`cs-global-preview-*`), and the "Customize all colors" collapsible
	 * header. None had a single reference left anywhere in `src/` or the docs,
	 * so none of them could ever match an element; deleting them changes no
	 * pixel, which is exactly why they survived review for so long.
	 *
	 * An empty allowance is the point. A rule that styles nothing is invisible
	 * to `tsc`, to the linter and to a reader, and the only thing that ever
	 * finds it is this test — so the useful state for it to be in is one where
	 * the next orphan fails it rather than joining a list.
	 */
	const RULES_WITHOUT_EMITTERS = new Set<string>([]);

	/** Class selectors in `styles.css`. */
	const styled = new Set<string>();
	for (const m of css.matchAll(
		new RegExp(`\\.(${OWNED.source})`, "g"),
	)) {
		styled.add(m[1] as string);
	}

	/**
	 * Class names the code puts on an element.
	 *
	 * Scanned from *every* string literal rather than only from the arguments of
	 * `addClass`/`cls:`, because a good third of them are held in exported
	 * constants (`export const CSS_ANIM_IN = "cs-anim-in"`) and applied through
	 * the constant. Restricting the scan to call sites missed 20 real classes
	 * and reported them as orphaned CSS.
	 */
	const emitted = new Map<string, string>();
	for (const f of files) {
		for (const lit of literals(f.text)) {
			if (!/(?:cs|callout-studio)-/.test(lit.value)) continue;
			for (const m of lit.value.matchAll(new RegExp(OWNED.source, "g"))) {
				const name = m[0];
				const index = m.index ?? 0;
				// `cs-import-issue-${severity}` — a prefix, handled above.
				if (
					name.endsWith("-") ||
					lit.value.slice(index + name.length, index + name.length + 2) === "${"
				) {
					continue;
				}
				if (NOT_A_CLASS.has(name)) continue;
				if (!emitted.has(name)) emitted.set(name, at(f, lit.start));
			}
		}
	}

	it("found both sides", () => {
		assert.ok(styled.size > 200, `only ${styled.size} classes in styles.css`);
		assert.ok(emitted.size > 200, `only ${emitted.size} classes emitted from src/`);
	});

	it("every class the code applies has a rule", () => {
		const bad = [...emitted.entries()]
			.filter(
				([name]) =>
					!styled.has(name) &&
					!EMITTED_WITHOUT_RULES.has(name) &&
					!STYLED_BY_GENERATED_CSS.has(name),
			)
			.map(([name, where]) => `${name}  (${where})`)
			.sort();
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"These classes are applied but styled by nothing. Add the rule; if CSSInjector already styles it, add it to STYLED_BY_GENERATED_CSS; if it is only a JS hook, add it to EMITTED_WITHOUT_RULES with the reason:",
				bad,
			),
		);
	});

	it("every rule in styles.css is applied by something", () => {
		const bad = [...styled]
			.filter(
				(name) =>
					!emitted.has(name) &&
					!RULES_WITHOUT_EMITTERS.has(name) &&
					!PREFIXES.some((p) => name.startsWith(p)),
			)
			.sort();
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"These rules style a class nothing applies — usually a rename that only landed on one side:",
				bad,
			),
		);
	});

	it("the frozen exception lists have no stale entries", () => {
		// The same rot as the file-size ratchet: an exception that has been
		// fixed but not removed silently re-permits the thing it was granted
		// for.
		const stale: string[] = [];
		for (const name of EMITTED_WITHOUT_RULES) {
			if (styled.has(name)) {
				stale.push(`EMITTED_WITHOUT_RULES: ${name} now has a rule — remove it`);
			} else if (!emitted.has(name)) {
				stale.push(`EMITTED_WITHOUT_RULES: ${name} is no longer emitted — remove it`);
			}
		}
		for (const name of RULES_WITHOUT_EMITTERS) {
			if (emitted.has(name)) {
				stale.push(`RULES_WITHOUT_EMITTERS: ${name} is emitted now — remove it`);
			} else if (!styled.has(name)) {
				stale.push(`RULES_WITHOUT_EMITTERS: ${name} has no rule left — remove it`);
			}
		}
		for (const name of STYLED_BY_GENERATED_CSS) {
			// The generated half is the whole justification, so a class that has
			// picked up a static rule no longer belongs here — and one nothing
			// applies any more is an exception outliving its class.
			if (styled.has(name)) {
				stale.push(
					`STYLED_BY_GENERATED_CSS: ${name} has a styles.css rule now — remove it`,
				);
			} else if (!emitted.has(name)) {
				stale.push(
					`STYLED_BY_GENERATED_CSS: ${name} is no longer emitted — remove it`,
				);
			}
		}
		assert.deepStrictEqual(stale, [], report("Stale exceptions:", stale));
	});
});

/* -------------------------------------------------------------------------- */
/* The modal-surface invariant                                                */
/* -------------------------------------------------------------------------- */

describe("modal surfaces use the --cs-surface pair", () => {
	// CLAUDE.md's rule, and the reason it exists is not visible on a desktop:
	// mobile dark repoints --modal-background onto --background-secondary, so a
	// band painted --background-primary comes out as a pure-black stripe and a
	// strip painted --background-secondary vanishes into the surface it is
	// meant to sit above. `modalSurfaces.test.ts` covers the runtime behaviour;
	// this is the one thing it cannot see — a *new* rule inside .cs-modal that
	// names the raw variable.
	it("no rule scoped to .cs-modal paints a raw --background-primary", () => {
		const bad: string[] = [];
		// Split into rules crudely: everything between a `{` and the matching
		// `}` at depth 1, with its selector.
		const RULE = /([^{}]+)\{([^{}]*)\}/g;
		for (const m of css.matchAll(RULE)) {
			const selector = (m[1] as string).trim();
			const body = m[2] as string;
			if (!/\.cs-modal\b/.test(selector)) continue;
			for (const decl of body.matchAll(
				/(background|background-color)\s*:\s*var\(\s*(--background-primary|--background-secondary)\s*\)/g,
			)) {
				bad.push(
					`styles.css:${lineOf(cssRaw, m.index ?? 0)}  ${selector.slice(0, 70)} → ${decl[2]}`,
				);
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"Inside .cs-modal, paint var(--cs-surface, var(--background-primary)) or var(--cs-surface-raised, var(--background-secondary)) — the raw variables are wrong on mobile dark:",
				bad,
			),
		);
	});
});
