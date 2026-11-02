/**
 * editor/headingFold.ts — shared helpers for the heading-callout editor
 * integrations.
 *
 * The fold mechanics themselves live in livepreview/fold.ts (CodeMirror-level,
 * identical to Obsidian's native pre-heading arrow). This module keeps the
 * pieces that need Obsidian's app object: the core "Fold heading" gate that
 * decides whether a fold arrow is drawn at all, and the CM-EditorView →
 * MarkdownView resolution used by heading link navigation.
 */
import { MarkdownView } from "obsidian";
import type { App } from "obsidian";
import type { EditorView } from "@codemirror/view";

/**
 * Whether Obsidian's core "Fold heading" setting is on. When it is off, native
 * heading folding does not exist, so the whole feature is a no-op and no arrow
 * is drawn. `getConfig` is undocumented; if it is unavailable we assume the
 * Obsidian default (on) rather than hide the feature.
 */
export function isHeadingFoldEnabled(app: App): boolean {
	try {
		const vault = app.vault as unknown as {
			getConfig?: (key: string) => unknown;
		};
		if (typeof vault.getConfig !== "function") return true;
		return vault.getConfig("foldHeading") !== false;
	} catch {
		return true;
	}
}

/**
 * Find the MarkdownView whose editor hosts a given CodeMirror EditorView. Used
 * by widget click handlers to reach view-level APIs (link navigation) from the
 * CM `view` they are handed. `editor.cm` is undocumented but stable.
 */
export function resolveMarkdownView(app: App, cm: EditorView): MarkdownView | null {
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			const editorCm = (view.editor as unknown as { cm?: EditorView }).cm;
			if (editorCm === cm) return view;
		}
	}
	return null;
}
