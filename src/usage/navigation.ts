import { MarkdownView, Notice, TFile, type App } from "obsidian";
import { t } from "../i18n";
import type { CalloutOccurrence } from "./occurrenceTypes";
import { scanCalloutOccurrences, scanCalloutOccurrencesAsync } from "./scanCalloutOccurrences";

/** Revalidate against the whole current document, including its exclusion context. */
export function resolveOccurrencePosition(
	occurrence: CalloutOccurrence,
	content: string,
): CalloutOccurrence | null {
	return resolveParsedOccurrence(occurrence, scanCalloutOccurrences(occurrence.path, content));
}

function resolveParsedOccurrence(
	occurrence: CalloutOccurrence,
	candidates: readonly CalloutOccurrence[],
): CalloutOccurrence | null {
	const bracket = occurrence.lineText.slice(occurrence.from, occurrence.to);
	const matches = candidates.filter((candidate) =>
		candidate.identity === occurrence.identity && candidate.role === occurrence.role &&
		candidate.lineText === occurrence.lineText &&
		candidate.from === occurrence.from && candidate.to === occurrence.to &&
		candidate.lineText.slice(candidate.from, candidate.to) === bracket,
	);
	const unchanged = matches.find((candidate) =>
		candidate.contentFingerprint === occurrence.contentFingerprint &&
		candidate.line === occurrence.line && candidate.from === occurrence.from,
	);
	if (unchanged) return unchanged;
	// A unique original source line can safely move when lines are inserted above.
	// Repeated lines or edited source have no reliable anchor: let the caller refresh.
	return matches.length === 1 ? matches[0]! : null;
}

/** Opens a document leaf, never the results sidebar, and selects the exact token. */
export async function navigateToCalloutOccurrence(
	app: App,
	occurrence: CalloutOccurrence,
	newTab = false,
): Promise<boolean> {
	try {
		const file = app.vault.getAbstractFileByPath(occurrence.path);
		if (!(file instanceof TFile)) {
			new Notice(t("usage.missing"));
			return false;
		}
		const workspace = app.workspace;
		let leaf = newTab ? workspace.getLeaf("tab") :
			workspace.getLeavesOfType("markdown").find((candidate) =>
				candidate.getRoot() === workspace.rootSplit &&
				candidate.view instanceof MarkdownView && candidate.view.file === file,
			) ?? workspace.getLeaf(false);
		if (leaf.getRoot() !== workspace.rootSplit) leaf = workspace.getLeaf("tab");
		await leaf.openFile(file, { active: true, state: { mode: "source" } });
		await leaf.loadIfDeferred();
		if (!(leaf.view instanceof MarkdownView) || leaf.view.file !== file) {
			new Notice(t("usage.openFailed"));
			return false;
		}
		// The open editor is authoritative here; a cached disk read may lag typing.
		const view = leaf.view;
		const editor = view.editor;
		const content = editor.getValue();
		const stillOpen = (): boolean => leaf.view === view && view.file === file && file.path === occurrence.path;
		const candidates = await scanCalloutOccurrencesAsync(occurrence.path, content, stillOpen);
		// Parsing yields for large notes. Never select coordinates from a buffer
		// that changed while awaiting it, even when the saved line still matches.
		const current = candidates && stillOpen() && editor.getValue() === content
			? resolveParsedOccurrence(occurrence, candidates) : null;
		if (!current) {
			new Notice(t("usage.changed"));
			return false;
		}
		const from = { line: current.line, ch: current.from };
		const to = { line: current.line, ch: current.to };
		leaf.setEphemeralState({ line: current.line, focus: true });
		editor.setSelection(from, to);
		editor.scrollIntoView({ from, to }, true);
		editor.focus();
		return true;
	} catch {
		new Notice(t("usage.openFailed"));
		return false;
	}
}
