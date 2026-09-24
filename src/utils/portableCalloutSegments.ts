import { assertPortableCustomLine, PortableCustomReplacementError } from "./portableCalloutCustom";

interface ApprovedInlineEdit { readonly from: number; readonly to: number; readonly text: string }
export interface PortableCustomField {
	/** Original source offsets, including the complete approved inline payload. */
	readonly from: number;
	readonly to: number;
	readonly source: string;
	/** One source word on either side, displayed as read-only context. */
	readonly before: string;
	readonly after: string;
	readonly value: string;
}
export interface PortableCustomFields {
	readonly fields: readonly PortableCustomField[];
	/** Exact finalized default output outside the editable replacements. */
	readonly fragments: readonly string[];
}
interface OutputRange { from: number; to: number }

/** Locate the converter's single block-preserving escape without reparsing tokens. */
function outputRanges(raw: string, finalized: string, ranges: OutputRange[]): OutputRange[] | undefined {
	if (raw === finalized) return ranges;
	let from = 0, suffix = 0;
	while (from < raw.length && from < finalized.length && raw[from] === finalized[from]) from++;
	while (suffix < raw.length - from && suffix < finalized.length - from
		&& raw[raw.length - suffix - 1] === finalized[finalized.length - suffix - 1]) suffix++;
	const to = raw.length - suffix;
	const removed = raw.slice(from, to), inserted = finalized.slice(from, finalized.length - suffix);
	if (!(removed === "" && inserted === "\\") && !(removed === " " && inserted === "&#32;")
		&& !(removed === "\t" && inserted === "&#9;")) return undefined;
	const delta = inserted.length - removed.length;
	// An escape of replacement text belongs to that editable field. An escape of
	// untouched neighboring prose remains in a fixed fragment, even after an empty field.
	const owner = ranges.findIndex(range => range.from <= from && range.to > from && range.to >= to);
	return ranges.map((range, index) => {
		if (index === owner) return { from: range.from, to: range.to + delta };
		const shift = range.from > from || (range.from === from && owner >= 0 && index > owner) ? delta : 0;
		return { from: range.from + shift, to: range.to + shift };
	});
}

/** Uses only edits approved by the safe converter; protected examples never become fields. */
export function createPortableCustomFields(
	before: string, defaultReplacement: string, edits: readonly ApprovedInlineEdit[],
): PortableCustomFields | undefined {
	if (!edits.length || /[\r\n\0]/.test(before + defaultReplacement)) return undefined;
	let raw = "", cursor = 0;
	const ranges: OutputRange[] = [];
	for (const edit of edits) {
		if (!Number.isInteger(edit.from) || !Number.isInteger(edit.to) || edit.from < cursor
			|| edit.to <= edit.from || edit.to > before.length || /[\r\n\0]/.test(edit.text)) return undefined;
		raw += before.slice(cursor, edit.from);
		ranges.push({ from: raw.length, to: raw.length + edit.text.length });
		raw += edit.text;
		cursor = edit.to;
	}
	raw += before.slice(cursor);
	const finalized = outputRanges(raw, defaultReplacement, ranges);
	if (!finalized) return undefined;
	const fragments: string[] = [], fields: PortableCustomField[] = [];
	cursor = 0;
	for (let index = 0; index < edits.length; index++) {
		const edit = edits[index]!, range = finalized[index]!;
		if (range.from < cursor || range.to < range.from || range.to > defaultReplacement.length) return undefined;
		fragments.push(defaultReplacement.slice(cursor, range.from));
		fields.push(Object.freeze({ from: edit.from, to: edit.to, source: before.slice(edit.from, edit.to),
			before: /\S+[ \t]*$/.exec(before.slice(0, edit.from))?.[0].trim() ?? "",
			after: /^[ \t]*\S+/.exec(before.slice(edit.to))?.[0].trim() ?? "",
			value: defaultReplacement.slice(range.from, range.to) }));
		cursor = range.to;
	}
	fragments.push(defaultReplacement.slice(cursor));
	return Object.freeze({ fields: Object.freeze(fields), fragments: Object.freeze(fragments) });
}

/** Editable values cannot change the fixed words, punctuation or other source spans. */
export function composePortableCustomFields(model: PortableCustomFields, values: readonly string[]): string {
	if (values.length !== model.fields.length || model.fragments.length !== values.length + 1) throw new PortableCustomReplacementError();
	let result = model.fragments[0]!;
	for (let index = 0; index < values.length; index++) {
		const value = values[index]!;
		assertPortableCustomLine(value);
		result += value + model.fragments[index + 1]!;
	}
	return result;
}
