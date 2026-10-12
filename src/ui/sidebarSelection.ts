import type { Editor, EditorSelection } from "obsidian";

type SelectionListener = (editor: Editor, documentChanged: boolean) => void;

const subscriptions = new WeakMap<Editor, Set<(documentChanged: boolean) => void>>();
/** Sidebars that follow whichever editor the caret moves in (Find callouts). */
const anyEditorListeners = new Set<SelectionListener>();

/**
 * The existing CodeMirror extension forwards selection transactions, without polling.
 * With no sidebar open, both lookups come back empty, so a transaction costs nothing more.
 */
export function notifySidebarEditorSelection(editor: Editor, documentChanged = false): void {
	for (const notify of subscriptions.get(editor) ?? []) notify(documentChanged);
	for (const listener of anyEditorListeners) listener(editor, documentChanged);
}

/** Hear every editor's caret moves and edits until the returned function is called. */
export function onSidebarEditorSelection(listener: SelectionListener): () => void {
	anyEditorListeners.add(listener);
	return () => { anyEditorListeners.delete(listener); };
}

const equalPosition = (a: EditorSelection["anchor"], b: EditorSelection["anchor"]): boolean =>
	a.line === b.line && a.ch === b.ch;
const sameRange = (a: EditorSelection, b: EditorSelection): boolean =>
	equalPosition(a.anchor, b.anchor) && equalPosition(a.head, b.head) ||
	equalPosition(a.anchor, b.head) && equalPosition(a.head, b.anchor);

/**
 * A clicked result stays current until the user acts in its editor: a different
 * selection or any edit. Navigation leaves the caret where it was, so the
 * selection to compare against is whatever the editor held when it landed.
 */
export class SidebarSourceSelection {
	private dispose?: () => void;
	clear(): void { this.dispose?.(); this.dispose = undefined; }
	watch(editor: Editor, onClear: () => void): void {
		this.clear();
		const landed = editor.listSelections();
		const notify = (documentChanged: boolean): void => {
			const selections = editor.listSelections();
			const unchanged = selections.length === landed.length &&
				selections.every((selection, i) => sameRange(selection, landed[i]!));
			if (unchanged && !documentChanged) return;
			this.clear();
			onClear();
		};
		const listeners = subscriptions.get(editor) ?? new Set();
		listeners.add(notify);
		subscriptions.set(editor, listeners);
		this.dispose = () => {
			listeners.delete(notify);
			if (listeners.size === 0) subscriptions.delete(editor);
		};
	}
}
