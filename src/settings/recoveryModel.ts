/**
 * settings/recoveryModel.ts — the shapes the setup comparison is built from,
 * and the one helper every section uses to find a saved object's differences.
 *
 * Kept apart from recoverySections.ts (callout types and settings groups) and
 * recoveryCollections.ts (id-keyed lists) so both can share it without
 * importing each other.
 */
import type { Component } from "obsidian";
import { t } from "../i18n";
import { canonical } from "../manager/syncTree";
import type { CalloutRenderRole } from "../types";
import { recoveryFieldLabel } from "./recoveryDetailFields";
import { isRecord, renderGeneric, type RecoverySide, type ValueRenderer } from "./recoveryValues";

export type RecoveryItemKind = "added" | "removed" | "changed";
/** `before` is the current setup, `after` the setup restoring would produce. */
export type RecoverySideName = "before" | "after";
export type RecoverySides = Readonly<Record<RecoverySideName, RecoverySide>>;

export interface RecoveryField {
	label: string;
	/** The value in the current setup; undefined when it has none. */
	before: unknown;
	/** The value after restoring; undefined when that setup has none. */
	after: unknown;
	render: ValueRenderer;
	/** What an absent value means for this field, such as "Automatic". */
	absent?: string;
	/** The saved objects holding the two values, for renderers that need siblings. */
	owners?: readonly [unknown, unknown];
}

export interface RecoveryItem {
	/** Unique within the report: the section's prefix and the item's stable id. */
	key: string;
	kind: RecoveryItemKind;
	title: string;
	/** A literal identifier beside the title, such as `[!note]`. */
	code?: string;
	/** A short muted line under the title, such as "Built-in command". */
	note?: string;
	/**
	 * Draws the whole item as one side has it: a callout preview, a palette, a
	 * picture, a command's name. Called only for a side the item exists on.
	 * Without one, the title spans the row and the fields say everything.
	 */
	summary?: (parent: HTMLElement, side: RecoverySideName, component: Component) => void;
	fields: RecoveryField[];
}

export interface RecoverySection {
	id: string;
	title: string;
	items: RecoveryItem[];
}

export interface RecoveryReport {
	sections: RecoverySection[];
	sides: RecoverySides;
}

/** One field of a saved object: its key, how to draw it, and what absence means. */
export type FieldSpec = readonly [key: string, render: ValueRenderer, absent?: () => string];

/** The order the settings page lists the three roles in. */
export const ROLE_ORDER: readonly CalloutRenderRole[] = ["heading", "inline", "regular"];

export const ROLE_LABELS: Readonly<Record<CalloutRenderRole, string>> = {
	heading: "settings.calloutTypeHeading",
	inline: "settings.calloutTypeInline",
	regular: "settings.calloutTypeRegular",
};

/** What an absent optional value means, per kind of field. */
export const absentText = {
	no: () => t("recovery.details.no"),
	none: () => t("recovery.details.value.none"),
	default: () => t("recovery.details.value.default"),
	automatic: () => t("recovery.details.value.automatic"),
	themeDefault: () => t("recovery.details.value.themeDefault"),
};

/** A path of saved keys, labelled; `$order` is the order of an id-keyed list. */
export function pathLabel(path: readonly string[]): string {
	return path.map(key => key === "$order" ? t("recovery.details.order") : recoveryFieldLabel(key)).join(" › ");
}

export interface RecordFieldOptions {
	/** Keys shown elsewhere; never reported here, not even as unknown. */
	skip?: readonly string[];
	/** Report keys `specs` does not name (default true), after the known ones. */
	unknown?: boolean;
}

/**
 * Fields for every key of two saved objects that differs: the keys in `specs`
 * order, then unknown ones by name. Incidental keys never reach here — callers
 * pass comparable values.
 */
export function recordFields(
	before: unknown, after: unknown, specs: readonly FieldSpec[], options: RecordFieldOptions = {},
): RecoveryField[] {
	const a = isRecord(before) ? before : {}, b = isRecord(after) ? after : {};
	const owners = [before, after] as const;
	const skip = new Set(options.skip ?? []);
	const fields: RecoveryField[] = [];
	for (const [key, render, absent] of specs) {
		if (skip.has(key) || canonical(a[key]) === canonical(b[key])) continue;
		fields.push({ label: recoveryFieldLabel(key), before: a[key], after: b[key], render, absent: absent?.(), owners });
	}
	if (options.unknown === false) return fields;
	const known = new Set([...specs.map(([key]) => key), ...skip, "id"]);
	const unknown = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => !known.has(key)).sort();
	for (const key of unknown) {
		if (canonical(a[key]) === canonical(b[key])) continue;
		fields.push({ label: recoveryFieldLabel(key), before: a[key], after: b[key], render: renderGeneric, owners });
	}
	return fields;
}
