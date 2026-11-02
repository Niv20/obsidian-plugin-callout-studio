/**
 * editor/livepreview/refresh.ts — the two signals this plugin sends its own
 * decorations: an editor-wide refresh, and "this caret is ours".
 *
 * Registry changes (colors, icons, renames, new definitions) and settings
 * toggles do not change the document, so CodeMirror would never rebuild our
 * decorations on its own. Dispatching this no-op effect to every editor that
 * carries them forces each ViewPlugin's update() to rebuild.
 */
import { StateEffect } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/** No-payload effect: "callout definitions or toggles changed — rebuild". */
export const calloutStudioRefresh = StateEffect.define<null>();

/**
 * Marks a transaction whose selection THIS PLUGIN placed: a click on an inline
 * pill, which has no editing affordance other than revealing its raw source
 * under the caret.
 *
 * It exists to opt that one transaction out of the reveal freeze (see the
 * ViewPlugin's `wasMousedown`). The freeze holds our raw reveal back until the
 * mouse is released so it lands in the same paint as core's own — but a pill is
 * decoration of ours alone, with no core-owned syntax to wait for, so freezing
 * it buys nothing and can lose the reveal outright: if core's mousedown flag is
 * still set when the mouseup safety net fires, that rebuild reads the frozen
 * (pre-click) selection, and the transaction that eventually clears the flag is
 * not itself a rebuild trigger. The pill then stays shut until the next
 * keystroke — which is exactly "clicking a pill does nothing, arrow keys work".
 */
export const calloutStudioCaretDrop = StateEffect.define<null>();

/**
 * Every EditorView our ViewPlugin is currently mounted in.
 *
 * The plugin registers itself here from its constructor and drops out in
 * destroy(), so membership tracks CodeMirror's own lifecycle exactly and the
 * set can never hold a torn-down view.
 *
 * This replaced walking `getLeavesOfType("markdown")` for `editor.cm`, which
 * only ever found the ONE top-level editor per markdown tab. Obsidian applies
 * a registered editor extension to every CM6 instance it builds, and several
 * of those are not workspace leaves: table cells and canvas cards in Live
 * Preview, an editable `![[note]]` transclusion, and this plugin's own
 * settings preview. Their inline callouts and heading callouts are widget DOM the icon sweep
 * deliberately will not touch (see CSS_CM_WIDGET), so missing them here left
 * them with no refresh path at all — they kept the old icon until the next
 * keystroke in that editor.
 */
const liveViews = new Set<EditorView>();

/** Start tracking `view` (called from the ViewPlugin's constructor). */
export function registerCalloutEditorView(view: EditorView): void {
	liveViews.add(view);
}

/** Stop tracking `view` (called from the ViewPlugin's destroy()). */
export function unregisterCalloutEditorView(view: EditorView): void {
	liveViews.delete(view);
}

/**
 * Dispatch the refresh effect to every editor carrying our decorations —
 * every window, and nested editors as well as workspace leaves.
 *
 * Iterated over a copy: a dispatch can synchronously tear an editor down (and
 * so mutate the set) through the update it triggers.
 */
export function refreshAllCalloutEditors(): void {
	for (const view of Array.from(liveViews)) {
		try {
			view.dispatch({ effects: calloutStudioRefresh.of(null) });
		} catch {
			// A detached/mid-teardown editor must not break the sweep.
		}
	}
}
