/**
 * settings/LiveCalloutPreview.ts — Real, editable Obsidian Live Preview of a
 * callout, for the settings UI.
 *
 * The preview hosts a genuine embedded Obsidian markdown editor
 * ({@link EmbeddableMarkdownEditor}) rather than a static render. Because
 * editor extensions registered with `registerEditorExtension` apply to every
 * markdown editor in the workspace, the embedded one inherits Obsidian's native
 * `> [!id]` callout rendering, the plugin's heading/inline ViewPlugin, and the
 * injected per-callout CSS — so it is 1:1 with a real note, in the active theme,
 * and editable in place. All three callout roles (regular `> [!id]`, heading
 * `## [!id]`, inline `[!id]`) render exactly as in a note.
 *
 * The embedded editor is pinned to Live Preview regardless of the vault's
 * "Default editing mode" (see `forceLivePreview`), so this pane always means
 * what its label says — rendered callouts, with click-to-reveal-source intact —
 * instead of quietly becoming a raw-source pane in a Source-mode vault.
 *
 * Fidelity is preserved by NOT overriding the cascade: the preview sits inside
 * the real `body.theme-*`, applies no colours/backdrop of its own, and lets the
 * live `CSSInjector` rules resolve exactly as in a note.
 *
 * Graceful fallback: the embedded-editor API is undocumented and may change. If
 * construction throws, the preview degrades to a static (non-editable)
 * `MarkdownRenderer.render` of the same sample — still accurate, just not
 * editable — so the plugin never breaks. That path stays full-fidelity too: the
 * reading-view post-processors give it the same three roles and painted icons,
 * and `refresh()` re-renders it on every form change.
 *
 * Shared by the callout editor modal (previewing an in-progress edit via the
 * reserved preview ID), the callout type cards (one role each), and the
 * per-role global style popups (previewing the neutral demo callout under
 * the vault-wide geometry).
 */
import { Component, MarkdownRenderer, Notice, type App } from "obsidian";
import { EmbeddableMarkdownEditor } from "./EmbeddableMarkdownEditor";
import { calloutStudioRefresh } from "../editor/livepreview/refresh";
import { t } from "../i18n";

/** How long to wait after the last change before re-rendering the fallback. */
const RENDER_DEBOUNCE_MS = 150;

/** Minimum gap between "preview is read-only" notices, to avoid spamming. */
const READ_ONLY_NOTICE_THROTTLE_MS = 1500;

export interface LiveCalloutPreviewOptions {
	/** Header label shown above the preview. Omit for a headerless preview
	 * (e.g. inside a card that carries its own title). */
	title?: string;
	/** Initial sample markdown to render. */
	initialText: string;
	/** Visually collapse one terminal blank line while retaining it for the caret. */
	collapseTrailingBlankLine?: boolean;
	/**
	 * Invoked immediately before each refresh (and once on construction). The
	 * editor modal uses this to push its in-progress definition into the
	 * registry and re-inject CSS so colours/icons update live.
	 */
	beforeRender?: () => void;
	/** Invoked from {@link destroy} for caller cleanup (clear preview def, etc.). */
	onDestroy?: () => void;
}

export class LiveCalloutPreview {
	private readonly component = new Component();
	private readonly opts: LiveCalloutPreviewOptions;

	/** Real editable editor (primary path); null when the fallback is in use. */
	private editor: EmbeddableMarkdownEditor | null = null;
	/** Static-render target (fallback path only). */
	private renderEl: HTMLElement | null = null;

	private text: string;
	private renderTimer: number | null = null;
	private renderSeq = 0;
	private destroyed = false;
	private lastReadOnlyNoticeTs = 0;

	constructor(
		private readonly app: App,
		parentEl: HTMLElement,
		options: LiveCalloutPreviewOptions,
	) {
		this.opts = options;
		this.text = options.initialText;
		this.component.load();
		// Register the in-progress definition + inject CSS BEFORE building, so
		// the editor's decorations resolve against the styled callout on first
		// paint.
		this.opts.beforeRender?.();
		this.build(parentEl);
	}

	/**
	 * Re-apply after a form/style change. Runs {@link beforeRender} (so the
	 * modal's in-progress definition + CSS are refreshed) then, in the editable
	 * path, rebuilds the heading/inline decorations (colours follow the CSS
	 * cascade with no rebuild). In the fallback path it re-renders the sample.
	 */
	refresh(): void {
		if (this.destroyed) return;
		this.opts.beforeRender?.();
		if (this.editor) {
			// Colours/geometry update live via the injected CSS. Heading/inline
			// widgets must be rebuilt explicitly: registry changes don't touch
			// the document, so CodeMirror won't rebuild them on its own.
			try {
				this.editor.cm?.dispatch({
					effects: calloutStudioRefresh.of(null),
				});
			} catch {
				/* editor mid-teardown — ignore */
			}
			return;
		}
		this.scheduleRender();
	}

	/**
	 * Replace the sample markdown so the preview's callout ID and title track the
	 * form. Re-seeding the live editor is safe because it is read-only — there is
	 * no user input to clobber. In the fallback path the next render picks up the
	 * new text.
	 */
	setText(text: string): void {
		if (this.destroyed || this.text === text) return;
		this.text = text;
		this.editor?.setValue(text);
	}

	/** Throttled "the live preview can't be edited" notice. */
	private notifyReadOnly(): void {
		const now = Date.now();
		if (now - this.lastReadOnlyNoticeTs < READ_ONLY_NOTICE_THROTTLE_MS) {
			return;
		}
		this.lastReadOnlyNoticeTs = now;
		new Notice(t("editor.previewReadOnly"));
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.renderTimer !== null) {
			window.clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
		this.editor?.destroy();
		this.editor = null;
		this.opts.onDestroy?.();
		this.component.unload();
	}

	// ── DOM ────────────────────────────────────────────────────────────

	private build(parentEl: HTMLElement): void {
		const container = parentEl.createDiv({
			cls: "callout-studio-preview-container cs-live-preview-container",
		});

		if (this.opts.title) {
			const header = container.createDiv({
				cls: "callout-studio-preview-header",
			});
			header.createSpan({ text: this.opts.title });
		}

		const body = container.createDiv({
			cls: "cs-live-preview-body",
		});
		if (
			this.opts.collapseTrailingBlankLine &&
			this.text.endsWith("\n")
		) {
			body.addClass("cs-live-preview-collapse-trailing-line");
		}

		// Primary path: a real, editable Obsidian editor. If the undocumented
		// embed API is unavailable/changed, fall back to a static render.
		try {
			this.editor = new EmbeddableMarkdownEditor(this.app, body, {
				value: this.text,
				// The preview mirrors the form; typing in it would have no place
				// to go. Keep it interactive (click reveals raw markdown) but
				// block edits, surfacing a notice on any attempt.
				readOnly: true,
				onEditAttempt: () => this.notifyReadOnly(),
			});
			body.addClass("cs-live-preview-editable");
		} catch (e) {
			console.warn(
				"[CalloutStudio] embedded live preview unavailable; " +
					"falling back to static render",
				e,
			);
			this.editor = null;
			// The failed constructor may have mounted (and torn down) real
			// editor DOM in here. Clear it, or the static render below lands
			// underneath its leftovers.
			body.empty();
			this.buildFallback(body);
		}
	}

	// ── Fallback (static MarkdownRenderer) ─────────────────────────────

	private buildFallback(body: HTMLElement): void {
		// `.markdown-preview-view` + `.markdown-rendered` make Obsidian's own
		// reading-view CSS and the injected per-callout colour rules resolve as
		// inside a note.
		body.addClass("markdown-preview-view");
		this.renderEl = body.createDiv({
			cls: "markdown-rendered cs-live-preview-render",
		});
		void this.renderNow();
	}

	private scheduleRender(): void {
		if (this.destroyed || !this.renderEl) return;
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.renderTimer = window.setTimeout(() => {
			this.renderTimer = null;
			void this.renderNow();
		}, RENDER_DEBOUNCE_MS);
	}

	private async renderNow(): Promise<void> {
		if (this.destroyed || !this.renderEl) return;
		const target = this.renderEl;
		const seq = ++this.renderSeq;
		// Render into a detached scratch element and swap in one go, so the
		// preview never flashes empty between keystrokes.
		const scratch = createDiv({ cls: target.className });
		try {
			await MarkdownRenderer.render(
				this.app,
				this.text,
				scratch,
				"",
				this.component,
			);
		} catch {
			return;
		}
		if (this.destroyed || seq !== this.renderSeq) return;
		target.empty();
		while (scratch.firstChild) {
			target.appendChild(scratch.firstChild);
		}
	}
}
