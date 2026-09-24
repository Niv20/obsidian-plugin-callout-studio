import { MarkdownView, Notice, TFile, type App, type Editor, type EditorPosition, type WorkspaceLeaf } from "obsidian";
import { t } from "../i18n";

export interface SidebarSourceRange { from: EditorPosition; to: EditorPosition; }
export type SidebarSourceSelected = (editor: Editor, range: SidebarSourceRange) => void;

/** File headings open the note at the top, without selecting a callout. */
export function navigateToSidebarFile(app: App, path: string, newTab = false,
	isCurrent: () => boolean = () => true): Promise<boolean> {
	return navigateToSidebarResult(app, path,
		() => ({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } }), newTab, isCurrent);
}

/** Open the source editor and select only a range validated against its live buffer. */
export async function navigateToSidebarResult(
	app: App,
	path: string,
	resolvePosition: (content: string, stillOpen: () => boolean) =>
		SidebarSourceRange | null | Promise<SidebarSourceRange | null>,
	newTab = false,
	isCurrent: () => boolean = () => true,
	onSelected?: SidebarSourceSelected,
): Promise<boolean> {
	try {
		if (!isCurrent()) return false;
		const file = app.vault.getAbstractFileByPath(path);
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
		const view = leaf.view;
		const editor = view.editor;
		const content = editor.getValue();
		const stillOpen = (): boolean => {
			if (!isCurrent() || leaf.view !== view || view.file !== file || file.path !== path) return false;
			const active = workspace.getActiveViewOfType(MarkdownView);
			// Sidebar focus keeps the note context; another main editor cancels it.
			return active ? active === view : workspace.getMostRecentLeaf(workspace.rootSplit) === leaf;
		};
		const range = await resolvePosition(content, stillOpen);
		if (!stillOpen()) return false;
		// Resolution can yield while reading large notes. Never apply coordinates
		// to a buffer that changed while it was waiting, even if its line matches.
		if (!range || editor.getValue() !== content) {
			new Notice(t("usage.changed"));
			return false;
		}
		leaf.setEphemeralState({ line: range.from.line, focus: true });
		editor.setSelection(range.from, range.to);
		editor.scrollIntoView(range, true);
		editor.focus();
		onSelected?.(editor, range);
		return true;
	} catch {
		new Notice(t("usage.openFailed"));
		return false;
	}
}
