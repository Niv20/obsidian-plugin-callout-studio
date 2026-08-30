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
import { fallbackTokenCSS } from "./fallbackTokenCSS";
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
	/** `CalloutRegistry.standsDown` — see the early return it guards. */
	standsDown(def: CalloutDefinition): boolean;
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
	/**
	 * `CSSInjector.themeSurface` — what the active styling says about the surface
	 * of a callout it does not name. Asked here for the same reason the per-id
	 * block asks it: an unknown callout is painted by this block, so it inherits
	 * this block's quarrel with a theme that blanks the callout background.
	 */
	themeSurface(
		def: CalloutDefinition,
		selectorsAt: (guard: string, weight: number) => string,
	): string;
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
	// The template has been handed to the theme: nothing to spread. Also what
	// lets `setStyleMode` have no special case for the fallback target.
	if (ctx.standsDown(fallbackDef)) return "";

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
	// A theme-styled row is included too, and that is load-bearing: everything
	// below carries `!important` at a specificity no theme can reach, so
	// dropping one would paint it *harder* than a normal callout — the exact
	// opposite of handing it over.
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

	// The same stand-down the registered ids get. Three `.callout` repeats rather
	// than the chain's own one: this has to outrank the dark block above, which
	// `body.theme-dark` already puts one class-unit ahead of the light one.
	//
	// The guard REPLACES this block's own `body` rather than sitting in front of
	// it. Every guard the scanner accepts is a compound on the element Style
	// Settings puts its classes on, which is `<body>` itself — so `body.callout-on
	// body .callout` would be asking for a body inside a body, and match nothing
	// at all. The one case with no guard keeps the `body` it always had.
	const surface = ctx.themeSurface(
		fallbackDef,
		(guard, weight) =>
			`${guard === "" ? "body " : guard}${".callout".repeat(weight)}${notSelectors}`,
	);
	if (surface) parts.push(surface);

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

	// The plugin's own heading / inline / ref token DOM for these same unknown
	// ids — a different surface in a different register, so a different module.
	parts.push(...fallbackTokenCSS(fallbackDef, ctx));
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
