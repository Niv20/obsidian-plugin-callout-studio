/**
 * settings/styleSpecs.ts — the sliders of each role's vault-wide style,
 * written down once, as data.
 *
 * Who calls it. The style pages (declarative/stylePages.ts), which build every
 * slider from these, so a range, a step or a unit is written once.
 *
 * The main idea. A slider is described by what it changes (`get` and `set` on
 * the settings, given the live settings object every time, never a copy) and
 * by how it moves (its range and step, and the digits and unit its readout
 * shows). Its default is whatever `get` reads from DEFAULT_SETTINGS.
 */
import { DEFAULT_SETTINGS } from "../constants";
import type { LocaleKey } from "../i18n";
import type { CalloutRenderRole, PluginSettings, RoleFrameStyleSettings } from "../types";

/** One slider of a role's style. */
export interface StyleSliderDef {
	/** A stable name for the slider's row; a key never changes. */
	id: string;
	/** Its name on screen. */
	label: LocaleKey;
	/** More words the settings search should find it by. */
	aliases?: string[];
	min: number;
	max: number;
	step: number;
	/** Digits after the point in the readout (always this many, so it never changes width). */
	decimals: number;
	/** Before the number in the readout, e.g. `"×"` for a scale. */
	prefix?: string;
	/** After the number in the readout, e.g. `"px"`. */
	suffix?: string;
	/** The value in `settings` now. */
	get(settings: PluginSettings): number;
	/** Put `value` into `settings`. */
	set(settings: PluginSettings, value: number): void;
}

/** The value a slider resets to. */
export function sliderDefault(def: StyleSliderDef): number {
	return def.get(DEFAULT_SETTINGS);
}

/**
 * The part of the settings holding a role's frame (borders and corners). The
 * block role's frame is the top of `globalStyle` itself; the other two have
 * their own object inside it.
 */
export function roleFrame(settings: PluginSettings, role: CalloutRenderRole): RoleFrameStyleSettings {
	if (role === "heading") return settings.globalStyle.heading;
	if (role === "inline") return settings.globalStyle.inline;
	return settings.globalStyle;
}

/** Where a role's frame is, as a dotted path into the settings (for a control row's key). */
export function roleFramePath(role: CalloutRenderRole): string {
	if (role === "heading") return "globalStyle.heading";
	if (role === "inline") return "globalStyle.inline";
	return "globalStyle";
}

/**
 * Corner rounding of a role's frame. The inline role goes to 25px, which a
 * pill needs to round its ends fully at its largest text scale (1.5×).
 */
export function cornerRoundingSlider(role: CalloutRenderRole): StyleSliderDef {
	return {
		id: `${role}-corner-rounding`,
		label: "settings.borderRadius",
		aliases: ["radius", "rounded corners"],
		min: 0,
		max: role === "inline" ? 25 : 24,
		step: 1,
		decimals: 0,
		suffix: "px",
		get: (settings) => roleFrame(settings, role).borderRadius,
		set: (settings, value) => { roleFrame(settings, role).borderRadius = value; },
	};
}

/** Border thickness of a role's frame (shown only while one of its sides has a border). */
export function borderWidthSlider(role: CalloutRenderRole): StyleSliderDef {
	return {
		id: `${role}-border-width`,
		label: "settings.borderWidth",
		aliases: ["border", "outline"],
		min: 1,
		max: 4,
		step: 0.5,
		decimals: 1,
		suffix: "px",
		get: (settings) => roleFrame(settings, role).borderWidth,
		set: (settings, value) => { roleFrame(settings, role).borderWidth = value; },
	};
}

/** Block callouts: the title's font scale. */
export const TITLE_SCALE_SLIDER: StyleSliderDef = {
	id: "regular-title-scale",
	label: "settings.titleScale",
	aliases: ["title size", "font size"],
	min: 0.5,
	max: 1.5,
	step: 0.05,
	decimals: 2,
	prefix: "×",
	get: (settings) => settings.globalStyle.titleScale,
	set: (settings, value) => { settings.globalStyle.titleScale = value; },
};

/** Block callouts: the content's font scale. */
export const CONTENT_SCALE_SLIDER: StyleSliderDef = {
	id: "regular-content-scale",
	label: "settings.contentScale",
	aliases: ["content size", "font size"],
	min: 0.5,
	max: 1.5,
	step: 0.05,
	decimals: 2,
	prefix: "×",
	get: (settings) => settings.globalStyle.contentScale,
	set: (settings, value) => { settings.globalStyle.contentScale = value; },
};

/** Inline callouts: the text's font scale. */
export const INLINE_TEXT_SCALE_SLIDER: StyleSliderDef = {
	id: "inline-text-scale",
	label: "settings.inlineTextScale",
	aliases: ["text size", "font size"],
	min: 0.5,
	max: 1.5,
	step: 0.05,
	decimals: 2,
	prefix: "×",
	get: (settings) => settings.globalStyle.inline.fontScale,
	set: (settings, value) => { settings.globalStyle.inline.fontScale = value; },
};

/**
 * Heading callouts: the space above and below the text inside the bar. One
 * slider drives both, so the text always stays centred in the bar.
 */
export const HEADING_PADDING_SLIDER: StyleSliderDef = {
	id: "heading-padding",
	label: "settings.headingPadVertical",
	aliases: ["padding"],
	min: 0,
	max: 1,
	step: 0.05,
	decimals: 2,
	suffix: "em",
	get: (settings) => settings.globalStyle.heading.paddingTop,
	set: (settings, value) => {
		settings.globalStyle.heading.paddingTop = value;
		settings.globalStyle.heading.paddingBottom = value;
	},
};

/**
 * Heading callouts: the gap above each one, which separates it from what
 * comes before (chiefly another heading callout, which would otherwise stack
 * glued to it when collapsed). Not the padding inside the bar.
 */
export const HEADING_GAP_SLIDER: StyleSliderDef = {
	id: "heading-gap",
	label: "settings.headingGap",
	aliases: ["margin", "gap"],
	min: 0,
	max: 2,
	step: 0.05,
	decimals: 2,
	suffix: "em",
	get: (settings) => settings.globalStyle.heading.marginTop,
	set: (settings, value) => { settings.globalStyle.heading.marginTop = value; },
};
