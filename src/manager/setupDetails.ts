/** Read-only snapshots used to inspect an earlier setup without restoring it. */
import { DEFAULT_CALLOUTS } from "../defaultCallouts";
import { packFor } from "../icons/registry";
import type { CalloutDefinition, PluginData } from "../types";
import { CALLOUT_RENDER_ROLES } from "../types";
import type { RecoverySource } from "./settingsRecoveryService";
import type { SetupVersion } from "./setupVersions";
import { differingEntries } from "./setupDifference";
import { withoutIncidental } from "./settingsGenesis";
import { canonical } from "./syncTree";

export interface SetupFieldChange {
	/** Relative saved keys and row IDs; `$order` denotes an ID-keyed list's order. */
	path: string[];
	before: unknown;
	after: unknown;
}

export interface SetupChange {
	/** A callout type (`row:<id>`) or settings group (`settings:<group>`). */
	key: string;
	/** The value currently displayed, or undefined when it does not exist. */
	before: unknown;
	/** The value in the earlier setup, or undefined when it does not exist. */
	after: unknown;
	kind: "added" | "removed" | "changed";
	/** Only changed values, excluding incidental state even inside a changed group. */
	fields: SetupFieldChange[];
}

export interface SetupCalloutComparison {
	id: string;
	before?: CalloutDefinition;
	after?: CalloutDefinition;
	kind: "added" | "removed" | "changed" | "unchanged";
	fields: SetupFieldChange[];
	/**
	 * The saved artwork this callout's visible icon draws from differs, although
	 * the definition may not. Global styling is deliberately not counted: it
	 * changes every callout at once, so the report shows it once, in its own
	 * section, instead of repeating it on every callout type.
	 */
	artworkChanged: boolean;
}

export interface SetupDetails {
	source: RecoverySource;
	/** The version `source` is a copy of, when the report should say where it is kept. */
	version?: SetupVersion;
	/** The displayed setup when the details were opened. */
	current: Partial<PluginData>;
	/** The changes restoring this source would make, relative to `current`. */
	changes: SetupChange[];
	/** All effective stored and built-in definitions, with changed definitions first. */
	callouts: SetupCalloutComparison[];
}

function valueAt(data: Partial<PluginData>, key: string): unknown {
	const name = key.slice(key.indexOf(":") + 1);
	if (key.startsWith("row:")) return data.callouts?.find(row => row.id === name);
	return ownValue(data.settings, name);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownValue(value: object | undefined, key: string): unknown {
	return value && Object.prototype.hasOwnProperty.call(value, key) ? (value as Record<string, unknown>)[key] : undefined;
}

/** A list's entries by their unique string `id`, or null when it is not such a list. */
export function keyedRows(value: unknown[]): Map<string, Record<string, unknown>> | null {
	const rows = new Map<string, Record<string, unknown>>();
	for (const row of value) {
		if (!isObject(row) || typeof row.id !== "string" || rows.has(row.id)) return null;
		rows.set(row.id, row);
	}
	return rows;
}

/** Compare saved JSON values, matching collection entries by their stable IDs. */
export function setupFieldChanges(before: unknown, after: unknown): SetupFieldChange[] {
	const snapshot = JSON.parse(JSON.stringify({ before, after })) as { before?: unknown; after?: unknown };
	const changes: SetupFieldChange[] = [];
	function compare(a: unknown, b: unknown, path: string[]): void {
		if (canonical(a) === canonical(b)) return;
		if (isObject(a) && isObject(b)) {
			for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) compare(ownValue(a, key), ownValue(b, key), [...path, key]);
			return;
		}
		if (Array.isArray(a) && Array.isArray(b)) {
			const left = keyedRows(a), right = keyedRows(b);
			if (left && right) {
				for (const id of new Set([...left.keys(), ...right.keys()])) compare(left.get(id), right.get(id), [...path, id]);
				const sharedBefore = [...left.keys()].filter(id => right.has(id));
				const sharedAfter = [...right.keys()].filter(id => left.has(id));
				if (canonical(sharedBefore) !== canonical(sharedAfter)) {
					changes.push({ path: [...path, "$order"], before: [...left.keys()], after: [...right.keys()] });
				}
				return;
			}
		}
		changes.push({ path, before: a, after: b });
	}
	compare(snapshot.before, snapshot.after, []);
	return changes;
}

/** Every callout type a setup renders: shipped defaults overlaid with its saved rows. */
export function effectiveCallouts(data: Partial<PluginData>): Map<string, CalloutDefinition> {
	// A missing built-in override resets to the default; it does not delete the
	// type. Avoid a scratch registry, which would replace the live image pack.
	const rows = JSON.parse(JSON.stringify([...DEFAULT_CALLOUTS, ...(data.callouts ?? [])])) as CalloutDefinition[];
	return new Map(rows.filter(row => row.source !== "theme").map(row => [row.id, row]));
}

/** The stored artwork a definition's visible icon draws; null when it draws none of its own. */
function savedArtwork(data: Partial<PluginData>, definition: CalloutDefinition): unknown {
	const { icon } = definition;
	let artwork: unknown = null;
	if (definition.hideIcon !== true && icon.type === "image") {
		const image = data.settings?.userImages?.find(entry => entry.id === icon.value);
		if (image) artwork = { svg: image.svg, width: image.width, height: image.height, format: image.format };
	} else if (definition.hideIcon !== true) {
		const pack = packFor(icon);
		if (pack && pack.kind !== "builtin" && pack.kind !== "glyph") {
			artwork = CALLOUT_RENDER_ROLES.map(role => {
				const variant = pack.cacheVariant(icon, role);
				const cached = data.iconSvgCache?.find(entry => entry.pack === icon.type && entry.name === icon.value && entry.variant === variant);
				return cached?.svg ?? (icon.type === "material" ? data.materialSvgCache?.find(entry =>
					entry.name === icon.value && `${entry.style}|${entry.weight}` === variant)?.svg : undefined) ?? null;
			});
		}
	}
	return artwork;
}

function calloutComparisons(current: Partial<PluginData>, earlier: Partial<PluginData>): SetupCalloutComparison[] {
	const before = effectiveCallouts(current), after = effectiveCallouts(earlier);
	const callouts: SetupCalloutComparison[] = [...new Set([...before.keys(), ...after.keys()])].map(id => {
		const currentRow = before.get(id), savedRow = after.get(id);
		const fields = setupFieldChanges(currentRow, savedRow);
		return { id, before: currentRow, after: savedRow,
			kind: !currentRow ? "added" : !savedRow ? "removed" : fields.length ? "changed" : "unchanged", fields,
			// Only when both sides draw an icon: showing or hiding one is the
			// `hideIcon` field's change, not an artwork change.
			artworkChanged: !!currentRow && !!savedRow && currentRow.hideIcon !== true && savedRow.hideIcon !== true &&
				canonical(savedArtwork(current, currentRow)) !== canonical(savedArtwork(earlier, savedRow)) };
	});
	return callouts.sort((a, b) => Number(a.kind === "unchanged" && !a.artworkChanged) -
		Number(b.kind === "unchanged" && !b.artworkChanged) || a.id.localeCompare(b.id));
}

/** Own the JSON snapshots, so later edits cannot change a report or its inputs. */
export function setupDetails(source: RecoverySource, current: Partial<PluginData>): SetupDetails {
	const snapshot = JSON.parse(JSON.stringify({ source, current })) as Pick<SetupDetails, "source" | "current">;
	const earlier = snapshot.source.data;
	const comparableCurrent = withoutIncidental(snapshot.current) as Partial<PluginData>;
	const comparableEarlier = earlier === null ? null : withoutIncidental(earlier) as Partial<PluginData>;
	const changes: SetupChange[] = earlier === null ? [] : [...differingEntries(snapshot.current, earlier)].map(key => {
		const before = valueAt(snapshot.current, key), after = valueAt(earlier, key);
		return { key, before, after, kind: before === undefined ? "added" : after === undefined ? "removed" : "changed",
			fields: setupFieldChanges(valueAt(comparableCurrent, key), valueAt(comparableEarlier!, key)) };
	});
	return { ...snapshot, changes, callouts: earlier === null ? [] : calloutComparisons(snapshot.current, earlier) };
}
