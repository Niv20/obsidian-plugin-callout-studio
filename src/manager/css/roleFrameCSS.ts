/**
 * manager/css/roleFrameCSS.ts — the frame a heading bar and an inline pill
 * take from **Global callout style**: their border, corner radius, spacing and
 * scale.
 *
 * Split from `CSSInjector.generateGlobalStyleCSS`, where these two rules were
 * the tail of a method otherwise about Obsidian's block callout. They name no
 * callout and no `.callout`, only this plugin's own two classes, which is why
 * they have a second reader: the website export (`manager/web/webData.ts`)
 * needs exactly these and none of the block-callout rules before them, since a
 * published site draws its block callouts itself.
 *
 * Most values travel as CSS variables the static rules in `styles.css` read
 * with a fallback, so nothing is emitted while a setting is at its default.
 */
import { CSS_HEADING_LINE, CSS_INLINE_TOKEN } from "../../editor/tokenClasses";
import type { GlobalStyleSettings, RoleFrameStyleSettings } from "../../types";

/**
 * Border declarations for a role frame, mirroring the regular-callout border
 * logic: tinted by the element's own per-callout accent. Empty when no side is
 * enabled.
 */
function roleBorderProps(frame: Pick<RoleFrameStyleSettings, "borderSides" | "borderWidth">): string[] {
	const { top, right, bottom, left } = frame.borderSides;
	const anySide = top || right || bottom || left;
	if (!anySide) return [];
	const bStyle =
		`${frame.borderWidth}px solid ` + `color-mix(in oklch, var(--cs-accent, currentColor) 45%, transparent)`;
	if (top && right && bottom && left) {
		return [`  border: ${bStyle};`];
	}
	const props: string[] = [`  border: none;`];
	if (top) props.push(`  border-top: ${bStyle};`);
	if (right) props.push(`  border-right: ${bStyle};`);
	if (bottom) props.push(`  border-bottom: ${bStyle};`);
	if (left) props.push(`  border-left: ${bStyle};`);
	return props;
}

/** The heading-bar rule, then the inline-pill rule — each only when it says something. */
export function roleFrameRules(gs: GlobalStyleSettings): string[] {
	const rules: string[] = [];

	// Heading-bar frame. Borders are drawn directly; radius and vertical
	// text spacing go through CSS variables consumed by the static
	// .cs-heading-callout rule in styles.css (whose fallbacks are the
	// defaults, so nothing is emitted while a value is untouched).
	const headingProps = roleBorderProps(gs.heading);
	if (gs.heading.borderRadius !== 4) {
		headingProps.push(`  --cs-heading-radius: ${gs.heading.borderRadius}px;`);
	}
	if (gs.heading.paddingTop !== 0.25) {
		headingProps.push(`  --cs-heading-pad-top: ${gs.heading.paddingTop}em;`);
	}
	if (gs.heading.paddingBottom !== 0.25) {
		headingProps.push(`  --cs-heading-pad-bottom: ${gs.heading.paddingBottom}em;`);
	}
	// Gap above the bar (the outer margin, reading view only — see the
	// static .cs-heading-callout:not(.cm-line) rule in styles.css; Live
	// Preview gets the same visual effect from HeadingGapWidget, a real
	// block-level DOM node, since a margin can't safely reach .cm-line).
	// Rides this same variable-then-static-fallback rule as its siblings
	// above so the default (0) is an explicit, enforced value rather than
	// "whatever the theme's own heading margin happens to be".
	if (gs.heading.marginTop !== 0) {
		headingProps.push(`  --cs-heading-gap-top: ${gs.heading.marginTop}em;`);
	}
	if (headingProps.length > 0) {
		rules.push(`.${CSS_HEADING_LINE} {\n${headingProps.join("\n")}\n}`);
	}

	// The static 1em radius covers the default 16px inline-pill setting.
	const inlineProps = roleBorderProps(gs.inline);
	if (gs.inline.borderRadius !== 16) inlineProps.push(`  --cs-inline-radius: ${gs.inline.borderRadius}px;`);
	if (gs.inline.fontScale !== 1) {
		inlineProps.push(
			`  --cs-inline-scale: ${gs.inline.fontScale};`,
			// Pill-em compensation keeps the lift fixed to the surrounding line.
			`  --cs-inline-center-lift: ${(0.1 / gs.inline.fontScale).toFixed(3)}em;`,
		);
	}
	if (inlineProps.length > 0) {
		rules.push(`.${CSS_INLINE_TOKEN} {\n${inlineProps.join("\n")}\n}`);
	}

	return rules;
}
