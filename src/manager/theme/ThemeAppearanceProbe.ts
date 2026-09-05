/**
 * manager/theme/ThemeAppearanceProbe.ts — asking the page what the theme's
 * callouts actually look like.
 *
 * The DOM half of `themeAppearance.ts`. It renders every theme-owned callout
 * once, offscreen, reads a handful of computed values off each, and throws the
 * DOM away. Everything it learns is plain data by the time it leaves here, so
 * the interpretation — which is where all the judgement lives — stays pure and
 * unit-tested.
 *
 * Two neighbours carry the halves this file deliberately does not: which node
 * answers which property is `readCalloutStyle.ts`, and what the answers mean is
 * `themeAppearance.ts` with `themeIcon.ts`. What is left here is scheduling —
 * when to render, what to cache, and when the cache has become a lie.
 *
 * ## Why it renders instead of reading a stylesheet
 *
 * Because the question is "what does this look like", and only the cascade
 * knows. See `themeAppearance.ts` for the full argument; the short version is
 * that a theme can reach its colour through variables, `color-mix()`,
 * inheritance or a Style Settings class, and a text parser sees none of it.
 *
 * ## Three things about the rendering that are load-bearing
 *
 * **The ancestry.** Callouts are rendered inside
 * `.markdown-preview-view > .markdown-rendered`, exactly as
 * `settings/quickInsertPreview.ts` does, because core's callout CSS and every
 * theme's are written against reading view. A callout lifted out of that chain
 * loses the very styling we are here to measure.
 *
 * **`visibility: hidden`, never `display: none`.** A `display: none` subtree has
 * no layout and no used values for the properties that matter — masks and
 * backgrounds come back empty, and the probe would report every theme as
 * unknown. Hiding it visually while leaving it laid out is what makes the read
 * meaningful, and parking it at -10000px keeps it from touching the page the
 * user can see. `contain` stops that offscreen box from provoking layout work
 * anywhere else.
 *
 * **One batch per theme change.** A whole-document render is far too expensive
 * to do per row, so every wanted id goes into a single `MarkdownRenderer.render`
 * call, and the result is cached against `stylingSignature(app)` plus the
 * light/dark mode. The cache is dropped on `css-change`, which Obsidian fires
 * for a theme switch, a snippet toggle and an appearance change alike.
 *
 * ## The limit, stated once
 *
 * Only the *current* appearance mode can be read. Wrapping the probe in a
 * `.theme-light` div does not flip a theme that writes `body.theme-dark …`, and
 * flipping the real body would repaint the user's screen. So this reports the
 * colours that are on screen now and re-reads when they change — which is also
 * what `ui/ColorCircles.resolveCurrentModeColors` has always done for swatches.
 */
import { Component, MarkdownRenderer, type App } from "obsidian";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import {
	readThemeAppearance,
	UNKNOWN_APPEARANCE,
	type ThemeAppearance,
} from "./themeAppearance";
import { stylingSignature } from "./customCssApi";
import {
	domReader,
	readCalloutStyle,
	type ComputedStyleReader,
} from "./readCalloutStyle";

export type { ComputedStyleReader } from "./readCalloutStyle";

/** Kept in sync with the probe container rule in `styles.css`. */
const HOST_CLASS = "cs-theme-probe";

export class ThemeAppearanceProbe {
	private readonly component = new Component();
	private cache: Map<string, ThemeAppearance> = new Map();
	private signature: string | null = null;
	private running = false;
	private destroyed = false;
	/** The one request that arrived mid-pass. See {@link ensure}. */
	private pending: { ids: readonly string[]; onReady: () => void } | null =
		null;

	constructor(
		private readonly app: App,
		private readonly read: ComputedStyleReader = domReader,
	) {
		this.component.load();
	}

	/**
	 * What the theme does to this callout, or the unknown appearance when the
	 * probe has not reached it yet.
	 *
	 * Synchronous and never throws, because it is called from row renderers and
	 * from token DOM construction. A caller that gets `UNKNOWN_APPEARANCE` draws
	 * a neutral placeholder and is repainted when {@link ensure} lands.
	 */
	get(id: string): ThemeAppearance {
		return this.cache.get(obsidianCalloutAttrId(id)) ?? UNKNOWN_APPEARANCE;
	}

	/** Everything measured in the last pass, for handing to the registry. */
	results(): ReadonlyMap<string, ThemeAppearance> {
		return this.cache;
	}

	/**
	 * Drop everything. Called on `css-change`: the answers just changed.
	 *
	 * The **cache goes too**, not only the signature. Keeping it meant that
	 * between a theme switch and the next pass landing, `get()` still answered
	 * with the *outgoing* theme's colours and artwork — and the settings tab
	 * repaints in exactly that window, because publishing the new ownership is
	 * itself a registry change. Every row the old theme also styled came up
	 * wearing its colours, and any row only the new theme owns came up with no
	 * swatch at all, which is how one callout could look uniquely broken while
	 * its neighbours looked merely wrong. Answering `UNKNOWN_APPEARANCE` for a
	 * moment is the contract callers are already written against.
	 */
	invalidate(): void {
		this.signature = null;
		this.cache = new Map();
	}

	/**
	 * Read every id in `ids`, unless the current answers are already for this
	 * styling and this appearance mode. `onReady` fires when the cache moved.
	 *
	 * ## Why a call that arrives mid-pass is held rather than dropped
	 *
	 * Refusing outright was nearly right — a second call against the *same*
	 * stylesheet is redundant by construction — but the one call that is not
	 * redundant is the one `css-change` makes, and that is exactly when a pass
	 * is likely to still be in flight. `registerThemeAppearance` does
	 * `invalidate()` then `probe()`; dropping that second half left the running
	 * pass free to write the **outgoing** theme's readings into the cache it had
	 * just been cleared of, with nothing scheduled to correct them. Every row
	 * then wore the previous theme's colours and artwork until some unrelated
	 * `css-change` happened along.
	 *
	 * So the latest request is held in a single slot and re-run once the current
	 * pass finishes. One slot, cleared before the re-run, is what bounds it: a
	 * burst of `css-change` events collapses to one extra pass, and that pass
	 * returns immediately if the signature turns out not to have moved after all.
	 */
	async ensure(ids: readonly string[], onReady: () => void): Promise<void> {
		if (this.destroyed) return;
		if (this.running) {
			this.pending = { ids, onReady };
			return;
		}
		// A bracket or a newline in an id would close the token early, so what
		// comes back is not the callout that was asked for. Such an id cannot
		// come from the theme scan, which reads attribute selectors, but it can
		// come from vault discovery. Since `measure` now keys off each rendered
		// callout's own `data-callout`, one of these can no longer drag its
		// neighbours onto the wrong row — it would simply measure nothing — but
		// it is still dropped here, so the batch stays a batch of real ids and
		// the signature does not churn on markup that cannot render.
		const wanted = [...new Set(ids.map(obsidianCalloutAttrId))]
			.filter((id) => id.length > 0 && !/[[\]\r\n|]/.test(id))
			.sort();
		const signature = `${stylingSignature(this.app)}|${
			this.isDark() ? "dark" : "light"
		}|${wanted.join(" ")}`;
		if (signature === this.signature) return;

		this.running = true;
		try {
			this.cache =
				wanted.length > 0
					? await this.measure(wanted)
					: new Map<string, ThemeAppearance>();
			this.signature = signature;
		} catch {
			// A failed read must not freeze the answers: clearing the signature
			// lets the next repaint try again, and until then every row falls to
			// the neutral placeholder rather than to a stored Studio colour.
			// The cache goes with it, or that second half is not true — the last
			// good readings describe styling we have just failed to confirm is
			// still on screen, which is the same lie `invalidate` refuses.
			this.signature = null;
			this.cache = new Map();
		} finally {
			this.running = false;
			if (!this.destroyed) onReady();
			const next = this.pending;
			this.pending = null;
			if (next && !this.destroyed) void this.ensure(next.ids, next.onReady);
		}
	}

	private isDark(): boolean {
		return activeDocument.body.classList.contains("theme-dark");
	}

	private async measure(
		attrIds: readonly string[],
	): Promise<Map<string, ThemeAppearance>> {
		const host = activeDocument.body.createDiv({
			cls: `${HOST_CLASS} markdown-preview-view`,
		});
		host.setAttribute("aria-hidden", "true");
		const target = host.createDiv({ cls: "markdown-rendered" });
		const out = new Map<string, ThemeAppearance>();
		try {
			await MarkdownRenderer.render(
				this.app,
				// The header alone, and never the user's display name: a name
				// carrying a newline would split into two blockquotes and shift
				// every callout after it onto the wrong id.
				attrIds.map((id) => `> [!${id}] `).join("\n\n"),
				target,
				"",
				this.component,
			);
			// Each rendered callout names its own id, so ask it rather than
			// counting. Reading `rendered[index]` instead assumes the renderer
			// produced exactly one `.callout` per line in the order they were
			// written, and every id after the first place that stops being true
			// is silently attributed to its neighbour — a wrong colour looks
			// plausible, so nothing would ever report it. `wanted` keeps a
			// callout nested inside a theme's own markup from claiming a row,
			// and the first reading of an id wins.
			const wanted = new Set(attrIds);
			const rendered = Array.from(
				target.querySelectorAll<HTMLElement>(".callout"),
			);
			for (const el of rendered) {
				const id = obsidianCalloutAttrId(
					el.getAttribute("data-callout") ?? "",
				);
				if (!wanted.has(id) || out.has(id)) continue;
				out.set(id, readThemeAppearance(readCalloutStyle(el, this.read)));
			}
		} finally {
			host.remove();
		}
		return out;
	}

	destroy(): void {
		this.destroyed = true;
		this.component.unload();
		this.cache = new Map();
		this.pending = null;
	}
}
