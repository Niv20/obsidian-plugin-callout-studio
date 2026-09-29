/**
 * settings/recoveryValues.ts — one saved value, drawn for the setup comparison.
 *
 * The Setup details window never prints stored JSON and never hides a value
 * behind a "complete text" disclosure. Every value goes through a renderer here
 * that draws what the value does — a color as a swatch, an icon as the icon, a
 * gradient as a gradient, a border choice as a small frame — and names it in
 * plain words. A field this version does not know (saved by a newer one) still
 * renders, as labelled plain values in nested lists.
 *
 * Saved text reaches the DOM only as text. Colors are validated before they are
 * interpolated into CSS, and saved artwork renders only through the sanitizing
 * paths in recoveryPreview.ts.
 */
import { getLocale, getSelectableLocales, t } from "../i18n";
import { emojiLabelFor } from "../icons/packs/emoji";
import { packFor } from "../icons/registry";
import type { CalloutDefinition, CalloutIcon, PluginData } from "../types";
import { bgGradientCss, isValidHexColor, normalizeAngleDeg, sanitizeBgGradient } from "../utils/colorUtils";
import { recoveryFieldLabel } from "./recoveryDetailFields";
import { renderRecoveryIcon } from "./recoveryPreview";

/** The setup a value belongs to, for values that refer to other saved things. */
export interface RecoverySide {
	data: Partial<PluginData>;
	/** This setup's effective callout definitions, built-ins included, by id. */
	callouts: ReadonlyMap<string, CalloutDefinition>;
}

/**
 * Draws one side's value. `owner` is the saved object that holds the value — a
 * callout definition or a palette — for renderers that need its siblings: a
 * gradient starts at its owner's background color.
 */
export type ValueRenderer = (parent: HTMLElement, value: unknown, side: RecoverySide, owner?: unknown) => void;

/** Text longer than this shows as an excerpt with its length, never in full. */
const LONG_TEXT = 160;
/** Entries listed from one unknown list or object before a count takes over. */
const MAX_ENTRIES = 40;
/** Nesting shown for unknown values; deeper levels are summarized. */
const MAX_DEPTH = 6;
const SIDES = ["top", "right", "bottom", "left"] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function formatNumber(value: number): string {
	try { return value.toLocaleString(getLocale(), { maximumFractionDigits: 2 }); }
	catch { return String(value); }
}

function formatDate(time: number): string {
	try { return new Date(time).toLocaleString(getLocale()); }
	catch { return new Date(time).toLocaleString(); }
}

export function muted(parent: HTMLElement, text: string): HTMLElement {
	return parent.createSpan({ cls: "cs-recovery-muted", text });
}

/** A row of small parts — swatch, name, code — that wraps as a unit. */
function inline(parent: HTMLElement): HTMLElement {
	return parent.createSpan({ cls: "cs-recovery-value" });
}

function swatch(parent: HTMLElement, color: string): void {
	parent.createSpan({ cls: "cs-recovery-swatch", attr: { "aria-hidden": "true" } })
		.setCssProps({ "--cs-recovery-swatch": color });
}

/** Any saved value as readable text and labelled lists: the fallback for all others. */
export const renderGeneric: ValueRenderer = (parent, value, side) => generic(parent, value, side, 0);

function generic(parent: HTMLElement, value: unknown, side: RecoverySide, depth: number): void {
	if (value === undefined) { muted(parent, t("recovery.details.value.notSet")); return; }
	if (value === null) { muted(parent, t("recovery.details.null")); return; }
	if (typeof value === "boolean") { renderYesNo(parent, value, side); return; }
	if (typeof value === "number") { parent.createSpan({ text: formatNumber(value) }); return; }
	if (typeof value === "string") { renderText(parent, value, side); return; }
	if (depth >= MAX_DEPTH) { muted(parent, t("recovery.details.value.nested")); return; }
	if (Array.isArray(value)) {
		if (value.length === 0) { muted(parent, t("recovery.details.emptyList")); return; }
		const list = parent.createEl("ol", { cls: "cs-recovery-value-list" });
		for (const entry of value.slice(0, MAX_ENTRIES)) generic(list.createEl("li"), entry, side, depth + 1);
		if (value.length > MAX_ENTRIES) muted(parent, t("recovery.details.value.more", { count: value.length - MAX_ENTRIES }));
		return;
	}
	if (isRecord(value)) {
		const entries = Object.entries(value);
		if (entries.length === 0) { muted(parent, t("recovery.details.emptyObject")); return; }
		const list = parent.createEl("dl", { cls: "cs-recovery-pairs" });
		for (const [key, entry] of entries.slice(0, MAX_ENTRIES)) {
			list.createEl("dt", { text: recoveryFieldLabel(key) });
			generic(list.createEl("dd"), entry, side, depth + 1);
		}
		if (entries.length > MAX_ENTRIES) muted(parent, t("recovery.details.value.more", { count: entries.length - MAX_ENTRIES }));
		return;
	}
	// Saved settings are JSON: every value is one of the kinds above.
	muted(parent, t("recovery.details.value.nested"));
}

/** Saved text, literally; a long one as an excerpt that says how long it is. */
export const renderText: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "string") { generic(parent, value, side, 0); return; }
	if (value === "") { muted(parent, t("recovery.details.emptyText")); return; }
	if (value.length <= LONG_TEXT) { parent.createSpan({ cls: "cs-recovery-text", text: value }); return; }
	parent.createSpan({ cls: "cs-recovery-text", text: `${value.slice(0, LONG_TEXT)}…` });
	muted(parent, t("recovery.details.value.longText", { count: formatNumber(value.length) }));
};

export const renderYesNo: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "boolean") { generic(parent, value, side, 0); return; }
	parent.createSpan({ text: t(value ? "recovery.details.yes" : "recovery.details.no") });
};

/** A switch in the settings: On or Off rather than Yes or No. */
export const renderOnOff: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "boolean") { generic(parent, value, side, 0); return; }
	parent.createSpan({ text: t(value ? "recovery.details.value.on" : "recovery.details.value.off") });
};

/** Whether a context-menu entry is offered. */
export const renderShown: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "boolean") { generic(parent, value, side, 0); return; }
	parent.createSpan({ text: t(value ? "recovery.details.value.shown" : "recovery.details.value.hidden") });
};

function unit(key: string, scale = 1): ValueRenderer {
	return (parent, value, side) => {
		if (typeof value !== "number" || !Number.isFinite(value)) { generic(parent, value, side, 0); return; }
		parent.createSpan({ text: t(key, { value: formatNumber(value * scale) }) });
	};
}

export const renderPx = unit("recovery.details.value.px");
export const renderEm = unit("recovery.details.value.em");
export const renderScale = unit("recovery.details.value.scale");
export const renderPercent = unit("recovery.details.value.percent", 100);
export const renderHeadingLevel = unit("recovery.details.value.headingLevel");

/** A stored choice, named by its label key; an unknown value stays literal. */
export function renderChoice(labels: Readonly<Record<string, string>>): ValueRenderer {
	return (parent, value, side) => {
		if (typeof value === "string" && Object.hasOwn(labels, value)) parent.createSpan({ text: t(labels[value]!) });
		else generic(parent, value, side, 0);
	};
}

export const renderColor: ValueRenderer = (parent, value, side) => {
	if (!isValidHexColor(value)) { generic(parent, value, side, 0); return; }
	const row = inline(parent);
	swatch(row, value);
	row.createEl("code", { cls: "cs-recovery-code", text: value.toLowerCase() });
};

export const MATERIAL_STYLES: Readonly<Record<string, string>> = {
	outlined: "iconPicker.materialStyleOutlined", filled: "iconPicker.materialStyleFilled",
	rounded: "iconPicker.materialStyleRounded", sharp: "iconPicker.materialStyleSharp",
};
const PACK_STYLES: Readonly<Record<string, string>> = {
	"tabler-outline": "iconPicker.tablerStyleOutline", "tabler-filled": "iconPicker.tablerStyleFilled",
	"fa-solid": "iconPicker.faStyleSolid", "fa-regular": "iconPicker.faStyleRegular", "fa-brands": "iconPicker.faStyleBrands",
};
const MATERIAL_WEIGHTS: readonly number[] = [100, 200, 300, 400, 500, 600, 700];

function materialWeightText(weight: number): string {
	return MATERIAL_WEIGHTS.includes(weight)
		? `${t(`iconPicker.materialWeight${weight}`)} (${weight})`
		: formatNumber(weight);
}

export const renderMaterialWeight: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "number") { generic(parent, value, side, 0); return; }
	parent.createSpan({ text: materialWeightText(value) });
};

function isIcon(value: unknown): value is CalloutIcon {
	return isRecord(value) && typeof value.type === "string" && typeof value.value === "string";
}

function iconName(icon: CalloutIcon, data: Partial<PluginData>): string {
	if (icon.type === "emoji") return emojiLabelFor(icon.value) ?? icon.value;
	if (icon.type === "image") return data.settings?.userImages?.find(image => image.id === icon.value)?.name ?? icon.value;
	return icon.value;
}

/** Which library the drawing comes from, and the style choices that change it. */
function iconDetail(icon: CalloutIcon): string {
	const pack = packFor(icon);
	const parts = [pack ? t(pack.labelKey) : icon.type];
	const style = PACK_STYLES[icon.type];
	if (style) parts.push(t(style));
	if (icon.type === "material") {
		parts.push(t(MATERIAL_STYLES[icon.style ?? "outlined"] ?? "iconPicker.materialStyleOutlined"));
		parts.push(materialWeightText(icon.weight ?? 400));
	}
	if (icon.type === "image" && icon.recolor === true) parts.push(t("recovery.details.value.followsColor"));
	return parts.join(" · ");
}

/** The icon itself, drawn from this side's saved artwork, then its name and library. */
export const renderIcon: ValueRenderer = (parent, value, side) => {
	if (!isIcon(value)) { generic(parent, value, side, 0); return; }
	const row = inline(parent);
	row.addClass("is-icon");
	renderRecoveryIcon(row, side.data, value);
	const text = row.createSpan({ cls: "cs-recovery-value-lines" });
	text.createSpan({ text: iconName(value, side.data) });
	muted(text, iconDetail(value));
};

/** One bar per mode, each running from its owner's background color. */
export const renderGradient: ValueRenderer = (parent, value, side, owner) => {
	const gradient = sanitizeBgGradient(value);
	if (!gradient) { generic(parent, value, side, 0); return; }
	const lines = parent.createSpan({ cls: "cs-recovery-value-lines" });
	for (const mode of ["light", "dark"] as const) {
		const end = mode === "light" ? gradient.toColorLight : gradient.toColorDark;
		const start = isRecord(owner) ? owner[mode === "light" ? "bgColorLight" : "bgColorDark"] : undefined;
		const from = isValidHexColor(start) ? start : end;
		const row = inline(lines);
		row.createSpan({ cls: "cs-recovery-gradient", attr: { "aria-hidden": "true" } })
			.setCssProps({ "--cs-recovery-gradient": bgGradientCss(from, end, gradient) });
		row.createSpan({ text: t(mode === "light" ? "recovery.details.value.lightMode" : "recovery.details.value.darkMode") });
		row.createEl("code", { cls: "cs-recovery-code", text: `${from.toLowerCase()} → ${end.toLowerCase()}` });
	}
	const angle = t("recovery.details.value.angle", { value: formatNumber(normalizeAngleDeg(gradient.angleDeg)) });
	muted(lines, gradient.textGradient ? `${angle} · ${t("recovery.details.value.textGradient")}` : angle);
};

/** A small frame drawing the chosen sides, and their names. */
export const renderBorderSides: ValueRenderer = (parent, value, side) => {
	if (!isRecord(value)) { generic(parent, value, side, 0); return; }
	const row = inline(parent);
	const frame = row.createSpan({ cls: "cs-recovery-sides", attr: { "aria-hidden": "true" } });
	const on = SIDES.filter(name => value[name] === true);
	for (const name of SIDES) frame.toggleClass(`is-${name}`, value[name] === true);
	row.createSpan({
		text: on.length === 0 ? t("recovery.details.value.noBorders")
			: on.length === SIDES.length ? t("recovery.details.value.allSides")
			: on.map(name => t(`recovery.details.field.${name}`)).join(", "),
	});
};

/** One render role's icon nudge: offsets and scale, in words. */
export const renderIconAdjust: ValueRenderer = (parent, value, side) => {
	if (!isRecord(value)) { generic(parent, value, side, 0); return; }
	const parts: string[] = [];
	if (typeof value.offsetX === "number") parts.push(t("recovery.details.value.offsetX", { value: formatNumber(value.offsetX) }));
	if (typeof value.offsetY === "number") parts.push(t("recovery.details.value.offsetY", { value: formatNumber(value.offsetY) }));
	if (typeof value.size === "number") parts.push(t("recovery.details.value.size", { value: formatNumber(value.size) }));
	parent.createSpan({ text: parts.length ? parts.join(" · ") : t("recovery.details.value.default") });
};

/** Alternative ids, written the way a note uses them. */
export const renderAliases: ValueRenderer = (parent, value, side) => {
	if (!Array.isArray(value) || !value.every((alias): alias is string => typeof alias === "string")) {
		generic(parent, value, side, 0);
		return;
	}
	if (value.length === 0) { muted(parent, t("recovery.details.value.none")); return; }
	const row = inline(parent);
	for (const alias of value) row.createEl("code", { cls: "cs-recovery-chip", text: `[!${alias}]` });
};

/** A palette id, as the palette it names on this side. */
export const renderPaletteRef: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "string") { generic(parent, value, side, 0); return; }
	const palette = side.data.settings?.customPalettes?.find(entry => entry.id === value);
	const row = inline(parent);
	if (!palette) {
		row.createEl("code", { cls: "cs-recovery-code", text: value });
		muted(row, t("recovery.details.value.paletteMissing"));
		return;
	}
	for (const color of [palette.colorLight, palette.colorDark]) if (isValidHexColor(color)) swatch(row, color);
	row.createSpan({ text: palette.name });
};

/** A callout id, as the callout it names on this side: icon, name and token. */
export const renderCalloutRef: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "string") { generic(parent, value, side, 0); return; }
	if (value === "") { muted(parent, t("recovery.details.value.obsidianDefault")); return; }
	const def = side.callouts.get(value);
	const row = inline(parent);
	if (def && def.hideIcon !== true) {
		const glyph = renderRecoveryIcon(row, side.data, def.icon);
		const accent = parent.closest(".theme-dark") ? def.colorDark : def.colorLight;
		if (isValidHexColor(accent)) glyph.setCssProps({ color: accent });
	}
	if (def) row.createSpan({ text: def.displayName || def.id });
	row.createEl("code", { cls: "cs-recovery-code", text: `[!${value}]` });
	if (!def) muted(row, t("recovery.details.value.calloutMissing"));
};

/** Saved artwork: how much there is, since the picture itself is drawn beside it. */
export const renderArtwork: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "string") { generic(parent, value, side, 0); return; }
	parent.createSpan({ text: t("recovery.details.value.artwork", { size: formatNumber(Math.max(0.1, value.length / 1024)) }) });
};

export const renderDate: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "number" || !Number.isFinite(value)) { generic(parent, value, side, 0); return; }
	parent.createSpan({ text: formatDate(value) });
};

/** An interface language, by its own name. */
export const renderLanguage: ValueRenderer = (parent, value, side) => {
	if (typeof value !== "string") { generic(parent, value, side, 0); return; }
	if (value === "auto") { parent.createSpan({ text: t("settings.languageAuto") }); return; }
	const row = inline(parent);
	const name = getSelectableLocales().find(locale => locale.code === value)?.name;
	if (name) row.createSpan({ text: name });
	row.createEl("code", { cls: "cs-recovery-code", text: value });
};

/** A list of ids in order, each named the way its own side names it. */
export function renderOrder(labelOf: (id: string, side: RecoverySide) => string): ValueRenderer {
	return (parent, value, side) => {
		if (!Array.isArray(value)) { generic(parent, value, side, 0); return; }
		const list = parent.createEl("ol", { cls: "cs-recovery-value-list" });
		for (const id of value) list.createEl("li", { text: typeof id === "string" ? labelOf(id, side) : String(id) });
	};
}

/**
 * A palette as two small cards, one per mode, painted with its accent,
 * background (or gradient, or none) and text colors.
 */
export function renderPaletteCard(parent: HTMLElement, palette: unknown, side: RecoverySide): void {
	if (!isRecord(palette)) { generic(parent, palette, side, 0); return; }
	const card = parent.createDiv({ cls: "cs-recovery-palette" });
	const gradient = sanitizeBgGradient(palette.bgGradient);
	for (const mode of ["light", "dark"] as const) {
		const suffix = mode === "light" ? "Light" : "Dark";
		const accent = palette[`color${suffix}`], background = palette[`bgColor${suffix}`], text = palette[`textColor${suffix}`];
		const tile = card.createDiv({ cls: `cs-recovery-palette-tile is-${mode}` });
		const props: Record<string, string> = {};
		if (isValidHexColor(accent)) props["--cs-recovery-accent"] = accent;
		if (isValidHexColor(text)) props["--cs-recovery-palette-text"] = text;
		if (palette.transparentBg !== true && isValidHexColor(background)) {
			const end = gradient ? (mode === "light" ? gradient.toColorLight : gradient.toColorDark) : background;
			props["--cs-recovery-palette-image"] = gradient ? bgGradientCss(background, end, gradient) : `linear-gradient(${background}, ${background})`;
		}
		tile.setCssProps(props);
		tile.createDiv({ cls: "cs-recovery-palette-title", text: t(mode === "light" ? "recovery.details.value.lightMode" : "recovery.details.value.darkMode") });
		tile.createDiv({ cls: "cs-recovery-palette-body", text: t("recovery.details.value.sampleText") });
	}
}
