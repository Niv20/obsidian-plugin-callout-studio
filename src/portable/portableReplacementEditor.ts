import { markdownPrefix } from "../editor/markdownContainers";
import { assertPortableCustomLine, PortableCustomReplacementError, type PortableReplacement } from "../utils/portableCalloutCustom";
import type { PortableCalloutConversionChange } from "../utils/portableCalloutPlan";
import type { PortableReplacementField } from "./PortableCustomReplacementModal";

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
		return { fields: [{ value: title(current.replacement), source: base.before, before: prefix, after: suffix, heading: true }],
			compose: values => {
				if (values.length !== 1) throw new PortableCustomReplacementError();
				assertPortableCustomLine(values[0]!);
				const text = prefix + values[0]! + suffix;
				return text === current.defaultReplacement ? undefined : text;
			} };
	}
	const words = (text: string, end: boolean): string => {
		const matches = text.match(/\S+/g) ?? [];
		return (end ? matches.slice(-3) : matches.slice(0, 3)).join(" ");
	};
	const value = typeof custom === "object" ? custom.text : typeof custom === "string" ? custom : current.replacement;
	return { fields: [{ value, source: base.before,
		before: words(base.sourceLine.slice(0, base.from), true), after: words(base.sourceLine.slice(base.to), false) }], compose: values => {
		if (values.length !== 1) throw new PortableCustomReplacementError();
		const text = values[0]!;
		assertPortableCustomLine(text);
		return text === current.defaultReplacement ? undefined : { text, inline: [{ from: base.from, to: base.to, source: base.before, text }] };
	} };
}
