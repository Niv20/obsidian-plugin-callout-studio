/**
 * settings/recoverySections.ts — what the Setup details window lists, and in
 * which order.
 *
 * A comparison is split into the sections of the settings page, in the order
 * the page shows them: the callout types first, then the custom icons and
 * picker defaults that belong to the callout editor, then the fallback
 * callout, palettes, global style, context menu, commands and language.
 * Anything this version does not know goes last, under "Other settings".
 *
 * A section holds items. An item is one thing a person would name — a callout
 * type, a palette, a picture, a command — matched between the two setups by
 * its stable id, so everything that changed about it is one numbered row group
 * rather than scattered boxes. An item holds only the fields that differ. How
 * each value is drawn is decided here, by picking a renderer from
 * recoveryValues.ts; recoveryComparisonTable.ts only lays the result out.
 */
import type { Component } from "obsidian";
import { getLocale, t } from "../i18n";
import { effectiveCallouts, type SetupCalloutComparison, type SetupChange, type SetupDetails } from "../manager/setupDetails";
import { canonical } from "../manager/syncTree";
import type { CalloutDefinition, CalloutRenderRole, PluginData } from "../types";
import { compareText } from "../utils/sorting";
import {
	builtInCommandItems, contextMenuItems, customCommandItems, iconLibraryItems, imageItems, paletteItems,
} from "./recoveryCollections";
import { recoveryFieldLabel } from "./recoveryDetailFields";
import {
	ROLE_LABELS, ROLE_ORDER, absentText, pathLabel, recordFields, type FieldSpec, type RecordFieldOptions,
	type RecoveryField, type RecoveryItem, type RecoveryReport, type RecoverySection, type RecoverySideName, type RecoverySides,
} from "./recoveryModel";
import { renderRecoveryPreview } from "./recoveryPreview";
import { renderRecoveryHeadingPreview, renderRecoveryInlinePreview } from "./recoveryRolePreview";
import {
	MATERIAL_STYLES, isRecord, renderAliases, renderBorderSides, renderCalloutRef, renderChoice, renderColor, renderEm,
	renderGeneric, renderGradient, renderIcon, renderIconAdjust, renderLanguage, renderMaterialWeight, renderOnOff,
	renderPaletteRef, renderPx, renderScale, renderText, renderYesNo, type RecoverySide,
} from "./recoveryValues";

/** The icon and its visibility come first, as in the callout editor. */
const CALLOUT_HEAD: readonly FieldSpec[] = [
	["displayName", renderText],
	["icon", renderIcon],
	["hideIcon", renderYesNo, absentText.no],
];

const CALLOUT_TAIL: readonly FieldSpec[] = [
	["paletteId", renderPaletteRef, absentText.none],
	["colorLight", renderColor], ["colorDark", renderColor],
	["bgColorLight", renderColor, absentText.automatic], ["bgColorDark", renderColor, absentText.automatic],
	["bgGradient", renderGradient, absentText.none],
	["transparentBg", renderYesNo, absentText.no],
	["textColorLight", renderColor, absentText.themeDefault], ["textColorDark", renderColor, absentText.themeDefault],
	["foldable", renderYesNo], ["defaultFolded", renderYesNo],
	["aliases", renderAliases, absentText.none],
	["metadata", renderGeneric, absentText.none],
	["iconOffsetX", renderPx, absentText.default], ["iconOffsetY", renderPx, absentText.default],
	["iconSize", renderScale, absentText.default],
	["customized", renderYesNo, absentText.no],
	["source", renderText], ["builtIn", renderYesNo],
];

function calloutFields(row: SetupCalloutComparison): RecoveryField[] {
	const before = row.before!, after = row.after!;
	// Icon nudges sit right under the icon: one row per render role that differs.
	const nudges: RecoveryField[] = ROLE_ORDER
		.filter(role => canonical(before.iconAdjust?.[role]) !== canonical(after.iconAdjust?.[role]))
		.map(role => ({
			label: t("recovery.details.field.iconAdjustRole", { role: t(ROLE_LABELS[role]) }),
			before: before.iconAdjust?.[role], after: after.iconAdjust?.[role],
			render: renderIconAdjust, absent: absentText.default(),
		}));
	const fields = [
		...recordFields(before, after, CALLOUT_HEAD, { unknown: false }),
		...nudges,
		...recordFields(before, after, CALLOUT_TAIL, { skip: [...CALLOUT_HEAD.map(([key]) => key), "iconAdjust"] }),
	];
	if (row.artworkChanged && canonical(before.icon) === canonical(after.icon)) {
		fields.push({ label: t("recovery.details.field.iconArtwork"), before: before.icon, after: after.icon, render: renderIcon });
	}
	return fields;
}

function calloutItems(details: SetupDetails, sides: RecoverySides, builtIn: boolean): RecoveryItem[] {
	return details.callouts
		.filter(row => (row.kind !== "unchanged" || row.artworkChanged) && ((row.before ?? row.after)?.builtIn === true) === builtIn)
		.map((row): RecoveryItem => ({
			key: `callout:${row.id}`,
			kind: row.kind === "unchanged" ? "changed" : row.kind,
			title: (row.before ?? row.after)?.displayName || row.id,
			code: `[!${row.id}]`,
			summary: (parent, side, component) => renderRecoveryPreview(parent, sides[side].data,
				(side === "before" ? row.before : row.after)!, component),
			fields: row.before && row.after ? calloutFields(row) : [],
		}))
		// The settings page lists callout types by display name.
		.sort((a, b) => compareText(a.title, b.title, getLocale()));
}

/** Differing fields of one settings group, from its comparable (incidental-free) changes. */
function groupFields(change: SetupChange | undefined, specs: readonly FieldSpec[], options: RecordFieldOptions = {}): RecoveryField[] {
	if (!change) return [];
	if (change.fields.some(field => field.path.length === 0)) {
		return [{ label: t("recovery.details.value.wholeGroup"), before: change.before, after: change.after, render: renderGeneric }];
	}
	// `fields` already leaves out picker memory and onboarding flags; keep only
	// the keys it names, so those never surface as "unknown" either.
	const changed = new Set(change.fields.map(field => field.path[0]!));
	const pick = (value: unknown) => isRecord(value)
		? Object.fromEntries(Object.entries(value).filter(([key]) => changed.has(key))) : value;
	return recordFields(pick(change.before), pick(change.after), specs, options);
}

/** One nested object's differing fields, such as the heading frame inside the global style. */
function nestedFields(change: SetupChange | undefined, key: string, specs: readonly FieldSpec[]): RecoveryField[] {
	if (!change || !isRecord(change.before) || !isRecord(change.after)) return [];
	return recordFields(change.before[key], change.after[key], specs);
}

/** The callout a setup's style previews use: its note, or failing that its first type. */
function sampleCallout(side: RecoverySide): CalloutDefinition | undefined {
	return side.callouts.get("note") ?? side.callouts.values().next().value;
}

const FRAME_FIELDS: readonly FieldSpec[] = [
	["borderSides", renderBorderSides], ["borderWidth", renderPx], ["borderRadius", renderPx],
];

type RolePreview = (parent: HTMLElement, data: Partial<PluginData>, def: CalloutDefinition, component: Component) => void;

const ROLE_PREVIEWS: Readonly<Record<CalloutRenderRole, RolePreview>> = {
	heading: renderRecoveryHeadingPreview,
	inline: renderRecoveryInlinePreview,
	regular: renderRecoveryPreview,
};

/** One row per render role: its frame from the global style, plus the role's own switches. */
function styleItems(changes: ReadonlyMap<string, SetupChange>, sides: RecoverySides): RecoveryItem[] {
	const style = changes.get("settings:globalStyle");
	const byRole: Record<CalloutRenderRole, RecoveryField[]> = {
		heading: [
			...nestedFields(style, "heading", [...FRAME_FIELDS, ["paddingTop", renderEm], ["paddingBottom", renderEm], ["marginTop", renderEm]]),
			...groupFields(changes.get("settings:headingCallouts"), [["enabled", renderOnOff], ["showFoldArrow", renderOnOff],
				["refCleanTitles", renderOnOff], ["refShowIcon", renderOnOff]]),
		],
		inline: [
			...nestedFields(style, "inline", [...FRAME_FIELDS, ["fontScale", renderScale]]),
			...groupFields(changes.get("settings:inlineCallouts"), [["enabled", renderOnOff], ["allowContent", renderOnOff]]),
		],
		regular: groupFields(style, [...FRAME_FIELDS, ["titleScale", renderScale], ["contentScale", renderScale],
			["alignContentWithTitle", renderOnOff]], { skip: ["heading", "inline"] }),
	};
	return ROLE_ORDER.filter(role => byRole[role].length > 0).map((role): RecoveryItem => ({
		key: `style:${role}`,
		kind: "changed",
		title: t(ROLE_LABELS[role]),
		summary: (parent, side, component) => {
			const sample = sampleCallout(sides[side]);
			if (sample) ROLE_PREVIEWS[role](parent, sides[side].data, sample, component);
		},
		fields: byRole[role],
	}));
}

function iconSourceItems(change: SetupChange | undefined): RecoveryItem[] {
	const fields = groupFields(change, [
		["materialStyleDefault", renderChoice(MATERIAL_STYLES)],
		["materialWeightDefault", renderMaterialWeight],
		["faStyleDefault", renderChoice({ solid: "iconPicker.faStyleSolid", regular: "iconPicker.faStyleRegular",
			brands: "iconPicker.faStyleBrands" }), absentText.default],
		["tablerStyleDefault", renderChoice({ outline: "iconPicker.tablerStyleOutline", filled: "iconPicker.tablerStyleFilled" }),
			absentText.default],
		["lastMaterialCategory", renderText, absentText.none],
	]);
	return fields.length ? [{ key: "iconSources", kind: "changed", title: t("recovery.details.section.iconSources"), fields }] : [];
}

type SingleValueDraw = (parent: HTMLElement, value: unknown, side: RecoverySideName, component: Component) => void;

/** A setting that is one value: the title names it and each side draws it. */
function singleValueItem(change: SetupChange | undefined, key: string, title: string, draw: SingleValueDraw): RecoveryItem[] {
	if (!change) return [];
	return [{ key, kind: change.kind, title, fields: [],
		summary: (parent, side, component) => draw(parent, side === "before" ? change.before : change.after, side, component) }];
}

/** Settings groups this version does not know, labelled by their saved keys. */
function otherItems(changes: readonly SetupChange[], handled: ReadonlySet<string>, sides: RecoverySides): RecoveryItem[] {
	return changes.filter(change => change.key.startsWith("settings:") && !handled.has(change.key)).map((change): RecoveryItem => {
		const name = change.key.slice("settings:".length);
		const whole = change.fields.length === 0 || change.fields.some(field => field.path.length === 0);
		return {
			key: `other:${name}`, kind: change.kind, title: recoveryFieldLabel(name),
			summary: whole ? (parent, side) => renderGeneric(parent, side === "before" ? change.before : change.after, sides[side]) : undefined,
			fields: whole ? [] : change.fields.map(field => ({ label: pathLabel(field.path), before: field.before,
				after: field.after, render: renderGeneric })),
		};
	});
}

/** Settings groups with a section of their own; everything else is "Other settings". */
const HANDLED_GROUPS: ReadonlySet<string> = new Set(["userImages", "iconSources", "iconLibraries", "fallbackCalloutId",
	"customPalettes", "globalStyle", "headingCallouts", "inlineCallouts", "contextMenu", "customCommands",
	"disabledFixedCommands", "language"]
	.map(name => `settings:${name}`));

/** Every difference restoring would make, grouped and ordered as the settings page is. */
export function recoveryReport(details: SetupDetails): RecoveryReport {
	const side = (data: Partial<PluginData>): RecoverySide => ({ data, callouts: effectiveCallouts(data) });
	const sides: RecoverySides = { before: side(details.current), after: side(details.source.data ?? {}) };
	if (!details.source.data) return { sections: [], sides };
	const changes = new Map(details.changes.map(change => [change.key, change]));
	const group = (name: string) => changes.get(`settings:${name}`);
	const sections: RecoverySection[] = [
		{ id: "user", title: t("settings.myCalloutTypes"), items: calloutItems(details, sides, false) },
		{ id: "builtin", title: t("settings.builtInCallouts"), items: calloutItems(details, sides, true) },
		{ id: "images", title: t("iconPicker.custom"), items: imageItems(group("userImages"), sides) },
		{ id: "iconSources", title: t("recovery.details.section.iconSources"), items: [
			...iconSourceItems(group("iconSources")), ...iconLibraryItems(group("iconLibraries")),
		] },
		{ id: "fallback", title: t("settings.fallbackCallout"), items: singleValueItem(group("fallbackCalloutId"), "fallback",
			t("settings.fallbackCallout"), (parent, value, which, component) => {
				renderCalloutRef(parent, value, sides[which]);
				const def = typeof value === "string" ? sides[which].callouts.get(value) : undefined;
				if (def) renderRecoveryPreview(parent.createDiv({ cls: "cs-recovery-side-preview" }), sides[which].data, def, component);
			}) },
		{ id: "palettes", title: t("settings.customPalettes"), items: paletteItems(group("customPalettes"), sides) },
		{ id: "style", title: t("settings.globalSettings"), items: styleItems(changes, sides) },
		{ id: "contextMenu", title: t("settings.contextMenu"), items: contextMenuItems(group("contextMenu")) },
		{ id: "commands", title: t("settings.customCommands"), items: [
			...customCommandItems(group("customCommands"), sides), ...builtInCommandItems(group("disabledFixedCommands"), sides),
		] },
		{ id: "language", title: t("settings.language"), items: singleValueItem(group("language"), "language",
			t("recovery.details.field.language"), (parent, value, which) => renderLanguage(parent, value, sides[which])) },
		{ id: "other", title: t("recovery.details.section.other"), items: otherItems(details.changes, HANDLED_GROUPS, sides) },
	];
	return { sections: sections.filter(section => section.items.length > 0), sides };
}
