/**
 * tests/support/obsidianStub.ts — the `obsidian` module, as far as the tests
 * are concerned.
 *
 * `scripts/run-tests.mjs` aliases every `import … from "obsidian"` to this file.
 * It is not a *mock* of Obsidian: nothing here pretends to render, fetch or
 * store anything. It exists so a module under test can be bundled at all, and
 * so the handful of Obsidian values that are read as **data** rather than
 * called for effect have a truthful stand-in.
 *
 * It used to be a string written into a temp directory by the runner. It is a
 * real file now for one reason: `editorLivePreviewField` has to be an actual
 * `StateField`. `EditorState.field(f, false)` looks the field up by `f.id` in
 * the state's own config, so a plain object can only ever answer `undefined` —
 * which is indistinguishable from "this sub-editor has no such field", the very
 * distinction `calloutViewPlugin` and `headingGapField` branch on. A file can
 * import `@codemirror/state`; a string in `os.tmpdir()` cannot resolve it.
 *
 * Three exports are *seedable* — they are read as data, so an always-empty
 * default would leave half of each caller untestable. Each is driven by a
 * global a test sets before the code under test runs, following the convention
 * `getIconIds` established:
 *
 * - `__CS_ICON_IDS__`   — the Lucide id list (`icons/lucideId.ts`, `nameCheck.ts`)
 * - `__CS_LIVE_PREVIEW__` — whether a state created with `editorLivePreviewField`
 *   reports Live Preview (`false` models source mode)
 * - `__CS_NOTICES__`    — an array collecting every `new Notice(...)` message,
 *   so a suite can assert the user was told something. Absent by default, in
 *   which case `Notice` records nothing.
 * - `__CS_REQUEST_URL__` — a stand-in for one HTTP request. Absent by default,
 *   and `requestUrl` then rejects, which is what keeps every other suite off
 *   the network by construction. A suite that seeds it is not "allowed online"
 *   — it is *serving* the bytes itself, which is the only way to test what a
 *   downloader does with a truncated, mis-served or unverifiable response
 *   (`tests/localeStore.test.ts`). Empty it again in a `beforeEach`; nothing
 *   resets it on its own.
 * - `__CS_MACOS__`      — whether `Platform.isMacOS` reports a Mac. Default
 *   `false`, so the spelled-out Windows/Linux chord is what a suite gets unless
 *   it says otherwise. Read once, at module scope, because that is when
 *   `hotkeyLink` builds its glyph tables from it — which is why the only way to
 *   flip it is a module imported *before* the code under test (see
 *   tests/support/macPlatform.ts), and why the Mac chords live in a test file
 *   of their own.
 *
 * Everything else is the smallest shape that lets `instanceof` and `super(...)`
 * work, with two exceptions carrying real behaviour — `Setting` and
 * `SliderComponent`, which `settings/styleControls.ts` genuinely drives — and
 * both say so at their definition.
 */
import { StateField } from "@codemirror/state";

/* -------------------------------------------------------------------------- */
/* Seams                                                                      */
/* -------------------------------------------------------------------------- */

/** The sliver of Obsidian's `RequestUrlResponse` the plugin's fetchers read. */
export interface StubResponse {
	text: string;
}

interface TestGlobals {
	__CS_ICON_IDS__?: string[];
	__CS_LIVE_PREVIEW__?: boolean;
	__CS_NOTICES__?: string[];
	__CS_MACOS__?: boolean;
	__CS_REQUEST_URL__?: (url: string) => Promise<StubResponse>;
}

const seams = globalThis as unknown as TestGlobals;

/* -------------------------------------------------------------------------- */
/* Platform / misc                                                            */
/* -------------------------------------------------------------------------- */

export const Platform = {
	isMobile: false,
	isDesktop: true,
	isMacOS: seams.__CS_MACOS__ === true,
};

export const Keymap = { isModEvent: () => false };

export function setIcon(): void {
	/* no-op: nothing here draws */
}

/**
 * Records the tooltip on the element so a test can assert it was set, and so
 * `repoSourceRules`' "nothing sets a native `title`" rule keeps having a real
 * alternative to point at.
 */
export function setTooltip(el: { dataset?: Record<string, string> }, text: string): void {
	if (el.dataset) el.dataset.csTooltip = text;
}

export function getIconIds(): string[] {
	return seams.__CS_ICON_IDS__ ?? [];
}

export function normalizePath(p: string): string {
	return p;
}

/**
 * Rejects unless a suite has seeded `__CS_REQUEST_URL__`, so "the tests must
 * not touch the network" stays true by default rather than by discipline. The
 * seam is read on every call, not captured once, so a suite can change what a
 * URL serves between requests — which is how a first-URL failure falling
 * through to the second is testable at all.
 */
export function requestUrl(options: { url: string }): Promise<StubResponse> {
	const serve = seams.__CS_REQUEST_URL__;
	if (!serve) return Promise.reject(new Error("no network in tests"));
	return serve(options.url);
}

export function requireApiVersion(): boolean {
	return true;
}

/* -------------------------------------------------------------------------- */
/* Classes                                                                    */
/* -------------------------------------------------------------------------- */

export class TFile {}
export class Plugin {}
export class Component {
	/**
	 * Real `Component` owns child lifetimes and unload callbacks. Nothing here
	 * needs that, but several modules call these on construction and teardown
	 * (`QuickInsertPreviews`, `ThemeAppearanceProbe`), so they have to exist or
	 * the suite dies before it reaches the behaviour it is testing.
	 */
	load(): void {}
	unload(): void {}
}
export class Modal {}
export class Editor {}

/**
 * Settings-pane and menu constructors. These exist so the *bundle links*, and
 * for no other reason: `AutoComplete` imports `CalloutEditor` as a value (it
 * opens one for "Create new"), which drags the whole settings UI into any suite
 * that touches the popover. None of it is constructed there, and a suite that
 * did construct one would need real implementations rather than these.
 */
export class ToggleComponent {}
export class PluginSettingTab {}
export class Menu {}
export class WorkspaceLeaf {}

/* -------------------------------------------------------------------------- */
/* Settings components — the two that ARE driven                              */
/* -------------------------------------------------------------------------- */

/**
 * The sliver of `HTMLElement` the two components below touch. Structural, so
 * `tests/support/fakeDom.ts`'s `FakeElement` satisfies it without this file
 * importing that one — which it must not, or every suite that so much as
 * imports `obsidian` would have a fake DOM installed on it.
 */
type ElementLike = {
	createDiv(options?: { cls?: string }): ElementLike;
	value: string;
	dataset?: Record<string, string>;
};

/**
 * A real slider, unlike its neighbours above, because `settings/styleControls.ts`
 * drives one: it formats the readout through it, sets the limits and the value
 * through it, and hangs its own `input`/`pointer*` listeners on `sliderEl`.
 *
 * Two things are modelled deliberately:
 *
 * - **`setValue` clamps.** That is the `<input type="range">` doing it, not
 *   Obsidian — which is exactly why `addStyleSlider` has to call `setLimits`
 *   *before* `setValue`, and why that ordering is worth a test.
 * - **`setDisplayFormat` is present.** It arrived in Obsidian 1.13, and this
 *   models a build that has it. The older builds `setSliderDisplay` also has to
 *   survive are covered by handing that helper a bare object without the method
 *   — the branch is in the helper, not here.
 *
 * `onChange` is NOT wired to any DOM event: which event Obsidian fires it from
 * is its own business, and pinning a guess here would be asserting a fact this
 * file does not know. A suite calls {@link commit} to say "the component
 * notified its consumer", which is the whole of the contract `styleControls`
 * is written against.
 */
/**
 * Every `SliderComponent` built since a suite last emptied it.
 *
 * `addStyleSlider` constructs its slider inside a callback it never hands back,
 * so this is the only way to reach the component itself — the element is
 * findable in the DOM, but `onChange` is not on the element. Empty it in a
 * `beforeEach`; nothing resets it on its own.
 */
export const createdSliders: SliderComponent[] = [];

export class SliderComponent {
	readonly sliderEl: ElementLike;
	min = 0;
	max = 100;
	step = 1;
	/** The formatter `setSliderDisplay` installed, or null on an older build. */
	displayFormat: ((value: number) => string) | null = null;
	/** Every `setLimits`/`setValue` call, in order — the ordering is the point. */
	readonly calls: string[] = [];
	private changeCb: ((value: number) => unknown) | null = null;

	constructor(containerEl: ElementLike) {
		this.sliderEl = containerEl.createDiv({ cls: "slider" });
		createdSliders.push(this);
	}

	setLimits(min: number, max: number, step: number): this {
		this.min = min;
		this.max = max;
		this.step = step;
		this.calls.push("setLimits");
		return this;
	}

	setValue(value: number): this {
		this.calls.push("setValue");
		this.sliderEl.value = String(
			Math.min(this.max, Math.max(this.min, value)),
		);
		return this;
	}

	getValue(): number {
		return Number(this.sliderEl.value);
	}

	onChange(cb: (value: number) => unknown): this {
		this.changeCb = cb;
		return this;
	}

	setDynamicTooltip(): this {
		return this;
	}

	setDisplayFormat(format: (value: number) => string): this {
		this.displayFormat = format;
		return this;
	}

	/** Test seam: the component telling its consumer the value changed. */
	commit(value: number): unknown {
		return this.changeCb?.(value);
	}
}

/**
 * Obsidian's setting row, as far as `styleControls` uses it: a container that
 * builds the three-element skeleton and hands out components. Only `addSlider`
 * is real — nothing else under test constructs one — and the rest are the
 * fluent no-ops that keep a chained call from throwing.
 */
/** The chainable shape `Setting.addButton` / `addExtraButton` hand out. */
export class ButtonLike {
	readonly buttonEl: ElementLike;
	private click: (() => void) | null = null;

	constructor(containerEl: ElementLike) {
		this.buttonEl = containerEl.createDiv({ cls: "clickable-icon" });
	}

	setButtonText(text: string): this {
		if (this.buttonEl.dataset) this.buttonEl.dataset.csText = text;
		return this;
	}

	setIcon(): this {
		return this;
	}

	setTooltip(text: string): this {
		setTooltip(this.buttonEl, text);
		return this;
	}

	setCta(): this {
		return this;
	}

	onClick(cb: () => void): this {
		this.click = cb;
		return this;
	}

	/** For a test that wants to press it. */
	press(): void {
		this.click?.();
	}
}

export class Setting {
	readonly settingEl: ElementLike;
	readonly infoEl: ElementLike;
	readonly controlEl: ElementLike;
	/** Every slider this row created, in order. */
	readonly sliders: SliderComponent[] = [];

	constructor(containerEl: ElementLike) {
		this.settingEl = containerEl.createDiv({ cls: "setting-item" });
		this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
		this.controlEl = this.settingEl.createDiv({
			cls: "setting-item-control",
		});
	}

	/**
	 * Both record onto the row rather than staying inert, through the same
	 * `dataset` idiom as {@link setTooltip} — the copy a heading carries is
	 * sometimes the assertion (`CalloutListsSection` writes the active theme's
	 * name into its description, and has to rewrite it on every refresh).
	 * Neither builds a `nameEl`/`descEl`, because the DOM shape is not what any
	 * test here is about and inventing one would be a second thing to keep true.
	 */
	setName(name?: string): this {
		if (this.settingEl.dataset) this.settingEl.dataset.csName = name ?? "";
		return this;
	}

	setDesc(desc?: string): this {
		if (this.settingEl.dataset) this.settingEl.dataset.csDesc = desc ?? "";
		return this;
	}

	setClass(): this {
		return this;
	}

	setHeading(): this {
		return this;
	}

	/**
	 * Enough of a button for a section to *build* — the sections under test here
	 * are exercised for what they render, not for what their buttons do, and a
	 * section that throws while wiring one never gets as far as the rows.
	 */
	addButton(cb: (button: ButtonLike) => unknown): this {
		cb(new ButtonLike(this.controlEl));
		return this;
	}

	addExtraButton(cb: (button: ButtonLike) => unknown): this {
		cb(new ButtonLike(this.controlEl));
		return this;
	}

	addSlider(cb: (slider: SliderComponent) => unknown): this {
		const slider = new SliderComponent(this.controlEl);
		this.sliders.push(slider);
		cb(slider);
		return this;
	}
}

/** Records its message when `__CS_NOTICES__` is an array; inert otherwise. */
export class Notice {
	constructor(message?: string) {
		if (Array.isArray(seams.__CS_NOTICES__) && message !== undefined) {
			seams.__CS_NOTICES__.push(message);
		}
	}
}

export class MarkdownRenderer {
	static render(): Promise<void> {
		return Promise.resolve();
	}
}

/**
 * Bare on purpose: every field the code under test reads (`editor`,
 * `containerEl`, `previewMode`, `file`) is assigned by the suite that needs it.
 * What matters is that it is a real class, so `info instanceof MarkdownView`
 * and `view instanceof MarkdownView` mean something.
 */
export class MarkdownView {}

/**
 * `CalloutAutoComplete extends EditorSuggest`, so this has to carry the two
 * things the subclass inherits rather than defines: `app` (set by `super(app)`)
 * and `close()` (called through `super.close()`). `context` is a property
 * Obsidian assigns before `selectSuggestion` runs; suites set it themselves.
 */
export class EditorSuggest<T> {
	context: unknown = null;
	/** Marks that `super.close()` ran, which is otherwise unobservable. */
	closedCount = 0;

	constructor(public app: unknown) {}

	close(): void {
		this.closedCount++;
	}

	/** Present so `EditorSuggest<T>` is not an unused type parameter. */
	protected declare readonly __suggestion?: T;
}

/* -------------------------------------------------------------------------- */
/* CodeMirror-facing values                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Obsidian's "is this editor in Live Preview" field. A real `StateField`, so a
 * state that includes it answers `true`/`false` and one that does not answers
 * `undefined` — the three-way distinction the callers actually branch on.
 */
export const editorLivePreviewField = StateField.define<boolean>({
	create: () => seams.__CS_LIVE_PREVIEW__ !== false,
	update: (value) => value,
});

/**
 * Obsidian's Live Preview ViewPlugin, read only as the key to
 * `view.plugin(livePreviewState)`. A fake view answers that call however its
 * suite wants, so the key needs no behaviour — only identity.
 */
export const livePreviewState = {};
