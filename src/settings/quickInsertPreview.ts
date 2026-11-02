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
 * **Only the rows on screen are rendered, a page at a time.** A vault with
 * hundreds of callouts used to be one render of all of them, which froze the
 * window before the first row appeared and again after every change. Now the
 * window asks {@link QuickInsertPreviews.ensure} for the rows it has drawn, and
 * each ask is one render of just those, kept by id and by the spelling it was
 * drawn with (a search for an alias draws the alias). Filtering and scrolling
 * back read the cache and stay synchronous; a row that has no preview yet shows
 * its name until `onLanded` says the render arrived.
 */
import { Component, MarkdownRenderer, type App } from "obsidian";
import { buildBlockHeaderToken } from "../editor/calloutWriter";
import type { CalloutDefinition } from "../types";

/**
 * The one line that stands in for the callout.
 *
 * A header and nothing else: it is what the user is choosing between, it is
 * what `Insert` writes first, and a body of invented sample prose would triple
 * every row's height for no information. Newlines are folded out because a
 * render maps rendered blocks back to definitions by position, and a display
 * name carrying one (an import can produce that) would split into two
 * blockquotes and shift every row after it onto the wrong callout.
 *
 * `matchedId` is the spelling the row will be written with (see
 * `matchedCalloutId`): searching `tldr` draws `> [!tldr] Tldr`, because that is
 * the line Insert writes. Left out, it is the primary id.
 */
export function previewMarkdown(def: CalloutDefinition, matchedId?: string): string {
	return `> ${buildBlockHeaderToken(def, { matchedId }).replace(/[\r\n]+/g, " ")}`;
}

/**
 * What a cached preview is filed under: the callout and the spelling it was
 * drawn with. The same callout drawn as `abstract` and as `tldr` are two
 * previews, so changing the search must not hand a row the other's title.
 */
function previewKey(id: string, matchedId?: string): string {
	return matchedId === undefined || matchedId === id ? id : `${id}\n${matchedId}`;
}

/** One callout's rendered row content, and what it was rendered from. */
interface Rendered {
	/** The markdown it came from, to tell a renamed callout from an unchanged one. */
	markdown: string;
	el: HTMLElement;
	/** False once something changed since the render (see {@link QuickInsertPreviews.invalidate}). */
	fresh: boolean;
}

export class QuickInsertPreviews {
	/** Owns the renders, so unloading it tears down everything they registered. */
	private readonly component = new Component();
	private readonly cache = new Map<string, Rendered>();
	/** The epoch each callout is being rendered in, so two overlapping asks do not render it twice. */
	private readonly inFlight = new Map<string, number>();
	/** Goes up on every {@link invalidate}; a render that started in an earlier one lands stale. */
	private epoch = 0;
	private destroyed = false;

	/**
	 * @param onLanded Called after a render has been stored, so the window can
	 *   swap the new previews into the rows that were waiting for them.
	 */
	constructor(
		private readonly app: App,
		private readonly onLanded: () => void = () => {},
	) {
		this.component.load();
	}

	/**
	 * The rendered preview for `id` as `matchedId`, or `null` if none has been
	 * rendered yet.
	 *
	 * A stale one is returned on purpose, until its replacement lands: a row
	 * shows slightly old artwork for a moment rather than blinking back to its
	 * name. Only of the same spelling, though — an `abstract` preview standing in
	 * for a `tldr` row would show a title the row will not write.
	 */
	get(id: string, matchedId?: string): HTMLElement | null {
		return this.cache.get(previewKey(id, matchedId))?.el ?? null;
	}

	/**
	 * Something a preview depends on changed (a definition, the stylesheet, a
	 * downloaded icon). Every callout is rendered again the next time it is asked
	 * for — but only then, so a change costs the rows on screen, not the list.
	 */
	invalidate(): void {
		this.epoch++;
		for (const entry of this.cache.values()) entry.fresh = false;
	}

	/**
	 * Render the callouts in `defs` that have no up-to-date preview, as one batch.
	 *
	 * `matchedId` names the spelling each one is drawn with, as for
	 * {@link previewMarkdown}; it is asked once per callout, so it must answer the
	 * same way as the `matchedId` later given to {@link get}.
	 */
	async ensure(
		defs: readonly CalloutDefinition[],
		matchedId: (def: CalloutDefinition) => string | undefined = () => undefined,
	): Promise<void> {
		const epoch = this.epoch;
		// Read once: the search can move on while the render is in flight, and what
		// lands must be filed under the line that was actually rendered.
		const wanted = defs
			.map((def) => {
				const spelling = matchedId(def);
				return { key: previewKey(def.id, spelling), markdown: previewMarkdown(def, spelling) };
			})
			.filter(({ key, markdown }) => {
				const entry = this.cache.get(key);
				if (entry?.fresh && entry.markdown === markdown) return false;
				return this.inFlight.get(key) !== epoch;
			});
		if (wanted.length === 0) return;
		for (const { key } of wanted) this.inFlight.set(key, epoch);

		// Rendered detached and swapped in whole, the same way LiveCalloutPreview
		// avoids showing a half-built list.
		const scratch = createDiv({ cls: "markdown-preview-view" });
		const target = scratch.createDiv({ cls: "markdown-rendered" });
		try {
			await MarkdownRenderer.render(
				this.app,
				wanted.map(({ markdown }) => markdown).join("\n\n"),
				target,
				"",
				this.component,
			);
		} catch {
			// Nothing to keep; the rows stay on their names and the next ask tries again.
			this.release(wanted, epoch);
			return;
		}
		this.release(wanted, epoch);
		if (this.destroyed) return;

		const rendered = Array.from(target.querySelectorAll<HTMLElement>(".callout"));
		wanted.forEach(({ key, markdown }, index) => {
			const el = rendered[index];
			if (!el) return;
			const fresh = epoch === this.epoch;
			// An older render never replaces a newer one that got here first.
			if (!fresh && this.cache.get(key)?.fresh) return;
			this.cache.set(key, { markdown, el: hostFor(el), fresh });
		});
		this.onLanded();
	}

	destroy(): void {
		this.destroyed = true;
		this.component.unload();
		this.cache.clear();
		this.inFlight.clear();
	}

	private release(keys: readonly { key: string }[], epoch: number): void {
		for (const { key } of keys) {
			if (this.inFlight.get(key) === epoch) this.inFlight.delete(key);
		}
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
