/**
 * settings/pluginImport/pluginImportFlow.ts — which of the plugin import
 * window's options its one Import acts on.
 *
 * Pure on purpose. The window used to carry an Import inside the "This vault"
 * row beside a footer Import that only read the paste box — and, for
 * Admonition, a "Choose file…" that imported the moment a file was picked. The
 * rule that replaced them is stated here once, as functions of plain state, so
 * it can be tested without a DOM.
 *
 * The window has at most two options, on one screen:
 *
 *   vault   the other plugin's own data.json, found in this vault. On screen
 *           only while there is, or may yet be, something in it.
 *   manual  what the user hands over instead: an uploaded file (Admonition) or
 *           pasted text (Callout Manager). Which of the two is the source's to
 *           say (`PluginImportSource.manual`); the rule below is the same for
 *           both. Always on screen, and alone once the vault turns out to hold
 *           nothing.
 *
 * Each keeps what it was given, and exactly one of them is active: the one
 * Import would act on. That is the option the user last filled or picked, for
 * as long as it still holds something — and the vault otherwise, once found.
 */

/**
 * What looking for the other plugin's data.json in this vault turned up. With
 * nothing to import, the probe says which of three things it found — and the
 * window treats all three alike: the vault option simply is not offered.
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

export type ImportOption = "vault" | "manual";

export interface ImportFlow {
	probe: ProbeState;
	/** The option the user last filled or picked; null until they do either. */
	chosen: ImportOption | null;
	/** A file is staged, or the paste box holds something other than whitespace. */
	hasManual: boolean;
	/** Reading, planning, reporting or applying: nothing else may start. */
	busy: boolean;
}

export function initialFlow(): ImportFlow {
	return {
		probe: "checking",
		chosen: null,
		hasManual: false,
		busy: false,
	};
}

/** Whether an option holds something Import could act on. */
export function isFilled(flow: ImportFlow, option: ImportOption): boolean {
	return option === "vault" ? flow.probe === "found" : flow.hasManual;
}

/**
 * Whether the vault option is on screen: while its data is being looked for,
 * and once it is found. A probe that settles on nothing takes it away, and the
 * manual option is then the only one there is.
 */
export function vaultOffered(probe: ProbeState): boolean {
	return probe === "checking" || probe === "found";
}

/**
 * What Import would act on. The user's own choice while it still holds
 * something; otherwise the vault once found, as the recommended default; and
 * otherwise whatever the manual option holds, being the only thing on screen.
 */
export function activeOption(flow: ImportFlow): ImportOption | null {
	if (flow.chosen !== null && isFilled(flow, flow.chosen)) return flow.chosen;
	if (flow.probe === "found") return "vault";
	return flow.hasManual ? "manual" : null;
}

export function canImport(flow: ImportFlow): boolean {
	return !flow.busy && activeOption(flow) !== null;
}
