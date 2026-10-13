/**
 * manager/css/fallbackIcon.ts — DOM half of the weak unknown-callout fallback.
 *
 * `--callout-icon` does not directly represent Studio pack/image/emoji
 * definitions or "no icon", so those cases use a private CSS sentinel. This
 * module acts only while that sentinel is the computed winner. An exact
 * snippet replaces it through the ordinary cascade and this module restores
 * that native result (including literal SVG) instead of painting over it.
 */
import { getIcon, setIcon } from "obsidian";
import { createIconResolver } from "../../icons/resolver";
import { renderIconInto } from "../../icons/renderIcon";
import { userImageFor } from "../../icons/packs/userImages";
import type { CalloutIcon } from "../../types";
import type { CalloutRegistry } from "../CalloutRegistry";
import { FALLBACK_ICON_SENTINEL } from "./calloutIconProp";
import { coreIconValue, importCoreIconSvg } from "./coreIcon";
import { iconBoxWidth } from "./iconBox";

export const CSS_FALLBACK_ICON = "cs-fallback-icon";
export const CSS_FALLBACK_ICON_HIDDEN = "cs-fallback-icon-hidden";

/** Sizing shared by every visible unknown-fallback DOM copy. */
export function fallbackIconRootStyle(icon: CalloutIcon): string {
	const width = iconBoxWidth(userImageFor(icon));
	return `width:${width};height:var(--icon-size, 1.2em)`;
}

/** Paint fallback artwork, hide its box, or restore the winning native icon. */
export function paintUnknownFallbackIcon(
	calloutEl: HTMLElement,
	iconEl: HTMLElement,
	registry: CalloutRegistry,
): void {
	const fallback = registry.get(registry.settings.fallbackCalloutId);
	if (
		!fallback ||
		registry.themeOwns(fallback) ||
		coreIconValue(calloutEl) !== FALLBACK_ICON_SENTINEL
	) {
		restoreCoreIcon(calloutEl, iconEl);
		return;
	}

	if (fallback.hideIcon === true) {
		iconEl.empty();
		iconEl.addClass(CSS_FALLBACK_ICON_HIDDEN);
		return;
	}

	iconEl.removeClass(CSS_FALLBACK_ICON_HIDDEN);
	renderIconInto(iconEl, fallback.icon, createIconResolver(registry), {
		role: "regular",
		fill: "currentColor",
		missing: { kind: "placeholder", lucideId: "lucide-pencil" },
		className: CSS_FALLBACK_ICON,
		rootStyle: fallbackIconRootStyle(fallback.icon),
	});
}

/** The slice of an icon slot {@link slotAlreadyShows} looks at. */
interface SlotLike {
	childNodes: { length: number };
	firstElementChild: { outerHTML: string } | null;
}

/**
 * Whether `slot` already holds exactly the drawing `wanted` is: one child, and
 * that child's markup the same. What `setIcon` would leave there, so writing it
 * again changes nothing the reader can see.
 *
 * A `null` `wanted` (an id Obsidian has no drawing for, or markup that is not
 * an id at all) is never "already shown": the caller falls through to the full
 * restore, which is the answer it has always given.
 */
export function slotAlreadyShows(
	slot: SlotLike,
	wanted: { outerHTML: string } | null,
): boolean {
	if (!wanted || slot.childNodes.length !== 1) return false;
	const current = slot.firstElementChild;
	return current !== null && current.outerHTML === wanted.outerHTML;
}

/**
 * Re-run Obsidian's one-shot icon resolution after Studio replaced the slot.
 * Reads the property now, after the new stylesheet is installed, so a theme or
 * snippet change is picked up rather than restoring stale artwork.
 *
 * **Read first, write only a difference.** This runs for every theme-owned and
 * unknown callout in every window on every inject - which is every
 * `css-change`, so every step of a font-size drag. It used to empty the slot
 * and refill it each time, and the read of the next callout's property then
 * forced a style recalculation of the page: 1.5 ms apiece under Serenity, 66 ms
 * per event for thirty callouts, measured in Obsidian 1.14.4. Reading the value
 * before touching the slot, and leaving a slot that already holds that drawing
 * alone, makes the steady state free and leaves the DOM exactly as the full
 * restore would.
 */
export function restoreCoreIcon(
	calloutEl: HTMLElement,
	iconEl: HTMLElement,
): void {
	const value = coreIconValue(calloutEl);
	const markup = value.startsWith("<svg");
	iconEl.removeClass(CSS_FALLBACK_ICON_HIDDEN);
	if (value && !markup && slotAlreadyShows(iconEl, getIcon(value))) return;
	iconEl.empty();
	if (!value) return;
	if (markup) {
		const svg = importCoreIconSvg(value, iconEl.ownerDocument);
		if (svg) iconEl.appendChild(svg);
		return;
	}
	setIcon(iconEl, value);
}
