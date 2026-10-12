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
 * gradient and its print repaint, content text colour, the title sweep, the
 * fold chevron — is a function of the palette alone, so each colour is a
 * virtual definition (`metadataDefinition`) run through the injector's own
 * emitters, with a selector that names the word instead of an id. What the
 * callout's own definition says about its icon, frame and title stays.
 *
 * ## Matching a word in either separator
 *
 * A word may stand alone, or between spaces (ITS Theme's convention), or
 * between pipes (the Callout Metadata plugin's), or any mix. `~=` covers every
 * whitespace boundary; the five pipe forms cover the rest. The `i` flag
 * matches `PINK` as `pink` — ASCII only, which is why the JS side folds case
 * the same narrow way (`foldMetadataCase`).
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
	entryWords,
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
	const forms = words.flatMap((word) => {
		const v = cssAttrValue(word);
		return [
			`[data-callout-metadata~="${v}" i]`,
			`[data-callout-metadata^="${v}|" i]`,
			`[data-callout-metadata$="|${v}" i]`,
			`[data-callout-metadata*="|${v}|" i]`,
			`[data-callout-metadata*="|${v} " i]`,
			`[data-callout-metadata*=" ${v}|" i]`,
		];
	});
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

/** `""` → `:root ` so a light rule weighs what its `.theme-dark ` twin does. */
const scope = (themePrefix: string): string => themePrefix || ":root ";

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
	const owned =
		standalone || ctx.themeOwnedAttrIds.length === 0
			? ""
			: `:not(${ctx.themeOwnedAttrIds
					.map((id) => `[data-callout="${cssAttrValue(id)}"]`)
					.join(", ")})`;
	const block = (themePrefix: string, weight = ctx.weight): string =>
		`${themePrefix}${".callout".repeat(Math.max(1, weight))}` +
		`[data-callout]${owned}${words}`;
	const blockSel: SelectorsFor = (themePrefix) => block(scope(themePrefix));

	const parts: string[] = [];

	// Accent and background, light then dark — the same two blocks a
	// definition gets, minus the icon, which stays the callout's own.
	const light = [...ctx.accentProps(def, "light"), ...ctx.bgProps(def, "light", true)];
	if (def.transparentBg) light.push(...ctx.transparentBorderProps());
	parts.push(`${blockSel("")} {\n${light.join("\n")}\n}`);
	if (def.transparentBg) {
		// The `:root` rule matches in both modes, so one copy clears both.
		parts.push(transparentChildrenCSS([blockSel("")], true));
	}
	if (ctx.needsDarkBlock(def)) {
		const dark = [...ctx.accentProps(def, "dark"), ...ctx.bgProps(def, "dark", true)];
		parts.push(`${blockSel(".theme-dark ")} {\n${dark.join("\n")}\n}`);
	}

	// Content text. A palette always carries both (bakePaletteColors fills in
	// the defaults), so both are written: the callout's own text colour must
	// not show through under a colour that never chose it.
	if (def.textColorLight) {
		parts.push(`${blockSel("")} > .callout-content {\n  color: ${def.textColorLight}${imp};\n}`);
	}
	if (def.textColorDark) {
		parts.push(
			`${blockSel(".theme-dark ")} > .callout-content {\n  color: ${def.textColorDark}${imp};\n}`,
		);
	}

	parts.push(
		...ctx.textSweepRules(
			def,
			(p) => `${blockSel(p)} > .callout-title > .callout-title-inner`,
			false,
			imp,
		),
	);

	const fold = foldArrowRules(def, blockSel, words, imp);
	if (fold) parts.push(fold);

	const print = ctx.printGradientCSS(def, (p, suffix) => `${blockSel(p)}${suffix}`, false, imp);
	if (print) parts.push(print);

	if (!standalone) {
		parts.push(tokenRules(def, words, ctx));
		const surface = ctx.themeSurface(def, (guard, weight, rootQualifier) =>
			`${block(guard, weight)}${rootQualifier}`,
		);
		if (surface) parts.push(surface);
	}
	return parts.filter(Boolean).join("\n\n");
}

/**
 * Heading bars and inline pills — our own DOM, so ordinary (non-important)
 * rules as the definition's are, each one class heavier than its definition
 * twin: `[data-callout]` beside the word's `:is()`, plus the scope.
 */
function tokenRules(
	def: CalloutDefinition,
	words: string,
	ctx: MetadataColorCssContext,
): string {
	const pill = (p: string) => `${scope(p)}.${CSS_INLINE_TOKEN}[data-callout]${words}`;
	const heading = (p: string) => `${scope(p)}.${CSS_HEADING_LINE}[data-callout]${words}`;
	const both: SelectorsFor = (p) => `${pill(p)},\n${heading(p)}`;
	const parts: string[] = [];

	const accent = (mode: "light" | "dark") => [
		...ctx.ownAccentProps(def, mode),
		...ctx.bgProps(def, mode),
	];
	parts.push(`${both("")} {\n${accent("light").join("\n")}\n}`);
	parts.push(`${both(".theme-dark ")} {\n${accent("dark").join("\n")}\n}`);

	const pillPrint = ctx.printGradientCSS(def, (p, suffix) => `${pill(p)}${suffix}`, true);
	if (pillPrint) parts.push(pillPrint);
	const headingPrint = ctx.printGradientCSS(def, (p, suffix) => `${heading(p)}${suffix}`, false);
	if (headingPrint) parts.push(headingPrint);

	// The pill sweeps its own root (it carries the background layer); the bar
	// sweeps the two text runs it can hold — same split as the definition's.
	parts.push(
		...ctx.textSweepRules(
			def,
			(p) => `${scope(p)}.${CSS_INLINE_TOKEN}.${CSS_INLINE_TOKEN}[data-callout]${words}`,
			true,
			"",
		),
	);
	parts.push(
		...ctx.textSweepRules(
			def,
			(p) =>
				`${heading(p)} .${CSS_HEADING_TITLE},\n` +
				`${scope(p)}.${CSS_HEADING_TOKEN}[data-callout]${words} > .${CSS_TOKEN_NAME}`,
			false,
			"",
		),
	);
	return parts.join("\n\n");
}

/**
 * The fold chevrons in the gradient's second colour, as
 * `CSSInjector.generateFoldArrowCSS` does for a definition — only when the
 * palette sweeps its title text, which is the sweep the arrow closes.
 */
function foldArrowRules(
	def: CalloutDefinition,
	blockSel: SelectorsFor,
	words: string,
	imp: string,
): string {
	const g = def.bgGradient;
	if (!g?.textGradient || !g.textToColorLight) return "";
	const selectorsFor = (p: string): string =>
		[
			`${blockSel(p)} > .callout-title > .callout-fold`,
			`${scope(p)}.${CSS_HEADING_LINE}[data-callout]${words} .${CSS_FOLD_ARROW}`,
			`${scope(p)}.${CSS_HEADING_LINE}[data-callout]${words} .heading-collapse-indicator`,
		].join(",\n");
	const dark = g.textToColorDark ?? g.textToColorLight;
	return (
		`${selectorsFor("")} {\n  color: ${g.textToColorLight}${imp};\n}\n\n` +
		`${selectorsFor(".theme-dark ")} {\n  color: ${dark}${imp};\n}`
	);
}
