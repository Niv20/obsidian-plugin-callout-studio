/**
 * manager/theme/readCalloutStyle.ts — which node answers which property.
 *
 * The narrowest piece of the appearance pipeline, and the one that had the bug.
 * `ThemeAppearanceProbe` decides *when* to render and what to cache;
 * `themeAppearance.ts` and `themeIcon.ts` decide what a reading *means*. This
 * decides only where to point `getComputedStyle`, which turns out to be a real
 * question with real answers:
 *
 * - the accent is not on `.callout-title` for every theme, because core's
 *   `--callout-title-color` hook paints `.callout-title-inner`;
 * - the artwork's visibility is not on `.callout-icon`, because a theme can
 *   switch off the drawing inside it and leave the slot laid out;
 * - the drawing itself may be on `.callout-icon::before` rather than on
 *   `.callout-icon`, mask and paint together.
 *
 * Reading one node where the theme spoke on another is indistinguishable from
 * the theme having said nothing, which is why each of those looked for years
 * like "this theme just uses core's colours".
 */
import type { ProbeReadout } from "./themeAppearance";

/**
 * The computed-style reader, injected so tests can drive the ladder without a
 * cascade. Mirrors the two `getComputedStyle` overloads.
 */
export type ComputedStyleReader = (
	el: Element,
	pseudo?: string | null,
) => Pick<CSSStyleDeclaration, "getPropertyValue">;

export const domReader: ComputedStyleReader = (el, pseudo) =>
	getComputedStyle(el, pseudo ?? null);

/** One node's computed style, or nothing when there is no such node. */
type Style = Pick<CSSStyleDeclaration, "getPropertyValue"> | null;

/**
 * A mask reaches the screen under either spelling and browsers do not mirror
 * one onto the other, so both have to be asked of whichever node is being read.
 */
function maskOf(style: Style): string {
	return (
		style?.getPropertyValue("mask-image") ||
		style?.getPropertyValue("-webkit-mask-image") ||
		""
	);
}

/** Everything one rendered callout can be asked, as a flat readout. */
export function readCalloutStyle(
	calloutEl: HTMLElement,
	read: ComputedStyleReader,
): ProbeReadout {
	const titleEl =
		calloutEl.querySelector<HTMLElement>(".callout-title") ?? calloutEl;
	// The element that actually holds the title text, and the only one core's
	// `--callout-title-color` hook paints. Falling back to the title band keeps
	// the reading honest if a renderer ever stops building it.
	const titleTextEl =
		calloutEl.querySelector<HTMLElement>(".callout-title-inner") ?? titleEl;
	const iconEl = calloutEl.querySelector<HTMLElement>(".callout-icon");
	// The drawing inside the slot. A theme can switch this off on its own
	// (`.callout-icon > svg { display: none }`) while leaving the slot laid out,
	// so the markup being present says nothing about it being visible.
	const iconChildEl = iconEl?.firstElementChild ?? null;
	const box = read(calloutEl);
	const title = read(titleEl);
	const titleText = titleTextEl === titleEl ? title : read(titleTextEl);
	const icon: Style = iconEl ? read(iconEl) : null;
	const iconChild: Style = iconChildEl ? read(iconChildEl) : null;
	const before: Style = iconEl ? read(iconEl, "::before") : null;

	return {
		titleColor: title.getPropertyValue("color"),
		titleTextColor: titleText.getPropertyValue("color"),
		background: box.getPropertyValue("background-color"),
		backgroundImage: box.getPropertyValue("background-image"),
		// No icon element at all is the same evidence as a hidden one: core
		// builds the slot for every callout, so its absence means the theme
		// removed it.
		iconDisplay: iconEl ? icon?.getPropertyValue("display") ?? "" : "none",
		iconMarkup: iconChildEl?.outerHTML ?? null,
		iconChildDisplay: iconChild?.getPropertyValue("display") ?? "",
		iconMask: maskOf(icon),
		iconPseudoContent: before?.getPropertyValue("content") ?? "",
		iconPseudoFont: before?.getPropertyValue("font-family") ?? "",
		iconPseudoMask: maskOf(before),
		iconPseudoBackground: before?.getPropertyValue("background-color") ?? "",
		iconPseudoColor: before?.getPropertyValue("color") ?? "",
	};
}
