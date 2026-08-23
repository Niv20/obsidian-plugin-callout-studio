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
 */
import {
	calloutAccentVarRef,
	calloutColorUsesRawTriplet,
	calloutColorValue,
} from "../utils/calloutColorFormat";
import { hexToRgbString } from "../utils/colorUtils";

/**
 * The two variables this plugin owns, without Obsidian's `--callout-color`.
 * Used on its own heading-bar / inline-pill / ref-token DOM, where core's
 * variable would go unread.
 */
export function ownAccentDeclarations(
	hex: string,
	themeVar: string | undefined,
	imp: string,
): string[] {
	const rgb = `  --cs-color-rgb: ${hexToRgbString(hex)}${imp};`;
	if (!themeVar) return [`  --cs-accent: ${hex}${imp};`, rgb];
	return [
		`  --cs-accent-theme: ${calloutAccentVarRef(themeVar)}${imp};`,
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
): string[] {
	const props: string[] = [];
	if (!themeVar) {
		props.push(`  --callout-color: ${calloutColorValue(hex)}${imp};`);
	} else if (imposed) {
		const themed = calloutColorUsesRawTriplet()
			? `var(${themeVar})`
			: "var(--cs-accent-theme)";
		props.push(`  --callout-color: ${themed}${imp};`);
	}
	props.push(...ownAccentDeclarations(hex, themeVar, imp));
	return props;
}
