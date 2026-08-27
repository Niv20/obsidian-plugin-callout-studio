/**
 * settings/EmbeddableMarkdownEditor.ts — Thin wrapper around Obsidian's
 * INTERNAL markdown editor, so the settings preview can host a real, editable
 * Live Preview surface that is 1:1 with a note.
 *
 * ⚠️ Undocumented internals. It obtains the base `MarkdownEditor` constructor
 * via `app.embedRegistry.embedByExtension.md` + a prototype walk — the
 * community-standard "EmbeddableMarkdownEditor" pattern. It can break on
 * Obsidian updates, so ALL fragile access is isolated here: construction throws
 * on any unexpected shape and callers (LiveCalloutPreview) must catch and fall
 * back to a static `MarkdownRenderer` render.
 *
 * Why an embedded editor at all: extensions registered via
 * `registerEditorExtension` apply to EVERY markdown editor in the workspace, so
 * an embedded one automatically gets Obsidian's native `> [!id]` callout
 * rendering, our heading/inline ViewPlugin, and the injected per-callout CSS —
 * i.e. it renders exactly like a real note, in the active theme, for free.
 */
import { Component, type App, type Editor, type TFile } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { EditorSelection, StateEffect } from "@codemirror/state";
import {
	createEditorOwner,
	releaseActiveEditor,
	type EditorOwner,
} from "./embeddedEditorOwner";
import {
	readOnlyPreviewExtensions,
	type PreviewWriteGate,
} from "./previewReadOnly";

/** Minimal shape of the internal edit view we touch. */
interface InternalMarkdownEditor extends Component {
	editable: boolean;
	/**
	 * Raw source vs. Live Preview for this editor. Seeded in the base
	 * constructor from the vault's "Default editing mode"; see
	 * {@link forceLivePreview}, which overwrites it before it is ever read.
	 */
	sourceMode?: boolean;
	editMode?: object;
	showEditor?(): void;
	set(content: string, focus?: boolean): void;
	destroy?(): void;
	editor?: Editor & { cm?: EditorView };
	cm?: EditorView;
}

type MarkdownEditorCtor = new (
	app: App,
	container: HTMLElement,
	owner: EditorOwner,
) => InternalMarkdownEditor;

/** `app` widened to the internal embed registry. */
interface EmbedRegistryApp extends App {
	embedRegistry?: {
		embedByExtension?: {
			md?: (
				ctx: { app: App; containerEl: HTMLElement },
				file: TFile | null,
				subpath: string,
			) => InternalMarkdownEditor;
		};
	};
}

/** Cached constructor — resolving it spins up (then unloads) a throwaway editor. */
let cachedCtor: MarkdownEditorCtor | null = null;

/**
 * Pin an editor instance to Live Preview, whatever the vault's "Default editing
 * mode" (Settings → Editor) says.
 *
 * The base editor opens its constructor with
 * `this.sourceMode = !app.vault.getConfig("livePreview")` — an embed has no
 * file, leaf or view state of its own to carry a mode, so it simply adopts the
 * vault-wide default. A preview pane must not: it is labelled "Live preview",
 * and under a Source-mode vault it would otherwise show its sample as raw
 * `> [!id]` text forever.
 *
 * Overwriting the flag is enough *because of when it is read*. `sourceMode`
 * feeds `buildLocalExtensions()`, which decides both halves of Live Preview —
 * it seeds `editorLivePreviewField` and installs the live-preview view plugin —
 * and `getLocalExtensions()` memoises that into `this.localExtensions`, so it
 * runs exactly once, lazily, on the first `set()`. Assigning between
 * construction and that first `set()` therefore lands before anything has read
 * it, and the editor builds identically to one in a Live-Preview vault: fully
 * interactive, with the click-to-reveal-source behaviour intact. Flipping it
 * after `set()` would not work — the extensions are already cached, so the
 * live-preview plugin would be missing no matter what the field said.
 *
 * Undocumented internals, hence the optional property: if the flag is ever
 * renamed the assignment is inert and the editor simply follows the vault
 * default again, exactly as it did before this existed.
 */
function forceLivePreview(instance: InternalMarkdownEditor): void {
	instance.sourceMode = false;
}

/**
 * Resolve the base `MarkdownEditor` constructor by instantiating a throwaway
 * embed and walking two prototype levels up from its concrete edit view (the
 * concrete `MarkdownEditView` → its base editor class). Throws if the internal
 * shape changed, so the caller can fall back.
 */
function resolveMarkdownEditorCtor(app: App): MarkdownEditorCtor {
	if (cachedCtor) return cachedCtor;

	const md = (app as EmbedRegistryApp).embedRegistry?.embedByExtension?.md;
	if (!md) {
		throw new Error("embedRegistry.embedByExtension.md unavailable");
	}

	const temp = md({ app, containerEl: createDiv() }, null, "");
	try {
		temp.editable = true;
		temp.showEditor?.();
		const editMode = temp.editMode;
		if (!editMode) {
			throw new Error("editMode unavailable after showEditor()");
		}
		const proto = Object.getPrototypeOf(Object.getPrototypeOf(editMode)) as
			| { constructor?: unknown }
			| null;
		const ctor = proto?.constructor;
		if (typeof ctor !== "function") {
			throw new Error("could not resolve MarkdownEditor constructor");
		}
		cachedCtor = ctor as MarkdownEditorCtor;
		return cachedCtor;
	} finally {
		temp.unload();
	}
}

export interface EmbeddableMarkdownEditorOptions {
	/** Initial markdown content. */
	value: string;
	/**
	 * When true the editor is read-only: the cursor can still move and click (so
	 * Live Preview reveals the raw markdown), but typing/paste/drop never change
	 * the document. Each blocked attempt invokes {@link onEditAttempt}.
	 */
	readOnly?: boolean;
	/** Invoked when the user attempts to edit while {@link readOnly}. */
	onEditAttempt?: () => void;
}

/**
 * A real, editable Obsidian markdown editor mounted into an arbitrary element.
 * The constructor THROWS if the internal API is unavailable — callers must
 * wrap it in try/catch and provide a fallback.
 */
export class EmbeddableMarkdownEditor {
	private readonly instance: InternalMarkdownEditor;
	private readonly readOnly: boolean;
	/**
	 * The permit {@link setValue} needs to get its own reseed past the
	 * read-only transaction filter. Null until {@link applyReadOnly} runs, and
	 * for a writable editor forever — neither case has a filter to get past.
	 */
	private writeGate: PreviewWriteGate | null = null;
	private destroyed = false;
	/** Handle of the pending blur-park timer, so destroy() can cancel it. */
	private parkTimer: number | null = null;
	private readonly app: App;
	/**
	 * The object Obsidian installs as `app.workspace.activeEditor` when this
	 * editor is focused. Kept so teardown can hand the slot back — see
	 * {@link releaseActiveEditor}, which is the only thing that ever will.
	 */
	private readonly owner: EditorOwner;

	constructor(
		app: App,
		container: HTMLElement,
		options: EmbeddableMarkdownEditorOptions,
	) {
		const Ctor = resolveMarkdownEditorCtor(app);
		this.app = app;
		// Arrow closures so the owner (whose own `this` is the owner object)
		// can still reach this instance — without aliasing `this`.
		this.owner = createEditorOwner(app, {
			editor: () => this.instance?.editor,
			selection: () => this.currentSelectionText(),
		});
		this.instance = new Ctor(app, container, this.owner);
		try {
			// Must sit between construction and the first `set()` — that call
			// is what builds (and then caches) the extensions this flag
			// decides.
			forceLivePreview(this.instance);
			this.instance.set(options.value, false);

			// A shape change could let construction "succeed" without mounting
			// any DOM (a silent-empty failure that would otherwise leave a
			// blank box). Treat that as a failure so the caller falls back to a
			// static render.
			if (container.childElementCount === 0) {
				throw new Error("embedded editor did not mount");
			}
		} catch (e) {
			// `set()` is what installs the focus handler that registers the
			// owner as `activeEditor`, so a throw from here leaves a live
			// editor no one holds a reference to. Tear it down before the
			// caller loses the only handle to it.
			this.destroy();
			throw e;
		}

		this.readOnly = options.readOnly ?? false;
		if (this.readOnly) {
			this.applyReadOnly(options.onEditAttempt);
			this.parkCursor();
		}
	}

	/**
	 * Make the editor read-only while keeping it interactive: selection/cursor
	 * still work (so Obsidian's Live Preview reveals raw markdown on click), but
	 * no route can change the document, and each attempt is reported via
	 * `onEditAttempt`. The rule itself — and why `EditorState.readOnly` alone
	 * never sufficed — lives in {@link readOnlyPreviewExtensions}.
	 *
	 * On blur the caret is parked at the end of the document (see
	 * {@link parkCursor} for why it must not idle inside a callout).
	 */
	private applyReadOnly(onEditAttempt?: () => void): void {
		const cm = this.cm;
		if (!cm) return;
		const { extensions, gate } = readOnlyPreviewExtensions({
			onEditAttempt,
			onBlur: () => {
				// Focus is what made this the app's active editor, and losing
				// it is what makes that untrue. Releasing here narrows the
				// window in which core reads the preview instead of the user's
				// note down to exactly the time the preview is focused.
				releaseActiveEditor(this.app, this.owner);
				// Deferred: let CodeMirror finish processing the focus change
				// before we move the selection. Blur is also exactly what fires
				// when the modal closes, and the teardown runs in that same
				// turn — so the handle is kept for destroy() to cancel, and a
				// second blur replaces the pending timer rather than stacking.
				if (this.parkTimer !== null) {
					window.clearTimeout(this.parkTimer);
				}
				this.parkTimer = window.setTimeout(() => {
					this.parkTimer = null;
					this.parkCursor();
				}, 0);
			},
		});
		this.writeGate = gate;
		cm.dispatch({ effects: StateEffect.appendConfig.of(extensions) });
	}

	/**
	 * Move the caret to the end of the document without scrolling or focusing.
	 *
	 * A read-only preview's caret must never idle INSIDE a `> [!id]` block
	 * while the editor is unfocused: Obsidian then collapses the callout into
	 * a widget but keeps a caret line whose hanging indent it measures against
	 * the widget's full width, and that bogus width is cached and applied to
	 * the raw source lines the next time a click reveals them (every wrapped
	 * row squeezed to ~one character). Sample texts therefore end outside any
	 * block callout, and the caret is parked there on build, reseed and blur.
	 */
	private parkCursor(): void {
		// destroy() does not null `instance`, so `cm` still hands back the
		// cached EditorView after teardown and the dispatch would go through.
		// The try/catch below only swallows a throw — it cannot undo state that
		// already landed — so the flag is what actually stops it.
		if (this.destroyed) return;
		const cm = this.cm;
		if (!cm) return;
		try {
			cm.dispatch({
				selection: EditorSelection.cursor(cm.state.doc.length),
			});
		} catch {
			/* editor mid-teardown — ignore */
		}
	}

	/** Underlying CM6 view, for dispatching state effects (may be null early). */
	get cm(): EditorView | null {
		return this.instance?.editor?.cm ?? this.instance?.cm ?? null;
	}

	/**
	 * Text of the current primary selection ("" if none / not ready). Consumed
	 * by the owner's `editor.getSelection()` shim (see {@link EditorOwner}).
	 * Fully defensive: it can be called mid-construction (before `this.instance`
	 * is assigned) or mid-teardown, and must never throw.
	 */
	private currentSelectionText(): string {
		try {
			const cm = this.cm;
			if (!cm) return "";
			const { from, to } = cm.state.selection.main;
			return cm.state.sliceDoc(from, to);
		} catch {
			return "";
		}
	}

	/**
	 * Replace the whole document.
	 *
	 * This is the plugin's own write, not the user's, so it goes through the
	 * gate — otherwise the read-only transaction filter would drop the reseed
	 * along with everything else and the preview would freeze on its first
	 * sample. Safe because the reseed is not user input: the preview mirrors a
	 * form, so there is never anything typed here to clobber.
	 */
	setValue(value: string): void {
		const write = (): void => this.instance.set(value, false);
		if (this.writeGate) this.writeGate.allow(write);
		else write();
		// set() leaves the caret at position 0 — inside a callout when the
		// sample starts with one (see parkCursor).
		if (this.readOnly) this.parkCursor();
	}

	destroy(): void {
		this.destroyed = true;
		// First, and unconditionally: nothing else in Obsidian ever releases
		// this slot for us, so skipping it leaves a destroyed editor standing
		// as the application's `activeEditor` for the rest of the session.
		// It has to precede the teardown below, which re-enters core code
		// (the mobile toolbar's `update()`) that reads `activeEditor`.
		releaseActiveEditor(this.app, this.owner);
		if (this.parkTimer !== null) {
			window.clearTimeout(this.parkTimer);
			this.parkTimer = null;
		}
		try {
			this.instance.destroy?.();
		} catch {
			/* ignore teardown errors */
		}
		try {
			this.instance.unload();
		} catch {
			/* ignore teardown errors */
		}
	}
}
