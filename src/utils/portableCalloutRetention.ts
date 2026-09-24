import type { App } from "obsidian";
import { portableCalloutApprovals } from "./portableCalloutApproval";
import type { PortableCalloutConversionChange, PortableCalloutConversionPlan } from "./portableCalloutPlan";
import type { PortableReplacement, PortableReplacements } from "./portableCalloutCustom";

/** Only unchanged prefix/suffix bytes can retain their absolute source position. */
function unchangedOffset(before: string, after: string, from: number, to: number): number | undefined {
	let prefix = 0, suffix = 0;
	while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
	while (suffix < before.length - prefix && suffix < after.length - prefix
		&& before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
	if (to <= prefix) return from;
	if (from >= before.length - suffix) return from + after.length - before.length;
	return undefined;
}

function lineOffset(content: string, line: number): number {
	let offset = 0;
	for (let at = 1; at < line; at++) offset = content.indexOf("\n", offset) + 1;
	return offset;
}

/** One changed line bracketed by unchanged lines has a unique parent position. */
function changedLine(before: string, after: string): number | undefined {
	const old = before.split("\n"), current = after.split("\n");
	let prefix = 0, suffix = 0;
	while (prefix < old.length && prefix < current.length && old[prefix] === current[prefix]) prefix++;
	while (suffix < old.length - prefix && suffix < current.length - prefix
		&& old[old.length - suffix - 1] === current[current.length - suffix - 1]) suffix++;
	return old.length - prefix - suffix === 1 && current.length - prefix - suffix === 1 ? prefix + 1 : undefined;
}

/** Retain custom tokens only where the old and new source correspondence is unique. */
export function retainPortableCalloutReplacements(
	app: App, previous: PortableCalloutConversionPlan | undefined, next: PortableCalloutConversionPlan,
	replacements: PortableReplacements, retained?: (oldId: string, newId: string) => void, discarded?: (oldId: string) => void,
): Map<string, PortableReplacement> {
	const before = previous && portableCalloutApprovals.get(previous), after = portableCalloutApprovals.get(next);
	if (!before || !after || before.app !== app || after.app !== app) return new Map();
	const result = new Map<string, PortableReplacement>();
	for (const row of previous.changes) {
		const value = replacements.get(row.id);
		if (value === undefined) continue;
		const old = before.entries.find(entry => entry.path === row.path)!;
		const current = after.entries.find(entry => entry.file === old.file);
		if (!current) { discarded?.(row.id); continue; }
		const oldRows = previous.changes.filter(change => change.path === old.path);
		const newRows = next.changes.filter(change => change.path === current.path);
		const match = (change: PortableCalloutConversionChange): boolean => change.before === row.before && change.headingLine === row.headingLine;
		const candidates = newRows.filter(match), oldCandidates = oldRows.filter(match);
		const uniqueLine = (rows: readonly PortableCalloutConversionChange[], source: string): boolean =>
			new Set(rows.filter(change => change.sourceLine === source).map(change => change.line)).size === 1;
		const oldUnique = uniqueLine(oldRows, row.sourceLine);
		const sameSource = candidates.filter(change => change.sourceLine === row.sourceLine && change.from === row.from && change.to === row.to);
		const offset = lineOffset(old.original, row.line);
		const shifted = oldUnique ? unchangedOffset(old.original, current.original, offset + row.from, offset + row.to) : undefined;
		const withinLine = candidates.filter(change => change.line === row.line);
		const oldWithinLine = oldCandidates.filter(change => change.line === row.line);
		const sameLine = changedLine(old.original, current.original) === row.line;
		const target = current.original === old.original ? candidates.find(change => change.line === row.line && change.from === row.from && change.to === row.to)
			: oldUnique && sameSource.length === 1 && uniqueLine(newRows, row.sourceLine) ? sameSource[0]
			: !row.headingLine && sameLine && withinLine.length === 1 && oldWithinLine.length === 1 ? withinLine[0]
			: candidates.length === 1 && oldCandidates.length === 1 ? candidates[0]
			: shifted === undefined || candidates.length !== oldCandidates.length ? undefined
				: candidates.find(change => uniqueLine(newRows, change.sourceLine) && lineOffset(current.original, change.line) + change.from === shifted);
		if (!target) { discarded?.(row.id); continue; }
		result.set(target.id, typeof value === "object" && value.inline ? {
			text: value.text, inline: [{ from: target.from, to: target.to, source: target.before, text: value.text }],
		} : value);
		retained?.(row.id, target.id);
	}
	return result;
}
