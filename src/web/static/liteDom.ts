/**
 * web/static/liteDom.ts — the DOM the renderer gets when there is no browser.
 *
 * Quartz and Digital Garden build their pages in Node, and that is where
 * heading and inline callouts are drawn for them: the result is ordinary HTML,
 * so a feed reader, a search index and a link preview all see a callout and
 * not `[!tip]`. But `web/core.ts` is written against the DOM, and a build has
 * none. This file is one — cut down to exactly the members the core calls, and
 * not one more.
 *
 * That is a deliberate trade. A general DOM (jsdom, linkedom) would be a
 * dependency a user has to install into their site's repository; a renderer
 * written against an abstract tree would be a second renderer to keep in step
 * with reading view. A few hundred lines that implement `splitText`,
 * `closest`, `insertBefore` and friends keep the renderer single and the
 * exported file self-contained.
 *
 * What it does NOT do, so nobody reaches for it expecting more:
 *
 * - **Selectors** are a tag, classes, or both (`a.internal-link`), in a comma
 *   list. Anything else throws, so a new selector in the core fails a test
 *   here instead of silently matching nothing on someone's site.
 * - **A tree walker** yields text nodes only, from a snapshot taken when it is
 *   created. The core collects before it mutates, so it never needed more.
 * - **Nothing is parsed or printed here.** `htmlFragment.ts` turns HTML into
 *   this tree and back; `hastBridge.ts` does the same for Quartz's HAST. Both
 *   keep what they were given (`open`, `close`, `source`, `origin`) on the
 *   node, so a node the renderer never touched goes back out exactly as it
 *   came in.
 *
 * `tests/webRuntime.test.ts` runs every renderer case over this DOM as well as
 * the test suite's own, which is what keeps "exactly the members the core
 * calls" true.
 */

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
/** A comment, a doctype, a stray tag: carried through, never looked into. */
export const OPAQUE_NODE = 8;

/** One compound selector: `tag`, `.a.b`, or `tag.a`. */
interface Compound {
	tag: string | null;
	classes: string[];
}

const COMPOUND_RE = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)$/;
const parsedSelectors = new Map<string, Compound[]>();

function parseSelector(selector: string): Compound[] {
	let compounds = parsedSelectors.get(selector);
	if (compounds) return compounds;
	compounds = selector.split(",").map((part) => {
		const match = COMPOUND_RE.exec(part.trim());
		if (!match || (!match[1] && !match[2])) {
			throw new Error(`liteDom cannot match the selector "${part.trim()}"`);
		}
		return {
			tag: match[1] ? match[1].toLowerCase() : null,
			classes: match[2] ? match[2].slice(1).split(".") : [],
		};
	});
	parsedSelectors.set(selector, compounds);
	return compounds;
}

export abstract class LiteNode {
	abstract readonly nodeType: number;
	parent: LiteElement | null = null;

	get parentNode(): LiteElement | null {
		return this.parent;
	}

	get parentElement(): LiteElement | null {
		return this.parent;
	}

	get nextSibling(): LiteNode | null {
		const siblings = this.parent?.children;
		return siblings ? (siblings[siblings.indexOf(this) + 1] ?? null) : null;
	}

	get ownerDocument(): LiteDocument {
		return LITE_DOCUMENT;
	}

	abstract get textContent(): string;
	abstract cloneNode(deep?: boolean): LiteNode;

	remove(): void {
		const siblings = this.parent?.children;
		if (!siblings) return;
		siblings.splice(siblings.indexOf(this), 1);
		this.parent = null;
	}

	replaceWith(node: LiteNode): void {
		const parent = this.parent;
		if (!parent) return;
		parent.insertBefore(node, this);
		this.remove();
	}
}

export class LiteText extends LiteNode {
	readonly nodeType = TEXT_NODE;
	/**
	 * How this text was spelled where it came from, and what `data` was then.
	 * While `data` still equals `sourceData` the node is printed as `source`,
	 * so untouched text keeps its own entities.
	 */
	source: string | null = null;
	sourceData: string | null = null;
	/** `data` is already HTML (it holds entities this file does not decode). */
	verbatim = false;
	/** The HAST node this came from, handed back while the text is unchanged. */
	origin: unknown = undefined;

	constructor(public data: string) {
		super();
	}

	get textContent(): string {
		return this.data;
	}

	/** Cut the node at `offset`; the tail becomes the next sibling and is returned. */
	splitText(offset: number): LiteText {
		const tail = new LiteText(this.data.slice(offset));
		tail.verbatim = this.verbatim;
		this.data = this.data.slice(0, offset);
		const parent = this.parent;
		if (parent) parent.insertBefore(tail, this.nextSibling);
		return tail;
	}

	cloneNode(): LiteText {
		const copy = new LiteText(this.data);
		copy.source = this.source;
		copy.sourceData = this.sourceData;
		copy.verbatim = this.verbatim;
		return copy;
	}
}

export class LiteOpaque extends LiteNode {
	readonly nodeType = OPAQUE_NODE;

	/** `raw` is HTML to print as it is; `origin` a HAST node to hand back. */
	constructor(
		readonly raw: string,
		readonly origin: unknown = undefined,
	) {
		super();
	}

	get textContent(): string {
		return "";
	}

	cloneNode(): LiteOpaque {
		return new LiteOpaque(this.raw, this.origin);
	}
}

/** One attribute: its value, and how the source spelled it when it had one. */
export interface LiteAttr {
	value: string;
	raw?: string;
}

/** The slice of `DOMTokenList` the core uses. */
export interface LiteClassList {
	contains(cls: string): boolean;
	add(...classes: string[]): void;
}

export class LiteElement extends LiteNode {
	readonly nodeType = ELEMENT_NODE;
	readonly children: LiteNode[] = [];
	/** Lower-cased, for matching. `name` keeps the spelling (`linearGradient`). */
	readonly tag: string;
	readonly attrs = new Map<string, LiteAttr>();
	/** Names set since the node was read; empty means "print it as it came". */
	readonly changed = new Set<string>();
	/** The source's own tags, verbatim. `null` on an element built here. */
	open: string | null = null;
	close: string | null = null;
	selfClosing = false;
	/** The HAST element this came from. */
	origin: unknown = undefined;

	constructor(readonly name: string) {
		super();
		this.tag = name.toLowerCase();
	}

	readonly classList: LiteClassList = {
		contains: (cls) => this.classNames().includes(cls),
		add: (...classes) => {
			const names = this.classNames();
			let grew = false;
			for (const cls of classes) {
				if (names.includes(cls)) continue;
				names.push(cls);
				grew = true;
			}
			if (grew) this.setAttribute("class", names.join(" "));
		},
	};

	private classNames(): string[] {
		const value = this.attrs.get("class")?.value ?? "";
		return value.split(/\s+/).filter((cls) => cls !== "");
	}

	getAttribute(name: string): string | null {
		return this.attrs.get(name)?.value ?? null;
	}

	setAttribute(name: string, value: string): void {
		this.attrs.set(name, { value });
		this.changed.add(name);
	}

	get firstChild(): LiteNode | null {
		return this.children[0] ?? null;
	}

	get lastChild(): LiteNode | null {
		return this.children[this.children.length - 1] ?? null;
	}

	get textContent(): string {
		let text = "";
		for (const child of this.children) text += child.textContent;
		return text;
	}

	set textContent(value: string) {
		for (const child of this.children) child.parent = null;
		this.children.length = 0;
		if (value !== "") this.appendChild(new LiteText(value));
	}

	appendChild<T extends LiteNode>(node: T): T {
		return this.insertBefore(node, null);
	}

	insertBefore<T extends LiteNode>(node: T, reference: LiteNode | null): T {
		node.remove();
		const at = reference ? this.children.indexOf(reference) : -1;
		if (at < 0) this.children.push(node);
		else this.children.splice(at, 0, node);
		node.parent = this;
		return node;
	}

	matches(selector: string): boolean {
		for (const compound of parseSelector(selector)) {
			if (compound.tag !== null && compound.tag !== this.tag) continue;
			if (compound.classes.length > 0) {
				const names = this.classNames();
				if (!compound.classes.every((cls) => names.includes(cls))) continue;
			}
			return true;
		}
		return false;
	}

	closest(selector: string): LiteElement | null {
		if (this.matches(selector)) return this;
		for (let el = this.parent; el; el = el.parent) {
			if (el.matches(selector)) return el;
		}
		return null;
	}

	querySelectorAll(selector: string): LiteElement[] {
		const found: LiteElement[] = [];
		const visit = (el: LiteElement): void => {
			for (const child of el.children) {
				if (!(child instanceof LiteElement)) continue;
				if (child.matches(selector)) found.push(child);
				visit(child);
			}
		};
		visit(this);
		return found;
	}

	cloneNode(deep = false): LiteElement {
		const copy = new LiteElement(this.name);
		for (const [name, attr] of this.attrs) copy.attrs.set(name, { ...attr });
		for (const name of this.changed) copy.changed.add(name);
		copy.open = this.open;
		copy.close = this.close;
		copy.selfClosing = this.selfClosing;
		if (deep) for (const child of this.children) copy.appendChild(child.cloneNode(true));
		return copy;
	}
}

/** `createTreeWalker(root, SHOW_TEXT)`: the text nodes under `root`, in order. */
class TextWalker {
	private readonly nodes: LiteText[] = [];
	private at = 0;

	constructor(root: LiteNode) {
		const visit = (node: LiteNode): void => {
			if (node instanceof LiteText) this.nodes.push(node);
			else if (node instanceof LiteElement) for (const child of node.children) visit(child);
		};
		if (root instanceof LiteElement) for (const child of root.children) visit(child);
	}

	nextNode(): LiteText | null {
		return this.nodes[this.at++] ?? null;
	}
}

/** The slice of `Document` the core reaches through `ownerDocument`. */
export interface LiteDocument {
	createElement(name: string): LiteElement;
	createTreeWalker(root: LiteNode, whatToShow?: number): TextWalker;
}

const LITE_DOCUMENT: LiteDocument = {
	createElement: (name) => new LiteElement(name),
	createTreeWalker: (root) => new TextWalker(root),
};
