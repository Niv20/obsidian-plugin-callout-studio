/**
 * manager/css/metadataColorCSS.ts — the colour one callout takes from its own
 * metadata: `> [!mark|pink]` paints that callout pink, every other `mark`
 * keeps its colour.
 *
 * ## Pure CSS, keyed on the attribute itself
 *
 * Obsidian already writes the metadata into `data-callout-metadata` on every
 * block callout, and this plugin stamps the same attribute on its own heading
 * bars and inline pills. So the whole feature is attribute selectors — no
 * per-element script, nothing that has to run before the colour appears — and
 * the block half survives into an exported snippet, where none of our code
 * runs at all. The one thing a stylesheet cannot do is bake the colour into
 * the DOM for PDF export; `utils/calloutMetadata.definitionWithMetadataColor`
 * covers that for the injector's export painters.
 *
 * ## One rule set per colour, not per callout
 *
 * A metadata colour is "apply this palette to this one instance". Everything
 * a palette decides — accent variables, background tint and its alpha, the
 * gradient and its print repaint, the title sweep, the fold chevron — is a
 * function of the palette alone, so each colour is a virtual definition
 * (`metadataDefinition`) run through the injector's own emitters, with a
 * selector that names the word instead of an id. What the callout's own
 * definition says about its icon, frame and title stays.
 *
 * ## Replacing, not layering
 *
 * The callout's own definition still matches the element, so anything the
 * colour does not restate shows through it. Hence the resets, each written
 * only for a colour that lacks the thing: no gradient → `background-image:
 * none` (and the print `::before` cleared), no title sweep → the sweep's
 * clipping undone and the chevrons back to their defaults. Content text takes
 * the palette's own colour when it has one and the theme's otherwise
 * (`inherit`) — never the fixed `#1a1a1a` a palette bakes when it has none,
 * which under a theme with text colours of its own would be a colour nobody
 * chose.
 *
 * ## Matching a word in either separator
 *
 * A word may stand alone, or between spaces (ITS Theme's convention), or
 * between pipes (the Callout Metadata plugin's), or any mix — the six forms of
 * `METADATA_WORD_FORMS`, which the export painters evaluate too. The `i` flag
 * matches `PINK` as `pink` — ASCII only, which is why the JS side folds case
 * the same narrow way (`foldMetadataCase`).
 *
 * ## Nested, so a word's selector is written once
 *
 * Each colour is a handful of blocks — the callout, the inline pill, the
 * heading bar, the heading token — whose selector holds the word's six forms,
 * `.callout` repeated to the studio weight and the theme-owned exclusion. Flat,
 * every one of a colour's rules repeated all of that; under ITS Theme that was
 * five sixths of a 217 KB block. Native nesting states it once and puts each
 * rule inside as `:root &` / `.theme-dark &`, which is the same selector to the
 * cascade: `&` is `:is(outer)`, and `:is()` of one selector weighs what the
 * selector does.
 *
 * ## Weight and order
 *
 * Every rule here is one attribute heavier than the definition rule it
 * overrides — `[data-callout]` plus the word's `:is()` stand where the
 * definition has its single `[data-callout="id"]` — and the light rules carry
 * a `:root` scope so they weigh exactly what the `.theme-dark` ones do. That
 * second part is what keeps the fixed precedence of `metadataColorEntries`
 * true in both modes: every colour's rules tie with every other colour's, so
 * source order alone decides between two colours, and the stronger colour
 * always comes later. Without it a weaker colour's dark block would outweigh
 * a stronger colour's unscoped light rule in dark mode.
 *
 * Callouts the theme owns are excluded — the plugin promised to leave those
 * alone, and a palette painted over a theme's own construction would rarely
 * look like either. Unknown ids are not: the rule names no id, so a callout
 * no definition covers takes the colour too.
 */
import type { CalloutDefinition } from "../../types";
import { bakePaletteColors } from "../../utils/colorPalettes";
import {
	DEFAULT_TEXT_COLOR_DARK,
	DEFAULT_TEXT_COLOR_LIGHT,
} from "../../utils/colorUtils";
import {
	entryWords,
	METADATA_WORD_FORMS,
	type MetadataColorEntry,
} from "../../utils/calloutMetadata";
import { cssAttrValue } from "../../utils/calloutSelector";
import { transparentChildrenCSS } from "./backgroundProps";
import {
	CSS_FOLD_ARROW,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_HEADING_TOKEN,
	CSS_INLINE_TOKEN,
	CSS_TOKEN_NAME,
} from "../../editor/renderShared";

/** Builds a selector list for one theme prefix (`""` or `".theme-dark "`). */
type SelectorsFor = (themePrefix: string) => string;
/** The print repaint's selector callback, as `printGradientCSS` takes it. */
type PrintSelectorsFor = (themePrefix: string, suffix: string) => string;

/**
 * The injector's emitters, named rather than inherited — the same arrangement
 * as `FallbackCssContext`, for the same reason: this file can then be read and
 * tested without the class around it.
 */
export interface MetadataColorCssContext {
	/** `.callout` repetitions in force this pass (`StudioWeightCache.resolve`). */
	weight: number;
	/** `" !important"` in studio mode — always, for a painted rule. */
	important: string;
	/**
	 * What some callout's own definition paints that a colour without it must
	 * clear: a background gradient, a title sweep. False → no definition has
	 * one, so the resets would clear nothing and are left out. The sheet is
	 * rebuilt whenever a definition changes, so this cannot go stale.
	 */
	clears: { gradient: boolean; sweep: boolean };
	/** The `data-callout` attr forms of every callout the theme owns. */
	themeOwnedAttrIds: readonly string[];
	/** The frame declarations a transparent palette adds — see `transparentBorder.ts`. */
	transparentBorderProps(): string[];
	accentProps(def: CalloutDefinition, mode: "light" | "dark"): string[];
	ownAccentProps(def: CalloutDefinition, mode: "light" | "dark"): string[];
	bgProps(def: CalloutDefinition, mode: "light" | "dark", important?: boolean): string[];
	needsDarkBlock(def: CalloutDefinition): boolean;
	textSweepRules(
		def: CalloutDefinition,
		selectorsFor: SelectorsFor,
		ownsBackground: boolean,
		imp: string,
	): string[];
	printGradientCSS(
		def: CalloutDefinition,
		selFor: PrintSelectorsFor,
		hideElementGradient: boolean,
		imp?: string,
	): string;
	/** `CSSInjector.themeSurface`, at the weight it adds itself. */
	themeSurface(
		def: CalloutDefinition,
		selectorsAt: (guard: string, weight: number, rootQualifier: string) => string,
	): string;
}

/**
 * The `:is()` that matches a metadata string containing any of `words` as a
 * whole word, whatever separates it from its neighbours. One class of
 * specificity, whichever form matches.
 */
export function metadataWordSelector(words: readonly string[]): string {
	const forms = words.flatMap((word) =>
		METADATA_WORD_FORMS.map(
			({ op, value }) => `[data-callout-metadata${op}="${cssAttrValue(value(word))}" i]`,
		),
	);
	return `:is(${forms.join(", ")})`;
}

/**
 * A palette as the definition it would leave behind on a callout — only the
 * colour fields mean anything; the rest exists to satisfy the type. The id
 * cannot collide with a real one (`isUnmodifiedBuiltIn` must say no, so the
 * accent is always the palette's literal colour, never a theme variable).
 */
function metadataDefinition(entry: MetadataColorEntry): CalloutDefinition {
	return {
		id: `metadata colour ${entry.key}`,
		displayName: entry.palette.name,
		icon: { type: "lucide", value: "pencil" },
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "plugin",
		...bakePaletteColors(entry.palette),
	};
}

/** One mode's rule inside a colour's block: `:root &` or `.theme-dark &`. */
const inMode = (themePrefix: string): string => `${themePrefix || ":root "}&`;

/** A rule from its selector and declaration lines. */
const rule = (selector: string, props: readonly string[]): string =>
	`${selector} {\n${props.join("\n")}\n}`;

/** One nested block: the colour's selector once, its rules inside. */
const nest = (outer: string, rules: readonly string[]): string =>
	`${outer} {\n${rules.filter(Boolean).join("\n\n")}\n}`;

/**
 * `props` with `background-image: none` added when they paint none of their
 * own: a colour without a gradient must clear the gradient the callout's own
 * definition draws, or its tint sits underneath it, unseen. Only while some
 * definition has a gradient to clear (`clears.gradient`).
 */
function clearingImage(props: string[], imp: string, ctx: MetadataColorCssContext): string[] {
	return !ctx.clears.gradient || props.some((p) => p.trimStart().startsWith("background-image:"))
		? props
		: [...props, `  background-image: none${imp};`];
}

/** The title-sweep declarations at rest — a colour without a sweep restores them. */
const unswept = (imp: string): string[] => [
	`  background-image: none${imp};`,
	`  -webkit-background-clip: border-box${imp};`,
	`  background-clip: border-box${imp};`,
	`  -webkit-text-fill-color: currentColor${imp};`,
];

/** The print `::before` a callout's own gradient paints, emptied — when one could. */
const noPrintGradient = (selector: string, imp: string, ctx: MetadataColorCssContext): string =>
	ctx.clears.gradient
		? `@media print {\n${rule(`${selector}::before`, [`  background-image: none${imp};`])}\n}`
		: "";

/** Whether the palette sweeps its title text — `CSSInjector.textGradientCss`'s own test. */
const sweeps = (def: CalloutDefinition): boolean =>
	Boolean(def.bgGradient?.textGradient && def.bgGradient.textToColorLight);

/**
 * Every metadata colour's rules, weakest colour first — see the module note
 * for why that order and those weights are the whole precedence story.
 *
 * `standalone` (the exported snippet) keeps only the block callout rules:
 * the token DOM is ours and the theme-owned exclusion and surface block name
 * the theme active *here*, exactly as `generateCalloutCSS` decides.
 */
export function generateMetadataColorCSS(
	entries: readonly MetadataColorEntry[],
	ctx: MetadataColorCssContext,
	standalone = false,
): string {
	const out: string[] = [];
	for (const entry of entries) {
		const css = colorRules(entry, ctx, standalone);
		if (css) out.push(`/* metadata colour: ${entry.key} */\n${css}`);
	}
	return out.join("\n\n");
}

function colorRules(
	entry: MetadataColorEntry,
	ctx: MetadataColorCssContext,
	standalone: boolean,
): string {
	const def = metadataDefinition(entry);
	const words = metadataWordSelector(entryWords(entry));
	const imp = ctx.important;
	const weight = Math.max(1, ctx.weight);
	const owned =
		standalone || ctx.themeOwnedAttrIds.length === 0
			? ""
			: `:not(${ctx.themeOwnedAttrIds
					.map((id) => `[data-callout="${cssAttrValue(id)}"]`)
					.join(", ")})`;
	const rules: string[] = [];

	// Accent and background, light then dark — the same two blocks a
	// definition gets, minus the icon, which stays the callout's own.
	const light = clearingImage(
		[...ctx.accentProps(def, "light"), ...ctx.bgProps(def, "light", true)],
		imp,
		ctx,
	);
	if (def.transparentBg) light.push(...ctx.transparentBorderProps());
	rules.push(rule(inMode(""), light));
	// The `:root` rule matches in both modes, so one copy clears both.
	if (def.transparentBg) rules.push(transparentChildrenCSS([inMode("")], true));
	if (ctx.needsDarkBlock(def)) {
		const dark = clearingImage(
			[...ctx.accentProps(def, "dark"), ...ctx.bgProps(def, "dark", true)],
			imp,
			ctx,
		);
		rules.push(rule(inMode(".theme-dark "), dark));
	}

	rules.push(...contentColorRules(entry, def, imp));

	const title = (p: string): string => `${inMode(p)} > .callout-title > .callout-title-inner`;
	const fold = (p: string): string => `${inMode(p)} > .callout-title > .callout-fold`;
	if (sweeps(def)) {
		rules.push(...ctx.textSweepRules(def, title, false, imp), sweptChevrons(def, fold, imp));
	} else if (ctx.clears.sweep) {
		rules.push(rule(title(""), unswept(imp)), rule(fold(""), [`  color: inherit${imp};`]));
	}

	rules.push(
		ctx.printGradientCSS(def, (p, suffix) => `${inMode(p)}${suffix}`, false, imp) ||
			noPrintGradient(inMode(""), imp, ctx),
	);

	if (!standalone) {
		// A guard is a theme's own prefix, `body.x` as often as `.x`. Wrapped in
		// `:is()` — same weight — because a nested selector that opens with a
		// type selector is dropped by the first engines to ship nesting.
		rules.push(
			ctx.themeSurface(def, (guard, surfaceWeight, rootQualifier) =>
				`${guard.trim() ? `:is(${guard.trim()}) ` : ""}&` +
				`${".callout".repeat(Math.max(0, surfaceWeight - weight))}${rootQualifier}`,
			),
		);
	}

	const blocks = [nest(`${".callout".repeat(weight)}[data-callout]${owned}${words}`, rules)];
	if (!standalone) blocks.push(...tokenBlocks(def, words, ctx));
	return blocks.join("\n\n");
}

/**
 * Content text: the palette's own colour when it chose one, else the theme's.
 * A palette that never set a text colour bakes `#1a1a1a` / `#e0e0e0`, and
 * forcing those would repaint the body text of a callout whose theme writes in
 * sepia; `inherit` still clears a text colour the callout's own definition has.
 */
function contentColorRules(
	entry: MetadataColorEntry,
	def: CalloutDefinition,
	imp: string,
): string[] {
	const { textColorLight, textColorDark } = entry.palette;
	const authored =
		(textColorLight !== undefined && textColorLight !== DEFAULT_TEXT_COLOR_LIGHT) ||
		(textColorDark !== undefined && textColorDark !== DEFAULT_TEXT_COLOR_DARK);
	const content = (p: string): string => `${inMode(p)} > .callout-content`;
	if (!authored) return [rule(content(""), [`  color: inherit${imp};`])];
	const rules = [rule(content(""), [`  color: ${def.textColorLight}${imp};`])];
	if (def.textColorDark !== def.textColorLight) {
		rules.push(rule(content(".theme-dark "), [`  color: ${def.textColorDark}${imp};`]));
	}
	return rules;
}

/**
 * The fold chevrons in the sweep's second colour, as
 * `CSSInjector.generateFoldArrowCSS` paints them for a definition.
 */
function sweptChevrons(def: CalloutDefinition, selectorsFor: SelectorsFor, imp: string): string {
	const light = def.bgGradient?.textToColorLight ?? "";
	const dark = def.bgGradient?.textToColorDark ?? light;
	return (
		rule(selectorsFor(""), [`  color: ${light}${imp};`]) +
		(dark === light ? "" : `\n\n${rule(selectorsFor(".theme-dark "), [`  color: ${dark}${imp};`])}`)
	);
}

/**
 * Heading bars, heading tokens and inline pills — our own DOM, so ordinary
 * (non-important) rules as the definition's are, each one class heavier than
 * its definition twin: `[data-callout]` beside the word's `:is()`, plus the
 * scope.
 */
function tokenBlocks(
	def: CalloutDefinition,
	words: string,
	ctx: MetadataColorCssContext,
): string[] {
	const colours = (): string[] =>
		(["light", "dark"] as const).map((mode) =>
			rule(
				inMode(mode === "dark" ? ".theme-dark " : ""),
				clearingImage([...ctx.ownAccentProps(def, mode), ...ctx.bgProps(def, mode)], "", ctx),
			),
		);
	const sweep = (selectorsFor: SelectorsFor, ownsBackground: boolean): string[] =>
		sweeps(def)
			? ctx.textSweepRules(def, selectorsFor, ownsBackground, "")
			: ctx.clears.sweep
				? [rule(selectorsFor(""), ownsBackground ? unswept("").slice(1) : unswept(""))]
				: [];
	const print = (hideElementGradient: boolean): string =>
		ctx.printGradientCSS(def, (p, suffix) => `${inMode(p)}${suffix}`, hideElementGradient) ||
		noPrintGradient(inMode(""), "", ctx);

	// The pill sweeps its own root (it carries the background layer), so its
	// reset leaves the background image to the colour rules above.
	const pill = nest(`.${CSS_INLINE_TOKEN}[data-callout]${words}`, [
		...colours(),
		print(true),
		...sweep((p) => `${inMode(p)}.${CSS_INLINE_TOKEN}`, true),
	]);

	const arrows = (p: string): string =>
		`${inMode(p)} .${CSS_FOLD_ARROW},\n${inMode(p)} .heading-collapse-indicator`;
	const bar = nest(`.${CSS_HEADING_LINE}[data-callout]${words}`, [
		...colours(),
		print(false),
		...sweep((p) => `${inMode(p)} .${CSS_HEADING_TITLE}`, false),
		sweeps(def)
			? sweptChevrons(def, arrows, ctx.important)
			: ctx.clears.sweep
				? rule(arrows(""), [`  color: var(--cs-accent, #086ddd)${ctx.important};`])
				: "",
	]);

	// Only a sweep reaches the heading token's own name, so without one in
	// play there is nothing to say about it.
	const tokenName = sweep((p) => `${inMode(p)} > .${CSS_TOKEN_NAME}`, false);
	const token = tokenName.length > 0
		? nest(`.${CSS_HEADING_TOKEN}[data-callout]${words}`, tokenName)
		: "";
	return [pill, bar, token].filter(Boolean);
}
