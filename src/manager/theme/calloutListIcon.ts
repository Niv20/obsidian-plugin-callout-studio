/**
 * manager/theme/calloutListIcon.ts — one answer to "draw this callout small",
 * for every list that offers callouts to pick from.
 *
 * Autocomplete, *Replace in vault*, the vault-stats rows and the command
 * builder all draw the same thing: a small icon and an accent beside a name.
 * They had drifted into three different answers about theme-owned callouts —
 * autocomplete tested the raw `externalStyle` field (so it missed every callout
 * the theme owns and cheerfully showed the stored colour), and the other two
 * tested nothing at all. Each was a place the plugin confidently named an
 * appearance that is not on the page.
 *
 * Quick Insert is deliberately not a caller. It renders a real callout through
 * `MarkdownRenderer`, so the theme paints it directly and there is nothing to
 * reproduce — that is the better mechanism wherever a full callout will fit,
 * and this exists for the surfaces where one will not.
 */
import { renderIconInto, renderNoIcon } from "../../icons/renderIcon";
import { createIconResolver } from "../../icons/resolver";
import type { CalloutRegistry } from "../CalloutRegistry";
import type { CalloutDefinition } from "../../types";
import { renderThemeIconInto } from "./renderThemeIcon";

/** Colour for a callout this plugin does not paint and cannot measure. */
const MUTED = "var(--text-muted)";

/**
 * Draw `def`'s icon into `iconEl` and return the accent a caller should use for
 * it — three sources, chosen by who actually paints the callout.
 *
 * - **The theme owns it** → the icon measured off a rendered callout, and the
 *   accent measured with it. Falls to a neutral placeholder and the muted
 *   colour when nothing legible came back, never to `def.icon`.
 * - **The user styles it in their own CSS** → neutral placeholder, muted. There
 *   is no rendered element of ours to measure and the snippet may draw anything
 *   at all, so the only honest answer is to decline to guess.
 * - **Callout Studio paints it** → the stored icon and colour, which is exactly
 *   what will be on the page.
 */
export function paintCalloutListIcon(
	iconEl: HTMLElement,
	def: CalloutDefinition,
	registry: CalloutRegistry,
	isDark: boolean,
): string {
	if (registry.themeOwns(def)) {
		const { accent, icon } = registry.themeAppearanceOf(def);
		renderThemeIconInto(iconEl, icon);
		return accent ?? MUTED;
	}
	if (def.externalStyle === true) {
		renderNoIcon(iconEl);
		return MUTED;
	}
	if (def.hideIcon === true) {
		renderNoIcon(iconEl);
	} else {
		renderIconInto(iconEl, def.icon, createIconResolver(registry), {
			role: "regular",
			fill: "currentColor",
			missing: { kind: "placeholder", lucideId: "pencil" },
			errorText: "📝",
		});
	}
	return isDark ? def.colorDark : def.colorLight;
}
