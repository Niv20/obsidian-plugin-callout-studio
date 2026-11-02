/**
 * tests/embeddedEditorOwner.test.ts — the object the settings live preview
 * installs as `app.workspace.activeEditor`, and what teardown does with it.
 *
 * This suite exists because of a crash that carried no plugin frame at all:
 *
 *   Uncaught TypeError: Cannot read properties of undefined (reading 'sourceMode')
 *       at e.updateViewState (app.js:1:1087153)
 *       at e._onFileOpen   (app.js:1:1086928)
 *
 * Clicking into the preview makes Obsidian assign the plugin's owner object to
 * `workspace.activeEditor` — its CodeMirror config carries
 * `domEventHandlers({focus(){ app.workspace.activeEditor = this.owner }})`.
 * The native menu-bar builder then runs on every `file-open` and
 * `active-leaf-change` and evaluates
 *
 *   !(mode === "preview") && activeEditor.editMode.sourceMode
 *
 * The owner answered `"source"`, so the `&&` never short-circuited and it
 * dereferenced an `editMode` the owner does not have. Nothing released the
 * registration either, so the dead owner stayed installed for the rest of the
 * session — the `activeEditor` setter ignores real `MarkdownView`s, so even
 * clicking back into a note could not displace it.
 *
 * Both halves are pinned below. The cases that are not marked as regressions
 * are the fence around them: they record the members earlier crashes proved
 * core dereferences (Word Count and the Command Palette on `editor`, RTL
 * scroll on `syncScroll`), so a future edit cannot quietly drop one.
 */
import "./support/fakeDom";
import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import type { App } from "obsidian";
import { asEl, el } from "./support/fakeDom";
import { EmbeddableMarkdownEditor } from "../src/settings/EmbeddableMarkdownEditor";

/* -------------------------------------------------------------------------- */
/* Fakes                                                                      */
/* -------------------------------------------------------------------------- */

/** The sliver of the owner object this suite asserts on. */
interface OwnerLike {
	app: unknown;
	getMode: () => string;
	toggleMode: () => void;
	editor: unknown;
	onMarkdownScroll: () => void;
	syncScroll: () => void;
	/** Deliberately absent in the real owner; typed so a case can prove it. */
	editMode?: unknown;
	file?: unknown;
	showSearch?: unknown;
}

/**
 * Every instance built with a real owner, in order.
 *
 * `EmbeddableMarkdownEditor` caches the resolved constructor in a module-level
 * `cachedCtor` that is never reset, so the ctor is resolved by the FIRST
 * construction in this process and reused by every later one. One shared class
 * plus this array is the only way to observe more than one case.
 */
const built: FakeMarkdownEditor[] = [];

class FakeMarkdownEditor {
	sourceMode?: boolean;
	owner?: OwnerLike;
	container?: { createDiv: (o?: { cls?: string }) => unknown };
	readonly sets: Array<[string, boolean | undefined]> = [];
	destroyCount = 0;
	unloadCount = 0;
	/** Set by `mount({ mountsNothing: true })` to force the ctor's bail-out. */
	static mountsNothing = false;

	constructor(_app?: unknown, container?: unknown, owner?: unknown) {
		if (!owner) return; // the throwaway probe, built via Object.create
		this.owner = owner as OwnerLike;
		this.container = container as FakeMarkdownEditor["container"];
		built.push(this);
	}

	set(content: string, focus?: boolean): void {
		this.sets.push([content, focus]);
		if (!FakeMarkdownEditor.mountsNothing) {
			this.container?.createDiv({ cls: "cm-editor" });
			return;
		}
		// The ctor treats an empty container as a silent mount failure. Stand
		// in for what really happens first: `set()` is what installs the focus
		// handler, so by the time the mount check throws, the owner can already
		// be the app's active editor.
		const app = this.owner?.app as { workspace: { activeEditor: unknown } };
		app.workspace.activeEditor = this.owner;
	}

	destroy(): void {
		this.destroyCount++;
	}

	unload(): void {
		this.unloadCount++;
	}
}

/** The concrete edit view, so the ctor's two prototype hops land on the base. */
class FakeMarkdownEditView extends FakeMarkdownEditor {}

/**
 * An `App` answering exactly what `resolveMarkdownEditorCtor` walks, plus a
 * workspace whose `activeEditor` behaves like the real accessor pair.
 */
function fakeApp(): { app: App; workspace: { activeEditor: unknown } } {
	const workspace = { activeEditor: null as unknown };
	const app = {
		workspace,
		embedRegistry: {
			embedByExtension: {
				md: () => ({
					editable: false,
					editMode: undefined as object | undefined,
					showEditor(this: { editMode?: object }) {
						// `Object.create`, not `new`: the resolver only walks
						// the prototype chain, and `new` would run the base
						// constructor with no arguments.
						this.editMode = Object.create(FakeMarkdownEditView.prototype) as object;
					},
					unload() {},
				}),
			},
		},
	} as unknown as App;
	return { app, workspace };
}

/** Build one preview editor and hand back everything a case asserts on. */
function mount(value = "> [!note] Note\n> body") {
	const { app, workspace } = fakeApp();
	const container = el({ cls: "cs-live-preview-body" });
	const editor = new EmbeddableMarkdownEditor(app, asEl(container), {
		value,
		readOnly: true,
	});
	const instance = built[built.length - 1] as FakeMarkdownEditor;
	return {
		app,
		workspace,
		editor,
		instance,
		owner: instance.owner as OwnerLike,
		container,
		/** What Obsidian's CodeMirror focus handler does. */
		focus: () => {
			workspace.activeEditor = instance.owner;
		},
	};
}

beforeEach(() => {
	built.length = 0;
	FakeMarkdownEditor.mountsNothing = false;
});

/* -------------------------------------------------------------------------- */
/* The owner's shape                                                          */
/* -------------------------------------------------------------------------- */

describe("the owner installed as workspace.activeEditor", () => {
	it("is what the internal editor was constructed with", () => {
		const { owner, instance } = mount();
		assert.ok(owner, "the base ctor received an owner");
		assert.strictEqual(instance.sourceMode, false, "pinned to Live Preview");
		assert.deepStrictEqual(instance.sets, [["> [!note] Note\n> body", false]]);
	});

	// >>> REGRESSION: the reported crash <<<
	it("reports 'preview', so core never reads editMode off it", () => {
		// `updateViewState` runs on every file-open and active-leaf-change:
		//   t && (n = !0, r = !(i = "preview" === t.getMode()) && t.editMode.sourceMode)
		// Answering "preview" is what makes the `&&` short-circuit before the
		// unguarded `editMode` read. Answering "source" is the crash.
		const { owner } = mount();
		assert.strictEqual(owner.getMode(), "preview");

		// The exact expression, evaluated against the real owner.
		const menuState = (t: OwnerLike): boolean => {
			const isPreview = t.getMode() === "preview";
			return !isPreview && (t.editMode as { sourceMode: boolean }).sourceMode;
		};
		assert.doesNotThrow(() => menuState(owner));
		assert.strictEqual(menuState(owner), false);
	});

	it("answers 'preview' so editor commands are routed to the real note", () => {
		// `Commands.addCommand` wraps every editorCallback/editorCheckCallback
		// in `if (allowPreview || getMode() !== "preview")`. That gate is what
		// keeps every editor command in the app — core's, other plugins', and
		// this plugin's own wrap/unwrap — off the settings preview.
		const { owner } = mount();
		const dispatches = owner.getMode() !== "preview";
		assert.strictEqual(dispatches, false);
	});

	// >>> REGRESSION: adding editMode would re-enable a worse failure <<<
	it("does not carry editMode, file or showSearch", () => {
		// Each absence is load-bearing, not an oversight:
		//  - editMode:   `editor:follow-link` would navigate the workspace
		//                behind the modal, resolved from the vault root.
		//  - file:       the Outline view matches on `activeEditor.file ===
		//                this.file`; `null` would make a fileless outline
		//                adopt this preview, `undefined` never matches.
		//  - showSearch: `editor:open-search` duck-types it and falls back to
		//                the active leaf, which is what keeps Mod+F opening
		//                search in the user's note.
		const { owner } = mount();
		for (const absent of ["editMode", "file", "showSearch"] as const) {
			assert.ok(!(absent in owner), `${absent} must stay absent — see embeddedEditorOwner.ts`);
		}
	});

	// >>> REGRESSION: fixing getMode() must not leave Mod+E throwing <<<
	it("exposes toggleMode, the one mode command with no gate", () => {
		// `markdown:toggle-preview` is `if (activeEditor) activeEditor
		// .toggleMode()` — no getMode() check — so it reaches this object
		// whatever the mode says.
		const { owner } = mount();
		assert.strictEqual(typeof owner.toggleMode, "function");
		assert.doesNotThrow(() => owner.toggleMode());
	});

	it("exposes the real editor, and the scroll hooks core calls blind", () => {
		// Word Count runs `info.editor.getSelection()` on every
		// editor-selection-change; the Command Palette runs
		// `activeEditor.editor.getCursor()`; the native scroll listener calls
		// `owner.syncScroll()` unconditionally (an RTL `dir` flip fires a
		// spurious scroll event with no user scrolling at all).
		const { owner } = mount();
		assert.ok(owner.editor);
		assert.doesNotThrow(() => owner.syncScroll());
		assert.doesNotThrow(() => owner.onMarkdownScroll());
	});
});

/* -------------------------------------------------------------------------- */
/* Releasing the registration                                                 */
/* -------------------------------------------------------------------------- */

describe("destroy()", () => {
	it("tears the internal instance down", () => {
		const { editor, instance } = mount();
		editor.destroy();
		assert.strictEqual(instance.destroyCount, 1);
		assert.strictEqual(instance.unloadCount, 1);
	});

	// >>> REGRESSION: without this the crash outlives the window <<<
	it("hands workspace.activeEditor back", () => {
		// Obsidian's own embedded-editor host releases itself in both teardown
		// paths; the base class this plugin borrows does not, because in
		// Obsidian's design that is the owner's job. Nothing else can: the
		// `activeEditor` setter ignores real MarkdownViews, so clicking back
		// into a note cannot displace a stale owner, and core otherwise clears
		// the field only on a genuine active-leaf change. Closing a modal is
		// not one.
		const { editor, workspace, focus } = mount();
		focus();
		editor.destroy();
		assert.strictEqual(workspace.activeEditor, null);
	});

	it("leaves someone else's registration alone", () => {
		const someoneElse = { app: null };
		const { editor, workspace } = mount();
		workspace.activeEditor = someoneElse;
		editor.destroy();
		assert.strictEqual(workspace.activeEditor, someoneElse);
	});

	it("is safe when the preview was never focused", () => {
		const { editor, workspace } = mount();
		assert.doesNotThrow(() => editor.destroy());
		assert.strictEqual(workspace.activeEditor, null);
	});

	// >>> REGRESSION: the failed-mount path left an unreleasable owner <<<
	it("releases even when construction fails to mount", () => {
		// The throw happens after `set()` has installed the focus handler, so
		// bailing out without a teardown left a live editor that nothing held
		// a reference to — and therefore an owner nothing could ever release.
		FakeMarkdownEditor.mountsNothing = true;
		const { app, workspace } = fakeApp();
		const container = el({ cls: "cs-live-preview-body" });
		assert.throws(
			() =>
				new EmbeddableMarkdownEditor(app, asEl(container), {
					value: "> [!note] Note",
					readOnly: true,
				}),
			/did not mount/,
		);
		const instance = built[built.length - 1] as FakeMarkdownEditor;
		assert.strictEqual(instance.destroyCount, 1, "instance was torn down");
		assert.strictEqual(instance.unloadCount, 1);
		assert.strictEqual(workspace.activeEditor, null);
	});
});
