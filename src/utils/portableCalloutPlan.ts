import type { App, TFile } from "obsidian";
import { assertPortableCustomLine, assertPortableCustomStructure, PortableCustomReplacementError, portableReplacementText, type PortableReplacements } from "./portableCalloutCustom";
import { portableCalloutUnits, portableUnitId, selectedPortableContent, portableUnitPreview, type PortableCalloutUnit, type PortableUnitRange } from "./portableCalloutUnits";
import { fingerprintCalloutContent } from "../usage/contentFingerprint";
import { planPortableHeadingLinks, type PortableHeadingLinkCache, type PortableHeadingLinkEdit, type PortableHeadingLinkIssue } from "./portableHeadingLinks";
import type { PortableCalloutConversion, PortableCalloutLineChange } from "./portableCallouts";

export interface PortableCalloutCounts {
	files: number; count: number; headings: number; inline: number; skipped: number; linkCount: number;
}
export interface PortableCalloutConversionExample {
	readonly path: string;
	/** One-based source line. */
	readonly line: number;
	readonly before: string;
	readonly after: string;
}
export interface PortableCalloutConversionChange extends PortableCalloutConversionExample {
	readonly id: string;
	readonly sourceLine: string;
	readonly from: number;
	readonly to: number;
	readonly headingLine: boolean;
	readonly contentFingerprint: string;
	/** Source replacement before dependent heading-link repairs. */
	readonly replacement: string;
	/** Default for the current selected subset, before custom text or link repairs. */
	readonly defaultReplacement: string;
	readonly custom: boolean;
	readonly edits: PortableCalloutLineChange["edits"];
	readonly count: number;
	readonly headings: number;
	readonly inline: number;
}
export interface PortableCalloutLinkChange extends PortableCalloutConversionExample {
	readonly id: string;
	readonly contentFingerprint: string;
}
export interface PortableCalloutBlockedChange {
	readonly id: string;
	readonly reason: PortableHeadingLinkIssue["reason"];
}
export interface PortableCalloutConversionPlan extends Readonly<PortableCalloutCounts> {
	/** A partial write retains its approved pending link repairs; choices are fixed. */
	readonly recovery: boolean;
	readonly scannedFiles: number;
	readonly examples: readonly PortableCalloutConversionExample[];
	readonly changes: readonly PortableCalloutConversionChange[];
	readonly selectedIds: readonly string[];
	readonly linkChanges: readonly PortableCalloutLinkChange[];
	readonly blockedChanges: readonly PortableCalloutBlockedChange[];
}
export interface PortableCalloutSnapshot {
	file: TFile;
	path: string;
	mtime: number;
	size: number;
	original: string;
	conversion: PortableCalloutConversion;
	changes: PortableCalloutLineChange[];
}
export interface PortableCalloutOutput {
	content: string;
	count: number;
	headings: number;
	inline: number;
	linkCount: number;
}
export const emptyPortableCounts = (): PortableCalloutCounts =>
	({ files: 0, count: 0, headings: 0, inline: 0, skipped: 0, linkCount: 0 });

const sourceFingerprints = new WeakMap<PortableCalloutSnapshot, string>();
function sourceFingerprint(entry: PortableCalloutSnapshot): string {
	let value = sourceFingerprints.get(entry);
	if (value === undefined) { value = fingerprintCalloutContent(entry.original); sourceFingerprints.set(entry, value); }
	return value;
}

const displayLine = (line: string): string => line.replace(/\r$/, "");
function sourceChanges(entries: readonly PortableCalloutSnapshot[], units: ReadonlyMap<string, readonly PortableCalloutUnit[]>, fingerprints: ReadonlyMap<string, string>, replacements: PortableReplacements): readonly PortableCalloutConversionChange[] {
	return Object.freeze(entries.flatMap(entry => units.get(entry.path)!.map(change => {
		const id = portableUnitId(entry.path, change), value = replacements.get(id);
		const replacement = value === undefined ? change.after : portableReplacementText(value);
		return Object.freeze({ ...change, edits: Object.freeze(change.edits.map(edit => Object.freeze({ ...edit }))),
			id, path: entry.path, contentFingerprint: fingerprints.get(entry.path)!, after: replacement, replacement, defaultReplacement: change.after, custom: value !== undefined });
	})));
}

function examples(changes: readonly PortableCalloutConversionChange[]): readonly PortableCalloutConversionExample[] {
	return Object.freeze(changes.slice(0, 6).map(({ path, line, before, after }) => {
		let difference = 0;
		while (difference < before.length && before[difference] === after[difference]) difference++;
		const start = Math.max(0, difference - 100);
		const excerpt = (value: string): string => value.length <= 400 ? value
			: `${start ? "…" : ""}${value.slice(start, start + 400)}${value.length > start + 400 ? "…" : ""}`;
		return Object.freeze({ path, line, before: excerpt(before), after: excerpt(after) });
	}));
}

export function buildPortableCalloutPlan(
	app: App, entries: readonly PortableCalloutSnapshot[], requested?: ReadonlySet<string>,
	previousBlocked: readonly PortableCalloutBlockedChange[] = [],
	headingCache?: PortableHeadingLinkCache, replacements: PortableReplacements = new Map(),
): { plan: PortableCalloutConversionPlan; outputs: Map<string, PortableCalloutOutput> } {
	const fingerprints = new Map(entries.map(entry => [entry.path, sourceFingerprint(entry)]));
	for (const value of replacements.values()) assertPortableCustomLine(portableReplacementText(value));
	const units = new Map(entries.map(entry => [entry.path, portableCalloutUnits(entry.changes)]));
	for (const entry of entries) for (const unit of units.get(entry.path)!) {
		const value = replacements.get(portableUnitId(entry.path, unit));
		if (typeof value !== "object" || !value.inline) continue;
		if (unit.headingLine || value.inline.length !== 1 || value.inline[0]!.from !== unit.from
			|| value.inline[0]!.to !== unit.to || value.inline[0]!.source !== unit.before || value.inline[0]!.text !== value.text) throw new PortableCustomReplacementError();
	}
	const changes = sourceChanges(entries, units, fingerprints, replacements);
	const selected = new Set(changes.filter(change => !requested || requested.has(change.id)).map(change => change.id));
	const blocked = new Map(previousBlocked.filter(change => !selected.has(change.id)).map(change => [change.id, change]));
	const byLocation = new Map<string, PortableCalloutConversionChange[]>();
	for (const change of changes) { const key = JSON.stringify([change.path, change.line]); const rows = byLocation.get(key) ?? []; rows.push(change); byLocation.set(key, rows); }
	const originals = entries.map(entry => ({ path: entry.path, content: entry.original }));
	let ranges = new Map<string, PortableUnitRange>();
	let defaults = new Map<string, string>(), defaultRanges = new Map<string, PortableUnitRange>();
	const contents = (values: PortableReplacements, collect?: Map<string, PortableUnitRange>): Map<string, string> => new Map(entries.map(entry => {
		const output = selectedPortableContent(entry.path, entry.original, units.get(entry.path)!, selected, values);
		if (collect) for (const [id, range] of output.ranges) collect.set(id, range);
		return [entry.path, output.content];
	}));
	const propose = (): Map<string, string> => {
		ranges = new Map();
		const proposed = contents(replacements, ranges);
		if (replacements.size) {
			defaultRanges = new Map<string, PortableUnitRange>();
			defaults = contents(new Map(), defaultRanges);
			for (const entry of entries) {
				const custom = changes.filter(change => change.path === entry.path && selected.has(change.id) && change.custom);
				assertPortableCustomStructure(defaults.get(entry.path)!, proposed.get(entry.path)!, new Set(custom.map(change => change.line)),
					custom.map(change => ({ before: defaultRanges.get(change.id)!, after: ranges.get(change.id)! })));
			}
		} else { defaults = proposed; defaultRanges = ranges; }
		return proposed;
	};
	let proposed = propose();
	let links = planPortableHeadingLinks(app, originals, proposed, headingCache);
	// A heading with an unsafe reference cannot be converted behind that reference's back.
	while (links.issues.length) {
		let removed = false;
		for (const issue of links.issues) {
			const affected = byLocation.get(JSON.stringify([issue.targetPath, issue.targetLine])) ?? [];
			for (const change of affected) if (selected.delete(change.id)) {
				blocked.set(change.id, Object.freeze({ id: change.id, reason: issue.reason }));
				removed = true;
			}
		}
		if (!removed) throw new Error("Heading references could not be planned safely");
		proposed = propose();
		links = planPortableHeadingLinks(app, originals, proposed, headingCache);
	}
	const outputs = new Map<string, PortableCalloutOutput>();
	const linkChanges: PortableCalloutLinkChange[] = [];
	const counts = emptyPortableCounts();
	const chosenByPath = new Map<string, PortableCalloutConversionChange[]>();
	for (const change of changes) if (selected.has(change.id)) {
		const rows = chosenByPath.get(change.path) ?? [];
		rows.push(change); chosenByPath.set(change.path, rows);
	}
	const editsByPath = new Map<string, PortableHeadingLinkEdit[]>();
	for (const edit of links.edits) {
		const edits = editsByPath.get(edit.path) ?? [];
		edits.push(edit); editsByPath.set(edit.path, edits);
	}
	for (const entry of entries) {
		const chosen = chosenByPath.get(entry.path) ?? [];
		const edits = (editsByPath.get(entry.path) ?? []).sort((a, b) => b.from - a.from);
		let content = proposed.get(entry.path)!;
		for (const edit of edits) content = content.slice(0, edit.from) + edit.text + content.slice(edit.to);
		const output = { content, count: 0, headings: 0, inline: 0, linkCount: edits.length };
		for (const change of chosen) {
			output.count += change.count; output.headings += change.headings; output.inline += change.inline;
		}
		outputs.set(entry.path, output);
		counts.skipped += entry.conversion.skipped;
		if (content !== entry.original) counts.files++;
		counts.count += output.count; counts.headings += output.headings;
		counts.inline += output.inline; counts.linkCount += output.linkCount;
		const beforeLines = entry.original.split("\n"), afterLines = content.split("\n");
		for (const line of [...new Set(edits.map(edit => edit.line))].sort((a, b) => a - b)) {
			const before = displayLine(beforeLines[line - 1]!), after = displayLine(afterLines[line - 1]!);
			linkChanges.push(Object.freeze({ id: JSON.stringify([entry.path, line, before, after]), path: entry.path, line, before, after, contentFingerprint: fingerprints.get(entry.path)! }));
		}
	}
	const finalChanges = Object.freeze(changes.map(change => selected.has(change.id)
		? Object.freeze({ ...change,
			replacement: portableUnitPreview(proposed.get(change.path)!, ranges.get(change.id)!, []),
			defaultReplacement: portableUnitPreview(defaults.get(change.path)!, defaultRanges.get(change.id)!, []),
			after: portableUnitPreview(proposed.get(change.path)!, ranges.get(change.id)!, editsByPath.get(change.path) ?? []) }) : change));
	return { outputs, plan: Object.freeze({
		...counts, recovery: false, scannedFiles: entries.length, changes: finalChanges, selectedIds: Object.freeze([...selected]),
		examples: examples(finalChanges.filter(change => selected.has(change.id))),
		linkChanges: Object.freeze(linkChanges), blockedChanges: Object.freeze([...blocked.values()]),
	}) };
}

/** Keep exact pending bytes after partial success, even when their target heading is already converted. */
export function remainingPortableCalloutPlan(
	plan: PortableCalloutConversionPlan, entries: readonly PortableCalloutSnapshot[],
	outputs: ReadonlyMap<string, PortableCalloutOutput>,
): PortableCalloutConversionPlan | undefined {
	const pending = new Set(entries.filter(entry => outputs.get(entry.path)!.content !== entry.original).map(entry => entry.path));
	if (!pending.size) return;
	const selected = new Set(plan.selectedIds);
	const changes = Object.freeze(plan.changes.filter(change => pending.has(change.path) && selected.has(change.id)));
	const counts = { ...emptyPortableCounts(), skipped: plan.skipped, files: pending.size };
	for (const path of pending) {
		const output = outputs.get(path)!;
		counts.count += output.count; counts.headings += output.headings;
		counts.inline += output.inline; counts.linkCount += output.linkCount;
	}
	return Object.freeze({ ...counts, recovery: true, scannedFiles: entries.length, changes,
		examples: examples(changes), selectedIds: Object.freeze(changes.map(change => change.id)),
		linkChanges: Object.freeze(plan.linkChanges.filter(change => pending.has(change.path))),
		blockedChanges: Object.freeze([]),
	});
}
