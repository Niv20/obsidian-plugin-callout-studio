/**
 * settings/previewReadOnly.ts — What makes an embedded preview immutable.
 *
 * Split out of `EmbeddableMarkdownEditor` so the rule can be tested against a
 * real `EditorState` without an Obsidian editor to host it, and because that
 * file is at its size limit.
 *
 * ## Why `EditorState.readOnly` was never enough
 *
 * `readOnly` is advisory. CodeMirror's own docs say it "is consulted by
 * commands and extensions that implement editing functionality" — it does not
 * reject a programmatic `dispatch({changes})`. Everything that types, pastes or
 * drops goes through a command and is stopped; everything that calls the editor
 * API directly is not. Obsidian's editor context menu is entirely the second
 * kind: the Format, Paragraph and Insert submenus call `toggleBulletList()`,
 * `setHeading()`, `toggleBlockquote()`, `insertTable()`, `insertCallout()`,
 * `insertCodeblock()`, `insertMathBlock()` and friends, all of which land in a
 * "read-only" preview. So did this plugin's own menu items, and so does any
 * other plugin's editor command that happens to reach the preview.
 *
 * {@link readOnlyPreviewExtensions} therefore adds a `transactionFilter`, which
 * is the only place every one of those routes converges — they all end at
 * `cm.dispatch`. A transaction that changes the document is dropped whole and
 * reported through `onEditAttempt`; anything that does not (selection moves,
 * our own `calloutStudioRefresh` effect, Obsidian's live-preview bookkeeping)
 * passes untouched, so click-to-reveal-source still works.
 *
 * `EditorView.editable.of(false)` is deliberately NOT used. It would be simpler
 * and it would be wrong: with no caret there is no cursor position, and Live
 * Preview reveals a line's raw markdown by cursor position. The preview would
 * stop being a preview of anything.
 */
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * The permit that lets the preview's *own* writes through.
 *
 * `EmbeddableMarkdownEditor.setValue()` reseeds the document when the form it
 * mirrors changes, and that reseed is a doc-changing transaction like any
 * other. Rather than trying to recognise it after the fact, the write announces
 * itself: {@link allow} opens the gate, runs the write synchronously, and
 * closes it again in a `finally` so a throw cannot leave the editor writable.
 *
 * Synchronous by construction. `set()` dispatches during the call, so there is
 * no window in which the gate is open and something else could dispatch — and
 * an async variant would silently create one.
 */
export interface PreviewWriteGate {
	/** True only for the duration of an {@link allow} call. */
	readonly isOpen: boolean;
	/** Run `fn` with document writes permitted. */
	allow<T>(fn: () => T): T;
}

export interface ReadOnlyPreviewOptions {
	/** Invoked once per blocked edit attempt, however it was triggered. */
	onEditAttempt?: () => void;
	/**
	 * Invoked when the editor loses focus. Kept as a callback rather than
	 * handled here because what the owner does on blur (release the app's
	 * `activeEditor`, park the caret) is the editor's business, not this
	 * module's.
	 */
	onBlur?: () => void;
}

/**
 * The extension set that makes a preview read-only, plus the gate its owner
 * needs to reseed it.
 *
 * Returned together because they are one mechanism: the filter is meaningless
 * without a way through it, and a gate no filter consults does nothing.
 */
export function readOnlyPreviewExtensions(
	options: ReadOnlyPreviewOptions = {},
): {
	extensions: Extension[];
	gate: PreviewWriteGate;
} {
	const { onEditAttempt, onBlur } = options;

	let open = false;
	const gate: PreviewWriteGate = {
		get isOpen() {
			return open;
		},
		allow<T>(fn: () => T): T {
			const previous = open;
			open = true;
			try {
				return fn();
			} finally {
				open = previous;
			}
		},
	};

	const block = (event: Event): boolean => {
		event.preventDefault();
		onEditAttempt?.();
		return true;
	};

	const extensions: Extension[] = [
		// Still worth setting even though it is not the guarantee: it is what
		// well-behaved commands and extensions check, so they decline instead
		// of dispatching a transaction for the filter below to throw away.
		EditorState.readOnly.of(true),
		// Keeps Obsidian's modal focus-first pass (which skips
		// `[tabindex="-1"]`) from dropping the caret into a preview when a
		// popup opens. Clicking still focuses.
		EditorView.contentAttributes.of({ tabindex: "-1" }),
		// The guarantee. Every route that can change the document — menu
		// commands, `Editor.replaceRange`, another plugin's command, a raw
		// `view.dispatch` — arrives here.
		EditorState.transactionFilter.of((tr) => {
			if (!tr.docChanged || gate.isOpen) return tr;
			onEditAttempt?.();
			return [];
		}),
		EditorView.domEventHandlers({
			blur: () => {
				onBlur?.();
				return false;
			},
		}),
		// The filter above already guarantees nothing lands; these run at the
		// highest precedence to stop the *browser's* default as well, so a
		// paste or a drop never repaints the contenteditable for a frame
		// before CodeMirror reconciles it back. They also cover the Electron
		// context-menu paths (cut, spellcheck replacement) that mutate the
		// DOM directly rather than through a CodeMirror command.
		Prec.highest(
			EditorView.domEventHandlers({
				beforeinput: block,
				paste: block,
				drop: block,
			}),
		),
	];

	return { extensions, gate };
}
