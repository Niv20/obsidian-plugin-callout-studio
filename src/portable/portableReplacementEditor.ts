import { markdownPrefix } from "../editor/markdownContainers";
import { assertPortableCustomLine, PortableCustomReplacementError, type PortableReplacement } from "../utils/portableCalloutCustom";
import type { PortableCalloutConversionChange } from "../utils/portableCalloutPlan";

export interface PortableReplacementField {
	value: string;
	defaultValue?: string;
	source: string;
	before?: string;
	after?: string;
	heading?: boolean;
}

export interface PortableReplacementEditor {
	fields: readonly PortableReplacementField[];
	compose(values: readonly string[]): PortableReplacement | undefined;
}

/** Editable values exclude heading markers and all words surrounding an inline. */
export function createPortableReplacementEditor(
	base: PortableCalloutConversionChange, current: PortableCalloutConversionChange, custom?: PortableReplacement,
): PortableReplacementEditor | undefined {
	if (base.headingLine) {
		const start = markdownPrefix(base.replacement).from;
		const marker = /^#{1,6}[ \t]+/.exec(base.replacement.slice(start));
		if (!marker) return undefined;
		const prefix = base.replacement.slice(0, start + marker[0].length);
		const suffix = /[ \t]+#+[ \t]*$/.exec(base.replacement.slice(prefix.length))?.[0] ?? "";
		const title = (line: string): string => line.slice(prefix.length, suffix ? -suffix.length : undefined);
		return { fields: [{ value: title(current.replacement), defaultValue: title(current.defaultReplacement), source: base.before, before: prefix, after: suffix, heading: true }],
			compose: values => {
				if (values.length !== 1) throw new PortableCustomReplacementError();
				assertPortableCustomLine(values[0]!);
				const text = prefix + values[0]! + suffix;
				return text === current.defaultReplacement ? undefined : text;
			} };
	}
	const value = typeof custom === "object" ? custom.text : typeof custom === "string" ? custom : current.replacement;
	return { fields: [{ value, defaultValue: current.defaultReplacement, source: base.before }], compose: values => {
		if (values.length !== 1) throw new PortableCustomReplacementError();
		const text = values[0]!;
		assertPortableCustomLine(text);
		return text === current.defaultReplacement ? undefined : { text, inline: [{ from: base.from, to: base.to, source: base.before, text }] };
	} };
}
