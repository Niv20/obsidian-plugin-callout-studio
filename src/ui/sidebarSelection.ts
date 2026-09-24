import type { Editor, EditorPosition } from "obsidian";
import type { SidebarSourceRange } from "./sidebarNavigation";

const subscriptions = new WeakMap<Editor, Set<(documentChanged: boolean) => void>>();

/** The existing CodeMirror extension forwards selection transactions, without polling. */
export function notifySidebarEditorSelection(editor: Editor, documentChanged = false): void {
	for (const notify of subscriptions.get(editor) ?? []) notify(documentChanged);
}

const equalPosition = (a: EditorPosition, b: EditorPosition): boolean => a.line === b.line && a.ch === b.ch;

/** A highlighted result lasts only as long as its exact source selection. */
export class SidebarSourceSelection {
	private dispose?: () => void;
	clear(): void { this.dispose?.(); this.dispose = undefined; }
	watch(editor: Editor, range: SidebarSourceRange, onClear: () => void): void {
		this.clear();
		const notify = (documentChanged: boolean): void => {
			const selections = editor.listSelections();
			const selection = selections.length === 1 ? selections[0] : undefined;
			const matches = selection && (
				equalPosition(selection.anchor, range.from) && equalPosition(selection.head, range.to) ||
				equalPosition(selection.head, range.from) && equalPosition(selection.anchor, range.to)
			);
			if (matches && !documentChanged) return;
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
