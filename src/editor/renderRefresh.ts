/**
 * editor/renderRefresh.ts — repainting what a registry change does not repaint
 * by itself.
 *
 * Two passes with a deliberate difference in reach, and picking the wrong one
 * is a real bug class rather than a performance choice:
 *
 * - **`refreshCallouts`** re-injects and rebuilds Live Preview decorations.
 *   Registry mutations do not touch the document text, so CodeMirror has no
 *   reason to rebuild its own decorations without being asked.
 * - **`refreshRenderModes`** additionally re-runs the reading-view
 *   post-processors, which is the only way an already-baked heading or inline
 *   callout is added or stripped. Needed when a render-role toggle flips, not
 *   when a colour changed.
 *
 * Structurally typed hosts, so `main.ts` keeps the two forwarders and nothing
 * else — it is lifecycle and wiring.
 */
import { MarkdownView } from "obsidian";
import type { App } from "obsidian";
import { clearContentPillCache } from "./livepreview/contentPillRender";
import { refreshAllCalloutEditors } from "./livepreview/refresh";

/** What {@link refreshCallouts} needs. */
export interface RefreshHost {
	cssInjector: { inject(force?: boolean): void };
}

/**
 * Re-apply all callout styling and rebuild the editor decorations. Use after
 * any mutation that should be immediately visible.
 */
export function refreshCallouts(host: RefreshHost): void {
	// inject() emits "css-change" itself once the CSS is in place — a second
	// explicit trigger here would only re-enter our own listener and run the
	// whole pass again.
	host.cssInjector.inject();
	// A content pill's payload is rendered markdown and can itself hold a
	// callout token, so a registry edit can change what a cached payload should
	// look like. Dropped before the rebuild below re-renders them.
	clearContentPillCache();
	refreshAllCalloutEditors();
}

/** Fully re-render both preview modes — see the file header. */
export function refreshRenderModes(app: App): void {
	refreshAllCalloutEditors();
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (view instanceof MarkdownView) view.previewMode?.rerender(true);
	}
}
