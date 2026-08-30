/**
 * manager/accentDeclarations.ts — the accent custom properties one callout
 * carries, for one theme mode.
 *
 * Four variables, and the reason there are four is version drift, one
 * deliberate hand-off, and one piece of hardening:
 *
 * - `--callout-color` is Obsidian's own, consumed by its callout chrome. Its
 *   format changed in 1.13 (full color; a bare RGB triplet before), which
 *   `calloutColorValue` resolves. **Omitted entirely for a built-in the user
 *   has not modified** — that is what lets core's own rule, and any theme that
 *   overrides it, keep deciding the accent, instead of this plugin pinning its
 *   own hex over a theme the user chose.
 * - `--cs-accent` is ours, and must always be a real color on every version, so
 *   it can be fed to `color-mix()`. For an untouched built-in it follows the
 *   same Obsidian variable core is using, so our surfaces move with the theme
 *   in lockstep with the callout itself.
 * - `--cs-accent-theme` is what makes that "must always" true. It is registered
 *   `<color>` in `styles.css`, and a theme's value passes through it on the way
 *   to `--cs-accent` — see that `@property` rule for the whole derivation. Only
 *   emitted when there IS a theme value to launder; our own hexes are validated
 *   into and out of storage (`savedCalloutRows`, the importer) and go direct.
 * - `--cs-color-rgb` is the legacy bare triplet, kept for one release for
 *   anything outside this plugin still reading it. It cannot follow a theme — a
 *   triplet cannot be derived from a `var()` — so on an untouched built-in it
 *   carries the shipped default as a best effort. Nothing in this plugin
 *   depends on it any more.
 *
 * Its own module rather than four more methods on `CSSInjector`: none of this
 * reads the injector's state. Given a hex, the Obsidian variable to defer to
 * (or none) and the two flags, the declarations are a pure function —
 * `CSSInjector` is left holding only `themeAccentVar`, which is the one part
 * that does need the registry.
 *
 * `needsDarkBlock` lives here for the same reason, and moved here rather than
 * staying a method: once the *spelling* of a theme variable can differ between
 * light and dark — ten installed themes declare one in a single mode — "does
 * anything mode-dependent differ?" stopped being a question about the
 * definition alone and became one about these declarations.
 */
import {
	accentVarSpelling,
	calloutAccentVarRef,
	calloutColorValue,
} from "../utils/calloutColorFormat";
import type { AccentDialect } from "./theme/accentDialect";
import { hexToRgbString } from "../utils/colorUtils";
import type { CalloutDefinition } from "../types";

/** Which of a definition's two colour sets a declaration is being built from. */
type CalloutMode = "light" | "dark";

/**
 * The two variables this plugin owns, without Obsidian's `--callout-color`.
 * Used on its own heading-bar / inline-pill / ref-token DOM, where core's
 * variable would go unread.
 */
export function ownAccentDeclarations(
	hex: string,
	themeVar: string | undefined,
	imp: string,
	dialect: AccentDialect,
	mode: CalloutMode,
): string[] {
	const rgb = `  --cs-color-rgb: ${hexToRgbString(hex)}${imp};`;
	if (!themeVar) return [`  --cs-accent: ${hex}${imp};`, rgb];
	return [
		`  --cs-accent-theme: ${calloutAccentVarRef(themeVar, dialect, mode)}${imp};`,
		`  --cs-accent: var(--cs-accent-theme)${imp};`,
		rgb,
	];
}

/**
 * The full set, for any surface that carries a callout's colors.
 *
 * `imposed` is for the fallback block, which paints callouts that are NOT the
 * one it took its style from. Dropping `--callout-color` there would leave an
 * unrecognized callout on its own core default rather than on the fallback's
 * colour — i.e. quietly break the setting. It gets a value spelled out instead,
 * which still follows the theme AND still imposes the right hue.
 *
 * On 1.13+ that value is the `<color>`-typed hand-off declared alongside it in
 * the same rule, so a theme still writing ≤1.12 triplets cannot reach core
 * through us — this block paints every undefined id at an `!important` no
 * per-callout rule outranks, so forwarding a value core cannot parse would take
 * all of them down at once. On ≤1.12 core wants the triplet, and its own
 * variable is already spelled in whatever format that version expects.
 */
export function accentDeclarations(
	hex: string,
	themeVar: string | undefined,
	imp: string,
	imposed: boolean,
	dialect: AccentDialect,
	mode: CalloutMode,
): string[] {
	const props: string[] = [];
	if (!themeVar) {
		props.push(`  --callout-color: ${calloutColorValue(hex, dialect)}${imp};`);
	} else if (imposed) {
		props.push(
			`  --callout-color: ${imposedValue(hex, themeVar, dialect, mode)}${imp};`,
		);
	}
	props.push(...ownAccentDeclarations(hex, themeVar, imp, dialect, mode));
	return props;
}

/**
 * What the fallback block forwards into `--callout-color` for a built-in it is
 * imposing a hue on — three cases, because the read sites and the theme's own
 * variable can want different spellings.
 *
 * - Read sites want a colour: hand over the `<color>`-typed `--cs-accent-theme`
 *   declared alongside this in the same rule, so a theme still writing ≤1.12
 *   triplets cannot reach core through us.
 * - Read sites want a triplet and the theme's variable *is* one: forward it, and
 *   the accent keeps following the theme.
 * - Read sites want a triplet and the theme's variable is a colour: there is no
 *   spelling that both follows the theme and parses, so stop following it and
 *   spell out our own triplet. This block paints every undefined id at an
 *   `!important` no per-callout rule outranks, so forwarding a value the read
 *   sites cannot parse would take all of them down at once — the same reasoning
 *   that put `--cs-accent-theme` in the first case.
 */
function imposedValue(
	hex: string,
	themeVar: string,
	dialect: AccentDialect,
	mode: CalloutMode,
): string {
	if (dialect.read === "color") return "var(--cs-accent-theme)";
	return accentVarSpelling(themeVar, dialect, mode) === "triplet"
		? `var(${themeVar})`
		: hexToRgbString(hex);
}

/**
 * True when `def` needs a `.theme-dark` override block for its accent — any of
 * its mode-dependent colours differ, **or** the theme variable it defers to is
 * spelled differently in the two modes.
 *
 * That second clause is the whole reason this moved out of `CSSInjector`: the
 * colours can be identical in both modes and the *spelling* still not be, so
 * "does anything mode-dependent differ" stopped being a question about the
 * definition alone. Nier declares all thirteen accent variables under
 * `.theme-dark` only, as triplets, and leaves light mode on core's colours —
 * without a dark block one of the two modes emits the wrong wrapper and greys
 * every surface that reads `--cs-accent`. See `ModeSpelling` in
 * `manager/theme/accentDialect.ts`.
 */
export function needsDarkBlock(
	def: Pick<
		CalloutDefinition,
		"colorLight" | "colorDark" | "bgColorLight" | "bgColorDark" | "bgGradient"
	>,
	themeVar: string | undefined,
	dialect: AccentDialect,
): boolean {
	return (
		def.colorLight !== def.colorDark ||
		def.bgColorLight !== def.bgColorDark ||
		(!!def.bgGradient &&
			def.bgGradient.toColorLight !== def.bgGradient.toColorDark) ||
		(themeVar !== undefined &&
			accentVarSpelling(themeVar, dialect, "light") !==
				accentVarSpelling(themeVar, dialect, "dark"))
	);
}
