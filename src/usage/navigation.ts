import { MarkdownView, Notice, TFile, type App, type WorkspaceLeaf } from "obsidian";
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
	isCurrent: () => boolean = () => true,
): Promise<boolean> {
	try {
		if (!isCurrent()) return false;
		const file = app.vault.getAbstractFileByPath(occurrence.path);
		if (!(file instanceof TFile)) {
			new Notice(t("usage.missing"));
			return false;
		}
		const workspace = app.workspace;
		const isTarget = (candidate: WorkspaceLeaf | null): candidate is WorkspaceLeaf =>
			candidate !== null && candidate.getRoot() === workspace.rootSplit &&
			candidate.view instanceof MarkdownView && candidate.view.file === file;
		const recent = workspace.getMostRecentLeaf(workspace.rootSplit);
		let leaf = newTab ? workspace.getLeaf("tab") :
			isTarget(recent) ? recent :
			workspace.getLeavesOfType("markdown").find(isTarget) ?? workspace.getLeaf(false);
		if (leaf.getRoot() !== workspace.rootSplit) leaf = workspace.getLeaf("tab");
		await leaf.openFile(file, { active: true, state: { mode: "source" } });
		if (!isCurrent()) return false;
		await leaf.loadIfDeferred();
		if (!isCurrent()) return false;
		if (!(leaf.view instanceof MarkdownView) || leaf.view.file !== file) {
			new Notice(t("usage.openFailed"));
			return false;
		}
		// The open editor is authoritative here; a cached disk read may lag typing.
		const view = leaf.view;
		const editor = view.editor;
		const content = editor.getValue();
		const stillOpen = (): boolean => {
			if (!isCurrent() || leaf.view !== view || view.file !== file || file.path !== occurrence.path) return false;
			const active = workspace.getActiveViewOfType(MarkdownView);
			// Focusing the sidebar keeps the document context. Switching to another
			// editor or main-pane view cancels this pending navigation instead.
			return active ? active === view : workspace.getMostRecentLeaf(workspace.rootSplit) === leaf;
		};
		const candidates = await scanCalloutOccurrencesAsync(occurrence.path, content, stillOpen);
		if (!stillOpen()) return false;
		// Parsing yields for large notes. Never select coordinates from a buffer
		// that changed while awaiting it, even when the saved line still matches.
		const current = candidates && editor.getValue() === content
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
