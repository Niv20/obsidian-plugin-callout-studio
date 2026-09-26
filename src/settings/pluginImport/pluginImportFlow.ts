/**
 * settings/pluginImport/pluginImportFlow.ts — which of the plugin import
 * window's three options is active, and so what its one Import acts on.
 *
 * Pure on purpose. The window used to carry an Import inside the "This vault"
 * row beside a footer Import that only read the paste box — and, for
 * Admonition, a "Choose file…" that imported the moment a file was picked. The
 * rule that replaced them is stated here once, as functions of plain state, so
 * it can be tested without a DOM.
 *
 * The window shows three options at once, always in the same order:
 *
 *   vault  the other plugin's own data.json, found in this vault
 *   file   a chosen file, staged until Import is pressed
 *   paste  text read from the clipboard when its box is clicked
 *
 * Each keeps what it was given while another is active, so a staged file
 * survives a trip to the clipboard. Exactly one option is active at a time — it wears
 * the accent border — and Import acts on that one and never on another that
 * merely holds something.
 */

/**
 * What looking for the other plugin's data.json in this vault turned up. With
 * nothing to import, the window says which of three things it found:
 *
 *   notInstalled  no folder for the plugin at all
 *   empty         its folder, with nothing in it to import
 *   unreadable    its settings file, which can't be read, parsed or recognized
 */
export type ProbeState =
	| "checking"
	| "found"
	| "empty"
	| "notInstalled"
	| "unreadable";

export type ImportOption = "vault" | "file" | "paste";

/** Top to bottom, as the window draws them. */
export const IMPORT_OPTIONS: readonly ImportOption[] = ["vault", "file", "paste"];

export interface ImportFlow {
	probe: ProbeState;
	/** The option the user last chose; null until they choose one. */
	chosen: ImportOption | null;
	hasFile: boolean;
	/** The clipboard gave something other than whitespace. */
	hasPaste: boolean;
	/** Reading, planning, reporting or applying: nothing else may start. */
	busy: boolean;
}

export function initialFlow(): ImportFlow {
	return {
		probe: "checking",
		chosen: null,
		hasFile: false,
		hasPaste: false,
		busy: false,
	};
}

/** Whether an option holds something Import could act on. */
export function isFilled(flow: ImportFlow, option: ImportOption): boolean {
	switch (option) {
		case "vault":
			return flow.probe === "found";
		case "file":
			return flow.hasFile;
		case "paste":
			return flow.hasPaste;
	}
}

/**
 * The vault option greys out once the probe has settled on nothing to offer,
 * whichever of the three reasons it is. While it is still checking it is only
 * not selectable yet.
 */
export function vaultUnavailable(probe: ProbeState): boolean {
	return probe !== "checking" && probe !== "found";
}

/**
 * The active option: what the user chose, while it still holds something;
 * otherwise the vault once found, the recommended default; otherwise none.
 */
export function activeOption(flow: ImportFlow): ImportOption | null {
	if (flow.chosen !== null && isFilled(flow, flow.chosen)) return flow.chosen;
	return flow.probe === "found" ? "vault" : null;
}

export function canImport(flow: ImportFlow): boolean {
	return !flow.busy && activeOption(flow) !== null;
}
