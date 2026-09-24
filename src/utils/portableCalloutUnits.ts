import { markdownPrefix } from "../editor/markdownContainers";
import { applyPortableEdits, preservePortableBlockMeaning, type PortableCalloutLineChange } from "./portableCallouts";
import { createPortableCustomFields, composePortableCustomFields } from "./portableCalloutSegments";
import { portableReplacementText, type PortableReplacements } from "./portableCalloutCustom";

/** Heading syntax is contextual; ordinary inline replacements are independent spans. */
export interface PortableCalloutUnit extends PortableCalloutLineChange {
	readonly sourceLine: string;
	readonly from: number;
	readonly to: number;
	readonly headingLine: boolean;
}
export interface PortableUnitRange { from: number; to: number }
const display = (line: string): string => line.replace(/\r$/, "");
export const portableUnitId = (path: string, unit: PortableCalloutUnit): string =>
	JSON.stringify([path, unit.line, unit.from, unit.to, unit.sourceLine, unit.after]);

export function portableCalloutUnits(changes: readonly PortableCalloutLineChange[]): PortableCalloutUnit[] {
	return changes.flatMap<PortableCalloutUnit>(change => {
		const sourceLine = display(change.before), after = display(change.after);
		const prefix = markdownPrefix(sourceLine);
		const headingLine = prefix.quoteDepth === 0 && /^#{1,6}[ \t]+/.test(sourceLine.slice(prefix.from));
		if (headingLine) return [{ ...change, before: sourceLine, after, sourceLine, from: 0, to: sourceLine.length, headingLine }];
		const model = createPortableCustomFields(sourceLine, after, change.edits);
		if (!model) throw new Error("Approved inline edits could not be split safely");
		return model.fields.map((field, index) => ({
			line: change.line, sourceLine, from: field.from, to: field.to, headingLine,
			before: field.source, after: field.value, count: 1, headings: 0, inline: 1,
			edits: [change.edits[index]!],
		}));
	});
}

/** Recompute block escapes for the chosen subset, retaining every untouched source span. */
export function selectedPortableContent(
	path: string, original: string, units: readonly PortableCalloutUnit[], selected: ReadonlySet<string>, replacements: PortableReplacements,
): { content: string; ranges: Map<string, PortableUnitRange> } {
	const lines = original.split("\n"), byLine = new Map<number, PortableCalloutUnit[]>();
	for (const unit of units) if (selected.has(portableUnitId(path, unit))) {
		const group = byLine.get(unit.line) ?? []; group.push(unit); byLine.set(unit.line, group);
	}
	const relative = new Map<number, Map<string, PortableUnitRange>>();
	for (const [line, chosen] of byLine) {
		const source = display(lines[line - 1]!), suffix = lines[line - 1]!.endsWith("\r") ? "\r" : "";
		const ranges = new Map<string, PortableUnitRange>();
		if (chosen[0]!.headingLine) {
			const unit = chosen[0]!, id = portableUnitId(path, unit), custom = replacements.get(id);
			const text = custom === undefined ? unit.after : portableReplacementText(custom);
			lines[line - 1] = text + suffix; ranges.set(id, { from: 0, to: text.length });
		} else {
			chosen.sort((a, b) => a.from - b.from);
			const edits = chosen.map(unit => unit.edits[0]!);
			const defaults = preservePortableBlockMeaning(source, applyPortableEdits(source, [...edits]), markdownPrefix(source).from, false);
			const model = createPortableCustomFields(source, defaults, edits);
			if (!model) throw new Error("Selected inline edits could not be composed safely");
			const values = model.fields.map((field, index) => {
				const custom = replacements.get(portableUnitId(path, chosen[index]!));
				return custom === undefined ? field.value : portableReplacementText(custom);
			});
			lines[line - 1] = composePortableCustomFields(model, values) + suffix;
			let offset = model.fragments[0]!.length;
			for (let index = 0; index < chosen.length; index++) {
				ranges.set(portableUnitId(path, chosen[index]!), { from: offset, to: offset + values[index]!.length });
				offset += values[index]!.length + model.fragments[index + 1]!.length;
			}
		}
		relative.set(line, ranges);
	}
	const ranges = new Map<string, PortableUnitRange>();
	let offset = 0;
	for (let index = 0; index < lines.length; index++) {
		for (const [id, range] of relative.get(index + 1) ?? []) ranges.set(id, { from: offset + range.from, to: offset + range.to });
		offset += lines[index]!.length + 1;
	}
	return { content: lines.join("\n"), ranges };
}

/** Link repairs use proposed-content offsets; project only bytes inside this review unit. */
export function portableUnitPreview(content: string, range: PortableUnitRange, edits: readonly { from: number; to: number; text: string }[]): string {
	let text = content.slice(range.from, range.to);
	for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
		if (edit.from >= range.from && edit.to <= range.to) text = text.slice(0, edit.from - range.from) + edit.text + text.slice(edit.to - range.from);
	}
	return text;
}
