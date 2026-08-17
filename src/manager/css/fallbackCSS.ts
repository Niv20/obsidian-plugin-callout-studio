/**
 * manager/css/fallbackCSS.ts — the style an *unrecognized* callout id gets.
 *
 * Moved out of `CSSInjector`, which CLAUDE.md's ~300-line rule froze long ago.
 * It leaves cleanly because it was already parameterised on the callout list
 * rather than reaching into the injector's state: everything else it needs is
 * one of nine emitters, now named by {@link FallbackCssContext} instead of
 * reached through `this`.
 *
 * This is also the one place in the plugin that writes `!important`, and the
 * reasoning for that lives in the comments below rather than here, next to the
 * rules it justifies.
 */
import type {
	CalloutDefinition,
	CalloutIcon,
	PluginSettings,
} from "../../types";
import {
	followsCalloutColor,
	userImageFor,
} from "../../icons/packs/userImages";
import { svgToDataUri } from "../../icons/svg";
import {
	CSS_HEADING_LINE,
	CSS_INLINE_TOKEN,
	CSS_REF_TOKEN,
	CSS_UNKNOWN,
} from "../../editor/renderShared";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { tokenAttrSel } from "../../utils/calloutSelector";
import { iconBoxWidth } from "./iconBox";

/**
 * The injector's own emitters, named rather than inherited.
 *
 * Every member is a private method on `CSSInjector` and keeps its exact
 * signature, so the call sites below are unchanged from when they read `this.`.
 * Passing them explicitly is what lets this file be read — and tested — without
 * the 2000-line class around it.
 */
export interface FallbackCssContext {
	settings: PluginSettings;
	resolveSvg(icon: CalloutIcon, role: "regular"): string | null;
	getIconCSS(def: CalloutDefinition): string;
	accentProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important?: boolean,
		imposed?: boolean,
	): string[];
	ownAccentProps(def: CalloutDefinition, mode: "light" | "dark"): string[];
	bgProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important?: boolean,
	): string[];
	transparentBorderProps(important?: boolean): string[];
	needsDarkBlock(def: CalloutDefinition): boolean;
	printGradientCSS(
		def: CalloutDefinition,
		selector: (themePrefix: string, suffix: string) => string,
		isPill: boolean,
	): string;
}

/**
 * Generates a CSS rule that applies the fallback callout's styles to any
 * callout whose data-callout ID is not explicitly defined.
 * Uses `:not()` selectors to exclude all known IDs/aliases.
 */
export function generateFallbackCSS(
	callouts: CalloutDefinition[],
	ctx: FallbackCssContext,
): string {
	const fallbackId = ctx.settings.fallbackCalloutId;
	if (!fallbackId) return "";

	const fallbackDef = callouts.find((c) => c.id === fallbackId);
	if (!fallbackDef) return "";

	// Collect the *attr-form* of every known callout ID and alias — the form
	// Obsidian actually writes into `data-callout` on a block callout.
	// A space-form `:not([data-callout="multi word callout"])` never excludes
	// the element Obsidian tagged `multi-word-callout`, so the fallback rules
	// below (which carry `!important`) would forcibly override that callout's
	// real color and icon. A Set because two IDs can share one attr-form.
	//
	// The transient settings-preview definition is registered under its real
	// ID, so it is already included here and thus excluded from the tint.
	//
	// An `externalStyle` row is included too, and that is load-bearing rather
	// than an oversight: everything below carries `!important` at a
	// specificity no theme can reach, so dropping such a row from this set
	// would paint the callout *harder* than a normal one — the exact
	// opposite of handing it to the theme. "Emit nothing for it" is achieved
	// by generateCalloutCSS returning early, not by hiding it from here.
	const knownAttrIds = new Set<string>();
	for (const def of callouts) {
		knownAttrIds.add(obsidianCalloutAttrId(def.id));
		for (const alias of def.aliases ?? []) {
			knownAttrIds.add(obsidianCalloutAttrId(alias));
		}
	}

	const notSelectors = Array.from(knownAttrIds)
		.map((id) => `:not(${tokenAttrSel(id)})`)
		.join("");

	// The fallback template drawn with no icon means every unknown id in the
	// vault has none either — see iconHiddenCSS for what "no icon" costs. The
	// rules here are the same two, rewritten for this selector: `!important`
	// at a specificity the :not() chain already inflates past every
	// per-callout rule, since that is the register the whole block speaks in.
	const hidesIcon = fallbackDef.hideIcon === true;
	const iconCSS = hidesIcon ? "" : ctx.getIconCSS(fallbackDef);

	const parts: string[] = [
		"/* Fallback callout style for unrecognized types */",
	];
	if (hidesIcon) {
		parts.push(
			`body .callout${notSelectors} > .callout-title > .callout-icon {\n` +
				`  display: none !important;\n` +
				`}`,
		);
		if (ctx.settings.globalStyle.alignContentWithTitle) {
			parts.push(
				`body .callout${notSelectors} > .callout-content {\n` +
					`  padding-inline-start: 0 !important;\n` +
					`}`,
			);
		}
	}

	// Use `body` prefix + `!important` so the fallback wins over Obsidian's
	// built-in callout color/icon definitions. The `:not()` chain makes this
	// selector's specificity grow by one class-unit per known callout and
	// alias — already (0,26,1) in a modest vault — so it outranks every
	// per-callout rule on specificity alone, before the `!important` is even
	// consulted. It also matches at any nesting depth, which is fine: the
	// background it sets is a tint like every other, so nested unknown
	// callouts still step.
	const lightProps: string[] = [
		...ctx.accentProps(fallbackDef, "light", true, true),
	];
	if (iconCSS) lightProps.push(`  --callout-icon: ${iconCSS} !important;`);
	lightProps.push(...ctx.bgProps(fallbackDef, "light", true));
	// Same border pass the registered ids get, so an unknown id inherits a
	// transparent fallback whole rather than as a frame with nothing in it.
	if (fallbackDef.transparentBg) {
		lightProps.push(...ctx.transparentBorderProps(true));
	}
	parts.push(`body .callout${notSelectors} {\n${lightProps.join("\n")}\n}`);

	if (ctx.needsDarkBlock(fallbackDef)) {
		const darkProps: string[] = [
			...ctx.accentProps(fallbackDef, "dark", true, true),
		];
		darkProps.push(...ctx.bgProps(fallbackDef, "dark", true));
		parts.push(
			`body.theme-dark .callout${notSelectors} {\n${darkProps.join("\n")}\n}`,
		);
	}

	if (fallbackDef.textColorLight) {
		parts.push(
			`body .callout${notSelectors} > .callout-content {\n  color: ${fallbackDef.textColorLight} !important;\n}`,
		);
	}
	if (
		fallbackDef.textColorDark &&
		fallbackDef.textColorDark !== fallbackDef.textColorLight
	) {
		parts.push(
			`body.theme-dark .callout${notSelectors} > .callout-content {\n  color: ${fallbackDef.textColorDark} !important;\n}`,
		);
	}

	// Pack icon override for fallback (live view; PDF uses the hidden DOM
	// copy baked by paintIcons via resolveDef).
	const fallbackSvg = hidesIcon
		? null
		: ctx.resolveSvg(fallbackDef.icon, "regular");
	if (fallbackSvg) {
		const dataUri = svgToDataUri(fallbackSvg);
		const picture = userImageFor(fallbackDef.icon);
		const hide = `body .callout${notSelectors} > .callout-title > .callout-icon > svg {\n  display: none !important;\n}\n`;
		const box =
			`body .callout${notSelectors} > .callout-title > .callout-icon::after {\n` +
			`  content: "";\n` +
			`  display: inline-block;\n` +
			`  width: ${iconBoxWidth(picture)};\n` +
			`  height: var(--icon-size, 1.2em);\n`;
		// A picture that keeps its own colours is painted, not stencilled —
		// same split as generateIconOverride, which this mirrors for the
		// unknown-id fallback.
		const paint =
			picture && !followsCalloutColor(fallbackDef.icon, picture)
				? `  background-image: ${dataUri} !important;\n` +
					`  background-size: contain;\n` +
					`  background-repeat: no-repeat;\n` +
					`  background-position: center;\n`
				: `  --cs-icon-mask: ${dataUri};\n` +
					`  -webkit-mask-image: var(--cs-icon-mask) !important;\n` +
					`  mask-image: var(--cs-icon-mask) !important;\n` +
					`  -webkit-mask-size: contain;\n` +
					`  mask-size: contain;\n` +
					`  -webkit-mask-repeat: no-repeat;\n` +
					`  mask-repeat: no-repeat;\n` +
					`  background-color: var(--cs-accent) !important;\n`;
		parts.push(`@media screen {\n${hide}${box}${paint}}\n}`);
	}

	// Emoji icon override for fallback (live view).
	if (!hidesIcon && fallbackDef.icon.type === "emoji") {
		const safe = fallbackDef.icon.value
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"');
		parts.push(
			`@media screen {\n` +
				`body .callout${notSelectors} > .callout-title > .callout-icon > svg {\n  display: none !important;\n}\n` +
				`body .callout${notSelectors} > .callout-title > .callout-icon::after {\n` +
				`  content: "${safe}";\n` +
				`  display: inline-block;\n` +
				`  font-size: var(--icon-size, 1.2em);\n` +
				`  line-height: 1;\n` +
				`}\n` +
				`}`,
		);
	}

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
	// Unknown block callouts: the fallback tint carries the gradient too,
	// so it needs the same Preview-safe raster repaint. The selector mirrors
	// the fallback rules above (`body` prefix + :not() list).
	const unknownCalloutPrint = ctx.printGradientCSS(
		fallbackDef,
		(themePrefix, suffix) =>
			`body${themePrefix ? ".theme-dark" : ""} .callout${notSelectors}${suffix}`,
		false,
	);
	if (unknownCalloutPrint) parts.push(unknownCalloutPrint);

	return parts.join("\n\n");
}
