/**
 * manager/css/iconOverrides.ts — drawing a callout's icon over the one core
 * put there.
 *
 * The three `::after` rules that stand in for `--callout-icon` whenever the
 * artwork is not a Lucide id core can resolve on its own: a monochrome pack
 * glyph (a tinted mask), a user's own picture (a background image, so it keeps
 * its colours), and an emoji (a text glyph). All three also hide core's `<svg>`,
 * which is the half that makes them a *fight* rather than a contribution — and
 * why they are worth having in one module: it is the exact set of output a
 * cooperative mode has to be able to switch off.
 *
 * Every one is wrapped in `@media screen`, so none applies to PDF export. There
 * the hidden inline-SVG copy `paintIcons` bakes into the DOM shows through
 * instead, which survives Chromium's print pipeline far more reliably than a
 * CSS mask does.
 *
 * Selectors arrive already built, at whatever weight the calling mode emits at
 * (see `CSSInjector.sel`) — these functions never construct one, so they cannot
 * disagree with the rest of a callout's rules about how hard to push.
 */
import { svgToDataUri } from "../../icons/svg";
import { followsCalloutColor, userImageFor } from "../../icons/packs/userImages";
import type { CalloutIcon, UserImageIcon } from "../../types";
import { iconBoxWidth } from "./iconBox";

/**
 * A pack glyph, painted as a mask tinted with the callout's accent.
 *
 * The data URI is declared once into a custom property rather than repeated for
 * the prefixed and unprefixed mask properties. The whole stylesheet is also
 * written to localStorage on every inject (see StartupStyleCache), and an
 * inlined SVG is by far the largest thing in it, so halving each occurrence is
 * worth the indirection.
 */
export function iconMaskOverrideCSS(
	sel: string,
	svg: string,
	picture?: UserImageIcon,
	imp = "",
): string {
	return (
		`@media screen {\n` +
		`${sel} > .callout-title > .callout-icon > svg {\n` +
		`  display: none${imp};\n` +
		`}\n` +
		`${sel} > .callout-title > .callout-icon::after {\n` +
		`  --cs-icon-mask: ${svgToDataUri(svg)}${imp};\n` +
		`  content: ""${imp};\n` +
		`  display: inline-block${imp};\n` +
		`  width: ${iconBoxWidth(picture)}${imp};\n` +
		`  height: var(--icon-size, 1.2em)${imp};\n` +
		`  -webkit-mask-image: var(--cs-icon-mask)${imp};\n` +
		`  mask-image: var(--cs-icon-mask)${imp};\n` +
		`  -webkit-mask-size: contain${imp};\n` +
		`  mask-size: contain${imp};\n` +
		`  -webkit-mask-repeat: no-repeat${imp};\n` +
		`  mask-repeat: no-repeat${imp};\n` +
		`  background-color: var(--cs-accent)${imp};\n` +
		`}\n` +
		`}`
	);
}

/**
 * A user's picture, as a background rather than a mask — so it arrives with its
 * own colours instead of as a one-colour stencil. A mask is a stencil, and
 * running a logo or a photograph through one throws its colours away.
 */
export function imageOverrideCSS(
	sel: string,
	svg: string,
	picture: UserImageIcon,
	imp = "",
): string {
	return (
		`@media screen {\n` +
		`${sel} > .callout-title > .callout-icon > svg {\n` +
		`  display: none${imp};\n` +
		`}\n` +
		`${sel} > .callout-title > .callout-icon::after {\n` +
		`  content: ""${imp};\n` +
		`  display: inline-block${imp};\n` +
		`  width: ${iconBoxWidth(picture)}${imp};\n` +
		`  height: var(--icon-size, 1.2em)${imp};\n` +
		`  background-image: ${svgToDataUri(svg)}${imp};\n` +
		`  background-size: contain${imp};\n` +
		`  background-repeat: no-repeat${imp};\n` +
		`  background-position: center${imp};\n` +
		`}\n` +
		`}`
	);
}

/**
 * An emoji glyph, as `content:`. Emojis keep their own colours, so no mask and
 * no `background-color`.
 */
export function emojiOverrideCSS(
	sel: string,
	emoji: string,
	imp = "",
): string {
	// Defensive escaping for the CSS string literal (emojis contain neither
	// backslashes nor quotes, but keep it safe against future data changes).
	const safe = emoji.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return (
		`@media screen {\n` +
		`${sel} > .callout-title > .callout-icon > svg {\n` +
		`  display: none${imp};\n` +
		`}\n` +
		`${sel} > .callout-title > .callout-icon::after {\n` +
		`  content: "${safe}"${imp};\n` +
		`  display: inline-block${imp};\n` +
		`  font-size: var(--icon-size, 1.2em)${imp};\n` +
		`  line-height: 1${imp};\n` +
		`}\n` +
		`}`
	);
}

/**
 * The router between the two picture paths.
 *
 * Every library icon is a monochrome glyph, so it is drawn as a mask tinted
 * with the callout's colour. A picture the user supplied may be neither: a mask
 * is a stencil, and running a logo or a photograph through one throws its
 * colours away and leaves a silhouette. Those get a background image instead —
 * the same reasoning that already keeps emoji out of the mask path.
 */
export function iconOverrideCSS(
	sel: string,
	icon: CalloutIcon,
	svg: string,
	imp = "",
): string {
	const picture = userImageFor(icon);
	if (picture && !followsCalloutColor(icon, picture)) {
		return imageOverrideCSS(sel, svg, picture, imp);
	}
	return iconMaskOverrideCSS(sel, svg, picture, imp);
}
