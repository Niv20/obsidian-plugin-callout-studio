/**
 * settings/quickInsertPreview.ts — the quick-insert rows, rendered as real callouts.
 *
 * Each row shows the callout **as Obsidian draws it**, not a drawing of it. The
 * markdown comes from {@link buildBlockHeaderToken} — the same function
 * `wrapSelectionInCallout` writes into the note — and is handed to
 * `MarkdownRenderer.render`, so the row is produced by Obsidian's own callout
 * renderer, styled by Obsidian's own callout CSS, this plugin's injected
 * per-callout rules, and the active theme, in that order. Nothing here draws a
 * border, a tint or a radius, which is what makes the preview unable to drift
 * from the note: there is no second implementation to drift *from*.
 *
 * That also covers the cases an imitation would quietly get wrong — a
 * theme-owned callout, a `hideIcon` row, a snippet the user wrote by hand, a
 * fold mark, a gradient title. The registered markdown post-processor runs on
 * this output too, so `CSSInjector.paintIcons` bakes the artwork in exactly as
 * it does in a note.
 *
 * **One render for the whole list, cached by id.** A render per row per
 * keystroke would be absurd, and the content depends only on the definition, so
 * the list is rendered once as a single document and the resulting `.callout`
 * elements are kept. Filtering then just moves cached nodes into rows, which is
 * synchronous — the search box never waits for a renderer.
 */
import { Component, MarkdownRenderer, type App } from "obsidian";
import { buildBlockHeaderToken } from "../editor/calloutWriter";
import type { CalloutDefinition } from "../types";

/**
 * The one line that stands in for the callout.
 *
 * A header and nothing else: it is what the user is choosing between, it is
 * what `Insert` writes first, and a body of invented sample prose would triple
 * every row's height for no information. Newlines are folded out because the
 * batch render maps rendered blocks back to definitions by position, and a
 * display name carrying one (an import can produce that) would split into two
 * blockquotes and shift every row after it onto the wrong callout.
 */
export function previewMarkdown(def: CalloutDefinition): string {
	return `> ${buildBlockHeaderToken(def).replace(/[\r\n]+/g, " ")}`;
}

export class QuickInsertPreviews {
	/** Owns the renders, so unloading it tears down everything they registered. */
	private readonly component = new Component();
	private cache = new Map<string, HTMLElement>();
	/** Guards against an earlier build landing after a later one. */
	private seq = 0;
	private destroyed = false;

	constructor(private readonly app: App) {
		this.component.load();
	}

	/**
	 * The rendered preview for `id`, or `null` if this build has not reached it.
	 *
	 * Returning the *previous* build's element for a callout that still exists is
	 * deliberate: a rebuild swaps the cache in one go, so a row shows slightly
	 * stale artwork for a frame rather than blinking empty.
	 */
	get(id: string): HTMLElement | null {
		return this.cache.get(id) ?? null;
	}

	/** Render every definition once and keep the results. */
	async build(defs: readonly CalloutDefinition[]): Promise<void> {
		const seq = ++this.seq;
		if (defs.length === 0) {
			this.cache = new Map();
			return;
		}
		// Rendered detached and swapped in whole, the same way LiveCalloutPreview
		// avoids showing a half-built list.
		const scratch = createDiv({ cls: "markdown-preview-view" });
		const target = scratch.createDiv({ cls: "markdown-rendered" });
		try {
			await MarkdownRenderer.render(
				this.app,
				defs.map(previewMarkdown).join("\n\n"),
				target,
				"",
				this.component,
			);
		} catch {
			return;
		}
		if (this.destroyed || seq !== this.seq) return;

		const rendered = Array.from(
			target.querySelectorAll<HTMLElement>(".callout"),
		);
		const next = new Map<string, HTMLElement>();
		defs.forEach((def, index) => {
			const el = rendered[index];
			if (!el) return;
			next.set(def.id, hostFor(el));
		});
		this.cache = next;
	}

	destroy(): void {
		this.destroyed = true;
		this.component.unload();
		this.cache = new Map();
	}
}

/**
 * Re-create the ancestry the callout was rendered under.
 *
 * The plugin's own rules key on `.callout[data-callout=…]` with no ancestor, so
 * they would land regardless — but Obsidian's core callout CSS and every theme's
 * are written against reading view, and a callout lifted out of
 * `.markdown-preview-view > .markdown-rendered` loses exactly the theme
 * compatibility this preview exists to show.
 */
function hostFor(calloutEl: HTMLElement): HTMLElement {
	const host = createDiv({ cls: "cs-qi-preview markdown-preview-view" });
	// Decorative: everything it conveys is in the row's two labelled buttons,
	// and a screen reader reading out a rendered callout per row is noise.
	host.setAttribute("aria-hidden", "true");
	host.createDiv({ cls: "markdown-rendered" }).appendChild(calloutEl);
	return host;
}
