/**
 * Offline browser host for documentation vectors. Production components create
 * the UI; this file supplies only Obsidian's DOM/API shell. Never loads a vault,
 * launches the user's app, saves settings, or permits network requests.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export * from "../../tests/support/obsidianStub";
import { Scope } from "../../tests/support/obsidianStub";

type IconTable = Record<string, Array<Array<string | number>>>;
let icons: IconTable = {};
const NS = "http://www.w3.org/2000/svg";

/** Install native browser equivalents of Obsidian's convenience methods. */
export function installDomHelpers(table?: IconTable): void {
	icons = table ?? (window as any).__CS_GUIDE_ICONS__ ?? {};
	Object.defineProperties(Node.prototype, {
		doc: { configurable: true, get() { return this.ownerDocument ?? this; } },
		win: { configurable: true, get() { return this.ownerDocument?.defaultView ?? window; } },
	});
	function make(parent: Node | null, tag: string, options: any = {}, callback?: (el: HTMLElement) => void): HTMLElement {
		const info = typeof options === "string" ? { cls: options } : options;
		const el = document.createElement(tag);
		if (info.cls) el.className = Array.isArray(info.cls) ? info.cls.join(" ") : info.cls;
		if (info.text !== undefined) typeof info.text === "string" ? el.textContent = info.text : el.appendChild(info.text);
		for (const [key, value] of Object.entries(info.attr ?? {})) if (value !== null && value !== undefined) el.setAttribute(key, String(value));
		for (const key of ["value", "type", "placeholder", "href"]) if (info[key] !== undefined) (el as any)[key] = info[key];
		if (parent) info.prepend ? parent.insertBefore(el, parent.firstChild) : parent.appendChild(el);
		callback?.(el);
		return el;
	}
	Object.assign(Node.prototype, {
		createEl(this: Node, tag: string, options?: any, callback?: any) { return make(this, tag, options, callback); },
		createDiv(this: Node, options?: any, callback?: any) { return make(this, "div", options, callback); },
		createSpan(this: Node, options?: any, callback?: any) { return make(this, "span", options, callback); },
		empty(this: Node) { while (this.lastChild) this.removeChild(this.lastChild); },
		detach(this: Node) { this.parentNode?.removeChild(this); },
		appendText(this: Node, text: string) { this.appendChild(document.createTextNode(text)); },
		instanceOf(this: Node, constructor: any) { return this instanceof constructor; },
	});
	Object.assign(Element.prototype, {
		addClass(this: Element, ...classes: string[]) { this.classList.add(...classes); },
		addClasses(this: Element, classes: string[]) { this.classList.add(...classes); },
		removeClass(this: Element, ...classes: string[]) { this.classList.remove(...classes); },
		removeClasses(this: Element, classes: string[]) { this.classList.remove(...classes); },
		toggleClass(this: Element, classes: string | string[], force?: boolean) { for (const cls of [classes].flat()) this.classList.toggle(cls, force); },
		hasClass(this: Element, cls: string) { return this.classList.contains(cls); },
		setText(this: Element, text: string | Node) { this.replaceChildren(typeof text === "string" ? document.createTextNode(text) : text); },
		setAttr(this: Element, key: string, value: unknown) { value === null ? this.removeAttribute(key) : this.setAttribute(key, String(value)); },
		setAttrs(this: Element, values: Record<string, unknown>) { for (const [key, value] of Object.entries(values)) (this as any).setAttr(key, value); },
		getText(this: Element) { return this.textContent; },
		getCssProperty(this: Element, key: string) { return getComputedStyle(this).getPropertyValue(key); },
		getCssPropertyValue(this: Element, key: string) { return getComputedStyle(this).getPropertyValue(key); },
		find(this: Element, selector: string) { return this.querySelector(selector); },
		findAll(this: Element, selector: string) { return [...this.querySelectorAll(selector)]; },
		getWin() { return window; },
		getDocument() { return document; },
	});
	Object.assign(HTMLElement.prototype, {
		setCssProps(this: HTMLElement, values: Record<string, string>) { for (const [key, value] of Object.entries(values)) this.style.setProperty(key, value); },
		setCssStyles(this: HTMLElement, values: Record<string, string>) { Object.assign(this.style, values); },
		show(this: HTMLElement) { this.style.removeProperty("display"); },
		hide(this: HTMLElement) { this.style.display = "none"; },
		toggle(this: HTMLElement, shown: boolean) { if (shown) this.style.removeProperty("display"); else this.style.display = "none"; },
		isShown(this: HTMLElement) { return this.style.display !== "none"; },
		// Obsidian tells an element when it moves to another window; a scene is one window.
		onWindowMigrated(this: HTMLElement) { return () => {}; },
	});
	Object.assign(window, {
		createEl: (tag: string, options?: any, callback?: any) => make(null, tag, options, callback),
		createDiv: (options?: any, callback?: any) => make(null, "div", options, callback),
		createSpan: (options?: any, callback?: any) => make(null, "span", options, callback),
		createFragment: (callback?: (fragment: DocumentFragment) => void) => { const f = document.createDocumentFragment(); callback?.(f); return f; },
		activeWindow: window, activeDocument: document,
	});
}

/**
 * Obsidian's own icons, which it registers beside Lucide rather than in its
 * table: only the ones the plugin draws, in the same shape notation.
 */
const OBSIDIAN_ICONS: Record<string, unknown[][]> = {
	"right-triangle": [[6, "M3 8L12 17L21 8"]],
};

/** Icon geometry comes from the locally installed Obsidian Lucide table. */
export function setIcon(parent: HTMLElement, id: string): void {
	const name = id.replace(/^lucide-/, "");
	const shapes = icons[name] ?? OBSIDIAN_ICONS[name];
	if (!shapes) throw new Error(`Missing local Obsidian icon: ${name}`);
	const svg = document.createElementNS(NS, "svg");
	for (const [key, value] of Object.entries({ xmlns: NS, viewBox: "0 0 24 24", width: "24", height: "24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", class: `svg-icon lucide-${name}` })) svg.setAttribute(key, value);
	const tags = ["line", "circle", "polyline", "polygon", "ellipse", "rect", "path"];
	const attributes = [["x1", "y1", "x2", "y2"], ["cx", "cy", "r", "fill"], ["points"], ["points"], ["cx", "cy", "rx", "ry"], ["x", "y", "width", "height", "rx", "ry"], ["d", "fill"]];
	for (const [kind, ...values] of shapes) {
		const shape = document.createElementNS(NS, tags[Number(kind)]);
		attributes[Number(kind)].forEach((attr, index) => { if (values[index] !== undefined) shape.setAttribute(attr, String(values[index])); });
		svg.appendChild(shape);
	}
	parent.replaceChildren(svg);
}
export function getIconIds(): string[] { return Object.keys(icons).map(name => `lucide-${name}`); }
export function setTooltip(el: HTMLElement, text: string): void { el.setAttribute("aria-label", text); }
export function requireApiVersion(required: string): boolean {
	const version = (window as any).__CS_GUIDE_OBSIDIAN_VERSION__;
	if (!version) throw new Error("Documentation renderer must supply the local Obsidian version");
	const actualParts = String(version).split(".").map(Number), requiredParts = required.split(".").map(Number);
	for (let index = 0; index < 3; index++) {
		if ((actualParts[index] ?? 0) !== (requiredParts[index] ?? 0)) return (actualParts[index] ?? 0) > (requiredParts[index] ?? 0);
	}
	return true;
}

export class Modal {
	app: any; scope = new Scope(); containerEl: HTMLElement; modalEl: HTMLElement; titleEl: HTMLElement; contentEl: HTMLElement;
	constructor(app: any) {
		this.app = app;
		this.containerEl = createDiv({ cls: "modal-container mod-dim" });
		this.containerEl.createDiv({ cls: "modal-bg" });
		this.modalEl = this.containerEl.createDiv({ cls: "modal" });
		const close = this.modalEl.createDiv({ cls: "modal-close-button" }); setIcon(close, "x");
		this.titleEl = this.modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
		this.contentEl = this.modalEl.createDiv({ cls: "modal-content" });
	}
	setTitle(title: string): this { this.titleEl.setText(title); return this; }
	open(): void { document.body.appendChild(this.containerEl); this.onOpen(); }
	close(): void { this.onClose(); this.containerEl.remove(); }
	onOpen(): void {}
	onClose(): void {}
}

/** Obsidian's notice, in the DOM it builds: `.notice-container > .notice > .notice-message`; a click anywhere hides it. */
export class Notice {
	containerEl: HTMLElement; messageEl: HTMLElement; noticeEl: HTMLElement;
	constructor(message: string | DocumentFragment, _duration?: number) {
		const host = document.body.querySelector<HTMLElement>(":scope > .notice-container") ?? document.body.createDiv({ cls: "notice-container" });
		this.containerEl = host.createDiv({ cls: "notice" });
		this.messageEl = this.noticeEl = this.containerEl.createDiv({ cls: "notice-message" });
		this.messageEl.setText(message);
		this.containerEl.addEventListener("click", () => this.hide());
	}
	setMessage(message: string | DocumentFragment): this { this.messageEl.setText(message); return this; }
	hide(): void { this.containerEl.remove(); }
}

/** Obsidian 1.13's confirmation button: a press closes the dialog unless the handler returns something truthy. */
export class ConfirmationButton {
	buttonEl: HTMLButtonElement; isInitialFocus = false;
	private handler: (() => unknown) | null = null;
	constructor(parent: HTMLElement, private readonly handleClose: () => void) {
		this.buttonEl = parent.createEl("button");
		this.buttonEl.addEventListener("click", async () => { if (!(await this.handler?.())) this.handleClose(); });
	}
	setButtonText(text: string): this { this.buttonEl.textContent = text; return this; }
	setCta(): this { this.buttonEl.classList.add("mod-cta"); return this; }
	setDestructive(): this { this.buttonEl.classList.add("mod-destructive"); return this; }
	setCancel(): this { this.buttonEl.classList.add("mod-cancel"); return this; }
	setSecondary(): this { this.buttonEl.classList.add("mod-secondary"); return this; }
	setInitialFocus(): this { this.isInitialFocus = true; return this; }
	onClick(handler: () => unknown): this { this.handler = handler; return this; }
}
/** Obsidian 1.13's confirmation dialog: `mod-confirmation` on its container, and a button bar under the content. */
export class ConfirmationModal extends Modal {
	buttonContainerEl: HTMLElement;
	constructor(app: any) {
		super(app);
		this.containerEl.classList.add("mod-confirmation");
		this.buttonContainerEl = this.modalEl.createDiv({ cls: "modal-button-container" });
	}
	addClass(cls: string): this { this.modalEl.classList.add(cls); return this; }
	addCheckbox(label: string, cb: (value: boolean) => unknown): this {
		const labelEl = this.buttonContainerEl.createEl("label", { cls: "mod-checkbox" });
		const input = labelEl.createEl("input", { type: "checkbox", attr: { tabindex: "-1" } });
		input.addEventListener("change", () => cb(input.checked));
		labelEl.appendText(label);
		return this;
	}
	addButton(cb: (button: ConfirmationButton) => unknown): this { cb(new ConfirmationButton(this.buttonContainerEl, () => this.close())); return this; }
	addCancelButton(text?: string): this { return this.addButton((button) => button.setButtonText(text ?? "Cancel").setCancel()); }
}

class Control {
	el: HTMLElement;
	constructor(el: HTMLElement) { this.el = el; }
	setDisabled(value: boolean): this { (this.el as HTMLInputElement).disabled = value; return this; }
	setTooltip(text: string): this { setTooltip(this.el, text); return this; }
}
export class ButtonComponent extends Control {
	buttonEl: HTMLButtonElement;
	constructor(parent: HTMLElement) { const button = parent.createEl("button"); super(button); this.buttonEl = button; }
	setButtonText(text: string): this { this.buttonEl.textContent = text; return this; }
	setIcon(name: string): this { setIcon(this.buttonEl, name); return this; }
	setCta(): this { this.buttonEl.classList.add("mod-cta"); return this; }
	setDestructive(): this { this.buttonEl.classList.add("mod-destructive"); return this; }
	onClick(callback: () => unknown): this { this.buttonEl.addEventListener("click", callback); return this; }
}
/** As Obsidian's: a gear until given an icon; disabled is `is-disabled` and no Tab stop. */
export class ExtraButtonComponent extends Control {
	extraSettingsEl: HTMLElement; buttonEl: HTMLElement;
	constructor(parent: HTMLElement) { const el = parent.createDiv({ cls: "clickable-icon extra-setting-button", attr: { tabindex: "0" } }); super(el); this.extraSettingsEl = this.buttonEl = el; setIcon(el, "lucide-settings"); }
	setDisabled(value: boolean): this {
		this.el.classList.toggle("is-disabled", value);
		if (value) this.el.removeAttribute("tabindex"); else this.el.setAttribute("tabindex", "0");
		return this;
	}
	setIcon(name: string): this { setIcon(this.el, name); return this; }
	onClick(callback: () => unknown): this { this.el.addEventListener("click", callback); return this; }
}
/** Obsidian's search field: `div.search-input-container > input[type=search] + clear button`. */
export class SearchComponent {
	inputEl: HTMLInputElement; clearButtonEl: HTMLElement;
	private changeCb: ((value: string) => unknown) | null = null;
	constructor(parent: HTMLElement) {
		const container = parent.createDiv({ cls: "search-input-container" });
		this.inputEl = container.createEl("input", { type: "search", attr: { enterkeyhint: "search" } });
		this.clearButtonEl = container.createDiv({ cls: "search-input-clear-button" });
		this.inputEl.addEventListener("input", () => this.onChanged());
		this.clearButtonEl.addEventListener("click", () => { this.inputEl.value = ""; this.onChanged(); this.inputEl.focus(); });
	}
	setPlaceholder(text: string): this { this.inputEl.placeholder = text; return this; }
	setValue(value: string): this { this.inputEl.value = value; return this; }
	getValue(): string { return this.inputEl.value; }
	setDisabled(disabled: boolean): this { this.inputEl.disabled = disabled; return this; }
	onChange(callback: (value: string) => unknown): this { this.changeCb = callback; return this; }
	onChanged(): void { this.changeCb?.(this.inputEl.value); }
}
export class TextComponent extends Control {
	inputEl: HTMLInputElement;
	constructor(parent: HTMLElement) { const input = parent.createEl("input", { type: "text" }); super(input); this.inputEl = input; }
	setValue(value: string): this { this.inputEl.value = value; return this; }
	getValue(): string { return this.inputEl.value; }
	setPlaceholder(value: string): this { this.inputEl.placeholder = value; return this; }
	onChange(callback: (value: string) => unknown): this { this.inputEl.addEventListener("input", () => callback(this.getValue())); return this; }
}
export class ToggleComponent extends Control {
	toggleEl: HTMLElement;
	constructor(parent: HTMLElement) { const el = parent.createEl("label", { cls: "checkbox-container", attr: { tabindex: "0" } }); super(el); this.toggleEl = el; el.createEl("input", { attr: { type: "checkbox", tabindex: "-1" } }); }
	setValue(value: boolean): this { this.toggleEl.classList.toggle("is-enabled", value); (this.toggleEl.firstElementChild as HTMLInputElement).checked = value; return this; }
	getValue(): boolean { return this.toggleEl.classList.contains("is-enabled"); }
	onChange(callback: (value: boolean) => unknown): this { this.toggleEl.addEventListener("change", () => callback(this.getValue())); return this; }
}
/** As Obsidian 1.13's: the value in a `span.slider-value` before the track, in `displayFormat`. */
export class SliderComponent extends Control {
	sliderEl: HTMLInputElement; valueEl: HTMLElement;
	private displayFormat: ((value: number) => string) | null = null;
	constructor(parent: HTMLElement) {
		const valueEl = parent.createEl("span", { cls: "slider-value" });
		const input = parent.createEl("input", { cls: "slider", attr: { type: "range" } });
		super(input); this.sliderEl = input; this.valueEl = valueEl;
	}
	setLimits(min: number, max: number, step: number): this { this.sliderEl.min = String(min); this.sliderEl.max = String(max); this.sliderEl.step = String(step); this.updateDisplay(); return this; }
	setValue(value: number): this { this.sliderEl.value = String(value); this.updateDisplay(); return this; }
	setDisplayFormat(format: (value: number) => string): this { this.displayFormat = format; this.updateDisplay(); return this; }
	private updateDisplay(): void {
		const value = this.getValue(), min = Number(this.sliderEl.min || 0), max = Number(this.sliderEl.max || 100);
		this.valueEl.setText(this.displayFormat ? this.displayFormat(value) : String(value));
		this.sliderEl.style.setProperty("--slider-fill-ratio", String(max > min ? (value - min) / (max - min) : 0));
	}
	getValue(): number { return Number(this.sliderEl.value); }
	onChange(callback: (value: number) => unknown): this { this.sliderEl.addEventListener("input", () => callback(this.getValue())); return this; }
	setDynamicTooltip(): this { return this; }
	setInstant(): this { return this; }
}
export class DropdownComponent extends Control {
	selectEl: HTMLSelectElement;
	constructor(parent: HTMLElement) { const select = parent.createEl("select", { cls: "dropdown" }); super(select); this.selectEl = select; }
	addOption(value: string, label: string): this { this.selectEl.add(new Option(label, value)); return this; }
	addOptions(values: Record<string, string>): this { for (const [value, label] of Object.entries(values)) this.addOption(value, label); return this; }
	setValue(value: string): this { this.selectEl.value = value; return this; }
	getValue(): string { return this.selectEl.value; }
	onChange(callback: (value: string) => unknown): this { this.selectEl.addEventListener("change", () => callback(this.getValue())); return this; }
}

/** Anything a row can switch off with the row: its buttons, fields, toggles. */
interface RowComponent { setDisabled(disabled: boolean): unknown }

/**
 * Obsidian 1.14.4's `Setting`, in the DOM it builds (app.js `rT`): a
 * `div.setting-item` (a focus stop for the arrow keys) holding the info column
 * and the control column, an icon slot added in front on demand, and the
 * components a disabled row switches off.
 */
export class Setting {
	settingEl: HTMLElement; infoEl: HTMLElement; nameEl: HTMLElement; descEl: HTMLElement; controlEl: HTMLElement;
	iconEl: HTMLElement | null = null;
	components: RowComponent[] = [];
	disabled = false;
	private rowClick: (() => unknown) | null = null;
	constructor(parent: HTMLElement) {
		this.settingEl = parent.createDiv({ cls: "setting-item", attr: { tabindex: "-1" } });
		this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
		this.nameEl = this.infoEl.createDiv({ cls: "setting-item-name" });
		this.descEl = this.infoEl.createDiv({ cls: "setting-item-description" });
		this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
	}
	setName(text: string | DocumentFragment): this { this.nameEl.setText(text); return this; }
	setDesc(text: string | DocumentFragment): this { this.descEl.setText(text); return this; }
	setClass(cls: string): this { this.settingEl.classList.add(...cls.split(" ").filter(Boolean)); return this; }
	setHeading(): this { return this.setClass("setting-item-heading"); }
	/** The icon in front of the name; `null` empties the slot. */
	setIcon(icon: string | null): this {
		this.iconEl ??= this.settingEl.createDiv({ cls: "setting-item-icon", prepend: true });
		if (icon) setIcon(this.iconEl, icon); else this.iconEl.empty();
		return this;
	}
	/** A row that opens a page: a chevron at the end, and the whole row clickable. */
	setNavigable(callback: () => unknown): this {
		this.settingEl.classList.add("mod-navigable", "tappable");
		setIcon(this.controlEl.createDiv({ cls: "setting-item-chevron" }), "lucide-chevron-right");
		return this.setRowClick(callback);
	}
	/** A row that does something when clicked anywhere on it. */
	setAction(callback: () => unknown): this {
		this.settingEl.classList.add("mod-action", "tappable");
		return this.setRowClick(callback);
	}
	private setRowClick(callback: () => unknown): this {
		if (!this.rowClick) this.settingEl.addEventListener("click", (event) => { if (!event.defaultPrevented && !this.disabled) this.rowClick?.(); });
		this.rowClick = callback;
		return this;
	}
	/** `is-disabled` on the row, and every component switched off with it. */
	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		this.settingEl.classList.toggle("is-disabled", disabled);
		for (const component of this.components) component.setDisabled(disabled);
		return this;
	}
	/** Empty the control column for a redraw, as Obsidian does before drawing a row again. */
	clear(): this {
		this.controlEl.empty();
		this.components = [];
		this.errorEl = null;
		this.settingEl.classList.remove("is-invalid");
		return this;
	}
	/** Obsidian 1.13: the warning line under the control, and `is-invalid` on the row. */
	errorEl: HTMLElement | null = null;
	setErrorMessage(message: string | null): this {
		if (message) {
			this.errorEl ??= this.controlEl.createDiv({ cls: "setting-item-error" });
			this.errorEl.setText(message);
			this.errorEl.show();
			this.settingEl.classList.add("is-invalid");
		} else {
			this.errorEl?.hide();
			this.settingEl.classList.remove("is-invalid");
		}
		return this;
	}
	addDisplayValue(callback: (value: { setValue(text: string): unknown }) => unknown): this {
		const valueEl = this.controlEl.createDiv({ cls: "setting-item-value" });
		callback({ setValue(text: string) { valueEl.setText(text ?? ""); return this; } });
		return this;
	}
	/** A component the caller builds itself (a plugin's own picker, say). */
	addComponent(callback: (controlEl: HTMLElement) => RowComponent): this { this.components.push(callback(this.controlEl)); return this; }
	private add<T extends RowComponent>(component: T, callback: (control: T) => unknown): this { this.components.push(component); callback(component); return this; }
	addButton(callback: (control: ButtonComponent) => unknown): this { return this.add(new ButtonComponent(this.controlEl), callback); }
	addExtraButton(callback: (control: ExtraButtonComponent) => unknown): this { return this.add(new ExtraButtonComponent(this.controlEl), callback); }
	addText(callback: (control: TextComponent) => unknown): this { return this.add(new TextComponent(this.controlEl), callback); }
	/** As Obsidian's: the row is marked `mod-toggle`, which keeps it on one line on a phone. */
	addToggle(callback: (control: ToggleComponent) => unknown): this { this.add(new ToggleComponent(this.controlEl), callback); this.settingEl.classList.add("mod-toggle"); return this; }
	addSlider(callback: (control: SliderComponent) => unknown): this { return this.add(new SliderComponent(this.controlEl), callback); }
	addDropdown(callback: (control: DropdownComponent) => unknown): this { return this.add(new DropdownComponent(this.controlEl), callback); }
}

/**
 * Obsidian 1.14.4's `SettingGroup`, in the DOM it builds (app.js `oT`):
 * `div.setting-group > [heading row] + div.setting-group-search +
 * div.setting-items`. The heading row is in the box only while it has a
 * heading or a heading button; a list's Delete key and Alt+arrows work on the
 * focused row, through `settings`.
 */
export class SettingGroup {
	groupEl: HTMLElement; listEl: HTMLElement; searchContainerEl: HTMLElement;
	settings: Setting[] = [];
	private readonly headerEl: HTMLElement;
	private readonly headerNameEl: HTMLElement;
	private readonly headerControlEl: HTMLElement;
	constructor(parent: HTMLElement) {
		this.groupEl = parent.createDiv({ cls: "setting-group" });
		this.headerEl = createDiv({ cls: "setting-item setting-item-heading" });
		this.headerNameEl = this.headerEl.createDiv({ cls: "setting-item-name" });
		this.headerControlEl = this.headerEl.createDiv({ cls: "setting-item-control" });
		this.searchContainerEl = this.groupEl.createDiv({ cls: "setting-group-search", attr: { tabindex: "-1" } });
		this.listEl = this.groupEl.createDiv({ cls: "setting-items" });
	}
	/** Obsidian keeps the heading row only while there is something in it. */
	setHeading(text: string | DocumentFragment): this {
		this.headerNameEl.setText(text);
		const wanted = Boolean(typeof text === "string" ? text : text.textContent) || this.headerControlEl.childElementCount > 0;
		if (wanted && !this.headerEl.isConnected) this.groupEl.prepend(this.headerEl);
		else if (!wanted && this.headerEl.isConnected) this.headerEl.detach();
		return this;
	}
	addClass(...classes: string[]): this { this.groupEl.classList.add(...classes); return this; }
	addSetting(callback: (setting: Setting) => unknown): this { const setting = new Setting(this.listEl); this.settings.push(setting); callback(setting); return this; }
	addSearch(callback: (search: SearchComponent) => unknown): this { callback(new SearchComponent(this.searchContainerEl)); return this; }
	addExtraButton(callback: (control: ExtraButtonComponent) => unknown): this {
		if (!this.headerEl.isConnected) this.groupEl.prepend(this.headerEl);
		callback(new ExtraButtonComponent(this.headerControlEl));
		return this;
	}
	/** Delete or Backspace on a focused row calls `callback` with its place. */
	onDeleteItem(callback: (index: number) => unknown): this {
		this.listEl.addEventListener("keydown", (event) => {
			if (event.key !== "Delete" && event.key !== "Backspace") return;
			const index = this.settings.findIndex((setting) => setting.settingEl === event.target);
			if (index >= 0) { event.preventDefault(); callback(index); }
		});
		return this;
	}
	/** Alt+↑/↓ on a focused row calls `callback` with its place and the next. */
	onReorderItem(callback: (from: number, to: number) => unknown): this {
		this.listEl.addEventListener("keydown", (event) => {
			if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
			const from = this.settings.findIndex((setting) => setting.settingEl === event.target);
			const to = Math.min(Math.max(from + (event.key === "ArrowUp" ? -1 : 1), 0), this.settings.length - 1);
			if (from >= 0 && to !== from) { event.preventDefault(); callback(from, to); }
		});
		return this;
	}
	/** Focus the row at `index`, or the nearest shown one. */
	focusNearestItem(index: number): void {
		const shown = (setting: Setting | undefined) => setting && setting.settingEl.isShown();
		const after = this.settings.slice(index).find(shown);
		const before = this.settings.slice(0, index).reverse().find(shown);
		(after ?? before)?.settingEl.focus({ preventScroll: true });
	}
}

/**
 * Obsidian's menu shell, in the DOM Obsidian 1.14 builds for it
 * (`.menu > .menu-scroll > .menu-group > .menu-item`), so app.css draws it as
 * the real thing. The plugin supplies every item and action.
 */
export class MenuItem {
	el: HTMLElement; titleEl: HTMLElement; iconEl: HTMLElement;
	/** `afterClick` closes the menu once an item has run, as Obsidian's does. */
	constructor(parent: HTMLElement, private readonly afterClick: () => void) {
		this.el = parent.createDiv({ cls: "menu-item tappable" });
		this.iconEl = this.el.createDiv({ cls: "menu-item-icon" });
		this.titleEl = this.el.createDiv({ cls: "menu-item-title" });
	}
	setTitle(text: string | DocumentFragment): this { this.titleEl.setText(text); return this; }
	setIcon(icon: string): this { setIcon(this.iconEl, icon); return this; }
	setSection(section: string): this { this.el.dataset.section = section; return this; }
	setDisabled(disabled: boolean): this { this.el.classList.toggle("is-disabled", disabled); return this; }
	/** Obsidian's ✓: `mod-checked` on the item and a trailing check icon. */
	setChecked(checked: boolean): this {
		this.el.classList.toggle("mod-checked", checked);
		this.el.querySelector(".menu-item-icon.mod-checked")?.remove();
		if (checked) setIcon(this.el.createDiv({ cls: "menu-item-icon mod-checked" }), "check");
		return this;
	}
	setWarning(warning: boolean): this { this.el.classList.toggle("is-warning", warning); return this; }
	onClick(callback: (event: MouseEvent) => unknown): this {
		this.el.addEventListener("click", (event) => { callback(event); this.afterClick(); });
		return this;
	}
	setSubmenu(): Menu { return new Menu(); }
}
export class Menu {
	dom = createDiv({ cls: "menu" });
	private scrollEl = this.dom.createDiv({ cls: "menu-scroll" });
	private groupEl = this.scrollEl.createDiv({ cls: "menu-group" });
	private parentEl: HTMLElement | null = null;
	private hideCallback: (() => unknown) | null = null;
	addItem(callback: (item: MenuItem) => unknown): this { callback(new MenuItem(this.groupEl, () => this.hide())); return this; }
	addSeparator(): this {
		this.scrollEl.createDiv({ cls: "menu-separator" });
		this.groupEl = this.scrollEl.createDiv({ cls: "menu-group" });
		return this;
	}
	setUseNativeMenu(): this { return this; }
	setNoIcon(): this { this.dom.classList.add("mod-no-icon"); return this; }
	setParentElement(el: HTMLElement): this { this.parentEl = el; return this; }
	showAtPosition(position: { x: number; y: number; width?: number; overlap?: boolean; left?: boolean }): this {
		document.body.appendChild(this.dom);
		this.parentEl?.classList.add("has-active-menu");
		// Obsidian puts the menu 2px below the point it is given.
		Object.assign(this.dom.style, { position: "absolute", left: `${position.x + scrollX}px`, top: `${position.y + 2 + scrollY}px` });
		return this;
	}
	showAtMouseEvent(event: MouseEvent): this { return this.showAtPosition({ x: event.clientX, y: event.clientY }); }
	hide(): this {
		this.dom.remove();
		this.parentEl?.classList.remove("has-active-menu");
		const callback = this.hideCallback;
		this.hideCallback = null;
		callback?.();
		return this;
	}
	onHide(callback: () => unknown): void { this.hideCallback = callback; }
}

function renderInline(parent: HTMLElement, text: string): void {
	const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[\[(?:[^\]]|\](?!\]))+\]\])/g;
	let start = 0;
	for (const match of text.matchAll(pattern)) {
		parent.appendText(text.slice(start, match.index));
		const token = match[0];
		if (token.startsWith("`")) parent.createEl("code", { text: token.slice(1, -1) });
		else if (token.startsWith("**")) parent.createEl("strong", { text: token.slice(2, -2) });
		else {
			const [href, alias] = token.slice(2, -2).split("|");
			parent.createEl("a", { cls: "internal-link", text: alias ?? href, attr: { "data-href": href, href } });
		}
		start = (match.index ?? 0) + token.length;
	}
	parent.appendText(text.slice(start));
}

/**
 * The small CommonMark host needed by the editor's own three-role sample.
 * Heading and inline tokens stay as source until the production processors run;
 * block callouts receive Obsidian's documented reading-view DOM structure.
 */
/**
 * A callout's icon as Obsidian picks it: the `--callout-icon` its CSS gives the
 * callout (app.css names one per built-in type; a theme may name others),
 * else the pencil. An icon the local table lacks also falls back to the pencil.
 */
function drawCalloutIcon(callout: HTMLElement, iconEl: HTMLElement): void {
	const named = callout.isConnected ? getComputedStyle(callout).getPropertyValue("--callout-icon").trim() : "";
	try { setIcon(iconEl, named || "pencil"); } catch { setIcon(iconEl, "pencil"); }
}

export class MarkdownRenderer {
	static async render(app: any, markdown: string, el: HTMLElement, path: string, component: any): Promise<void> {
		const render = (window as any).__CS_GUIDE_MARKDOWN_RENDER__;
		if (render) { await render(app, markdown, el, path, component); return; }
		el.replaceChildren();
		const lines = markdown.split("\n");
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			if (!line.trim()) continue;
			const block = /^>\s*\[!([^\]|]+)(?:\|([^\]]*))?\]([+-]?)(?:\s+(.*))?$/.exec(line);
			if (block) {
				const callout = el.createDiv({ cls: `callout${block[3] ? " is-collapsible" : ""}${block[3] === "-" ? " is-collapsed" : ""}`, attr: { "data-callout": block[1].toLowerCase().replace(/ /g, "-"), "data-callout-metadata": block[2] ?? "", "data-callout-fold": block[3] } });
				const title = callout.createDiv({ cls: "callout-title" });
				drawCalloutIcon(callout, title.createDiv({ cls: "callout-icon" }));
				title.createDiv({ cls: "callout-title-inner", text: block[4] || block[1] });
				if (block[3]) setIcon(title.createDiv({ cls: "callout-fold" }), "chevron-down");
				const content = callout.createDiv({ cls: "callout-content" });
				const body: string[] = [];
				while (index + 1 < lines.length && /^>/.test(lines[index + 1])) body.push(lines[++index].replace(/^>\s?/, ""));
				for (const paragraph of body.join("\n").split(/\n\s*\n/)) if (paragraph.trim()) renderInline(content.createEl("p"), paragraph);
				continue;
			}
			const heading = /^(#{1,6})\s+(.*)$/.exec(line);
			if (heading) { renderInline(el.createEl(`h${heading[1].length}` as keyof HTMLElementTagNameMap), heading[2]); continue; }
			const paragraph = [line];
			while (index + 1 < lines.length && lines[index + 1].trim() && !/^(?:>|#{1,6}\s)/.test(lines[index + 1])) paragraph.push(lines[++index]);
			renderInline(el.createEl("p"), paragraph.join("\n"));
		}
		await (window as any).__CS_GUIDE_POSTPROCESS__?.(el, markdown);
	}
}
