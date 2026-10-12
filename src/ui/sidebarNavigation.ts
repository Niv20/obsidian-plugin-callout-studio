import { MarkdownView, Notice, Platform, TFile, type App, type Editor, type EditorPosition, type WorkspaceLeaf } from "obsidian";
import { t } from "../i18n";
import { linesOf } from "../editor/calloutExtent";
import { revealCalloutInEditor } from "../editor/calloutFlash";

export interface SidebarSourceRange { from: EditorPosition; to: EditorPosition; }
export type SidebarSourceSelected = (editor: Editor, range: SidebarSourceRange) => void;

export interface SidebarNavigationOptions {
	/** Ctrl/Cmd-click: open the note in a new tab. */
	newTab?: boolean;
	/** False once the sidebar's request is stale (filters changed, sidebar closed). */
	isCurrent?: () => boolean;
	/** Called once the result is in view, with the editor it landed in. */
	onSelected?: SidebarSourceSelected;
	/** The sidebar's own leaf. On a phone or tablet its drawer closes so the note shows. */
	origin?: WorkspaceLeaf;
}

/** File headings open the note at the top, without moving its caret. */
export function navigateToSidebarFile(app: App, path: string, options: SidebarNavigationOptions = {}): Promise<boolean> {
	return openSidebarNote(app, path, options, (view, _content, stillOpen) => {
		if (!stillOpen()) return Promise.resolve(false);
		closeSidebarDrawer(app, options.origin);
		view.editor.scrollTo(null, 0);
		return Promise.resolve(true);
	});
}

/**
 * Open the source editor and bring a range validated against its live buffer
 * into view. The caret, the selection and keyboard focus stay where they were:
 * a caret inside a callout would show its raw Markdown, and focusing the editor
 * raises the keyboard on iOS. The callout flashes instead (calloutFlash.ts).
 */
export function navigateToSidebarResult(
	app: App,
	path: string,
	resolvePosition: (content: string, stillOpen: () => boolean) =>
		SidebarSourceRange | null | Promise<SidebarSourceRange | null>,
	options: SidebarNavigationOptions = {},
): Promise<boolean> {
	return openSidebarNote(app, path, options, async (view, content, stillOpen) => {
		const range = await resolvePosition(content, stillOpen);
		if (!stillOpen()) return false;
		// Resolution can yield while reading large notes. Never apply coordinates
		// to a buffer that changed while it was waiting, even if its line matches.
		if (!range || view.editor.getValue() !== content) {
			new Notice(t("usage.changed"));
			return false;
		}
		const drawerClosing = closeSidebarDrawer(app, options.origin);
		revealCalloutInEditor(view.editor, linesOf(content), range, drawerClosing);
		options.onSelected?.(view.editor, range);
		return true;
	});
}

async function openSidebarNote(
	app: App,
	path: string,
	options: SidebarNavigationOptions,
	land: (view: MarkdownView, content: string, stillOpen: () => boolean) => Promise<boolean>,
): Promise<boolean> {
	const isCurrent = options.isCurrent ?? (() => true);
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
		let leaf = options.newTab ? workspace.getLeaf("tab") :
			isTarget(recent) ? recent :
			workspace.getLeavesOfType("markdown").find(isTarget) ?? workspace.getLeaf(false);
		if (leaf.getRoot() !== workspace.rootSplit) leaf = workspace.getLeaf("tab");
		// A pane already editing keeps Live Preview or Source, whichever its user
		// left it in. Anything else (Reading view, a new tab, another view type)
		// gets the vault's default editing mode by name: given only `mode`, core
		// restores whichever flavour the pane last edited in, which can be Source.
		const editing = leaf.view instanceof MarkdownView && leaf.view.getMode() === "source";
		const state = editing ? { mode: "source" } : { mode: "source", source: defaultsToSourceMode(app) };
		// Opened inactive, then activated without focus: core's focusLeaf is what
		// moves focus into the editor (and, on a phone, collapses the drawers).
		await leaf.openFile(file, { active: false, state });
		if (!isCurrent()) return false;
		workspace.setActiveLeaf(leaf, { focus: false });
		await leaf.loadIfDeferred();
		if (!isCurrent()) return false;
		if (!(leaf.view instanceof MarkdownView) || leaf.view.file !== file) {
			new Notice(t("usage.openFailed"));
			return false;
		}
		const view = leaf.view;
		const stillOpen = (): boolean => {
			if (!isCurrent() || leaf.view !== view || view.file !== file || file.path !== path) return false;
			const active = workspace.getActiveViewOfType(MarkdownView);
			// Sidebar focus keeps the note context; another main editor cancels it.
			return active ? active === view : workspace.getMostRecentLeaf(workspace.rootSplit) === leaf;
		};
		return await land(view, view.editor.getValue(), stillOpen);
	} catch {
		new Notice(t("usage.openFailed"));
		return false;
	}
}

/**
 * Whether Settings → Editor → Default editing mode is Source mode. `getConfig`
 * is undocumented (see headingFold.ts); without it, core's own default holds:
 * Live Preview.
 */
function defaultsToSourceMode(app: App): boolean {
	try {
		const vault = app.vault as unknown as { getConfig?: (key: string) => unknown };
		return typeof vault.getConfig === "function" && vault.getConfig("livePreview") === false;
	} catch {
		return false;
	}
}

/**
 * On a phone or tablet the sidebar is a drawer over the note. Close it, as core
 * does when a note gains focus. True when a drawer is now sliding away.
 */
function closeSidebarDrawer(app: App, origin: WorkspaceLeaf | undefined): boolean {
	if (!Platform.isMobile || !origin) return false;
	const { leftSplit, rightSplit } = app.workspace;
	const root = origin.getRoot();
	const drawer = root === leftSplit ? leftSplit : root === rightSplit ? rightSplit : null;
	if (!drawer || drawer.collapsed) return false;
	drawer.collapse();
	return true;
}
