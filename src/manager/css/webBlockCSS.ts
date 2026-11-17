/**
 * manager/css/webBlockCSS.ts — a block callout's look on a published site.
 *
 * A published site draws `> [!tip]` itself, which is why the website export
 * first left block callouts alone. But a site only knows the callouts it
 * ships: Obsidian's thirteen. A callout the user made is drawn there as a
 * plain note, and one the user restyled keeps the site's colours and icon.
 * So the export carries the block role too, as rules for the element the
 * site already built. No script: a stylesheet reaches every service, and
 * Obsidian Publish loads its script on a custom domain only.
 *
 * ## Each site reads a colour its own way
 *
 * The three sites agree on the element (`.callout[data-callout="id"]` with a
 * `.callout-title`, a `.callout-icon` and a `.callout-content`) and on
 * little else. {@link WebBlockSite} names the difference:
 *
 * | site      | colour                                   | icon slot                        |
 * | --------- | ---------------------------------------- | -------------------------------- |
 * | `quartz`  | `--color`, `--border`, `--bg` (\*)       | an empty box, masked by a URL    |
 * | `publish` | `--callout-color`, a colour              | Obsidian's `<svg>`               |
 * | `garden`  | `--callout-color`, a bare `r, g, b`      | a box a script adds on load      |
 *
 * (\*) and `--callout-color` where the site wears a converted Obsidian theme,
 * whose rules sit in cascade layers under Quartz's own.
 *
 * A callout says its colour once, in this plugin's own `--cs-accent`, and one
 * line per site points the site's variable at it. The dark rule then restates
 * the accent alone, and a metadata colour (`[!tip|pink]`) only has to move the
 * accent to recolour the whole callout.
 *
 * A fourth site, `generic`, was here until 2026-11-16, for the script the
 * export wrote for any other site: with no variable to trust it set the fill,
 * the frame and the title's colour itself. It went with that target;
 * `docs/internals-docs/web-target-another-site.md` keeps its rules.
 *
 * ## What is carried, and what is the site's
 *
 * Carried: the accent, the background (flat, gradient or none), the content
 * text colour the user chose, the icon and its nudge, the title sweep, and
 * what **Global callout style** changed from its defaults. Left to the site:
 * its padding, its type, its fold arrow, and everything about a built-in the
 * user never touched ({@link WebBlockCssContext.followsSite}), which stays in
 * the site's own colours exactly as an untouched built-in stays in the
 * theme's inside the vault.
 *
 * ## Weight
 *
 * Every rule repeats `.callout` ({@link WEB_BLOCK_WEIGHT}), so it outranks the
 * site's own `.callout[data-callout="tip"]` wherever the site puts this
 * stylesheet in its `<head>`. Nothing is `!important`: the site's owner can
 * still restyle a callout with an ordinary rule of their own.
 *
 * Dark mode is written as `.theme-dark`, as everywhere in this plugin;
 * `manager/web/targets.ts` rewrites it for Quartz.
 */
import { svgToDataUri } from "../../icons/svg";
import type { CalloutDefinition, GlobalStyleSettings, PluginSettings, UserImageIcon } from "../../types";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { cssAttrValue } from "../../utils/calloutSelector";
import { DEFAULT_TEXT_COLOR_DARK, DEFAULT_TEXT_COLOR_LIGHT, hexToRgbString } from "../../utils/colorUtils";
import { isDefaultIconAdjust, resolveIconAdjust } from "../../utils/iconAdjust";
import { blockAlignmentCSS } from "./alignmentCSS";
import { bgProps, transparentChildrenCSS } from "./backgroundProps";
import { iconBoxWidth } from "./iconBox";
import { emojiOverrideCSS, iconMaskOverrideCSS, imageOverrideCSS } from "./iconOverrides";
import { transparentBorderProps } from "./transparentBorder";

/** Whose block callout the rules are written for. See the module note. */
export type WebBlockSite = "quartz" | "publish" | "garden";

/**
 * A callout's block icon, as what a stylesheet can do with it.
 *
 * - `mask` — a one-colour drawing, tinted with the accent;
 * - `image` — a picture of the user's own, in its own colours;
 * - `text` — an emoji;
 * - `hidden` — the callout draws no icon;
 * - `site` — the artwork is not here, so the site's icon stays.
 */
export type WebBlockArtwork =
	| { kind: "mask"; svg: string; picture?: UserImageIcon }
	| { kind: "image"; svg: string; picture: UserImageIcon }
	| { kind: "text"; text: string }
	| { kind: "hidden" }
	| { kind: "site" };

/** What the rules need from outside: the settings, the artwork, one emitter. */
export interface WebBlockCssContext {
	settings: PluginSettings;
	artwork(def: CalloutDefinition): WebBlockArtwork;
	/**
	 * A built-in the user never changed. The site draws it already, in the
	 * site's own colours, and is left to.
	 */
	followsSite(def: CalloutDefinition): boolean;
	/** `CSSInjector.textSweepRules`, for the title of a gradient palette. */
	textSweepRules(def: CalloutDefinition, selectorsFor: (themePrefix: string) => string): string[];
}

/** `.callout` repetitions in every selector here — see the module note. */
export const WEB_BLOCK_WEIGHT = 2;

/** Quartz's icon box and the gap after it (`callouts.scss`, Quartz 4 and 5). */
const QUARTZ_ICON_SIZE = "18px";
const QUARTZ_TITLE_GAP = "5px";

const DARK = ".theme-dark ";

/** The one line (or few) that points a site's own colour at `--cs-accent`. */
const SITE_ACCENT: Record<WebBlockSite, readonly string[]> = {
	// Quartz writes its three as `#448aff`, `#448aff44` and `#448aff10`. A
	// Quartz site that wears a converted Obsidian theme (Quartz 5's `obsidian`
	// template does) reads Obsidian's variable instead, and paints a callout it
	// has no rule for as a plain quotation — so the colour is said both ways,
	// and the fill and the frame are set, not left to a variable.
	quartz: [
		"  --color: var(--cs-accent);",
		"  --border: color-mix(in srgb, var(--cs-accent) 27%, transparent);",
		"  --bg: color-mix(in srgb, var(--cs-accent) 6%, transparent);",
		"  --callout-color: var(--cs-accent);",
		"  background-color: var(--bg);",
		"  border-color: var(--border);",
	],
	publish: ["  --callout-color: var(--cs-accent);"],
	// Digital Garden's stylesheet reads it as `rgb(var(--callout-color))`.
	garden: ["  --callout-color: var(--cs-color-rgb);"],
};

/** The site's own colour for a callout, as a colour. */
const SITE_COLOUR: Record<WebBlockSite, string> = {
	quartz: "var(--callout-color, var(--color))",
	publish: "var(--callout-color)",
	garden: "rgb(var(--callout-color))",
};

const rule = (selector: string, props: readonly string[]): string => `${selector} {\n${props.join("\n")}\n}`;

/**
 * The spellings of one name a site may write into `data-callout`. Obsidian,
 * Publish and Digital Garden dasherize `my callout`; Quartz 5 keeps the space.
 */
function attrForms(name: string): string[] {
	const dashed = obsidianCalloutAttrId(name);
	const spaced = name.trim().toLowerCase().replace(/\s+/g, " ");
	return spaced === dashed ? [dashed] : [dashed, spaced];
}

/** Every `data-callout` spelling of every name of `defs`, once each, sorted. */
function attrIdsOf(defs: readonly CalloutDefinition[]): string[] {
	const ids = new Set<string>();
	for (const def of defs) {
		for (const name of [def.id, ...(def.aliases ?? [])]) for (const form of attrForms(name)) ids.add(form);
	}
	return [...ids].sort();
}

const blockSel = (attrId: string, themePrefix = ""): string =>
	`${themePrefix}${".callout".repeat(WEB_BLOCK_WEIGHT)}[data-callout="${cssAttrValue(attrId)}"]`;

/** The selectors one look is written on, under a theme prefix. */
type SelectorsFor = (themePrefix: string) => string[];

/** A callout's accent in this plugin's own two variables. */
const ownAccent = (hex: string): string[] => [`  --cs-accent: ${hex};`, `  --cs-color-rgb: ${hexToRgbString(hex)};`];

/**
 * The accent declarations for one mode. The site's line rides in the light
 * rule only: it reads `--cs-accent`, so it follows the dark rule by itself —
 * and repeating a `background-color` there would paint over a background the
 * light rule set for both modes.
 */
export function webBlockAccentProps(def: CalloutDefinition, mode: "light" | "dark", site: WebBlockSite): string[] {
	return mode === "dark" ? ownAccent(def.colorDark) : [...ownAccent(def.colorLight), ...SITE_ACCENT[site]];
}

/** A text colour the user chose, not the default a palette bakes when it has none. */
function hasAuthoredText(def: CalloutDefinition): boolean {
	return (
		(def.textColorLight !== undefined && def.textColorLight !== DEFAULT_TEXT_COLOR_LIGHT) ||
		(def.textColorDark !== undefined && def.textColorDark !== DEFAULT_TEXT_COLOR_DARK)
	);
}

/** The icon box's width for a picture that is not square, else `null`. */
function wideBox(picture: UserImageIcon | undefined): string | null {
	const width = iconBoxWidth(picture);
	return width === iconBoxWidth(undefined) ? null : width;
}

/**
 * Quartz's icon slot is an empty box painted in `--color` through a mask it
 * reads from `--callout-icon`. A one-colour drawing therefore only needs that
 * variable (set on the callout, with its accent); a picture or an emoji has to
 * switch the mask off and paint the box itself.
 */
function quartzIconRules(artwork: WebBlockArtwork, list: (prefix: string, tail?: string) => string): string[] {
	const icon = list("", " > .callout-title > .callout-icon");
	const noMask = ["  -webkit-mask-image: none;", "  mask-image: none;", "  background-color: transparent;"];
	switch (artwork.kind) {
		case "mask": {
			const width = wideBox(artwork.picture);
			if (!width) return [];
			return [
				rule(icon, [
					`  width: ${width};`,
					`  flex-basis: ${width};`,
					`  -webkit-mask-size: ${width} var(--icon-size);`,
					`  mask-size: ${width} var(--icon-size);`,
				]),
			];
		}
		case "image": {
			const width = wideBox(artwork.picture);
			return [
				rule(icon, [
					...noMask,
					`  background-image: ${svgToDataUri(artwork.svg)};`,
					"  background-repeat: no-repeat;",
					...(width
						? [
								`  width: ${width};`,
								`  flex-basis: ${width};`,
								`  background-size: ${width} var(--icon-size);`,
							]
						: []),
				]),
			];
		}
		case "text":
			return [
				rule(icon, noMask),
				rule(list("", " > .callout-title > .callout-icon::before"), [
					`  content: "${cssAttrValue(artwork.text)}";`,
					"  display: block;",
					"  font-size: var(--icon-size);",
					"  line-height: 1;",
					"  text-align: center;",
				]),
			];
		default:
			return [];
	}
}

/**
 * Obsidian's icon slot holds an `<svg>` the site resolved from a Lucide name.
 * It is hidden and the artwork drawn after it, exactly as in a vault
 * (`iconOverrides.ts`) — which also covers Digital Garden, whose script adds
 * the slot on load and fills it from a CDN.
 */
function obsidianIconRules(artwork: WebBlockArtwork, sels: readonly string[]): string[] {
	switch (artwork.kind) {
		case "mask":
			return [iconMaskOverrideCSS(sels, artwork.svg, artwork.picture)];
		case "image":
			return [imageOverrideCSS(sels, artwork.svg, artwork.picture)];
		case "text":
			return [emojiOverrideCSS(sels, artwork.text)];
		default:
			return [];
	}
}

/** One callout's rules, on whatever selectors `sels` names. */
function lookRules(def: CalloutDefinition, site: WebBlockSite, ctx: WebBlockCssContext, sels: SelectorsFor): string[] {
	const gs = ctx.settings.globalStyle;
	const list = (prefix: string, tail = ""): string =>
		sels(prefix)
			.map((sel) => `${sel}${tail}`)
			.join(",\n");
	const artwork = ctx.artwork(def);
	const aligned = gs.alignContentWithTitle;
	const parts: string[] = [];

	const lightOwn = [...ownAccent(def.colorLight), ...bgProps(def, "light")];
	const light = [...webBlockAccentProps(def, "light", site), ...bgProps(def, "light")];
	if (def.transparentBg) light.push(...transparentBorderProps(gs.borderSides));
	if (site === "quartz" && artwork.kind === "mask") light.push(`  --callout-icon: ${svgToDataUri(artwork.svg)};`);
	// A picture's box can be wider than a square; the content indent follows it.
	const picture = artwork.kind === "mask" || artwork.kind === "image" ? artwork.picture : undefined;
	if (aligned && wideBox(picture)) {
		const size = site === "quartz" ? QUARTZ_ICON_SIZE : "var(--icon-size, 1.2em)";
		light.push(`  --cs-align-icon-inline-size: ${iconBoxWidth(picture).replace("var(--icon-size, 1.2em)", size)};`);
	}
	parts.push(rule(list(""), light));

	const dark = [...webBlockAccentProps(def, "dark", site), ...bgProps(def, "dark")];
	if (dark.join("") !== lightOwn.join("")) parts.push(rule(list(DARK), dark));

	if (def.transparentBg && site !== "quartz") parts.push(transparentChildrenCSS(sels("")));

	if (hasAuthoredText(def)) {
		if (def.textColorLight) {
			parts.push(rule(list("", " > .callout-content"), [`  color: ${def.textColorLight};`]));
		}
		if (def.textColorDark && def.textColorDark !== def.textColorLight) {
			parts.push(rule(list(DARK, " > .callout-content"), [`  color: ${def.textColorDark};`]));
		}
	}

	if (artwork.kind === "hidden") {
		parts.push(rule(list("", " > .callout-title > .callout-icon"), ["  display: none;"]));
		if (aligned) parts.push(rule(list("", " > .callout-content"), ["  padding-inline-start: 0;"]));
	} else {
		parts.push(...(site === "quartz" ? quartzIconRules(artwork, list) : obsidianIconRules(artwork, sels(""))));
		const adjust = resolveIconAdjust(def, "regular");
		if (!isDefaultIconAdjust(adjust)) {
			const transforms: string[] = [];
			if (adjust.offsetX !== 0 || adjust.offsetY !== 0) {
				transforms.push(`translate(${adjust.offsetX}px, ${adjust.offsetY}px)`);
			}
			if (adjust.size !== 1) transforms.push(`scale(${adjust.size})`);
			parts.push(
				rule(list("", " > .callout-title > .callout-icon"), [
					`  transform: ${transforms.join(" ")};`,
					"  transform-origin: center;",
				]),
			);
		}
	}

	// The title sweep of a gradient palette, and the fold arrow in its second
	// colour — as `CSSInjector.generateCalloutCSS` and `generateFoldArrowCSS`.
	const title = (prefix: string): string => list(prefix, " > .callout-title > .callout-title-inner");
	const sweep = ctx.textSweepRules(def, title);
	parts.push(...sweep);
	const arrow = def.bgGradient?.textGradient ? def.bgGradient.textToColorLight : undefined;
	if (arrow && sweep.length > 0 && site !== "quartz") {
		const fold = (prefix: string): string => list(prefix, " > .callout-title > .callout-fold");
		const arrowDark = def.bgGradient?.textToColorDark ?? arrow;
		parts.push(rule(fold(""), [`  color: ${arrow};`]));
		if (arrowDark !== arrow) parts.push(rule(fold(DARK), [`  color: ${arrowDark};`]));
	}

	return parts.filter(Boolean);
}

/**
 * What **Global callout style** says about a block callout, for the callouts
 * the vault defines. As `CSSInjector.generateGlobalStyleCSS`, without the
 * importance: only a setting moved off its default is written, so a site
 * keeps its own frame until the user asked for another.
 */
function globalRules(attrIds: readonly string[], site: WebBlockSite, gs: GlobalStyleSettings): string[] {
	if (attrIds.length === 0) return [];
	const selectors = attrIds.map((id) => blockSel(id));
	const selectorsFor = (tail: string): string => selectors.map((sel) => `${sel}${tail}`).join(",\n");
	const parts: string[] = [];
	const obsidianDom = site === "publish" || site === "garden";
	const alignment = blockAlignmentCSS(selectors, gs.alignContentWithTitle && obsidianDom, false);
	if (gs.alignContentWithTitle && obsidianDom) parts.push(...alignment.iconRules);

	const props: string[] = [];
	if (gs.borderRadius !== 4) props.push(`  border-radius: ${gs.borderRadius}px;`);
	const { top, right, bottom, left } = gs.borderSides;
	const stroke = `${gs.borderWidth}px solid color-mix(in oklch, var(--cs-accent, currentColor) 45%, transparent)`;
	if (top && right && bottom && left) {
		props.push(`  border: ${stroke};`);
	} else if (top || right || bottom || left) {
		props.push("  border: none;");
		if (top) props.push(`  border-top: ${stroke};`);
		if (right) props.push(`  border-right: ${stroke};`);
		if (bottom) props.push(`  border-bottom: ${stroke};`);
		if (left) props.push(`  border-left: ${stroke};`);
	}
	if (props.length > 0) parts.push(rule(selectorsFor(""), props));

	if (gs.titleScale !== 1) {
		parts.push(
			rule(selectorsFor(" > .callout-title > .callout-title-inner"), [`  font-size: ${gs.titleScale}em;`]),
		);
	}
	if (gs.contentScale !== 1) {
		parts.push(rule(selectorsFor(" > .callout-content"), [`  font-size: ${gs.contentScale}em;`]));
	}

	if (gs.alignContentWithTitle && obsidianDom) parts.push(...alignment.contentRules);
	if (gs.alignContentWithTitle && site === "quartz") {
		// Quartz's title is its icon box, a gap, then the text.
		parts.push(
			rule(selectorsFor(" > .callout-content"), [
				`  padding-inline-start: calc(var(--cs-align-icon-inline-size, ${QUARTZ_ICON_SIZE}) + ${QUARTZ_TITLE_GAP});`,
			]),
		);
	}
	return parts.length > 0 ? ["/* Global callout style: block callouts */", ...parts] : [];
}

/**
 * The block-callout rules for one site: the global frame, each callout's own
 * look, and the fallback's look on every callout the vault does not define.
 *
 * `defs` are the callouts a note may name. The fallback excludes all of them
 * by name, an untouched built-in included, so what the site draws for one is
 * never painted over.
 */
export function webBlockCSS(defs: readonly CalloutDefinition[], site: WebBlockSite, ctx: WebBlockCssContext): string {
	const parts: string[] = [...globalRules(attrIdsOf(defs), site, ctx.settings.globalStyle)];

	// An untouched built-in keeps the site's colours. Its accent still has to
	// say what that colour is, for the global border and for anything else
	// that reads it.
	const following = attrIdsOf(defs.filter((def) => ctx.followsSite(def)));
	if (following.length > 0) {
		parts.push(rule(following.map((id) => blockSel(id)).join(",\n"), [`  --cs-accent: ${SITE_COLOUR[site]};`]));
	}

	for (const def of defs) {
		if (ctx.followsSite(def)) continue;
		const ids = attrIdsOf([def]);
		parts.push(...lookRules(def, site, ctx, (prefix) => ids.map((id) => blockSel(id, prefix))));
	}

	const fallback = defs.find((def) => def.id === ctx.settings.fallbackCalloutId);
	if (fallback && !ctx.followsSite(fallback)) {
		// `:where()` keeps the exclusion weightless, so this weighs what a
		// callout's own rule does and the two never meet on one element.
		const known = attrIdsOf(defs)
			.map((id) => `[data-callout="${cssAttrValue(id)}"]`)
			.join(",");
		const unknown = (prefix: string): string[] => [
			`${prefix}${".callout".repeat(WEB_BLOCK_WEIGHT)}[data-callout]:not(:where(${known}))`,
		];
		parts.push("/* Fallback callout style for unrecognized types */", ...lookRules(fallback, site, ctx, unknown));
	}

	return parts.filter((part) => part.trim()).join("\n\n");
}
