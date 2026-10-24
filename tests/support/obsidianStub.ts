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
 * - `__CS_ICONS__`      — what `getIcon(id)` hands back, by id; `null` for any
 *   id not seeded. Only `fallbackIcon.restoreCoreIcon` reads it, to decide
 *   whether a slot already shows what `setIcon` would draw.
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
import { TestScope } from "./fakeKeymap";
export { TestScope as Scope } from "./fakeKeymap";

/* -------------------------------------------------------------------------- */
/* Seams                                                                      */
/* -------------------------------------------------------------------------- */

/** The sliver of Obsidian's `RequestUrlResponse` the plugin's fetchers read. */
export interface StubResponse {
	text: string;
}

interface TestGlobals {
	__CS_ICON_IDS__?: string[];
	__CS_ICONS__?: Record<string, { outerHTML: string }>;
	__CS_LIVE_PREVIEW__?: boolean;
	__CS_NOTICES__?: string[];
	__CS_MACOS__?: boolean;
	__CS_REQUEST_URL__?: (url: string) => Promise<StubResponse>;
	__CS_LANGUAGE__?: string;
}

const seams = globalThis as unknown as TestGlobals;

/* -------------------------------------------------------------------------- */
/* Platform / misc                                                            */
/* -------------------------------------------------------------------------- */

export const Platform = {
	isMobile: false,
	isDesktop: true,
	isPhone: false,
	isTablet: false,
	isMacOS: seams.__CS_MACOS__ === true,
};

export const Keymap = { isModEvent: () => false };

export function addIcon(): void { /* Custom UI registration has no DOM effect here. */ }
export function removeIcon(): void { /* No global icon registry in this stand-in. */ }

export function setIcon(): void {
	/* no-op: nothing here draws */
}

/** The drawing `setIcon` would leave for `id`, or `null` when none is seeded. */
export function getIcon(id: string): { outerHTML: string } | null {
	return seams.__CS_ICONS__?.[id] ?? null;
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

/**
 * Obsidian's interface language, as Settings → General sets it. A suite sets
 * `__CS_LANGUAGE__` to play a user whose Obsidian speaks something else;
 * unset, it is the API's own default.
 */
export function getLanguage(): string {
	return seams.__CS_LANGUAGE__ ?? "en";
}

/* -------------------------------------------------------------------------- */
/* Classes                                                                    */
/* -------------------------------------------------------------------------- */

export class TFile {}
export class Plugin {}
export class Component {
	/** Minimal cleanup support for components that own temporary DOM editors. */
	private disposers: Array<() => void> = [];
	load(): void {}
	register(dispose: () => void): void { this.disposers.push(dispose); }
	registerDomEvent(el: EventTarget, name: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void {
		el.addEventListener(name, listener, options);
		this.register(() => el.removeEventListener(name, listener, options));
	}
	unload(): void { this.disposers.splice(0).forEach(dispose => dispose()); }
}
export class Modal {}

/**
 * Obsidian 1.13's confirmation button (`ConfirmationButton`): a press runs
 * the handler and closes the dialog unless the handler returns something
 * truthy, as app.js does.
 */
export class ConfirmationButton {
	readonly buttonEl: HTMLButtonElement;
	isInitialFocus = false;
	private handler: (() => unknown) | null = null;

	constructor(containerEl: HTMLElement, private readonly handleClose: () => void) {
		this.buttonEl = containerEl.createEl("button");
		this.buttonEl.addEventListener("click", () => {
			void (async () => {
				const keepOpen = await this.handler?.();
				if (!keepOpen) this.handleClose();
			})();
		});
	}

	setButtonText(text: string): this { this.buttonEl.textContent = text; return this; }
	setCta(): this { this.buttonEl.addClass("mod-cta"); return this; }
	setDestructive(): this { this.buttonEl.addClass("mod-destructive"); return this; }
	setCancel(): this { this.buttonEl.addClass("mod-cancel"); return this; }
	setSecondary(): this { this.buttonEl.addClass("mod-secondary"); return this; }
	setInitialFocus(): this { this.isInitialFocus = true; return this; }
	onClick(handler: () => unknown): this { this.handler = handler; return this; }
}

/**
 * Obsidian 1.13's confirmation dialog (`ConfirmationModal`), in the DOM it
 * builds: `.modal-container.mod-confirmation > .modal > (title, content,
 * .modal-button-container)`. `open` adds it to the page and runs `onOpen`;
 * `close` runs `onClose` and takes it off.
 *
 * The DOM is built on first use, not in the constructor: many suites create a
 * `ConfirmModal` only to replace its `confirm()`, without installing the fake
 * DOM, and the global `createDiv` does not exist there.
 */
export class ConfirmationModal extends Modal {
	app: unknown;
	readonly scope = {};
	private dom: {
		containerEl: HTMLElement;
		modalEl: HTMLElement;
		titleEl: HTMLElement;
		contentEl: HTMLElement;
		buttonContainerEl: HTMLElement;
	} | null = null;

	constructor(app: unknown) {
		super();
		this.app = app;
	}

	/** Builds the dialog's elements the first time any of them is asked for. */
	private get parts(): NonNullable<ConfirmationModal["dom"]> {
		if (!this.dom) {
			const containerEl = createDiv({ cls: "modal-container mod-confirmation" });
			const modalEl = containerEl.createDiv({ cls: "modal" });
			const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
			const contentEl = modalEl.createDiv({ cls: "modal-content" });
			const buttonContainerEl = modalEl.createDiv({ cls: "modal-button-container" });
			this.dom = { containerEl, modalEl, titleEl, contentEl, buttonContainerEl };
		}
		return this.dom;
	}

	get containerEl(): HTMLElement { return this.parts.containerEl; }
	get modalEl(): HTMLElement { return this.parts.modalEl; }
	get titleEl(): HTMLElement { return this.parts.titleEl; }
	get contentEl(): HTMLElement { return this.parts.contentEl; }
	get buttonContainerEl(): HTMLElement { return this.parts.buttonContainerEl; }

	setTitle(title: string): this { this.titleEl.setText(title); return this; }
	addClass(cls: string): this { this.modalEl.addClass(cls); return this; }

	addCheckbox(label: string, cb: (value: boolean) => unknown): this {
		const labelEl = this.buttonContainerEl.createEl("label", { cls: "mod-checkbox" });
		const input = labelEl.createEl("input", { type: "checkbox", attr: { tabindex: "-1" } });
		input.addEventListener("change", () => cb(input.checked));
		labelEl.appendText(label);
		return this;
	}

	addButton(cb: (button: ConfirmationButton) => unknown): this {
		cb(new ConfirmationButton(this.buttonContainerEl, () => this.close()));
		return this;
	}

	addCancelButton(text?: string): this {
		return this.addButton((button) => button.setButtonText(text ?? "Cancel").setCancel());
	}

	open(): void {
		activeDocument.body.appendChild(this.containerEl);
		this.onOpen();
	}

	close(): void {
		this.onClose();
		this.containerEl.remove();
	}

	onOpen(): void {}
	onClose(): void {}
}
export class Editor {}

// The settings tab and sub-page base classes, with the parts of Obsidian 1.13's
// declarative settings the tests drive: tests/support/settingsTabStub.ts.
export { PluginSettingTab, SettingPage } from "./settingsTabStub";
/** Menus retain one hide callback, as Obsidian does; later registrations replace it. */
export const createdMenus: Menu[] = [];
/** What a stub menu item was told, in the order the builder added it. */
export interface MenuItemRecord {
	title: string | DocumentFragment;
	titles: Array<string | DocumentFragment>;
	/** The Lucide id passed to `setIcon`, if any. */
	icon?: string;
	section?: string;
	warning: boolean;
	disabled: boolean;
	/** Whether `setChecked(true)` put Obsidian's ✓ on the item. */
	checked: boolean;
	click?: () => unknown;
}
/** Where `showAtPosition` was asked to put a menu (Obsidian's `MenuPositionDef`). */
export interface MenuPositionRecord {
	x: number;
	y: number;
	width?: number;
	overlap?: boolean;
	left?: boolean;
}
export class Menu extends Component {
	readonly items: MenuItemRecord[] = [];
	shown = false;
	hideCalls = 0;
	delayHideCallback = false;
	showEvent?: MouseEvent;
	/** Set by `showAtPosition`: where the menu was asked to open. */
	showPosition?: MenuPositionRecord;
	/** Set by `setNoIcon`: the menu draws no icon column. */
	noIcon = false;
	/** Set by `setParentElement`: the element the menu belongs to. */
	parentEl?: HTMLElement;
	private hidden?: () => void;
	constructor() { super(); createdMenus.push(this); }
	setUseNativeMenu(_native: boolean): this { return this; }
	setNoIcon(): this { this.noIcon = true; return this; }
	setParentElement(el: HTMLElement): this { this.parentEl = el; return this; }
	addItem(callback: (item: {
		setTitle(title: string | DocumentFragment): unknown;
		setIcon(icon: string): unknown;
		setSection(section: string): unknown;
		setWarning(warning: boolean): unknown;
		setDisabled(disabled: boolean): unknown;
		setChecked(checked: boolean): unknown;
		onClick(callback: () => unknown): unknown;
	}) => void): this {
		const record: MenuItemRecord = { title: "", titles: [], warning: false, disabled: false, checked: false };
		const item = {
			setTitle(title: string | DocumentFragment) { record.title = title; record.titles.push(title); return this; },
			setIcon(icon: string) { record.icon = icon; return this; },
			setSection(section: string) { record.section = section; return this; },
			setWarning(warning: boolean) { record.warning = warning; return this; },
			setDisabled(disabled: boolean) { record.disabled = disabled; return this; },
			setChecked(checked: boolean) { record.checked = checked; return this; },
			onClick(callback: () => unknown) { record.click = callback; return this; },
		};
		callback(item);
		this.items.push(record);
		return this;
	}
	addSeparator(): this { return this; }
	onHide(callback: () => void): void { this.hidden = callback; }
	showAtMouseEvent(event: MouseEvent): this {
		this.unload();
		this.shown = true;
		this.showEvent = event;
		this.load();
		return this;
	}
	/** As Obsidian does, marks the parent element `has-active-menu` while shown. */
	showAtPosition(position: MenuPositionRecord, _doc?: Document): this {
		this.unload();
		this.shown = true;
		this.showPosition = position;
		this.parentEl?.addClass("has-active-menu");
		this.load();
		return this;
	}
	/** A click on an item: runs its handler, then closes the menu, as Obsidian does. */
	clickItem(title: string): void {
		const index = this.items.findIndex((record) => record.title === title);
		if (index < 0) throw new Error(`no menu item titled ${title}`);
		this.clickItemAt(index);
	}
	/** The same click, on the item at `index` (0 is the first). */
	clickItemAt(index: number): void {
		const item = this.items[index];
		if (!item) throw new Error(`no menu item at ${index}`);
		item.click?.();
		this.hide();
	}
	hide(): this {
		this.hideCalls++;
		this.shown = false;
		this.parentEl?.removeClass("has-active-menu");
		this.unload();
		if (!this.delayHideCallback) this.finishHide();
		return this;
	}
	/** Phone close animation delivers this later than the component teardown. */
	finishHide(): void { this.hidden?.(); }
	/** A menu hidden before its deferred load only delivers onHide. */
	earlyHide(): void { this.shown = false; this.hideCalls++; this.finishHide(); }
}
export class WorkspaceLeaf {}

/** Minimal lifecycle/DOM host for occurrence view tests. */
export class ItemView {
	app: unknown;
	/** The view's own element (`.workspace-leaf-content`); a nav header goes in it, before the content. */
	containerEl: HTMLElement;
	contentEl: HTMLElement;
	private disposers: Array<() => void> = [];
	constructor(public leaf: { app: unknown }) {
		this.app = leaf.app;
		this.containerEl = createDiv({ cls: "workspace-leaf-content" });
		this.contentEl = this.containerEl.createDiv({ cls: "view-content" });
	}
	register(dispose: () => void): void { this.disposers.push(dispose); }
	registerEvent(_ref: unknown): void { /* The view explicitly removes its event refs on close. */ }
	registerDomEvent(el: EventTarget, name: string, listener: EventListener): void {
		el.addEventListener(name, listener);
		this.register(() => el.removeEventListener(name, listener));
	}
	setState(_state: unknown, _result: unknown): Promise<void> { return Promise.resolve(); }
	unload(): void { this.disposers.splice(0).forEach((dispose) => dispose()); }
}

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
	appendChild?(node: Node): unknown;
	addClass?(...classes: string[]): void;
	removeClass?(...classes: string[]): void;
	show?(): void;
	hide?(): void;
	addEventListener?(type: string, callback: () => void): void;
	setAttribute?(name: string, value: string): void;
	value: string;
	textContent: string;
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

export const createdToggles: ToggleComponent[] = [];

/**
 * Obsidian's search field, in the DOM app.js builds for it:
 * `div.search-input-container > input[type=search] + div.search-input-clear-button`.
 * Typing reports through `onChange`, and so does the clear button — which, as
 * in Obsidian, empties the field and refocuses it without an `input` event.
 */
export class SearchComponent {
	readonly inputEl: HTMLInputElement;
	readonly clearButtonEl: HTMLElement;
	private changeCb: ((value: string) => unknown) | null = null;

	constructor(containerEl: HTMLElement) {
		const container = containerEl.createDiv({ cls: "search-input-container" });
		this.inputEl = container.createEl("input", { type: "search" });
		this.clearButtonEl = container.createDiv({ cls: "search-input-clear-button" });
		this.inputEl.addEventListener("input", () => this.onChanged());
		this.clearButtonEl.addEventListener("click", () => {
			this.inputEl.value = "";
			this.onChanged();
			this.inputEl.focus();
		});
	}

	setPlaceholder(text: string): this {
		this.inputEl.setAttribute("placeholder", text);
		return this;
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string { return this.inputEl.value; }

	setDisabled(disabled: boolean): this {
		this.inputEl.disabled = disabled;
		return this;
	}

	onChange(cb: (value: string) => unknown): this {
		this.changeCb = cb;
		return this;
	}

	onChanged(): void {
		this.changeCb?.(this.inputEl.value);
	}
}

/** Settings reset tests need the displayed value as well as the change event. */
export class ToggleComponent {
	readonly toggleEl: ElementLike;
	private value = false;
	private changeCb: ((value: boolean) => unknown) | null = null;

	constructor(containerEl: ElementLike) {
		this.toggleEl = containerEl.createDiv({ cls: "checkbox-container" });
		createdToggles.push(this);
	}

	setValue(value: boolean): this {
		this.value = value;
		return this;
	}

	getValue(): boolean { return this.value; }

	/** Obsidian's toggle marks itself `is-disabled`; `Setting.setDisabled` reaches it. */
	disabled = false;
	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		return this;
	}

	setTooltip(text: string): this {
		setTooltip(this.toggleEl, text);
		return this;
	}

	onChange(cb: (value: boolean) => unknown): this {
		this.changeCb = cb;
		return this;
	}

	commit(value: boolean): unknown {
		this.setValue(value);
		return this.changeCb?.(value);
	}
}

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

	setInstant(): this {
		return this;
	}

	/** `Setting.setDisabled` reaches every component of the row, this one too. */
	disabled = false;
	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		return this;
	}

	setDisplayFormat(format: (value: number) => string): this {
		this.displayFormat = format;
		return this;
	}

	/** Test seam: the component telling its consumer the value changed. */
	commit(value: number): unknown {
		this.setValue(value);
		return this.changeCb?.(this.getValue());
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
	readonly extraSettingsEl: ElementLike;
	private click: (() => void) | null = null;

	constructor(containerEl: ElementLike) {
		this.buttonEl = containerEl.createDiv({ cls: "clickable-icon" });
		this.extraSettingsEl = this.buttonEl;
		this.buttonEl.addEventListener?.("click", () => { if (!this.disabled) this.click?.(); });
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

	/** Obsidian 1.13's red button class (`setWarning` is now `setDestructive().setCta()`). */
	setDestructive(): this {
		this.buttonEl.addClass?.("mod-destructive");
		return this;
	}

	/** Recorded as `aria-disabled`, and a disabled button's press does nothing. */
	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		this.buttonEl.setAttribute?.("aria-disabled", String(disabled));
		return this;
	}

	private disabled = false;

	onClick(cb: () => void): this {
		this.click = cb;
		return this;
	}

	/** For a test that wants to press it. */
	press(): void {
		if (!this.disabled) this.click?.();
	}
}

export class Setting {
	readonly settingEl: ElementLike;
	readonly infoEl: ElementLike;
	readonly nameEl: ElementLike;
	readonly descEl: ElementLike;
	readonly controlEl: ElementLike;
	/** Every slider this row created, in order. */
	readonly sliders: SliderComponent[] = [];
	/** Extra buttons are exposed so component tests can press their callbacks. */
	readonly extraButtons: ButtonLike[] = [];
	/** Obsidian 1.13's error line under the control; made by `setErrorMessage`. */
	errorEl: ElementLike | null = null;
	/**
	 * Every component the row made (buttons, toggles, sliders, …), as
	 * Obsidian keeps them: `setDisabled` reaches each one, and `clear` forgets
	 * them.
	 */
	components: Array<{ setDisabled?(disabled: boolean): unknown }> = [];
	/** Whether `setDisabled(true)` is in force. */
	disabled = false;
	/** The icon slot `setIcon` makes, first in the row; null until then. */
	iconEl: ElementLike | null = null;
	/** What a click on the whole row does (`setAction`, `setNavigable`). */
	private rowClick: (() => void) | null = null;

	constructor(containerEl: ElementLike) {
		this.settingEl = containerEl.createDiv({ cls: "setting-item" });
		this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
		this.nameEl = this.infoEl.createDiv({ cls: "setting-item-name" });
		this.descEl = this.infoEl.createDiv({ cls: "setting-item-description" });
		this.controlEl = this.settingEl.createDiv({
			cls: "setting-item-control",
		});
	}

	/**
	 * Both record onto the row through the same `dataset` idiom as
	 * {@link setTooltip} — the copy a heading carries is sometimes the
	 * assertion (`CalloutListsSection` writes the active theme's name into its
	 * description, and has to rewrite it on every refresh).
	 *
	 * `nameEl` is real, and only because production code mounts things in it:
	 * `sections/sectionDisclosure.ts` puts the fold chevron and the whole aria
	 * contract — `role`, `tabindex`, `aria-expanded`, `aria-controls` — on the
	 * name element, so a heading with no `nameEl` could not be built at all,
	 * let alone folded. `setName` writes into it the way Obsidian's does,
	 * *replacing* its children, because that replacement is exactly what the
	 * disclosure has to survive. `descEl` also supports the command format
	 * row's explanation when the selected callout belongs to the theme.
	 */
	setName(name?: string | DocumentFragment): this {
		if (name === undefined || typeof name === "string") {
			this.nameEl.textContent = name ?? "";
		} else {
			// A fragment's children move in, as they do in Obsidian — the
			// heading counts (`ui/faintCount.ts`) arrive this way.
			this.nameEl.textContent = "";
			for (const child of Array.from(name.childNodes)) this.nameEl.appendChild?.(child);
		}
		if (this.settingEl.dataset) this.settingEl.dataset.csName = this.nameEl.textContent;
		return this;
	}

	setDesc(desc?: string | DocumentFragment): this {
		if (desc === undefined || typeof desc === "string") {
			this.descEl.textContent = desc ?? "";
		} else {
			// A fragment's children move in, as they do in Obsidian — a
			// description with line breaks arrives this way.
			this.descEl.textContent = "";
			for (const child of Array.from(desc.childNodes)) this.descEl.appendChild?.(child);
		}
		if (this.settingEl.dataset) this.settingEl.dataset.csDesc = this.descEl.textContent;
		return this;
	}

	setClass(cls: string): this {
		this.settingEl.addClass?.(cls);
		return this;
	}

	/**
	 * Obsidian 1.13: a message shows `controlEl > div.setting-item-error` with
	 * that text and marks the row `is-invalid`; `null` or "" hides the line and
	 * drops the mark, as app.js does.
	 */
	setErrorMessage(message: string | null): this {
		if (message) {
			this.errorEl ??= this.controlEl.createDiv({ cls: "setting-item-error" });
			this.errorEl.textContent = message;
			this.errorEl.show?.();
			this.settingEl.addClass?.("is-invalid");
		} else {
			this.errorEl?.hide?.();
			this.settingEl.removeClass?.("is-invalid");
		}
		return this;
	}

	setHeading(): this {
		this.settingEl.addClass?.("setting-item-heading");
		return this;
	}

	/**
	 * Obsidian 1.13's `clear()`, as the declarative renderer uses it before
	 * drawing a reused row again: the controls go (with the components and the
	 * error line); the name, description and icon stay.
	 */
	clear(): this {
		(this.controlEl as unknown as { empty(): void }).empty();
		this.components = [];
		this.extraButtons.length = 0;
		this.sliders.length = 0;
		this.errorEl = null;
		this.settingEl.removeClass?.("is-invalid");
		return this;
	}

	/** Marks the row `is-disabled` and disables every component it made. */
	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		if (disabled) this.settingEl.addClass?.("is-disabled");
		else this.settingEl.removeClass?.("is-disabled");
		for (const component of this.components) component.setDisabled?.(disabled);
		return this;
	}

	/**
	 * The icon at the start of the row: a `div.setting-item-icon`, made on the
	 * first call and put before everything else, as Obsidian's runtime-only
	 * `setIcon` does. `null` leaves the slot empty. (Nothing is drawn here; the
	 * icon's name is kept in `data-cs-icon`.)
	 */
	setIcon(icon: string | null): this {
		if (!this.iconEl) {
			const row = this.settingEl as ElementLike & { insertBefore(node: unknown, ref: unknown): unknown; firstChild: unknown };
			this.iconEl = this.settingEl.createDiv({ cls: "setting-item-icon" });
			row.insertBefore(this.iconEl, row.firstChild);
		}
		if (this.iconEl.dataset) this.iconEl.dataset.csIcon = icon ?? "";
		return this;
	}

	/** A row that is a button as a whole (Obsidian's `setAction`). */
	setAction(onClick: () => void): this {
		this.settingEl.addClass?.("mod-action", "tappable");
		return this.setRowClick(onClick);
	}

	/** A row that opens a page, with a chevron at its end (Obsidian's `setNavigable`). */
	setNavigable(onClick: () => void): this {
		this.settingEl.addClass?.("mod-navigable", "tappable");
		this.controlEl.createDiv({ cls: "setting-item-chevron" });
		return this.setRowClick(onClick);
	}

	/** One click listener on the row, which a disabled row ignores. */
	private setRowClick(onClick: () => void): this {
		if (!this.rowClick) {
			this.settingEl.addEventListener?.("click", () => {
				if (!this.disabled) this.rowClick?.();
			});
		}
		this.rowClick = onClick;
		return this;
	}

	/**
	 * Enough of a button for a section to *build* — the sections under test here
	 * are exercised for what they render, not for what their buttons do, and a
	 * section that throws while wiring one never gets as far as the rows.
	 */
	addButton(cb: (button: ButtonLike) => unknown): this {
		const button = new ButtonLike(this.controlEl);
		this.components.push(button);
		cb(button);
		return this;
	}

	/**
	 * Obsidian 1.13.1's read-only value: a `div.setting-item-value` in the
	 * control area, holding the text `setValue` gives it.
	 */
	addDisplayValue(cb: (value: { setValue(text: string): unknown }) => unknown): this {
		const valueEl = this.controlEl.createDiv({ cls: "setting-item-value" });
		cb({ setValue(text: string) { valueEl.textContent = text ?? ""; return this; } });
		return this;
	}

	addExtraButton(cb: (button: ButtonLike) => unknown): this {
		const button = new ButtonLike(this.controlEl);
		this.extraButtons.push(button);
		this.components.push(button);
		cb(button);
		return this;
	}

	addSlider(cb: (slider: SliderComponent) => unknown): this {
		const slider = new SliderComponent(this.controlEl);
		this.sliders.push(slider);
		this.components.push(slider);
		cb(slider);
		return this;
	}

	addToggle(cb: (toggle: ToggleComponent) => unknown): this {
		const toggle = new ToggleComponent(this.controlEl);
		this.components.push(toggle);
		cb(toggle);
		return this;
	}

	/** Obsidian 1.11's `addComponent`: the callback builds a component in the control area. */
	addComponent<T extends { setDisabled?(disabled: boolean): unknown }>(cb: (controlEl: ElementLike) => T): this {
		this.components.push(cb(this.controlEl));
		return this;
	}
}

/**
 * Obsidian 1.11's `SettingGroup`, built as Obsidian builds it:
 * `div.setting-group > [div.setting-item.setting-item-heading] + div.setting-items`.
 * The heading row exists only once a heading or a heading button is added, and
 * it goes first, before the rows (`listEl`).
 */
export class SettingGroup {
	readonly groupEl: ElementLike;
	readonly listEl: ElementLike;
	/**
	 * Every row added through `addSetting`, in order. Obsidian's declarative
	 * renderer replaces the array after each draw, so it is writable.
	 */
	settings: Setting[] = [];
	/** The heading's buttons, so a test can press them. */
	readonly extraButtons: ButtonLike[] = [];
	private headerEl: ElementLike | null = null;
	private headerNameEl: ElementLike | null = null;
	private headerControlEl: ElementLike | null = null;

	constructor(containerEl: ElementLike) {
		this.groupEl = containerEl.createDiv({ cls: "setting-group" });
		this.listEl = this.groupEl.createDiv({ cls: "setting-items" });
	}

	/** The heading row, made on first use and moved before the rows. */
	private header(): { nameEl: ElementLike; controlEl: ElementLike } {
		if (!this.headerEl) {
			const headerEl = this.groupEl.createDiv({ cls: "setting-item setting-item-heading" });
			this.headerNameEl = headerEl.createDiv({ cls: "setting-item-name" });
			this.headerControlEl = headerEl.createDiv({ cls: "setting-item-control" });
			// `insertBefore` is the fake DOM's (and the browser's); the narrow
			// `ElementLike` type above does not list it.
			const group = this.groupEl as ElementLike & { insertBefore(node: unknown, ref: unknown): unknown; firstChild: unknown };
			group.insertBefore(headerEl, group.firstChild);
			this.headerEl = headerEl;
		}
		return { nameEl: this.headerNameEl!, controlEl: this.headerControlEl! };
	}

	/**
	 * As Obsidian's: the heading row shows while it has text or buttons, and is
	 * taken out of the group when it has neither.
	 */
	setHeading(text: string): this {
		if (text !== "" || this.extraButtons.length > 0) {
			this.header().nameEl.textContent = text;
		} else if (this.headerEl) {
			(this.headerEl as unknown as { remove(): void }).remove();
			this.headerEl = null;
		}
		return this;
	}

	/** The search field Obsidian puts above the rows (`div.setting-group-search`). */
	searchEl: ElementLike | null = null;

	addSearch(cb: (search: SearchComponent) => unknown): this {
		const group = this.groupEl as ElementLike & { insertBefore(node: unknown, ref: unknown): unknown };
		this.searchEl = this.groupEl.createDiv({ cls: "setting-group-search" });
		group.insertBefore(this.searchEl, this.listEl);
		cb(new SearchComponent(this.searchEl as unknown as HTMLElement));
		return this;
	}

	private deleteItemCb: ((index: number) => void) | null = null;
	private reorderItemCb: ((from: number, to: number) => void) | null = null;
	/** The index `focusNearestItem` was last asked for, so a test can check it. */
	focusedIndex: number | null = null;

	/** Delete or Backspace on a focused row calls this with the row's index. */
	onDeleteItem(cb: (index: number) => void): this {
		this.deleteItemCb = cb;
		return this;
	}

	/** Alt+↑ or Alt+↓ on a focused row calls this with its index and the next one. */
	onReorderItem(cb: (from: number, to: number) => void): this {
		this.reorderItemCb = cb;
		return this;
	}

	focusNearestItem(index: number): void {
		this.focusedIndex = index;
	}

	/** Test seam: Delete pressed on the row at `index`, as Obsidian handles it. */
	pressDelete(index: number): void {
		if (index < 0 || index >= this.settings.length) return;
		this.deleteItemCb?.(index);
		this.focusNearestItem(index);
	}

	/** Test seam: Alt+↑ (`-1`) or Alt+↓ (`1`) on the row at `index`, clamped as Obsidian clamps it. */
	pressAltArrow(index: number, step: -1 | 1): void {
		const to = Math.min(this.settings.length - 1, Math.max(0, index + step));
		if (to !== index) this.reorderItemCb?.(index, to);
	}

	addClass(...classes: string[]): this {
		this.groupEl.addClass?.(...classes);
		return this;
	}

	addSetting(cb: (setting: Setting) => unknown): this {
		const setting = new Setting(this.listEl);
		this.settings.push(setting);
		cb(setting);
		return this;
	}

	addExtraButton(cb: (button: ButtonLike) => unknown): this {
		const button = new ButtonLike(this.header().controlEl);
		this.extraButtons.push(button);
		cb(button);
		return this;
	}
}

/** Records its message when `__CS_NOTICES__` is an array; inert otherwise. */
export class Notice {
	/**
	 * The most recently constructed notice. `__CS_NOTICES__` collects the plain
	 * strings, which is all most suites need; a notice with an action button
	 * (ui/noticeAction.ts) has to be reached as an object to press it, through
	 * its `containerEl`.
	 */
	static last: Notice | null = null;
	message: unknown;
	readonly duration: number | undefined;
	hidden = false;
	private container: HTMLElement | null = null;
	hide(): void { this.hidden = true; }
	constructor(message?: string, duration?: number) {
		this.message = message;
		this.duration = duration;
		Notice.last = this;
		if (Array.isArray(seams.__CS_NOTICES__) && message !== undefined) {
			seams.__CS_NOTICES__.push(message);
		}
	}
	/**
	 * Obsidian's `div.notice`, made on first use: most suites never touch it
	 * and run without the fake DOM, where the global `createDiv` is missing.
	 */
	get containerEl(): HTMLElement {
		this.container ??= createDiv({ cls: "notice" });
		return this.container;
	}
	setMessage(message: string): this { this.message = message; return this; }
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
	/** Obsidian's row cap; subclasses may lower it. */
	limit = 100;
	/** The popover's own key bindings — subclasses register Tab and `|` here. */
	scope = new TestScope();
	/**
	 * Obsidian's internal suggestion list, which `editor/suggestKeys.ts` reads
	 * optionally. Absent until a suite installs one — the same "missing"
	 * case the production code has to survive.
	 */
	suggestions?: { useSelectedItem(evt: KeyboardEvent): boolean };

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
export const editorInfoField = StateField.define<{ editor?: import("obsidian").Editor } | null>({
	create: () => null,
	update: (value) => value,
});
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

/** Native Obsidian 1.13.7 heading normalization, verified against its bundled app. */
export function stripHeading(heading: string): string {
	return heading.replace(/[!"#$%&()*+,.:;<=>?@^`{|}~/[\]\\\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

export function stripHeadingForLink(heading: string): string {
	return heading.replace(/([:#|^\\\r\n]|%%|\[\[|\]\])/g, " ").replace(/\s+/g, " ").trim();
}
