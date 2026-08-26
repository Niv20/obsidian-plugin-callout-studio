/**
 * editor/roleIcon.ts — the icon on a heading callout, an inline callout or a
 * ref token.
 *
 * Two functions that have to agree: one paints the artwork, the other produces
 * the key a Live Preview widget compares to decide whether its DOM is still
 * current. Split from `renderShared` because both now fork on who owns the
 * callout — a theme-owned one wears the artwork the theme actually drew, read
 * back by `ThemeAppearanceProbe` — and that fork is the interesting part of
 * both, not of the token builder they used to sit inside.
 */
import { iconRenderKey, renderIconInto } from "../icons/renderIcon";
import { createIconResolver } from "../icons/resolver";
import {
	renderThemeIconInto,
	themeIconKey,
} from "../manager/theme/renderThemeIcon";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CalloutDefinition, CalloutRenderRole } from "../types";

/**
 * Paint a definition's icon into `iconEl` as visible, self-contained DOM, so
 * the glyph follows the surrounding element's CSS `color` in both themes.
 * Artwork that is not downloaded yet gets a pencil placeholder; the finished
 * download triggers a CSS re-inject whose paintIcons sweep repaints it.
 */
export function paintRoleIcon(
	iconEl: HTMLElement,
	def: CalloutDefinition,
	registry: CalloutRegistry,
	role: CalloutRenderRole,
): void {
	// The theme's icon here too: `def.icon` would put artwork on a heading
	// callout that appears nowhere on the block callout beside it.
	if (registry.themeOwns(def)) {
		renderThemeIconInto(iconEl, registry.themeAppearanceOf(def).icon);
		return;
	}
	renderIconInto(iconEl, def.icon, createIconResolver(registry), {
		role,
		fill: "currentColor",
		missing: { kind: "placeholder", lucideId: "pencil" },
		errorText: "•",
	});
}

/**
 * The icon half of a Live Preview widget's `eq()` snapshot.
 *
 * `iconRenderKey` alone is not enough: `hideIcon` changes the DOM this module
 * builds — no icon span at all — without changing the icon it would have drawn,
 * so two widgets either side of the toggle would compare equal and CodeMirror
 * would keep the stale one until the line was edited.
 */
export function tokenIconKey(
	def: CalloutDefinition | undefined,
	registry: CalloutRegistry,
	role: CalloutRenderRole,
): string {
	if (!def) return "";
	if (def.hideIcon === true) return "none";
	// A theme-owned callout's artwork does not come from `def.icon`, so keying
	// on it would let a widget survive a theme switch showing the old drawing.
	if (registry.themeOwns(def)) {
		return themeIconKey(registry.themeAppearanceOf(def).icon);
	}
	return iconRenderKey(def.icon, createIconResolver(registry), role);
}
