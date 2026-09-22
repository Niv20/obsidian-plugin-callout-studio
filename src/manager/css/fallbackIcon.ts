/**
 * manager/css/fallbackIcon.ts — DOM half of the weak unknown-callout fallback.
 *
 * `--callout-icon` does not directly represent Studio pack/image/emoji
 * definitions or "no icon", so those cases use a private CSS sentinel. This
 * module acts only while that sentinel is the computed winner. An exact
 * snippet replaces it through the ordinary cascade and this module restores
 * that native result (including literal SVG) instead of painting over it.
 */
import { setIcon } from "obsidian";
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

/**
 * Re-run Obsidian's one-shot icon resolution after Studio replaced the slot.
 * Reads the property now, after the new stylesheet is installed, so a theme or
 * snippet change is picked up rather than restoring stale artwork.
 */
export function restoreCoreIcon(
	calloutEl: HTMLElement,
	iconEl: HTMLElement,
): void {
	iconEl.removeClass(CSS_FALLBACK_ICON_HIDDEN);
	iconEl.empty();
	const value = coreIconValue(calloutEl);
	if (!value) return;
	if (value.startsWith("<svg")) {
		const svg = importCoreIconSvg(value, iconEl.ownerDocument);
		if (svg) iconEl.appendChild(svg);
		return;
	}
	setIcon(iconEl, value);
}
