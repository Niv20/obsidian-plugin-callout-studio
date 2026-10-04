/**
 * settings/recoveryCollections.ts — the saved lists in the setup comparison:
 * custom icons, palettes, commands and context-menu entries.
 *
 * Each of these is a list whose entries carry a stable `id`, so an entry is
 * matched between the two setups by that id: a renamed palette is still one
 * palette on one row, with its new name as a changed field. A list whose shared
 * entries only changed places gets a single "order" item rather than every
 * entry reading as changed.
 */
import { t } from "../i18n";
import { FIXED_COMMAND_IDS, FIXED_COMMAND_NAME_KEYS } from "../editor/commands";
import { keyedRows, type SetupChange } from "../manager/setupDetails";
import { canonical } from "../manager/syncTree";
import type {
	CalloutDefinition, CalloutRenderRole, CustomCommand, IconLibrarySettings, IconSourceId, UserImageIcon,
} from "../types";
import { describeCommand, resolveAction, resolveFold, resolveHeadingLevel } from "../utils/customCommands";
import { mergeIconLibraries } from "../utils/iconSourcesMerge";
import { ICON_SOURCES, ICON_SOURCE_IDS } from "../icons/registry";
import { isDownloadable, libraryOrder } from "../icons/iconLibraries";
import { ITEM_LABEL_KEY } from "./MenuCustomizationModal";
import {
	ROLE_LABELS, ROLE_ORDER, absentText, recordFields, type FieldSpec, type RecoveryField, type RecoveryItem,
	type RecoverySideName, type RecoverySides,
} from "./recoveryModel";
import { renderRecoveryImage } from "./recoveryPreview";
import {
	isRecord, renderArtwork, renderCalloutRef, renderChoice, renderColor, renderDate, renderGeneric, renderGradient,
	renderHeadingLevel, renderOnOff, renderOrder, renderPaletteCard, renderPercent, renderPx, renderShown, renderText,
	renderYesNo, type RecoverySide,
} from "./recoveryValues";

type Entry = Record<string, unknown>;

interface CollectionSpec {
	/** Key prefix, unique per list. */
	prefix: string;
	/** What a person calls the entry, on the side that holds it. */
	title: (entry: Entry, side: RecoverySide) => string;
	note?: string;
	/** Draws the entry as one side has it. */
	summary?: (parent: HTMLElement, entry: Entry, side: RecoverySide) => void;
	fields: readonly FieldSpec[];
	/** Title of the item reporting that shared entries changed places. */
	orderTitle: string;
}

function valueOf(change: SetupChange, side: RecoverySideName): unknown {
	return side === "before" ? change.before : change.after;
}

/** A value that is not the list this build expects: shown whole, as one item. */
function wholeItem(change: SetupChange, key: string, title: string, sides: RecoverySides): RecoveryItem {
	return { key, kind: change.kind, title, fields: [],
		summary: (parent, side) => renderGeneric(parent, valueOf(change, side), sides[side]) };
}

/** One item per entry that differs, matched by id, plus one for a changed order. */
function collectionItems(change: SetupChange | undefined, sides: RecoverySides, spec: CollectionSpec): RecoveryItem[] {
	if (!change) return [];
	const before = Array.isArray(change.before) ? keyedRows(change.before) : change.before === undefined ? new Map<string, Entry>() : null;
	const after = Array.isArray(change.after) ? keyedRows(change.after) : change.after === undefined ? new Map<string, Entry>() : null;
	if (!before || !after) return [wholeItem(change, `${spec.prefix}:*`, spec.orderTitle, sides)];
	const items: RecoveryItem[] = [];
	for (const id of new Set([...before.keys(), ...after.keys()])) {
		const current = before.get(id), restored = after.get(id);
		if (canonical(current) === canonical(restored)) continue;
		const shown = current ?? restored!, owner = current ? sides.before : sides.after;
		items.push({
			key: `${spec.prefix}:${id}`,
			kind: !current ? "added" : !restored ? "removed" : "changed",
			title: spec.title(shown, owner),
			note: spec.note,
			summary: spec.summary && ((parent, side) => spec.summary!(parent, (side === "before" ? current : restored)!, sides[side])),
			fields: current && restored ? recordFields(current, restored, spec.fields) : [],
		});
	}
	const shared = (rows: Map<string, Entry>, other: Map<string, Entry>) => [...rows.keys()].filter(id => other.has(id));
	if (canonical(shared(before, after)) !== canonical(shared(after, before))) {
		items.push({ key: `${spec.prefix}:$order`, kind: "changed", title: spec.orderTitle, fields: [],
			summary: (parent, side) => {
				const rows = side === "before" ? before : after;
				renderOrder(id => spec.title(rows.get(id)!, sides[side]))(parent, [...rows.keys()], sides[side]);
			} });
	}
	return items;
}

function nameOf(entry: Entry): string {
	return typeof entry.name === "string" && entry.name ? entry.name : String(entry.id);
}

const IMAGE_FORMATS: Readonly<Record<string, string>> = {
	svg: "recovery.details.value.formatSvg", png: "recovery.details.value.formatPng",
	jpeg: "recovery.details.value.formatJpeg", webp: "recovery.details.value.formatWebp",
};

export function imageItems(change: SetupChange | undefined, sides: RecoverySides): RecoveryItem[] {
	return collectionItems(change, sides, {
		prefix: "image",
		title: nameOf,
		summary: (parent, entry) => renderRecoveryImage(parent, entry as unknown as UserImageIcon),
		fields: [
			["name", renderText], ["format", renderChoice(IMAGE_FORMATS)], ["width", renderPx], ["height", renderPx],
			["monochrome", renderYesNo], ["svg", renderArtwork], ["rev", renderGeneric], ["addedAt", renderDate],
		],
		orderTitle: t("recovery.details.item.imageOrder"),
	});
}

export function paletteItems(change: SetupChange | undefined, sides: RecoverySides): RecoveryItem[] {
	return collectionItems(change, sides, {
		prefix: "palette",
		title: nameOf,
		summary: (parent, entry, side) => renderPaletteCard(parent, entry, side),
		fields: [
			["name", renderText],
			["colorLight", renderColor], ["colorDark", renderColor],
			["bgColorLight", renderColor], ["bgColorDark", renderColor],
			["textColorLight", renderColor], ["textColorDark", renderColor],
			["bgGradient", renderGradient, absentText.none],
			["transparentBg", renderYesNo, absentText.no],
			["bgIntensity", renderPercent, absentText.default],
			["baseColor", renderColor, absentText.none],
			["colorMode", renderChoice({ simple: "recovery.details.value.colorModeSimple",
				advanced: "recovery.details.value.colorModeAdvanced" }), () => t("recovery.details.value.colorModeSimple")],
		],
		orderTitle: t("recovery.details.item.paletteOrder"),
	});
}

/** A command's name as the command palette shows it, for the callout on that side. */
function commandName(entry: Entry, side: RecoverySide): string {
	const calloutId = typeof entry.calloutId === "string" ? entry.calloutId : "";
	const def = side.callouts.get(calloutId) ?? ({ displayName: calloutId } as CalloutDefinition);
	try { return describeCommand(entry as unknown as CustomCommand, def); }
	catch { return t("recovery.details.value.customCommand"); }
}

const COMMAND_ACTIONS: Readonly<Record<string, string>> = {
	wrap: "commandBuilder.actionWrap", insert: "commandBuilder.actionInsert",
};
const COMMAND_FOLDS: Readonly<Record<string, string>> = {
	none: "commandBuilder.foldNone", expanded: "commandBuilder.foldExpanded", collapsed: "commandBuilder.foldCollapsed",
};

/**
 * A command's whole setup on one side, as the command builder shows it: the
 * callout it writes, then the format and what it does. Resolved the way the
 * command itself resolves them, so a missing field reads as its real default.
 */
function renderCommand(parent: HTMLElement, entry: Entry, side: RecoverySide): void {
	renderCalloutRef(parent.createDiv(), entry.calloutId, side);
	const role = typeof entry.role === "string" ? entry.role : "";
	const parts = [Object.hasOwn(ROLE_LABELS, role) ? t(ROLE_LABELS[role as CalloutRenderRole]) : role];
	const command = entry as Partial<CustomCommand>;
	if (role === "heading") parts.push(t("recovery.details.value.headingLevel", { value: resolveHeadingLevel(command) }));
	if (role === "regular") parts.push(t(COMMAND_ACTIONS[resolveAction(command)]!), t(COMMAND_FOLDS[resolveFold(command)]!));
	parent.createDiv({ cls: "cs-recovery-muted", text: parts.filter(Boolean).join(" · ") });
}

export function customCommandItems(change: SetupChange | undefined, sides: RecoverySides): RecoveryItem[] {
	return collectionItems(change, sides, {
		prefix: "command",
		title: commandName,
		note: t("recovery.details.value.customCommand"),
		summary: renderCommand,
		fields: [
			["calloutId", renderCalloutRef],
			["role", renderChoice(ROLE_LABELS)],
			["headingLevel", renderHeadingLevel, absentText.default],
			["action", renderChoice(COMMAND_ACTIONS), absentText.default],
			["fold", renderChoice(COMMAND_FOLDS), () => t("commandBuilder.foldNone")],
		],
		orderTitle: t("recovery.details.item.commandOrder"),
	});
}

/** Turning a built-in command off or on: one item per command whose state differs. */
export function builtInCommandItems(change: SetupChange | undefined, sides: RecoverySides): RecoveryItem[] {
	if (!change) return [];
	const disabled = (value: unknown) => Array.isArray(value) ? new Set(value.filter(id => typeof id === "string")) : new Set<string>();
	const before = disabled(change.before), after = disabled(change.after);
	const names: Readonly<Record<string, string>> = FIXED_COMMAND_NAME_KEYS;
	const ids = [...new Set<string>([...FIXED_COMMAND_IDS, ...before, ...after])];
	return ids.filter(id => before.has(id) !== after.has(id)).map((id): RecoveryItem => ({
		key: `fixed:${id}`,
		kind: "changed",
		title: Object.hasOwn(names, id) ? t(names[id]!) : id,
		note: t("recovery.details.value.builtInCommand"),
		fields: [],
		summary: (parent, side) => renderOnOff(parent, !(side === "before" ? before : after).has(id), sides[side]),
	}));
}

/** A menu entry's name, as the menu editor labels it. */
function menuEntryLabel(id: string): string {
	const keys: Readonly<Record<string, string>> = ITEM_LABEL_KEY;
	return Object.hasOwn(keys, id) ? t(keys[id]!) : id;
}

/** One role's menu: each entry shown or hidden, and the order they come in. */
function menuFields(before: unknown, after: unknown): RecoveryField[] {
	const left = Array.isArray(before) ? keyedRows(before) : null, right = Array.isArray(after) ? keyedRows(after) : null;
	if (!left || !right) return [{ label: t("recovery.details.field.items"), before, after, render: renderGeneric }];
	const fields: RecoveryField[] = [];
	for (const id of new Set([...left.keys(), ...right.keys()])) {
		const a = left.get(id), b = right.get(id);
		if (canonical(a) === canonical(b)) continue;
		fields.push({ label: menuEntryLabel(id), before: a?.enabled, after: b?.enabled, render: renderShown,
			absent: t("recovery.details.value.notInMenu") });
	}
	const shared = (rows: Map<string, Entry>, other: Map<string, Entry>) => [...rows.keys()].filter(id => other.has(id));
	if (canonical(shared(left, right)) !== canonical(shared(right, left))) {
		fields.push({ label: t("recovery.details.order"), before: [...left.keys()], after: [...right.keys()],
			render: renderOrder(menuEntryLabel) });
	}
	return fields;
}

export function contextMenuItems(change: SetupChange | undefined): RecoveryItem[] {
	if (!change) return [];
	const before = isRecord(change.before) ? change.before : {}, after = isRecord(change.after) ? change.after : {};
	const items: RecoveryItem[] = [];
	const general = recordFields(before, after, [["enabled", renderOnOff]], { skip: ["items"] });
	if (general.length) items.push({ key: "menu:general", kind: "changed", title: t("settings.contextMenu"), fields: general });
	const roles = (value: unknown) => isRecord(value) ? value : {};
	const known = new Set<string>(ROLE_ORDER);
	const extra = Object.keys({ ...roles(before.items), ...roles(after.items) }).filter(role => !known.has(role)).sort();
	for (const role of [...ROLE_ORDER, ...extra]) {
		const fields = menuFields(roles(before.items)[role], roles(after.items)[role]);
		if (canonical(roles(before.items)[role]) === canonical(roles(after.items)[role]) || !fields.length) continue;
		const name = known.has(role) ? t(ROLE_LABELS[role as CalloutRenderRole]) : role;
		items.push({ key: `menu:${role}`, kind: "changed", title: t("recovery.details.item.menu", { role: name }), fields });
	}
	return items;
}

/** A library's name as Pick an icon shows it; an id this build does not know, as saved. */
function libraryLabel(id: string): string {
	return Object.hasOwn(ICON_SOURCES, id) ? t(ICON_SOURCES[id as IconSourceId].labelKey) : id;
}

/**
 * The Icon libraries window's settings: each library that ships with the
 * plugin shown or hidden, and the order Pick an icon lists the libraries in.
 * Compared as the window shows them, so a list still empty and the same order
 * written out are no difference. Which downloadable libraries a device offers
 * is not a setting — it is what is downloaded there — so it never appears.
 */
export function iconLibraryItems(change: SetupChange | undefined): RecoveryItem[] {
	if (!change) return [];
	const read = (value: unknown): IconLibrarySettings =>
		mergeIconLibraries(isRecord(value) ? value : undefined);
	const before = read(change.before), after = read(change.after);
	const fields: RecoveryField[] = [];
	for (const id of ICON_SOURCE_IDS) {
		if (isDownloadable(id)) continue;
		const shownBefore = !before.hidden.includes(id), shownAfter = !after.hidden.includes(id);
		if (shownBefore !== shownAfter) {
			fields.push({ label: libraryLabel(id), before: shownBefore, after: shownAfter, render: renderShown });
		}
	}
	const orderBefore = libraryOrder(before), orderAfter = libraryOrder(after);
	if (canonical(orderBefore) !== canonical(orderAfter)) {
		fields.push({ label: t("recovery.details.order"), before: orderBefore, after: orderAfter,
			render: renderOrder(libraryLabel) });
	}
	return fields.length
		? [{ key: "iconLibraries", kind: "changed", title: t("iconLibraries.title"), fields }]
		: [];
}
