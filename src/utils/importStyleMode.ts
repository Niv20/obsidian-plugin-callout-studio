/**
 * utils/importStyleMode.ts — the `externalStyle` flag, crossing an import
 * boundary.
 *
 * `CalloutDefinition.externalStyle` owns what the key means at rest. This owns
 * what it means when it arrives in a file this build did not write, which is a
 * different question with different answers: nothing here may assume the value
 * is even the right *type*.
 *
 * Worth carrying across an import at all because the flag says the exporter
 * styles that callout in their own CSS — a decision about their setup rather
 * than a colour they picked — and a reader who takes the file is taking that
 * arrangement with it.
 *
 * The companion `styleMode` key is gone: it stored a manual "who paints this"
 * setting that no longer exists, and every value it held meant "this plugin
 * paints it", which is what its absence means. It is listed in
 * `importFields.RETIRED_FIELDS`, so a file carrying one is accepted in silence
 * rather than warned about — an export made by an older build of this plugin is
 * not a file the plugin fails to understand.
 */
import type { CalloutDefinition } from "../types";

/** The raw key as it appears in untrusted data. */
export interface ImportedStyleKeys {
	externalStyle?: unknown;
}

/** Whether an imported entry asks to be left to the reader's own CSS. */
export function importedExternalStyle(entry: ImportedStyleKeys): boolean {
	return entry.externalStyle === true;
}

/**
 * What is wrong with an entry's `externalStyle`, ready to report, or `null`.
 *
 * A non-boolean value is a *malformed* field and sinks the entry, exactly as
 * the other boolean fields do.
 */
export function styleModeImportIssue(entry: ImportedStyleKeys): {
	fatal: boolean;
	field: string;
	level: "error" | "warning";
	messageKey: string;
	params: Record<string, string>;
} | null {
	if (
		entry.externalStyle !== undefined &&
		typeof entry.externalStyle !== "boolean"
	) {
		return {
			fatal: true,
			field: "externalStyle",
			level: "error",
			messageKey: "import.err.boolField",
			params: { field: "externalStyle" },
		};
	}
	return null;
}

/**
 * Write the imported flag onto a freshly built definition.
 *
 * `def` does not carry the key at this point, so this writes it only when the
 * entry asked for it — never `false`, which `isCalloutModified` would read as
 * an edit.
 */
export function applyImportedStyleMode(
	def: CalloutDefinition,
	entry: ImportedStyleKeys,
): void {
	if (importedExternalStyle(entry)) def.externalStyle = true;
}
