/**
 * settings/embeddedEditorOwner.ts — the object Obsidian installs as
 * `app.workspace.activeEditor` while the settings live preview has focus.
 *
 * The embedded editor does not ask for that job and cannot decline it. Its
 * CodeMirror config carries `domEventHandlers({focus(){ app.workspace
 * .activeEditor = this.owner }})`, shared by *every* markdown editor in the
 * app — so the moment the user clicks into the preview inside a Callout Studio
 * window, this plain object becomes what the whole application means by "the
 * editor the user is working in". Core then reads members off it that
 * `MarkdownFileInfo` — the published type of that slot — does not declare, and
 * reads most of them **unguarded**.
 *
 * That is the entire reason this module exists, and why it is a module rather
 * than an object literal inside {@link EmbeddableMarkdownEditor}: every member
 * below was added because a specific piece of Obsidian dereferenced it and
 * threw, each one found the same expensive way — a `TypeError` from a core
 * listener, asynchronous, with no plugin frame anywhere on the stack. Keeping
 * them together with the evidence is what stops the next one being found the
 * same way.
 *
 * Two rules govern edits here:
 *
 * 1. **An absent member is a decision, not an omission.** Three are left off
 *    deliberately — `file`, `editMode` and `showSearch` — and each says why at
 *    the point it would have gone. Adding one "for completeness" changes
 *    behaviour in core; see the individual notes.
 * 2. **The registration must be released.** See {@link releaseActiveEditor}.
 */
import type { App, Editor } from "obsidian";

/**
 * What the owner needs from the editor it fronts.
 *
 * Both are functions rather than values because the owner is built *before*
 * the editor exists (it is a constructor argument) and outlives it (core can
 * hold the slot after teardown). Every read therefore has to be late.
 */
export interface OwnedEditorAccess {
	/** The genuine Obsidian `Editor`, or `undefined` before mount. */
	editor(): Editor | undefined;
	/** Text of the current primary selection; `""` when unavailable. */
	selection(): string;
}

/**
 * The `activeEditor` stand-in. Deliberately **not** declared as Obsidian's
 * `MarkdownFileInfo`: it does not implement `file`, and pretending otherwise
 * would hide the one thing a reader of this file needs to know.
 */
export interface EditorOwner {
	app: App;
	/**
	 * Called by the internal edit view's own scroll plumbing. A no-op is
	 * enough — a real `MarkdownView` uses it to sync a split source/reading
	 * pane, and there is no second pane here.
	 */
	onMarkdownScroll: () => void;
	/**
	 * The native scroll listener calls this unconditionally, so it must exist
	 * even though it does nothing. Chromium fires a spurious `scroll` event on
	 * a scroller whenever an ancestor's `dir` flips to `rtl` — which Obsidian
	 * sets high in the DOM under RTL interface languages — so a missing method
	 * threw for every RTL user with zero user scrolling.
	 */
	syncScroll: () => void;
	getMode: () => "source" | "preview";
	toggleMode: () => void;
	readonly editor: Editor;
}

/**
 * Build the owner for one embedded editor.
 *
 * ## Why `getMode()` answers `"preview"`
 *
 * This single line is what keeps a read-only settings preview from being
 * treated as the user's note, and it is worth stating precisely what it buys,
 * because the obvious answer — `"source"`, since the thing plainly *is* an
 * editing surface — is what shipped first and was wrong four ways over.
 *
 * Core asks `activeEditor.getMode()` in exactly one spirit: *may editor
 * machinery act on this?* For a preview that is backed by no file, refuses
 * every keystroke, and mirrors a form the user is filling in, the honest
 * answer is no. Answering `"source"` made four separate pieces of Obsidian
 * take our object seriously:
 *
 * - `updateViewState()` — the native menu-bar builder, which runs on every
 *   `file-open` and `active-leaf-change` — evaluates
 *   `!(mode === "preview") && activeEditor.editMode.sourceMode`. With
 *   `"source"` the `&&` never short-circuits, so it dereferences `editMode`,
 *   which this object does not have, and throws. **That is the crash this
 *   answer fixes**, and it fixes it by removing the read rather than by
 *   feeding it something.
 * - `Commands.addCommand` wraps every `editorCallback`/`editorCheckCallback`
 *   in `if (allowPreview || getMode() !== "preview")`. That is *every* editor
 *   command in the application — Obsidian's own, every other plugin's, and
 *   this plugin's own wrap/unwrap commands. Answering `"source"` handed all of
 *   them the settings preview instead of the note the user was looking at.
 * - `editor:open-search-replace` and `editor:toggle-fold-properties` are gated
 *   on `getMode() === "source"` and then call members this object lacks.
 *   Answering `"preview"` skips both; answering `"source"` threw from both.
 * - The Command Palette runs every command's `checkCallback` when it opens, so
 *   all of the above fired merely from pressing the palette's hotkey.
 *
 * Nothing is given up. `owner.getMode` is never called by the editor itself —
 * only ever through `workspace.activeEditor` — so this does not reach the
 * embedded editor's own behaviour. Whether the preview renders as Live Preview
 * or raw source is decided by `sourceMode` on the *instance*, which
 * `forceLivePreview` pins independently.
 */
export function createEditorOwner(app: App, target: OwnedEditorAccess): EditorOwner {
	return {
		app,
		onMarkdownScroll: () => {},
		syncScroll: () => {},
		getMode: () => "preview",
		/**
		 * `markdown:toggle-preview` (Mod+E) is the one mode command with no
		 * gate at all — `if (activeEditor) activeEditor.toggleMode()` — so it
		 * reaches this object whatever `getMode()` says. A no-op is the right
		 * body: there is no second mode for a preview to toggle into, and a
		 * swallowed keystroke beats the `TypeError` that a missing method
		 * throws today.
		 */
		toggleMode: () => {},
		/**
		 * The **genuine** editor once mounted, because two consumers call
		 * methods straight through this property and neither tolerates a
		 * partial shim:
		 *
		 * - Word Count runs `info.editor.getSelection()` on every
		 *   `editor-selection-change`, and Obsidian re-throws listener errors
		 *   through `setTimeout`, so a failure surfaces as an uncaught error
		 *   detached from its cause.
		 * - The Command Palette's `listCommands()` runs every command's
		 *   `checkCallback`, and the editor commands call `getCursor()` /
		 *   `hasFocus()` on it.
		 *
		 * Before mount — `target.editor()` is `undefined` while the base
		 * constructor is still running — a selection-only shim stands in,
		 * which is all the Word Count listener needs for the initial
		 * cursor-park dispatch.
		 *
		 * Read-only is enforced by `EditorState.readOnly`, not by withholding
		 * the editor, so a command that does reach the preview cannot mutate
		 * it.
		 */
		get editor(): Editor {
			return target.editor() ?? ({ getSelection: () => target.selection() } as Editor);
		},

		/*
		 * Deliberately absent — each of these is load-bearing by *not* being
		 * here:
		 *
		 * `file` — `MarkdownFileInfo` declares it, and this object is
		 * consequently not one. Supplying `null` would be worse than omitting
		 * it: `Workspace.getActiveFile()` and the macOS share menu both
		 * optional-chain and behave identically either way, but the Outline
		 * view resolves its subject with `activeEditor.file === this.file`.
		 * Absent, that comparison is `undefined === null` and stays false;
		 * supplied as `null`, a fileless Outline would match this preview and
		 * start reading selections out of it. Absent is what keeps every
		 * file-shaped question falling through to the user's real note.
		 *
		 * `editMode` — the internal edit view. Core reads it only behind a
		 * `getMode()` gate that now answers `"preview"`, except in
		 * `editor:follow-link` and its three open-in-new-* siblings, which
		 * reach it only when the user presses the hotkey with the caret on a
		 * link. Supplying it would turn that `TypeError` into something worse:
		 * `triggerClickableToken` resolves through the owner's `file`, which
		 * is absent above, so it would navigate the workspace behind the modal
		 * to a link resolved from the vault root.
		 *
		 * `showSearch` — `editor:open-search` (Mod+F) duck-types it
		 * (`typeof owner.showSearch === "function"`) and falls back to the
		 * active leaf's own view when it is missing, so leaving it off is
		 * precisely what keeps Mod+F opening search in the user's note rather
		 * than in a preview that cannot usefully host it.
		 */
	};
}

/**
 * Hand `app.workspace.activeEditor` back, if this owner still holds it.
 *
 * **This is the half that makes the crash survivable rather than permanent,
 * and it has no equivalent anywhere else in the plugin.** Obsidian's own
 * embedded-editor host releases itself in both of its teardown paths
 * (`destroyEditor()` and `onunload()` each end in
 * `workspace.unsetActiveEditor(this)`); the base editor class this plugin
 * borrows does not, because in Obsidian's design releasing the slot is the
 * *owner's* job — and this plugin's owner is a plain object with no lifecycle
 * of its own.
 *
 * Nothing else will do it. The `activeEditor` setter ignores real
 * `MarkdownView`s (they are re-derived by the getter instead), so clicking
 * back into a note cannot displace a stale owner; and the only other place
 * core clears the field is a genuine active-leaf change. Closing a modal is
 * not one. So without this call, one visit to a callout editor's live preview
 * leaves a destroyed, detached, read-only editor standing as the application's
 * active editor for the rest of the session — until the user happens to switch
 * tabs.
 *
 * The identity check is what makes it safe to call unconditionally: if the
 * slot has moved on to someone else, this does nothing. Assigning `null` is
 * public, typed API (`activeEditor: MarkdownFileInfo | null`) and is exactly
 * what `unsetActiveEditor` does internally, without reaching for an
 * undocumented method.
 */
export function releaseActiveEditor(app: App, owner: EditorOwner): void {
	const { workspace } = app;
	// The types have no declared overlap — `EditorOwner` is deliberately not a
	// `MarkdownFileInfo` (see `file` above) — but at runtime this is the very
	// object core stored, so identity is the right question to ask.
	if ((workspace.activeEditor as unknown) === (owner as unknown)) {
		workspace.activeEditor = null;
	}
}
