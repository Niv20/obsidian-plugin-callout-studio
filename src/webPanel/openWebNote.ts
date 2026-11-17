/**
 * webPanel/openWebNote.ts — shows the Digital Garden note once the Publish to
 * the web panel has written it by hand.
 *
 * The note is what the user publishes next, and its top says what it is and
 * what not to do with it (`web/static/gardenNote.ts`), so **Write note** and
 * **Update now** open it, in the main area beside the panel. The keyboard
 * stays where it was, on the panel: the panel's next steps are how the note
 * gets published. It opens in Reading view, being a note to read and not to
 * edit. A tab that already shows it is brought forward as it is, and an empty
 * tab is used rather than left beside a new one.
 *
 * The writer goes through the vault's adapter (`manager/web/writeTarget.ts`),
 * so a note it has just created is on disk a moment before the vault lists
 * it. It is waited for, briefly. A note that never shows up is not opened, and
 * nothing more is said: the write's own notice has said what happened.
 */
import { TFile, type App, type WorkspaceLeaf } from "obsidian";

/** How long a note just created may take to reach the vault's list of files. */
const APPEAR_MS = 3000;

/** The note at `path` as the vault lists it, once it does; `null` if it does not within {@link APPEAR_MS}. */
function listed(app: App, path: string): Promise<TFile | null> {
	const lookUp = (): TFile | null => {
		const file = app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file : null;
	};
	const now = lookUp();
	if (now) return Promise.resolve(now);
	return new Promise((resolve) => {
		const finish = (file: TFile | null): void => {
			window.clearTimeout(timer);
			app.vault.offref(ref);
			resolve(file);
		};
		const ref = app.vault.on("create", (file) => {
			if (file.path === path && file instanceof TFile) finish(file);
		});
		const timer = window.setTimeout(() => finish(lookUp()), APPEAR_MS);
	});
}

/** A main-area tab that shows `path`, loaded or not yet. */
function showing(app: App, path: string): WorkspaceLeaf | null {
	const { workspace } = app;
	return (
		workspace
			.getLeavesOfType("markdown")
			.find((leaf) => leaf.getRoot() === workspace.rootSplit && leaf.getViewState().state?.file === path) ?? null
	);
}

/** Open the note at `path` as the module comment says. Never throws. */
export async function openWebNote(app: App, path: string): Promise<void> {
	try {
		const file = await listed(app, path);
		if (!file) return;
		const { workspace } = app;
		let leaf = showing(app, file.path);
		if (!leaf) {
			const recent = workspace.getMostRecentLeaf(workspace.rootSplit);
			leaf = recent?.view.getViewType() === "empty" ? recent : workspace.getLeaf("tab");
			// Inactive, then made the active tab without focus: the panel keeps the keyboard.
			await leaf.openFile(file, { active: false, state: { mode: "preview" } });
		}
		workspace.setActiveLeaf(leaf, { focus: false });
		await leaf.loadIfDeferred();
	} catch (e) {
		console.warn(`[CalloutStudio] could not open "${path}"`, e);
	}
}
