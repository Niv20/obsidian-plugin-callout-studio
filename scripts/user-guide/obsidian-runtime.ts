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
	});
	Object.assign(window, {
		createEl: (tag: string, options?: any, callback?: any) => make(null, tag, options, callback),
		createDiv: (options?: any, callback?: any) => make(null, "div", options, callback),
		createSpan: (options?: any, callback?: any) => make(null, "span", options, callback),
		createFragment: (callback?: (fragment: DocumentFragment) => void) => { const f = document.createDocumentFragment(); callback?.(f); return f; },
		activeWindow: window, activeDocument: document,
	});
}

/** Icon geometry comes from the locally installed Obsidian Lucide table. */
export function setIcon(parent: HTMLElement, id: string): void {
	const name = id.replace(/^lucide-/, "");
	const shapes = icons[name];
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
	setWarning(): this { this.buttonEl.classList.add("mod-warning"); return this; }
	onClick(callback: () => unknown): this { this.buttonEl.addEventListener("click", callback); return this; }
}
export class ExtraButtonComponent extends Control {
	extraSettingsEl: HTMLElement; buttonEl: HTMLElement;
	constructor(parent: HTMLElement) { const el = parent.createDiv({ cls: "clickable-icon extra-setting-button" }); super(el); this.extraSettingsEl = this.buttonEl = el; }
	setIcon(name: string): this { setIcon(this.el, name); return this; }
	onClick(callback: () => unknown): this { this.el.addEventListener("click", callback); return this; }
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
export class SliderComponent extends Control {
	sliderEl: HTMLInputElement;
	constructor(parent: HTMLElement) { const input = parent.createEl("input", { cls: "slider", attr: { type: "range" } }); super(input); this.sliderEl = input; }
	setLimits(min: number, max: number, step: number): this { this.sliderEl.min = String(min); this.sliderEl.max = String(max); this.sliderEl.step = String(step); return this; }
	setValue(value: number): this {
		this.sliderEl.value = String(value);
		this.sliderEl.style.setProperty("--slider-fill-ratio", String((this.getValue() - Number(this.sliderEl.min)) / (Number(this.sliderEl.max) - Number(this.sliderEl.min))));
		return this;
	}
	getValue(): number { return Number(this.sliderEl.value); }
	onChange(callback: (value: number) => unknown): this { this.sliderEl.addEventListener("input", () => callback(this.getValue())); return this; }
	setDynamicTooltip(): this { return this; }
	setInstant(): this { return this; }
	setDisplayFormat(): this { return this; }
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

export class Setting {
	settingEl: HTMLElement; infoEl: HTMLElement; nameEl: HTMLElement; descEl: HTMLElement; controlEl: HTMLElement;
	constructor(parent: HTMLElement) {
		this.settingEl = parent.createDiv({ cls: "setting-item" });
		this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
		this.nameEl = this.infoEl.createDiv({ cls: "setting-item-name" });
		this.descEl = this.infoEl.createDiv({ cls: "setting-item-description" });
		this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
	}
	setName(text: string | DocumentFragment): this { this.nameEl.setText(text); return this; }
	setDesc(text: string | DocumentFragment): this { this.descEl.setText(text); return this; }
	setClass(cls: string): this { this.settingEl.classList.add(cls); return this; }
	setHeading(): this { return this.setClass("setting-item-heading"); }
	addButton(callback: (control: ButtonComponent) => unknown): this { callback(new ButtonComponent(this.controlEl)); return this; }
	addExtraButton(callback: (control: ExtraButtonComponent) => unknown): this { callback(new ExtraButtonComponent(this.controlEl)); return this; }
	addText(callback: (control: TextComponent) => unknown): this { callback(new TextComponent(this.controlEl)); return this; }
	addToggle(callback: (control: ToggleComponent) => unknown): this { callback(new ToggleComponent(this.controlEl)); return this; }
	addSlider(callback: (control: SliderComponent) => unknown): this { callback(new SliderComponent(this.controlEl)); return this; }
	addDropdown(callback: (control: DropdownComponent) => unknown): this { callback(new DropdownComponent(this.controlEl)); return this; }
}

/** Obsidian's native menu shell; the plugin supplies every item and action. */
export class MenuItem {
	el: HTMLElement; titleEl: HTMLElement; iconEl: HTMLElement;
	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: "menu-item" });
		this.iconEl = this.el.createDiv({ cls: "menu-item-icon" });
		this.titleEl = this.el.createDiv({ cls: "menu-item-title" });
	}
	setTitle(text: string | DocumentFragment): this { this.titleEl.setText(text); return this; }
	setIcon(icon: string): this { setIcon(this.iconEl, icon); return this; }
	setSection(section: string): this { this.el.dataset.section = section; return this; }
	setDisabled(disabled: boolean): this { this.el.classList.toggle("is-disabled", disabled); return this; }
	setChecked(checked: boolean): this { this.el.classList.toggle("is-checked", checked); return this; }
	setWarning(warning: boolean): this { this.el.classList.toggle("is-warning", warning); return this; }
	onClick(callback: (event: MouseEvent) => unknown): this { this.el.addEventListener("click", callback); return this; }
	setSubmenu(): Menu { return new Menu(); }
}
export class Menu {
	dom = createDiv({ cls: "menu" });
	addItem(callback: (item: MenuItem) => unknown): this { callback(new MenuItem(this.dom)); return this; }
	addSeparator(): this { this.dom.createDiv({ cls: "menu-separator" }); return this; }
	setUseNativeMenu(): this { return this; }
	showAtPosition(position: { x: number; y: number }): this {
		document.body.appendChild(this.dom); Object.assign(this.dom.style, { position: "absolute", left: `${position.x}px`, top: `${position.y}px` }); return this;
	}
	showAtMouseEvent(event: MouseEvent): this { return this.showAtPosition({ x: event.clientX, y: event.clientY }); }
	hide(): void { this.dom.remove(); }
	onHide(): this { return this; }
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
				setIcon(title.createDiv({ cls: "callout-icon" }), "pencil");
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
