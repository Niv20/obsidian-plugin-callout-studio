import { t } from "../i18n";

export const FIELDS: Readonly<Record<string, string>> = {
	id: "id", displayName: "displayName", name: "name", icon: "icon", type: "type", value: "value",
	style: "style", weight: "weight", recolor: "recolor", hideIcon: "hideIcon",
	colorLight: "colorLight", colorDark: "colorDark", bgColorLight: "bgColorLight", bgColorDark: "bgColorDark",
	textColorLight: "textColorLight", textColorDark: "textColorDark", bgGradient: "bgGradient",
	transparentBg: "transparentBg", foldable: "foldable", defaultFolded: "defaultFolded",
	builtIn: "builtIn", source: "source", customized: "customized", aliases: "aliases", metadata: "metadata",
	paletteId: "paletteId", iconAdjust: "iconAdjust", iconOffsetX: "offsetX", iconOffsetY: "offsetY",
	offsetX: "offsetX", offsetY: "offsetY", iconSize: "size", size: "size",
	regular: "regular", heading: "heading", inline: "inline", version: "version",
	globalStyle: "globalStyle", contextMenu: "contextMenu", autocomplete: "autocomplete",
	iconSources: "iconSources", headingCallouts: "headingCallouts", inlineCallouts: "inlineCallouts",
	// `order` and `hidden` occur only inside `iconLibraries`, so they can carry its labels.
	iconLibraries: "iconLibraries", order: "libraryOrder", hidden: "hiddenLibraries",
	fallbackCalloutId: "fallbackCalloutId", language: "language", customPalettes: "customPalettes",
	userImages: "userImages", customCommands: "customCommands", disabledFixedCommands: "disabledFixedCommands",
	quickInsertSource: "quickInsertSource", welcomeSeen: "welcomeSeen", tutorialWelcomeSeen: "welcomeSeen",
	competitorImportBannerHandled: "competitorImportBannerHandled", iconSvgCache: "iconSvgCache",
	enabled: "enabled", items: "items", svg: "artwork", format: "format", width: "width", height: "height",
	monochrome: "monochrome", rev: "rev", addedAt: "addedAt", pack: "pack", variant: "variant",
	calloutId: "calloutId", role: "role", headingLevel: "headingLevel", action: "action", fold: "fold",
	borderSides: "borderSides", borderWidth: "borderWidth", borderRadius: "borderRadius",
	top: "top", right: "right", bottom: "bottom", left: "left", titleScale: "titleScale",
	contentScale: "contentScale", alignContentWithTitle: "alignContentWithTitle", fontScale: "fontScale",
	paddingTop: "paddingTop", paddingBottom: "paddingBottom", marginTop: "marginTop",
	refCleanTitles: "refCleanTitles", refShowIcon: "refShowIcon", showFoldArrow: "showFoldArrow", allowContent: "allowContent",
	angleDeg: "angleDeg", toColorLight: "toColorLight", toColorDark: "toColorDark", textGradient: "textGradient",
	textToColorLight: "textToColorLight", textToColorDark: "textToColorDark", bgIntensity: "bgIntensity",
	baseColor: "baseColor", colorMode: "colorMode", materialStyleDefault: "materialStyleDefault",
	materialWeightDefault: "materialWeightDefault", faStyleDefault: "faStyleDefault", tablerStyleDefault: "tablerStyleDefault",
	lastMaterialCategory: "lastMaterialCategory", lastCategory: "lastCategory", lastEmojiSkinTone: "lastEmojiSkinTone",
};

/** Unknown keys are literal saved identifiers, never guessed translations. */
export function recoveryFieldLabel(key: string): string {
	const field = Object.hasOwn(FIELDS, key) ? FIELDS[key] : undefined;
	return field ? t(`recovery.details.field.${field}`) : key;
}
