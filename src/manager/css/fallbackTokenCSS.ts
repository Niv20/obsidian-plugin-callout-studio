/**
 * manager/css/fallbackTokenCSS.ts — the fallback style, applied to the plugin's
 * OWN token DOM for ids nothing recognises.
 *
 * Split from `fallbackCSS.ts`, which paints Obsidian's block callouts. The two
 * halves shared a definition, not a job: the block half writes a `:not()` chain
 * naming every known id and speaks in `!important` because it has a theme to
 * outrank, while everything here is `.cs-inline-callout` / `.cs-heading-callout`
 * / `.cs-ref-token` — DOM this plugin invents, which no theme selector can match
 * and which therefore needs neither the chain nor the importance. Keeping them
 * in one function meant every reader of either had to hold both registers in
 * mind at once.
 *
 * The token renderer tags an unresolved id with `.cs-unknown`, so a plain class
 * rule reaches all of them and no exclusion list is needed at all.
 */
import type { CalloutDefinition } from "../../types";
import {
	CSS_HEADING_LINE,
	CSS_INLINE_TOKEN,
	CSS_REF_TOKEN,
	CSS_UNKNOWN,
} from "../../editor/renderShared";
import type { FallbackCssContext } from "./fallbackCSS";

/** The unknown-token rules, in the order they must be emitted. */
export function fallbackTokenCSS(
	fallbackDef: CalloutDefinition,
	ctx: FallbackCssContext,
): string[] {
	const parts: string[] = [];
// Unknown heading/inline tokens: the token renderer tags unresolved ids
// with .cs-unknown, so a plain class rule suffices — no :not() chain.
parts.push(
	`.${CSS_INLINE_TOKEN}.${CSS_UNKNOWN}, .${CSS_HEADING_LINE}.${CSS_UNKNOWN}, .${CSS_REF_TOKEN}.${CSS_UNKNOWN} {\n${ctx.ownAccentProps(fallbackDef, "light").join("\n")}\n}`,
);
if (fallbackDef.colorLight !== fallbackDef.colorDark) {
	parts.push(
		`.theme-dark .${CSS_INLINE_TOKEN}.${CSS_UNKNOWN}, .theme-dark .${CSS_HEADING_LINE}.${CSS_UNKNOWN}, .theme-dark .${CSS_REF_TOKEN}.${CSS_UNKNOWN} {\n${ctx.ownAccentProps(fallbackDef, "dark").join("\n")}\n}`,
	);
}

// Fallback background (solid OR gradient) on unknown heading callouts /
// inline callouts, mirroring generateTokenColorCSS for registered ids so all
// three roles share one background (ref tokens have no surface to paint).
// The .cs-unknown class doubles the class count, so this outranks the
// static styles.css tint without !important. bgProps emits nothing when
// the fallback has no custom bg, leaving the static tint in place.
const unknownBgSelectors = (themePrefix: string): string =>
	`${themePrefix}.${CSS_INLINE_TOKEN}.${CSS_UNKNOWN}, ` +
	`${themePrefix}.${CSS_HEADING_LINE}.${CSS_UNKNOWN}`;
const unknownLightBg = ctx.bgProps(fallbackDef, "light");
if (unknownLightBg.length > 0) {
	parts.push(
		`${unknownBgSelectors("")} {\n${unknownLightBg.join("\n")}\n}`,
	);
}
const unknownDarkBg = ctx.bgProps(fallbackDef, "dark");
if (
	unknownDarkBg.length > 0 &&
	unknownDarkBg.join("") !== unknownLightBg.join("")
) {
	parts.push(
		`${unknownBgSelectors(".theme-dark ")} {\n${unknownDarkBg.join("\n")}\n}`,
	);
}
// Only gradient backgrounds need the PDF-export ::before repaint; the
// method returns "" for solid backgrounds. Mirrors the known-id calls:
// pill hides its own gradient in print, block roles keep theirs.
const unknownPillPrint = ctx.printGradientCSS(
	fallbackDef,
	(themePrefix, suffix) =>
		`${themePrefix}.${CSS_INLINE_TOKEN}.${CSS_UNKNOWN}${suffix}`,
	true,
);
if (unknownPillPrint) parts.push(unknownPillPrint);
const unknownHeadingPrint = ctx.printGradientCSS(
	fallbackDef,
	(themePrefix, suffix) =>
		`${themePrefix}.${CSS_HEADING_LINE}.${CSS_UNKNOWN}${suffix}`,
	false,
);
if (unknownHeadingPrint) parts.push(unknownHeadingPrint);
	return parts;
}
