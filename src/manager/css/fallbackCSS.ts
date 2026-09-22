/**
 * manager/css/fallbackCSS.ts — the style an *unrecognized* callout id gets.
 *
 * Moved out of `CSSInjector`, which AGENTS.md's ~300-line rule froze long ago.
 * It leaves cleanly because it was already parameterised on the callout list
 * rather than reaching into the injector's state: everything else it needs is
 * one of nine emitters, now named by {@link FallbackCssContext} instead of
 * reached through `this`.
 *
 * The block-callout half deliberately stays weak: one class of specificity,
 * no `!important`, and no direct icon pseudo-element. That lets an ordinary
 * exact snippet remain the standard Obsidian override for an unknown id.
 */
import type { CalloutDefinition, PluginSettings } from "../../types";
import { fallbackTokenCSS } from "./fallbackTokenCSS";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { tokenAttrSel } from "../../utils/calloutSelector";

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
	/** `CalloutRegistry.themeOwns` — see the early return it guards. */
	themeOwns(def: CalloutDefinition): boolean;
	getIconCSS(def: CalloutDefinition): string;
	fallbackAccentProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
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
	// The template belongs to the theme: nothing of Studio's style to spread.
	if (ctx.themeOwns(fallbackDef)) return "";

	// Collect the *attr-form* of every known callout ID and alias — the form
	// Obsidian actually writes into `data-callout` on a block callout.
	// A space-form exclusion never matches the element Obsidian tagged
	// `multi-word-callout`, so the fallback would leak onto a recognized row.
	// A Set because two IDs can share one attr-form.
	//
	// The transient settings-preview definition is registered under its real
	// ID, so it is already included here and thus excluded from the tint.
	//
	// A theme-styled row is included too: it is recognized, so the unknown-id
	// fallback must never leak onto it while its own generated block is absent.
	const knownAttrIds = new Set<string>();
	for (const def of callouts) {
		knownAttrIds.add(obsidianCalloutAttrId(def.id));
		for (const alias of def.aliases ?? []) {
			knownAttrIds.add(obsidianCalloutAttrId(alias));
		}
	}

	const knownSelectors = Array.from(knownAttrIds)
		.map((id) => tokenAttrSel(id))
		.join(",");
	// `:where()` zeroes the entire exclusion list. The selector therefore stays
	// at exactly one class-unit no matter how many definitions or aliases the
	// vault contains; `.callout[data-callout="x"]` from an ordinary snippet is
	// strictly stronger and wins without source-order tricks or `!important`.
	const unknownSelector = `.callout:not(:where(${knownSelectors}))`;
	const darkUnknownSelector = `:where(.theme-dark) ${unknownSelector}`;
	const iconCSS = ctx.getIconCSS(fallbackDef);

	const parts: string[] = [
		"/* Fallback callout style for unrecognized types */",
	];
	// It matches at any nesting depth. `bgProps` emits translucent tints rather
	// than opaque fills, so nested unknown callouts keep the same stepped visual
	// depth as registered callouts.
	const lightProps: string[] = [
		...ctx.fallbackAccentProps(fallbackDef, "light"),
	];
	if (iconCSS) lightProps.push(`  --callout-icon: ${iconCSS};`);
	lightProps.push(...ctx.bgProps(fallbackDef, "light", false));
	// Same border pass the registered ids get, so an unknown id inherits a
	// transparent fallback whole rather than as a frame with nothing in it.
	if (fallbackDef.transparentBg) {
		lightProps.push(...ctx.transparentBorderProps(false));
	}
	parts.push(`${unknownSelector} {\n${lightProps.join("\n")}\n}`);

	if (ctx.needsDarkBlock(fallbackDef)) {
		const darkProps: string[] = [
			...ctx.fallbackAccentProps(fallbackDef, "dark"),
		];
		darkProps.push(...ctx.bgProps(fallbackDef, "dark", false));
		parts.push(
			`${darkUnknownSelector} {\n${darkProps.join("\n")}\n}`,
		);
	}

	if (fallbackDef.textColorLight) {
		parts.push(
			`${unknownSelector} > .callout-content {\n  color: ${fallbackDef.textColorLight};\n}`,
		);
	}
	if (
		fallbackDef.textColorDark &&
		fallbackDef.textColorDark !== fallbackDef.textColorLight
	) {
		parts.push(
			`${darkUnknownSelector} > .callout-content {\n  color: ${fallbackDef.textColorDark};\n}`,
		);
	}

	// The plugin's own heading / inline / ref token DOM for these same unknown
	// ids — a different surface in a different register, so a different module.
	parts.push(...fallbackTokenCSS(fallbackDef, ctx));
	return parts.join("\n\n");
}
