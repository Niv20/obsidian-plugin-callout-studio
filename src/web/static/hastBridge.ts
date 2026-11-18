/**
 * web/static/hastBridge.ts — Quartz's HTML tree (HAST) as a `liteDom` tree, and
 * back.
 *
 * Quartz hands a transformer plugin the page as HAST: plain objects, `element`
 * / `text` / everything else, with attributes as `properties`. The renderer
 * wants a DOM. This file is the two conversions around one renderer pass.
 *
 * Going back, **a node the renderer left alone is the very object Quartz gave
 * us** (`origin`): its `position`, its `data` and any field this file has never
 * heard of survive, and a later plugin cannot tell we were here. Only what
 * changed is written — the children of an element whose content moved, and the
 * properties the renderer set, by name.
 *
 * Property names. HAST spells `class` as `className` (a list) and
 * `data-callout` as `dataCallout`; those two families and `aria-*` are
 * translated, because the renderer reads or writes them. Everything else keeps
 * the name it has. For an icon's markup that means SVG attributes go out as
 * written (`viewBox`, `stroke-width`), which HAST's own lookups accept in
 * either spelling.
 */
import { decodeEntities } from "./htmlFragment";
import { LiteElement, LiteOpaque, LiteText, type LiteNode } from "./liteDom";

/** As much of a HAST node as this file reads. */
export interface HastNode {
	type: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
	value?: string;
}

const attrName = (property: string): string => {
	if (property === "className") return "class";
	if (property === "htmlFor") return "for";
	if (/^(?:data|aria)[A-Z]/.test(property)) return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
	return property;
};

const propertyName = (attr: string): string => {
	if (attr === "class") return "className";
	if (attr.startsWith("data-")) return attr.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
	return attr;
};

const propertyValue = (attr: string, value: string): unknown =>
	attr === "class" ? value.split(/\s+/).filter((cls) => cls !== "") : value;

/**
 * A HAST property as attribute text, or null for none. HAST holds strings,
 * numbers, booleans and lists of the first two; anything else (absent, `false`
 * or a kind HAST has no attribute for) reads as no attribute. Reading is all
 * that happens to it: `write` puts back only what the renderer set, so the
 * page keeps it as it was.
 */
function attrValue(value: unknown): string | null {
	if (Array.isArray(value)) return value.map(String).join(" ");
	if (typeof value === "string") return value;
	if (typeof value === "number" || value === true) return String(value);
	return null;
}

function read(node: HastNode): LiteNode {
	if (node.type === "text") {
		const text = new LiteText(node.value ?? "");
		text.sourceData = text.data;
		text.origin = node;
		return text;
	}
	if (node.type !== "element" || typeof node.tagName !== "string") return new LiteOpaque("", node);
	const el = new LiteElement(node.tagName);
	el.origin = node;
	for (const [property, raw] of Object.entries(node.properties ?? {})) {
		const value = attrValue(raw);
		if (value !== null) el.attrs.set(attrName(property), { value });
	}
	for (const child of node.children ?? []) el.appendChild(read(child));
	return el;
}

/** The whole tree, under a root that stands for Quartz's `root` node. */
export function fromHast(tree: HastNode): LiteElement {
	const root = new LiteElement("#root");
	for (const child of tree.children ?? []) root.appendChild(read(child));
	return root;
}

function write(node: LiteNode): HastNode {
	if (node instanceof LiteText) {
		const origin = node.origin as HastNode | undefined;
		if (origin && node.data === node.sourceData) return origin;
		// A baked icon's text arrives through the fragment parser, which keeps
		// an unusual entity undecoded; HAST text is never encoded.
		return { type: "text", value: node.verbatim ? decodeEntities(node.data) : node.data };
	}
	if (node instanceof LiteOpaque) return (node.origin as HastNode | undefined) ?? { type: "text", value: "" };
	const el = node as LiteElement;
	const children = el.children.map(write);
	const origin = el.origin as HastNode | undefined;
	if (!origin) {
		const properties: Record<string, unknown> = {};
		for (const [name, attr] of el.attrs) properties[propertyName(name)] = propertyValue(name, attr.value);
		return { type: "element", tagName: el.name, properties, children };
	}
	origin.children = children;
	if (el.changed.size > 0) {
		const properties = (origin.properties ??= {});
		for (const name of el.changed) {
			const attr = el.attrs.get(name);
			if (attr) properties[propertyName(name)] = propertyValue(name, attr.value);
		}
	}
	return origin;
}

/** Write `root`'s children back as the children of Quartz's tree. */
export function toHast(root: LiteElement, tree: HastNode): void {
	tree.children = root.children.map(write);
}

/** True when some text under `tree` contains `needle` — the cheap way out. */
export function hastHasText(tree: HastNode, needle: string): boolean {
	if (tree.type === "text") return (tree.value ?? "").indexOf(needle) !== -1;
	for (const child of tree.children ?? []) if (hastHasText(child, needle)) return true;
	return false;
}
