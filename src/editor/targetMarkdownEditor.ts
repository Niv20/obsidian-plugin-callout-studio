/**
 * editor/targetMarkdownEditor.ts — which editor a window writes into.
 *
 * Every other write in this plugin arrives through an `editorCallback` or a
 * CodeMirror event, so Obsidian hands it the right `Editor` and there is
 * nothing to decide. A window opened from the ribbon has no such handle: it is
 * opened *beside* the note, acts some seconds later, and by then the thing that
 * had focus is a button in a modal.
 *
 * Two rules make that safe, and both are load-bearing:
 *
 * **Never `workspace.activeEditor`.** It is the closest-looking API and it is
 * the wrong one: Obsidian installs whatever editor last had focus there, and
 * that includes the live preview inside this plugin's own windows — so a
 * window that trusted it could type into a preview widget instead of the
 * user's note. `getActiveViewOfType(MarkdownView)` only ever answers with a
 * real markdown leaf.
 *
 * The registration is not even bounded by the window: nothing in Obsidian
 * clears the slot when a modal closes, which is why `EmbeddableMarkdownEditor`
 * has to hand it back itself (`embeddedEditorOwner.releaseActiveEditor`).
 * Relying on that release from here would be trusting one module's teardown to
 * make another module's read safe — the point of this rule is that the read is
 * never made.
 *
 * **Capture, then re-check.** Resolving once at open time is what makes "the
 * note I opened this from" mean anything across split panes and a dozen tabs;
 * re-checking at write time is what stops a leaf that has since been closed,
 * re-used for another file or flipped into Reading view from being written to
 * anyway.
 *
 * **"Active" is not "in front", and "in front" is not "being edited".**
 * `getActiveViewOfType` reads `activeLeaf`, which a click in the sidebar takes
 * over, so the note on screen stops being the active view the moment the user
 * touches the file explorer. {@link mostRecentMarkdownView} finds it again —
 * walking real workspace leaves only, so the rule above is untouched — but
 * only so the refusal can name it. Writing into a note the user is not in is
 * how a callout lands on line 1 of a note nobody was typing in.
 *
 * **A refusal names itself.** The answer is a result, not a `null`, because
 * every caller of this module ends up telling the user something and "no" is
 * three different situations with three different ways out — see
 * {@link TargetEditorProblem}. Collapsing them into one absent value is what
 * made a note in Reading view and no note at all read the same.
 */
import { MarkdownView } from "obsidian";
import type { App, Editor, EditorPosition } from "obsidian";

export interface TargetEditor {
	view: MarkdownView;
	editor: Editor;
}

/**
 * Why there is nowhere to write, when there is nowhere to write.
 *
 * The three are kept apart because the user's next move differs for each, and a
 * message that covers all three covers none of them:
 *
 * - `"no-note"` — nothing markdown is in front at all: a canvas, the graph, the
 *   settings tab, an empty workspace. Open a note.
 * - `"reading-view"` — the note is there and is being *read*. Reading view is
 *   refused rather than silently flipped to source: changing what the user is
 *   looking at is not this feature's call to make, so the way out is theirs to
 *   take.
 * - `"no-cursor"` — the note is open for editing, but its editor cannot name a
 *   position to write at. Nothing is wrong with the *view*, so telling the user
 *   to open or switch anything would send them somewhere they already are.
 */
export type TargetEditorProblem = "no-note" | "reading-view" | "no-cursor";

/** An editor to write into, or the reason there isn't one. */
export type TargetEditorResult =
	| { readonly ok: true; readonly target: TargetEditor }
	| { readonly ok: false; readonly problem: TargetEditorProblem };

/**
 * Where a write would land, or `null` when the editor cannot say.
 *
 * `getCursor()` is the same question {@link wrapSelectionInCallout} asks first
 * — it reads `anchor`/`head`/`from`/`to` and then indexes into the answer — so
 * this is the write's own precondition, checked one step earlier where it can
 * still become a sentence instead of a `TypeError` out of a click handler. A
 * `MarkdownView` whose edit mode is half-built or has been torn down under it
 * is the case in the field: Obsidian's `editor` is typed non-nullable but the
 * getter reaches through `editMode`, and a CodeMirror instance that is gone
 * throws here rather than answering.
 */
function cursorOf(editor: Editor | undefined): EditorPosition | null {
	if (!editor || typeof editor.getCursor !== "function") return null;
	try {
		const cursor = editor.getCursor();
		if (!cursor) return null;
		// A finite line *and* ch: `NaN` would pass a null check and then travel
		// all the way into `replaceRange`.
		if (!Number.isFinite(cursor.line)) return null;
		if (!Number.isFinite(cursor.ch)) return null;
		return cursor;
	} catch {
		return null;
	}
}

/**
 * Turn a view — or the absence of one — into an answer.
 *
 * The one place the three refusals are decided, so the capture path and the
 * resolve-now path cannot disagree about what counts as writable.
 *
 * `getMode()` answers `"source"` for **both** Source mode and Live Preview
 * (Live Preview is source mode with its own sub-state), so `"preview"` — the
 * only other value — is Reading view and nothing else. That is what lets the
 * message name the two modes that do work.
 */
export function classifyTargetEditor(
	view: MarkdownView | null,
): TargetEditorResult {
	if (!view) return { ok: false, problem: "no-note" };
	if (view.getMode() !== "source") return { ok: false, problem: "reading-view" };
	const { editor } = view;
	if (!cursorOf(editor)) return { ok: false, problem: "no-cursor" };
	return { ok: true, target: { view, editor } };
}

/**
 * The note the user is looking at, when Obsidian says there is no active one.
 *
 * `getActiveViewOfType` is `activeLeaf.view instanceof type ? view : null`, and
 * `activeLeaf` is whatever leaf was activated last — **including a leaf in the
 * sidebar**. Click the file explorer, the search pane or the outline, then open
 * a window from the ribbon, and the note plainly in front of you is not the
 * "active view" any more. That is not an edge case; it is how most people reach
 * the ribbon, and it is what made this window refuse to write into a note that
 * was open in Live Preview.
 *
 * Obsidian's own `editor:focus` command carries the identical fallback — it
 * walks every leaf for the largest `activeTime` when `getActiveViewOfType`
 * comes back empty. `getMostRecentLeaf()` is the public form of that walk, and
 * a better one here: it covers the root split and popout windows but **not the
 * sidebars**, and prefers the most recently active *visible* leaf. So it
 * answers "the note you were last in", which is the note this window was opened
 * beside.
 *
 * It is still a `MarkdownView` check and not a cast: that leaf can just as
 * easily hold a canvas, a graph or a base, and those are a refusal.
 *
 * **What it answers is *which note*, never *whether to write*.** See
 * {@link resolveTargetEditor}: everything it finds is refused, and the find is
 * what makes the refusal specific instead of "open a note in editing mode"
 * shouted at someone whose note is open right in front of them.
 */
function mostRecentMarkdownView(app: App): MarkdownView | null {
	const view = app.workspace.getMostRecentLeaf()?.view;
	return view instanceof MarkdownView ? view : null;
}

/**
 * The markdown editor the user is looking at, or the reason there isn't one.
 *
 * The active view first — with two notes side by side, the focused one is the
 * only answer that is not a guess. The note last worked in is consulted only
 * when there is no active markdown view at all, and then **to name the note,
 * never to write into it**.
 *
 * That asymmetry is the whole point, and it is what a first attempt got wrong.
 * `Editor.getCursor()` cannot report "no cursor": CodeMirror 6 always has a
 * selection, and in an editor nobody has touched it sits at `{line: 0, ch: 0}`
 * — indistinguishable from a caret the user deliberately put at the top of the
 * note. So an editor reached through the fallback was written to at line 0,
 * which is the one place the user certainly did not ask for.
 *
 * The provenance is the signal `getCursor` cannot give. Reaching the fallback
 * *means* `activeLeaf` is something else — a sidebar pane, a canvas, the
 * ribbon's own leaf — so the caret is not in this note and there is no position
 * to honour. Refusing then is not a limitation; it is the `no-cursor` case,
 * finally detected by the only thing that actually knows.
 */
export function resolveTargetEditor(app: App): TargetEditorResult {
	const active = app.workspace.getActiveViewOfType(MarkdownView);
	if (active) return classifyTargetEditor(active);

	// The same ladder, run only to choose the sentence: a note in Reading view
	// is still a mode problem, and no note at all is still no note. A note that
	// *would* have been writable is the one answer that changes — the user is
	// not in it, so it becomes "put the cursor where you want this".
	const found = classifyTargetEditor(mostRecentMarkdownView(app));
	return found.ok ? { ok: false, problem: "no-cursor" } : found;
}

/**
 * Is a captured target still the live editor it was when it was captured?
 *
 * The leaf identity check is the one that matters: Obsidian re-uses a
 * `WorkspaceLeaf` for a different view rather than destroying it, so a leaf
 * that now hosts something else still holds a perfectly usable — and completely
 * wrong — `Editor`.
 */
export function isTargetStillValid(app: App, target: TargetEditor): boolean {
	const { view } = target;
	// `leaf` is typed non-nullable but a detached view really can be missing it.
	if (!view.leaf) return false;
	if (view.leaf.view !== view) return false;
	if (!app.workspace.getLeavesOfType("markdown").includes(view.leaf)) {
		return false;
	}
	if (view.getMode() !== "source") return false;
	return view.file !== null;
}

/**
 * The captured target if it still holds, otherwise whatever is active now,
 * otherwise the reason for neither.
 *
 * Preferring the capture is what makes the window predictable — it writes where
 * it was opened from — while the fallback keeps it useful when the user opened
 * it with nothing focused and then clicked into a note behind it.
 *
 * A held capture is still put back through {@link classifyTargetEditor} rather
 * than returned as-is: `isTargetStillValid` asks whether it is the *same* live
 * editor, which is not the same question as whether it can be written into.
 */
export function currentTargetEditor(
	app: App,
	captured: TargetEditor | null,
): TargetEditorResult {
	if (captured && isTargetStillValid(app, captured)) {
		return classifyTargetEditor(captured.view);
	}
	return resolveTargetEditor(app);
}
