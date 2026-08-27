/**
 * tests/support/fakeDom.ts — the smallest DOM the editor surfaces can be
 * exercised against.
 *
 * Several of the modules under test are DOM producers or DOM readers and
 * nothing else: `renderShared.buildCalloutTokenDom` builds token DOM,
 * `resolve.ts` walks up from a right-clicked element, `LinkSuggestDecorator`
 * rewrites a rendered suggestion in place, `AutoComplete.renderSuggestion`
 * paints a dropdown row, the reading-view post-processor rewrites a whole
 * rendered block, and `OutlineDecorator` watches a pane and rewrites its items.
 * Node has no DOM at all, so nothing here is *replacing* anything — this is the
 * only document that code ever sees in a test.
 *
 * It is deliberately not jsdom. Everything below is reachable from what the code
 * under test actually calls:
 *
 * - tree + attributes + classes + `dataset`, and Obsidian's own element helpers
 *   (`createDiv`/`createSpan`/`createFragment`/`appendText`/`addClass`/`empty`),
 *   which are `obsidian.d.ts` augmentations of `HTMLElement` and therefore just
 *   methods;
 * - the mutation surface the rewriters use — `splitText`, `replaceWith`,
 *   `remove`, `normalize`, sibling links, and document fragments as a staging
 *   list;
 * - `createTreeWalker` over `NodeFilter.SHOW_TEXT`, walked lazily off live
 *   parent/sibling pointers, because "mutating mid-walk derails the walker" is
 *   an invariant the post-processor is written around and a snapshot would hide;
 * - `closest` / `matches` / `querySelector`, over a selector grammar that is a
 *   comma-separated list of *compound* selectors (`tag`, `.class`, `[attr]`,
 *   `[attr="v"]`), optionally chained by the descendant combinator
 *   (`.search-input-container input`, which `hotkeyLink` uses), plus the one
 *   child production really uses: `:scope > .cls`
 *   (`OutlineDecorator.clearDecoration`), handled as a whole selector rather
 *   than as a general combinator grammar — on `FakeDocument` too, whose root is
 *   `documentElement` and not `body`;
 * - element-level `addEventListener` / `dispatchEvent` (bubbling, because
 *   `hotkeyLink` relies on it) and the handful of `HTMLInputElement` fields
 *   `hotkeyLink.findVisibleInput` reads before it will write to a search box;
 * - `window.setTimeout`, deferred exactly like `requestAnimationFrame` so a
 *   suite states when a retry fires instead of racing it;
 * - `MutationObserver` and `requestAnimationFrame`, which are the entire input
 *   to `OutlineDecorator` — both deferred until a test flushes them, so a suite
 *   states when the pane re-renders instead of racing it;
 * - `HTMLElement`, `Node`, `NodeFilter`, `MouseEvent` and `KeyboardEvent` as
 *   globals, because `instanceof`/constant reads against them are live branches
 *   in the code under test.
 *
 * Layout, measurement, real event dispatch and CSS cascade are all absent, and
 * no test may assert on them.
 */

/* -------------------------------------------------------------------------- */
/* Nodes                                                                      */
/* -------------------------------------------------------------------------- */

export const NODE_ELEMENT = 1;
export const NODE_TEXT = 3;
export const NODE_FRAGMENT = 11;

/** Sibling `delta` places from `node`, or null (used by next/previousSibling). */
function siblingOf(node: FakeNode, delta: number): FakeNode | null {
	const parent = node.parentElement;
	if (!parent) return null;
	const at = parent.childNodes.indexOf(node);
	if (at < 0) return null;
	return parent.childNodes[at + delta] ?? null;
}

/** Expand any fragment in `nodes` into its children, emptying it as it goes. */
function flattenNodes(
	nodes: ReadonlyArray<FakeNode | FakeDocumentFragment>,
): FakeNode[] {
	const flat: FakeNode[] = [];
	for (const node of nodes) {
		if (node instanceof FakeDocumentFragment) flat.push(...node.drain());
		else flat.push(node);
	}
	return flat;
}

/** Shared body of `FakeText.replaceWith` and `FakeElement.replaceWith`. */
function replaceNode(
	node: FakeNode,
	incoming: ReadonlyArray<FakeNode | FakeDocumentFragment>,
): void {
	const parent = node.parentElement;
	if (!parent) return;
	const flat = flattenNodes(incoming);
	// Detach first, then locate: one of the incoming nodes may be a child of the
	// same parent (`span.replaceWith(...span.childNodes)` is the common shape),
	// and removing it would shift the index computed before.
	for (const child of flat) child.parentElement?.removeChild(child);
	const at = parent.childNodes.indexOf(node);
	if (at < 0) return;
	parent.childNodes.splice(at, 1, ...flat);
	for (const child of flat) child.parentElement = parent;
	node.parentElement = null;
	parent.ownerDocument.recordMutation("childList", parent);
}

export class FakeText {
	readonly nodeType = NODE_TEXT;
	parentElement: FakeElement | null = null;

	private text: string;

	constructor(nodeValue: string) {
		this.text = nodeValue;
	}

	get nodeValue(): string {
		return this.text;
	}

	set nodeValue(value: string) {
		this.text = value;
		const parent = this.parentElement;
		if (parent) parent.ownerDocument.recordMutation("characterData", parent);
	}

	/**
	 * The other name every `Text` answers to. Both spellings are live in the code
	 * under test — the post-processor reads `.data` while the outline decorator
	 * reads `.nodeValue` — so they have to be one value, not two fields.
	 */
	get data(): string {
		return this.text;
	}

	set data(value: string) {
		this.nodeValue = value;
	}

	get textContent(): string {
		return this.text;
	}

	set textContent(value: string) {
		this.nodeValue = value;
	}

	get parentNode(): FakeElement | null {
		return this.parentElement;
	}

	get nextSibling(): FakeNode | null {
		return siblingOf(this, 1);
	}

	get previousSibling(): FakeNode | null {
		return siblingOf(this, -1);
	}

	get ownerDocument(): FakeDocument {
		return this.parentElement?.ownerDocument ?? sharedDocument;
	}

	/**
	 * Keep `[0, offset)` here and hand back a new node holding the rest, inserted
	 * directly after this one. An `offset` at the very end yields an empty tail
	 * node rather than nothing, exactly as the real one does — the pill splicer
	 * relies on that node existing.
	 */
	splitText(offset: number): FakeText {
		const tail = new FakeText(this.text.slice(offset));
		const parent = this.parentElement;
		const after = this.nextSibling;
		// Assigned directly rather than through the setter, so the split reports
		// one mutation instead of two.
		this.text = this.text.slice(0, offset);
		if (parent) {
			parent.insertBefore(tail, after);
			parent.ownerDocument.recordMutation("characterData", parent);
		}
		return tail;
	}

	remove(): void {
		this.parentElement?.removeChild(this);
	}

	replaceWith(...nodes: Array<FakeNode | FakeDocumentFragment>): void {
		replaceNode(this, nodes);
	}
}

export type FakeNode = FakeElement | FakeText;

/**
 * A staging list, which is all a fragment ever is here: `gradientTitleText`
 * builds its per-grapheme spans into one and hands it to `replaceWith`, which
 * splices the children in and leaves the fragment empty. Nodes parked in a
 * fragment deliberately report `parentElement === null` — the real one is not an
 * element either, and nothing under test asks.
 */
export class FakeDocumentFragment {
	readonly nodeType = NODE_FRAGMENT;
	readonly childNodes: FakeNode[] = [];

	appendChild<T extends FakeNode>(node: T): T {
		node.parentElement?.removeChild(node);
		node.parentElement = null;
		this.childNodes.push(node);
		return node;
	}

	get textContent(): string {
		return this.childNodes.map((node) => node.textContent).join("");
	}

	/** Hand over every child and empty out — what an insertion does to it. */
	drain(): FakeNode[] {
		return this.childNodes.splice(0, this.childNodes.length);
	}
}

class FakeClassList {
	private readonly names = new Set<string>();

	add(...classes: string[]): void {
		for (const cls of classes) if (cls) this.names.add(cls);
	}

	remove(...classes: string[]): void {
		for (const cls of classes) this.names.delete(cls);
	}

	contains(cls: string): boolean {
		return this.names.has(cls);
	}

	toggle(cls: string, force?: boolean): boolean {
		const on = force ?? !this.names.has(cls);
		if (on) this.names.add(cls);
		else this.names.delete(cls);
		return on;
	}

	get value(): string {
		return [...this.names].join(" ");
	}

	/** The classes in insertion order — what assertions read. */
	toArray(): string[] {
		return [...this.names];
	}
}

/** A `style` object supporting both property access and the CSSOM methods. */
type FakeStyle = Record<string, unknown> & {
	getPropertyValue(name: string): string;
	setProperty(name: string, value: string): void;
};

function createStyle(custom: Map<string, string>): FakeStyle {
	const style = {
		getPropertyValue: (name: string) => custom.get(name) ?? "",
		setProperty: (name: string, value: string) => void custom.set(name, value),
	};
	return style as FakeStyle;
}

/** `csOrig` → `data-cs-orig`, the mapping `dataset` is defined by. */
const dataAttrName = (key: string): string =>
	`data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** Options accepted by Obsidian's `createEl` / `createDiv` / `createSpan`. */
export interface ElOptions {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
	href?: string;
	type?: string;
	title?: string;
}

export class FakeElement {
	readonly nodeType = NODE_ELEMENT;
	readonly tagName: string;
	readonly classList = new FakeClassList();
	/** Custom properties behind {@link style} and {@link setCssProp}. */
	private readonly cssProps = new Map<string, string>();
	readonly style = createStyle(this.cssProps);
	readonly childNodes: FakeNode[] = [];
	parentElement: FakeElement | null = null;
	/**
	 * Plain field, not derived from the tree: suites build detached trees and say
	 * for themselves whether the thing is on screen. `OutlineDecorator` reads it
	 * to prune panes whose leaf is gone.
	 */
	isConnected = false;
	ownerDocument: FakeDocument;
	/** Set by the suites that build a `.cm-callout` widget host. */
	cmView?: unknown;

	private readonly attrs = new Map<string, string>();
	private datasetView?: Record<string, string | undefined>;

	constructor(tagName: string, ownerDocument?: FakeDocument) {
		this.tagName = tagName.toUpperCase();
		this.ownerDocument = ownerDocument ?? sharedDocument;
	}

	/* ---- attributes ---- */

	/**
	 * The whole class list as one string. A real alias of {@link classList},
	 * not a second field: `gradientTitleText` assigns `span.className` while
	 * everything else calls `addClass`, and a span whose class only exists on
	 * one of the two is invisible to the `querySelectorAll` that finds it again.
	 */
	get className(): string {
		return this.classList.value;
	}

	set className(value: string) {
		this.classList.remove(...this.classList.toArray());
		this.classList.add(...value.split(/\s+/).filter(Boolean));
	}

	setAttribute(name: string, value: string): void {
		this.attrs.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attrs.get(name) ?? null;
	}

	hasAttribute(name: string): boolean {
		return this.attrs.has(name);
	}

	removeAttribute(name: string): void {
		this.attrs.delete(name);
	}

	/**
	 * A real `dataset`: a live view over the `data-*` attributes, not a side
	 * table. `OutlineDecorator` only ever goes through `dataset`, but writing its
	 * markers somewhere `getAttribute` cannot see would be a divergence waiting
	 * to be depended on.
	 */
	get dataset(): Record<string, string | undefined> {
		this.datasetView ??= new Proxy(
			{},
			{
				get: (_target, key) =>
					typeof key === "string"
						? (this.getAttribute(dataAttrName(key)) ?? undefined)
						: undefined,
				set: (_target, key, value) => {
					if (typeof key === "string") {
						this.setAttribute(dataAttrName(key), String(value));
					}
					return true;
				},
				deleteProperty: (_target, key) => {
					if (typeof key === "string") {
						this.removeAttribute(dataAttrName(key));
					}
					return true;
				},
				has: (_target, key) =>
					typeof key === "string" && this.hasAttribute(dataAttrName(key)),
			},
		) as Record<string, string | undefined>;
		return this.datasetView;
	}

	/* ---- tree ---- */

	get children(): FakeElement[] {
		return this.childNodes.filter(
			(node): node is FakeElement => node.nodeType === NODE_ELEMENT,
		);
	}

	/**
	 * The first element child, like the real DOM. `ThemeAppearanceProbe` reaches
	 * for it to find the artwork inside `.callout-icon`, and while it was missing
	 * here an absent property answered `undefined` — so every test of that path
	 * measured "no icon" and the rung went unexercised.
	 */
	get firstElementChild(): FakeElement | null {
		return this.children[0] ?? null;
	}

	/**
	 * The last element child, and here for the same reason as its opposite: a
	 * settings section's trailing gap is spent on the assumption that its body
	 * is the last thing in its wrapper and its list the last thing in the body
	 * (`sectionTrailingGap.test.ts`), and an absent property answers `undefined`
	 * — which is neither the element a check is looking for nor the `null` it
	 * would accept, so the check either fails for the wrong reason or, compared
	 * against `null`, passes without ever having looked.
	 */
	get lastElementChild(): FakeElement | null {
		return this.children[this.children.length - 1] ?? null;
	}

	/**
	 * This element serialized, like the real DOM — its companion, and needed for
	 * the same reason: the probe records `firstElementChild.outerHTML` as the
	 * theme's artwork, so without it a rendered icon read back as no icon.
	 *
	 * Faithful enough to be evidence and no more: tag, attributes, children. It
	 * is never parsed back by anything under test.
	 */
	get outerHTML(): string {
		const tag = this.tagName.toLowerCase();
		const attrs = [...this.attrs].map(([n, v]) => ` ${n}="${v}"`).join("");
		const cls = this.classList.value;
		const classAttr = cls.length > 0 ? ` class="${cls}"` : "";
		return `<${tag}${classAttr}${attrs}>${this.innerHTML}</${tag}>`;
	}

	/** The serialized children — see {@link outerHTML}. */
	get innerHTML(): string {
		return this.childNodes
			.map((node) =>
				node.nodeType === NODE_ELEMENT ? node.outerHTML : node.nodeValue,
			)
			.join("");
	}

	/**
	 * Element children only, like the real DOM. Present because code guards on
	 * `childElementCount === 0` to detect "mounted nothing", and an absent
	 * property answers `undefined` — which is never `0`, so such a guard would
	 * silently never fire under test.
	 */
	get childElementCount(): number {
		return this.children.length;
	}

	get firstChild(): FakeNode | null {
		return this.childNodes[0] ?? null;
	}

	get lastChild(): FakeNode | null {
		return this.childNodes.at(-1) ?? null;
	}

	get parentNode(): FakeElement | null {
		return this.parentElement;
	}

	get nextSibling(): FakeNode | null {
		return siblingOf(this, 1);
	}

	get previousSibling(): FakeNode | null {
		return siblingOf(this, -1);
	}

	appendChild<T extends FakeNode>(node: T): T {
		node.parentElement?.removeChild(node);
		node.parentElement = this;
		this.childNodes.push(node);
		this.ownerDocument.recordMutation("childList", this);
		return node;
	}

	insertBefore<T extends FakeNode>(node: T, reference: FakeNode | null): T {
		node.parentElement?.removeChild(node);
		node.parentElement = this;
		const at = reference ? this.childNodes.indexOf(reference) : -1;
		if (at < 0) this.childNodes.push(node);
		else this.childNodes.splice(at, 0, node);
		this.ownerDocument.recordMutation("childList", this);
		return node;
	}

	removeChild<T extends FakeNode>(node: T): T {
		const at = this.childNodes.indexOf(node);
		if (at >= 0) this.childNodes.splice(at, 1);
		node.parentElement = null;
		if (at >= 0) this.ownerDocument.recordMutation("childList", this);
		return node;
	}

	replaceChildren(...nodes: FakeNode[]): void {
		for (const child of [...this.childNodes]) this.removeChild(child);
		for (const node of nodes) this.appendChild(node);
	}

	remove(): void {
		this.parentElement?.removeChild(this);
	}

	replaceWith(...nodes: Array<FakeNode | FakeDocumentFragment>): void {
		replaceNode(this, nodes);
	}

	detach(): void {
		this.parentElement?.removeChild(this);
	}

	/**
	 * Merge adjacent text children and drop empty ones, recursively — what
	 * `clearGradientChars` calls to put a title back to the single text node it
	 * was before the per-grapheme wrapping.
	 */
	normalize(): void {
		for (let i = this.childNodes.length - 1; i >= 0; i--) {
			const child = this.childNodes[i];
			if (!child) continue;
			if (child.nodeType === NODE_ELEMENT) {
				child.normalize();
				continue;
			}
			const text = child;
			if (text.nodeValue === "") {
				this.childNodes.splice(i, 1);
				text.parentElement = null;
				continue;
			}
			const prev = this.childNodes[i - 1];
			if (prev && prev.nodeType === NODE_TEXT) {
				prev.nodeValue += text.nodeValue;
				this.childNodes.splice(i, 1);
				text.parentElement = null;
			}
		}
	}

	contains(node: FakeNode | null): boolean {
		let current: FakeNode | null = node;
		while (current) {
			if (current === (this as FakeNode)) return true;
			current = current.parentElement;
		}
		return false;
	}

	get textContent(): string {
		return this.childNodes
			.map((node) =>
				node.nodeType === NODE_TEXT ? node.nodeValue : node.textContent,
			)
			.join("");
	}

	set textContent(value: string) {
		this.replaceChildren();
		if (value !== "") this.appendChild(new FakeText(value));
	}

	/* ---- selectors ---- */

	matches(selector: string): boolean {
		return matchesSelector(this, selector);
	}

	closest(selector: string): FakeElement | null {
		return closestFrom(this, selector);
	}

	querySelector(selector: string): FakeElement | null {
		return this.querySelectorAll(selector)[0] ?? null;
	}

	querySelectorAll(selector: string): FakeElement[] {
		// `:scope > .cls` is the one combinator production uses, and it is used
		// whole rather than as one term of a list — so it is recognized as a
		// whole selector instead of pretending to support a combinator grammar.
		const scoped = SCOPE_CHILD_RE.exec(selector.trim());
		if (scoped) {
			const compound = scoped[1] ?? "";
			return this.children.filter((child) =>
				matchesSelector(child, compound),
			);
		}
		const found: FakeElement[] = [];
		for (const child of this.children) {
			if (matchesSelector(child, selector)) found.push(child);
			found.push(...child.querySelectorAll(selector));
		}
		return found;
	}

	/* ---- Obsidian's HTMLElement augmentations ---- */

	addClass(...classes: string[]): void {
		this.classList.add(...classes);
	}

	removeClass(...classes: string[]): void {
		this.classList.remove(...classes);
	}

	/**
	 * The plural form. Obsidian ships both, and they take their arguments
	 * differently — `removeClass(...names)` is variadic, `removeClasses(names)`
	 * takes one array — which is exactly the sort of thing a stand-in gets
	 * wrong. `removeModalChrome` calls this one.
	 */
	removeClasses(classes: string[]): void {
		this.classList.remove(...classes);
	}

	/**
	 * Obsidian's array-returning `querySelectorAll`. Its whole reason to exist
	 * is that the real one returns a `NodeList`, so callers `.forEach` over the
	 * result and index into it — `applyModalChrome` detaches an old footer this
	 * way.
	 */
	findAll(selector: string): FakeElement[] {
		return this.querySelectorAll(selector);
	}

	toggleClass(classes: string | string[], value: boolean): void {
		for (const cls of Array.isArray(classes) ? classes : [classes]) {
			this.classList.toggle(cls, value);
		}
	}

	hasClass(cls: string): boolean {
		return this.classList.contains(cls);
	}

	empty(): void {
		this.replaceChildren();
	}

	setText(text: string): void {
		this.textContent = text;
	}

	appendText(text: string): void {
		this.appendChild(new FakeText(text));
	}

	createEl(tag: string, options?: ElOptions): FakeElement {
		return this.make(tag, options);
	}

	createDiv(options?: ElOptions): FakeElement {
		return this.make("div", options);
	}

	createSpan(options?: ElOptions): FakeElement {
		return this.make("span", options);
	}

	/** The shared body of the three creators above. */
	private make(tag: string, options?: ElOptions): FakeElement {
		const el = new FakeElement(tag, this.ownerDocument);
		applyElOptions(el, options);
		return this.appendChild(el);
	}

	/**
	 * Set a CSS custom property the way Obsidian sets `--font-text-size` on
	 * `<body>`: an inline declaration `getPropertyValue` reads straight back.
	 *
	 * Its own method rather than `style.setProperty` at the call site, because
	 * this is a `Map` wearing a CSSOM interface — there is no cascade here to
	 * prefer a class over, which is what that rule is really about.
	 */
	setCssProp(name: string, value: string): void {
		this.cssProps.set(name, value);
	}

	/* ---- form controls ---- */

	/**
	 * The four things `hotkeyLink.findVisibleInput` asks of a candidate input,
	 * plus the value it then writes. Plain fields rather than a separate
	 * `FakeInput` subclass: the code under test finds these through
	 * `querySelectorAll<HTMLInputElement>`, which does no narrowing at runtime,
	 * so any element it reaches has to be able to answer.
	 *
	 * `rects` defaults to 1 — laid out. There is no layout here to derive it
	 * from, and defaulting to 0 would make every input in every suite invisible,
	 * which is the wrong way round: a suite that wants a hidden input says so.
	 */
	value = "";
	disabled = false;
	readOnly = false;
	/** How many client rects {@link getClientRects} reports. 0 = not rendered. */
	rects = 1;
	/** Bumped by {@link focus} / {@link select}, which have nothing else to do. */
	focusCount = 0;
	selectCount = 0;

	focus(): void {
		this.focusCount++;
		this.ownerDocument.activeElement = this;
	}

	select(): void {
		this.selectCount++;
	}

	getClientRects(): { length: number } {
		return { length: this.rects };
	}

	/* ---- events ---- */

	private readonly listeners = new Map<string, Array<(ev: unknown) => void>>();

	addEventListener(type: string, fn: (ev: unknown) => void): void {
		const list = this.listeners.get(type) ?? [];
		list.push(fn);
		this.listeners.set(type, list);
	}

	removeEventListener(type: string, fn: (ev: unknown) => void): void {
		const list = this.listeners.get(type);
		if (!list) return;
		const at = list.indexOf(fn);
		if (at >= 0) list.splice(at, 1);
	}

	/** Fire this element's own listeners for a type. No bubbling. */
	fire(type: string, event: unknown = { type }): void {
		for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event);
	}

	/**
	 * A real dispatch: the target first, then every ancestor, when the event
	 * says it bubbles. Modelled rather than collapsed into {@link fire} because
	 * `hotkeyLink` dispatches a *bubbling* `input` at the search box precisely
	 * so the pane's own delegated listener hears it — an implementation that
	 * only fired locally would pass a test the real DOM would fail.
	 */
	dispatchEvent(event: { type: string; bubbles?: boolean }): boolean {
		this.fire(event.type, event);
		if (event.bubbles !== true) return true;
		for (
			let node = this.parentElement;
			node;
			node = node.parentElement
		) {
			node.fire(event.type, event);
		}
		return true;
	}
}

/** {@link FakeElement.closest}, as a free function — `this` is an argument. */
function closestFrom(start: FakeElement, selector: string): FakeElement | null {
	for (
		let current: FakeElement | null = start;
		current;
		current = current.parentElement
	) {
		if (matchesSelector(current, selector)) return current;
	}
	return null;
}

function applyElOptions(el: FakeElement, options?: ElOptions): void {
	if (!options) return;
	if (options.cls) {
		const classes = Array.isArray(options.cls)
			? options.cls
			: options.cls.split(/\s+/);
		el.classList.add(...classes.filter(Boolean));
	}
	if (options.text !== undefined) el.textContent = options.text;
	if (options.href !== undefined) el.setAttribute("href", options.href);
	if (options.type !== undefined) el.setAttribute("type", options.type);
	if (options.title !== undefined) el.setAttribute("title", options.title);
	for (const [name, value] of Object.entries(options.attr ?? {})) {
		el.setAttribute(name, value);
	}
}

/* -------------------------------------------------------------------------- */
/* Selector matching                                                          */
/* -------------------------------------------------------------------------- */

/** One `tag`/`.class`/`[attr]`/`[attr="value"]` piece of a compound selector. */
const SIMPLE_RE = /([.#]?[\w-]+)|(\[[^\]]+\])/g;

/** The whole-selector form `:scope > <compound>` — see querySelectorAll. */
const SCOPE_CHILD_RE = /^:scope\s*>\s*(.+)$/;

function matchesCompound(el: FakeElement, compound: string): boolean {
	const pieces = compound.trim().match(SIMPLE_RE);
	// An unparseable selector must never silently match everything.
	if (!pieces || pieces.length === 0) return false;
	for (const piece of pieces) {
		if (piece.startsWith(".")) {
			if (!el.classList.contains(piece.slice(1))) return false;
		} else if (piece.startsWith("#")) {
			if (el.getAttribute("id") !== piece.slice(1)) return false;
		} else if (piece.startsWith("[")) {
			const body = piece.slice(1, -1);
			const eq = body.indexOf("=");
			if (eq === -1) {
				if (!el.hasAttribute(body)) return false;
			} else {
				const name = body.slice(0, eq);
				const want = body.slice(eq + 1).replace(/^["']|["']$/g, "");
				if (el.getAttribute(name) !== want) return false;
			}
		} else if (el.tagName !== piece.toUpperCase()) {
			return false;
		}
	}
	return true;
}

function matchesSelector(el: FakeElement, selector: string): boolean {
	return selector.split(",").some((part) => matchesDescendantChain(el, part));
}

/**
 * One comma-separated part, which may be a chain of compounds joined by the
 * descendant combinator — `.search-input-container input`, which `hotkeyLink`
 * uses to find the settings pane's search box.
 *
 * Matched right to left: the element itself against the last compound, then
 * each preceding one against the nearest ancestor that satisfies it. Greedy is
 * correct here, and only here: "is an ancestor of" is transitive, so consuming
 * the closest match can never strand a compound that a farther one would have
 * satisfied. That stops being true the moment `>` or `~` joins the chain, which
 * is why neither is accepted — a general combinator grammar is a different
 * thing from this, and `:scope > .cls` stays handled whole in
 * {@link FakeElement.querySelectorAll}.
 *
 * Note that the ancestors are walked past the root a `querySelectorAll` was
 * called on. That is the real behaviour: a selector is matched against the
 * whole tree and only the *results* are restricted to the root's descendants.
 */
function matchesDescendantChain(el: FakeElement, part: string): boolean {
	const compounds = part.trim().split(/\s+/).filter(Boolean);
	const last = compounds.pop();
	if (last === undefined) return false;
	if (!matchesCompound(el, last)) return false;

	let pending = compounds.length - 1;
	for (
		let node = el.parentElement;
		node && pending >= 0;
		node = node.parentElement
	) {
		if (matchesCompound(node, compounds[pending] as string)) pending--;
	}
	return pending < 0;
}

/* -------------------------------------------------------------------------- */
/* Tree walker                                                                */
/* -------------------------------------------------------------------------- */

export const FILTER_ACCEPT = 1;
export const FILTER_REJECT = 2;
export const FILTER_SKIP = 3;
export const SHOW_ELEMENT = 1;
export const SHOW_TEXT = 4;

type WalkerFilter =
	| { acceptNode(node: FakeNode): number }
	| ((node: FakeNode) => number)
	| null;

/** Pre-order successor of `from`, never leaving `root`'s subtree. */
function advance(from: FakeNode, root: FakeNode): FakeNode | null {
	if (from.nodeType === NODE_ELEMENT) {
		const first = from.childNodes[0];
		if (first) return first;
	}
	// Climbing off a node whose parent chain was cut mid-walk simply ends the
	// walk — the real TreeWalker keeps going in the detached tree, and either
	// way the production code is written never to mutate while walking.
	for (let cur: FakeNode | null = from; cur && cur !== root; ) {
		const next = siblingOf(cur, 1);
		if (next) return next;
		cur = cur.parentElement;
	}
	return null;
}

/**
 * Lazy pre-order walker. Deliberately *not* a snapshot: the post-processor's
 * comments turn on "replacing nodes mid-walk derails TreeWalker", and a
 * pre-computed list would quietly make that untrue.
 */
class FakeTreeWalker {
	currentNode: FakeNode;

	constructor(
		readonly root: FakeNode,
		private readonly whatToShow: number,
		private readonly filter: WalkerFilter,
	) {
		this.currentNode = root;
	}

	nextNode(): FakeNode | null {
		let node: FakeNode | null = this.currentNode;
		for (;;) {
			node = advance(node, this.root);
			if (!node) return null;
			if (!this.shows(node)) continue;
			if (this.verdict(node) !== FILTER_ACCEPT) continue;
			this.currentNode = node;
			return node;
		}
	}

	private shows(node: FakeNode): boolean {
		const bit = node.nodeType === NODE_TEXT ? SHOW_TEXT : SHOW_ELEMENT;
		return (this.whatToShow & bit) !== 0;
	}

	private verdict(node: FakeNode): number {
		if (!this.filter) return FILTER_ACCEPT;
		return typeof this.filter === "function"
			? this.filter(node)
			: this.filter.acceptNode(node);
	}
}

/* -------------------------------------------------------------------------- */
/* Mutation observers                                                         */
/* -------------------------------------------------------------------------- */

/** The one field of a record anything under test could read. */
export interface FakeMutationRecord {
	type: "childList" | "characterData";
	target: FakeElement;
}

/**
 * A `MutationObserver` whose delivery a test decides.
 *
 * The real one delivers on a microtask, which would make every outline
 * assertion a race. Records queue here instead and are handed over by
 * {@link FakeDocument.flushMutations}, which is also what makes
 * `OutlineDecorator`'s `takeRecords()` drain observable: records the decorator
 * produced during its own pass are gone before any flush can deliver them.
 *
 * `observe`'s options are stored and not filtered on. The one caller passes
 * `childList + subtree + characterData`, so there is no combination here that
 * could tell them apart, and inventing one would be coverage for code that does
 * not exist.
 */
export class FakeMutationObserver {
	private records: FakeMutationRecord[] = [];
	private targets: FakeElement[] = [];
	options: unknown;

	constructor(
		private readonly callback: (
			records: FakeMutationRecord[],
			observer: FakeMutationObserver,
		) => void,
	) {}

	observe(target: FakeElement, options?: unknown): void {
		this.options = options;
		if (!this.targets.includes(target)) this.targets.push(target);
		target.ownerDocument.addObserver(this);
	}

	disconnect(): void {
		for (const target of this.targets) {
			target.ownerDocument.removeObserver(this);
		}
		this.targets = [];
		this.records = [];
	}

	takeRecords(): FakeMutationRecord[] {
		return this.records.splice(0, this.records.length);
	}

	/** Called by the document on every mutation; filters by observed subtree. */
	record(record: FakeMutationRecord): void {
		if (!this.targets.some((target) => target.contains(record.target))) return;
		this.records.push(record);
	}

	/** Called by the document's flush; a no-op when nothing queued up. */
	deliver(): void {
		const records = this.takeRecords();
		if (records.length === 0) return;
		this.callback(records, this);
	}
}

/* -------------------------------------------------------------------------- */
/* Window                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Just enough `window` for `requestAnimationFrame`, which is how
 * `OutlineDecorator` coalesces an observer burst into one pass. Frames are
 * queued and fired on demand for the same reason mutations are.
 */
export class FakeWindow {
	private readonly frames = new Map<number, () => void>();
	private seq = 1;

	requestAnimationFrame(fn: () => void): number {
		const id = this.seq++;
		this.frames.set(id, fn);
		return id;
	}

	cancelAnimationFrame(id: number): void {
		this.frames.delete(id);
	}

	/** Fire every frame queued *now*; frames they queue wait for the next flush. */
	flushFrames(): void {
		const due = [...this.frames.values()];
		this.frames.clear();
		for (const fn of due) fn();
	}

	pendingFrames(): number {
		return this.frames.size;
	}

	/* ---- timers ---- */

	/**
	 * Deferred exactly like the frames above, and for the same reason: a suite
	 * has to be able to say *when* the retry happens. `hotkeyLink` polls for the
	 * settings pane's search box on a 50ms timer up to twelve times, and a real
	 * timer would make the difference between "gave up" and "has not tried yet"
	 * a race.
	 *
	 * The delay is accepted and ignored — nothing here has a clock, and every
	 * caller under test uses one fixed interval, so ordering by delay would be
	 * modelling a distinction no test can observe.
	 */
	private readonly timers = new Map<number, () => void>();

	setTimeout(fn: () => void, _delayMs?: number): number {
		const id = this.seq++;
		this.timers.set(id, fn);
		return id;
	}

	clearTimeout(id: number): void {
		this.timers.delete(id);
	}

	/** Fire every timer queued *now*; timers they queue wait for the next flush. */
	flushTimers(): void {
		const due = [...this.timers.values()];
		this.timers.clear();
		for (const fn of due) fn();
	}

	pendingTimers(): number {
		return this.timers.size;
	}

	/**
	 * Drop every queued timer without running it. For a suite tearing down
	 * between cases: several of `hotkeyLink`'s tests deliberately leave a retry
	 * pending, and flushing those into the next test would have it start with a
	 * stray `Notice` and a search of the wrong DOM.
	 */
	clearTimers(): void {
		this.timers.clear();
	}
}

/* -------------------------------------------------------------------------- */
/* Document                                                                   */
/* -------------------------------------------------------------------------- */

export class FakeDocument {
	readonly body: FakeElement;
	readonly head: FakeElement;
	/**
	 * `@codemirror/view` sniffs the browser at module load with
	 * `"webkitFontSmoothing" in document.documentElement.style`, and takes that
	 * branch as soon as a `document` global exists at all — so any suite that
	 * installs this DOM *and* imports CodeMirror needs it to be there.
	 */
	readonly documentElement: FakeElement;
	/** What `container.ownerDocument.defaultView` resolves to. */
	defaultView: FakeWindow;
	/** Last element {@link FakeElement.focus} was called on. */
	activeElement: FakeElement | null = null;
	/** Every listener added through `addEventListener`, by type. */
	readonly listeners = new Map<string, Array<() => void>>();

	private readonly observers: FakeMutationObserver[] = [];

	constructor(defaultView?: FakeWindow) {
		this.defaultView = defaultView ?? new FakeWindow();
		this.documentElement = new FakeElement("html", this);
		this.body = new FakeElement("body", this);
		this.head = new FakeElement("head", this);
		this.documentElement.appendChild(this.head);
		this.documentElement.appendChild(this.body);
	}

	createElement(tag: string): FakeElement {
		return new FakeElement(tag, this);
	}

	createTextNode(text: string): FakeText {
		return new FakeText(text);
	}

	createDocumentFragment(): FakeDocumentFragment {
		return new FakeDocumentFragment();
	}

	/* ---- selectors ---- */

	/**
	 * Document-level search, which is a different root from any element's:
	 * `document.querySelectorAll` considers `documentElement` itself as well as
	 * its subtree. `hotkeyLink` reaches for `.modal.mod-settings` this way and
	 * would never find a modal appended to `<html>` if this only walked `body`.
	 */
	querySelectorAll(selector: string): FakeElement[] {
		const root = this.documentElement;
		const found = root.matches(selector) ? [root] : [];
		found.push(...root.querySelectorAll(selector));
		return found;
	}

	querySelector(selector: string): FakeElement | null {
		return this.querySelectorAll(selector)[0] ?? null;
	}

	createTreeWalker(
		root: FakeNode,
		whatToShow = SHOW_ELEMENT | SHOW_TEXT,
		filter: WalkerFilter = null,
	): FakeTreeWalker {
		return new FakeTreeWalker(root, whatToShow, filter);
	}

	/* ---- mutation observers ---- */

	addObserver(observer: FakeMutationObserver): void {
		if (!this.observers.includes(observer)) this.observers.push(observer);
	}

	removeObserver(observer: FakeMutationObserver): void {
		const at = this.observers.indexOf(observer);
		if (at >= 0) this.observers.splice(at, 1);
	}

	recordMutation(
		type: FakeMutationRecord["type"],
		target: FakeElement,
	): void {
		if (this.observers.length === 0) return;
		for (const observer of this.observers) observer.record({ type, target });
	}

	/** Hand every observer whatever it still holds (see FakeMutationObserver). */
	flushMutations(): void {
		for (const observer of [...this.observers]) observer.deliver();
	}

	/* ---- events ---- */

	addEventListener(type: string, fn: () => void): void {
		const list = this.listeners.get(type) ?? [];
		list.push(fn);
		this.listeners.set(type, list);
	}

	removeEventListener(type: string, fn: () => void): void {
		const list = this.listeners.get(type);
		if (!list) return;
		const at = list.indexOf(fn);
		if (at >= 0) list.splice(at, 1);
	}

	/** Fire every listener of a type, as a real dispatch would. */
	fire(type: string): void {
		for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
	}
}

let sharedDocument = new FakeDocument();

/* -------------------------------------------------------------------------- */
/* Installation                                                               */
/* -------------------------------------------------------------------------- */

/** Handle on the installed globals. */
export interface FakeDomHandle {
	document: FakeDocument;
	window: FakeWindow;
	/** Put `theme-dark` on `<body>`, as Obsidian does in dark mode. */
	dark(): void;
	/** Take it off again. */
	light(): void;
	/**
	 * Deliver queued mutation records, then fire the animation frames they
	 * scheduled — the two-step the outline pane's re-render really is. Repeats
	 * while either queue refills, so one call takes the pane to rest.
	 */
	settle(): void;
	/** Restore every global this replaced. */
	restore(): void;
}

/**
 * Install the fake DOM on `globalThis`.
 *
 * `createSpan`, `createDiv`, `createEl`, `createFragment`, `activeDocument` and
 * `activeWindow` are ambient globals in the Obsidian renderer; esbuild leaves
 * them as free identifiers, so seeding `globalThis` is all it takes.
 * `HTMLElement`, `Node`, `NodeFilter`, `MutationObserver`, `MouseEvent` and
 * `KeyboardEvent` are here because each is read as a value in the code under
 * test (`resolve.ts` guards on `HTMLElement`, `LinkSuggestDecorator` on
 * `Node.TEXT_NODE`, the reading post-processor on `NodeFilter.SHOW_TEXT`,
 * `OutlineDecorator` constructs a `MutationObserver`). `Event` is deliberately
 * NOT among them: Node has had a spec-compliant global since v15, so
 * `new Event("input", { bubbles: true })` — what `hotkeyLink` dispatches —
 * already behaves, and shadowing it would only invent a way to diverge.
 *
 * `node --test` runs each test *file* in its own process, so nothing installed
 * here can leak into another suite; `restore()` exists for the one suite that
 * wants to prove a module copes without a DOM at all.
 */
export function installFakeDom(): FakeDomHandle {
	const g = globalThis as Record<string, unknown>;
	const saved = { ...g };
	const keys = [
		"document",
		"activeDocument",
		"activeWindow",
		"window",
		"createEl",
		"createDiv",
		"createSpan",
		"createFragment",
		"HTMLElement",
		"Node",
		"NodeFilter",
		"MutationObserver",
		"MouseEvent",
		"KeyboardEvent",
	];

	const win = new FakeWindow();
	const doc = new FakeDocument(win);
	sharedDocument = doc;

	/**
	 * The one detached-element factory the three Obsidian globals are built on.
	 * Named apart from `createEl` on purpose: these are the *implementations*
	 * of `createDiv`/`createSpan`, so routing them through something called
	 * `createEl` would read as the mistake the lint rule is there to catch.
	 */
	const make = (tag: string, options?: ElOptions): FakeElement => {
		const el = new FakeElement(tag, doc);
		applyElOptions(el, options);
		return el;
	};

	g.document = doc;
	g.activeDocument = doc;
	g.window = win;
	g.activeWindow = win;
	g.createEl = make;
	g.createDiv = (options?: ElOptions) => make("div", options);
	g.createSpan = (options?: ElOptions) => make("span", options);
	g.createFragment = () => new FakeDocumentFragment();
	g.HTMLElement = FakeElement;
	g.Node = {
		ELEMENT_NODE: NODE_ELEMENT,
		TEXT_NODE: NODE_TEXT,
		DOCUMENT_FRAGMENT_NODE: NODE_FRAGMENT,
	};
	g.NodeFilter = {
		SHOW_ALL: -1,
		SHOW_ELEMENT,
		SHOW_TEXT,
		FILTER_ACCEPT,
		FILTER_REJECT,
		FILTER_SKIP,
	};
	g.MutationObserver = FakeMutationObserver;
	g.MouseEvent = class MouseEvent {};
	g.KeyboardEvent = class KeyboardEvent {};

	return {
		document: doc,
		window: win,
		dark: () => doc.body.classList.add("theme-dark"),
		light: () => doc.body.classList.remove("theme-dark"),
		settle(): void {
			// 32 is far above anything a real pane does; a higher count means a
			// pass is re-triggering itself, which is worth failing over.
			for (let guard = 0; guard < 32; guard++) {
				doc.flushMutations();
				if (win.pendingFrames() === 0) return;
				win.flushFrames();
			}
			throw new Error("fakeDom.settle(): the DOM never came to rest");
		},
		restore() {
			for (const key of keys) {
				if (key in saved) g[key] = saved[key];
				else delete g[key];
			}
		},
	};
}

/* -------------------------------------------------------------------------- */
/* Tree builder                                                               */
/* -------------------------------------------------------------------------- */

export interface ElementSpec {
	tag?: string;
	cls?: string | string[];
	attrs?: Record<string, string>;
	text?: string;
	children?: FakeElement[];
}

/**
 * Build one element, declaratively. Suites nest calls to describe the exact DOM
 * a right-click landed in, which is the whole input to `resolveContext`.
 */
export function el(spec: ElementSpec = {}): FakeElement {
	const node = new FakeElement(spec.tag ?? "div", sharedDocument);
	applyElOptions(node, { cls: spec.cls, attr: spec.attrs });
	if (spec.text !== undefined) node.appendText(spec.text);
	for (const child of spec.children ?? []) node.appendChild(child);
	return node;
}

/** One tag, one closing tag, or a run of text, in source order. */
const HTML_TOKEN_RE =
	/<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
const HTML_ATTR_RE = /([\w:-]+)(?:="([^"]*)")?/g;
/** Tags that never have children, so they never look for a closing tag. */
const HTML_VOID = new Set(["br", "hr", "img", "input"]);

/**
 * Parse a fragment of markup into fake elements — the input to the reading-view
 * post-processor is "whatever Obsidian's renderer already produced", and writing
 * those trees out as nested `el()` calls buries the one thing each test is
 * about.
 *
 * Grammar is exactly what those fixtures need: tags with quoted or bare
 * attributes, the void tags above, and text. No entities, no comments, no
 * implied end tags — a fixture that needs one of those is better written by
 * hand. Requires exactly one root element.
 */
export function html(markup: string): FakeElement {
	const root = new FakeElement("root", sharedDocument);
	const stack: FakeElement[] = [root];
	let at = 0;
	HTML_TOKEN_RE.lastIndex = 0;
	let match: RegExpExecArray | null;

	const top = (): FakeElement => stack[stack.length - 1] as FakeElement;
	const text = (raw: string): void => {
		if (raw !== "") top().appendText(raw);
	};

	while ((match = HTML_TOKEN_RE.exec(markup)) !== null) {
		text(markup.slice(at, match.index));
		at = match.index + match[0].length;
		const closing = match[1];
		if (closing !== undefined) {
			if (stack.length > 1) stack.pop();
			continue;
		}
		const tag = (match[2] ?? "").toLowerCase();
		const node = new FakeElement(tag, sharedDocument);
		HTML_ATTR_RE.lastIndex = 0;
		let attr: RegExpExecArray | null;
		while ((attr = HTML_ATTR_RE.exec(match[3] ?? "")) !== null) {
			const name = attr[1] ?? "";
			const value = attr[2] ?? "";
			if (name === "class") node.classList.add(...value.split(/\s+/).filter(Boolean));
			else node.setAttribute(name, value);
		}
		top().appendChild(node);
		if (!HTML_VOID.has(tag) && match[4] !== "/") stack.push(node);
	}
	text(markup.slice(at));

	const roots = root.children;
	if (roots.length !== 1 || root.childNodes.length !== 1) {
		throw new Error(`html(): expected exactly one root element in ${markup}`);
	}
	const only = roots[0] as FakeElement;
	root.removeChild(only);
	return only;
}

/** Cast helper: the code under test is typed against the real DOM. */
export const asEl = (node: FakeElement): HTMLElement =>
	node as unknown as HTMLElement;

/**
 * Installed the moment this module is evaluated, and exported as a handle.
 *
 * Import order is the guarantee: ES modules are evaluated depth-first in
 * declaration order, so a suite that lists this import **first** has the globals
 * in place before anything it is testing is even loaded. That matters for
 * `@codemirror/view`, which sniffs `document.documentElement.style` at module
 * scope — it copes with no `document` at all, but not with half of one.
 *
 * Doing it here rather than in a top-level statement is not stylistic: the
 * project's `tsconfig.json` type-checks `tests/` at `target: ES6`, where
 * top-level `await import(...)` — the other way to order this — is a compile
 * error.
 */
export const fakeDom: FakeDomHandle = installFakeDom();
