/**
 * web/static/htmlFragment.ts — HTML in, `liteDom` tree out, and back again
 * without changing a byte the renderer did not touch.
 *
 * Two callers. Digital Garden's build hands over the HTML markdown-it made of
 * a note, to be given back with its heading and inline callouts drawn
 * (`eleventy.ts`). And every build-time host parses a callout's baked icon —
 * a short `<svg>…</svg>` or an emoji — into nodes with it.
 *
 * It is not an HTML parser in the specification's sense, and does not try to
 * be: no implied end tags, no foster parenting, no namespaces. It does not
 * have to, because of one rule that makes its mistakes harmless:
 *
 * **Everything read is kept as it was written.** An element remembers its own
 * opening and closing tags, a text node its own spelling, and a comment or a
 * stray `</div>` is carried whole. Printing a tree that nobody changed
 * reproduces the input exactly, however the nesting was understood. So a
 * misreading can cost a callout that is left as text; it cannot damage the
 * page around it. `tests/webStatic.test.ts` pins that round trip on markup
 * chosen to be awkward.
 *
 * Text is decoded only as far as it can be put back: the five entities
 * markdown-it writes, and numeric ones. A text node holding any other `&` is
 * kept verbatim, and the renderer reads it as it stands.
 */
import { LiteElement, LiteOpaque, LiteText, type LiteNode } from "./liteDom";

const VOID_TAGS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr",
]);

/** Elements whose content is text up to their own end tag, whatever it holds. */
const RAW_TEXT_TAGS = new Set(["script", "style", "textarea", "title"]);

const OPEN_TAG_RE = /<([a-zA-Z][^\s>/]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const CLOSE_TAG_RE = /<\/([a-zA-Z][^\s>/]*)[^>]*>/y;
const ATTR_RE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const ENTITY_RE = /&(amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);/g;

/** The entities this file can put back; anything else is left as written. */
export function decodeEntities(text: string): string {
	return text.replace(ENTITY_RE, (whole, name: string) => {
		const named = ENTITIES[name];
		if (named !== undefined) return named;
		const code = /^#[xX]/.test(name) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
		return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
	});
}

const encodeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const encodeAttr = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function textNode(raw: string): LiteText {
	if (raw.indexOf("&") === -1) {
		const plain = new LiteText(raw);
		plain.source = raw;
		plain.sourceData = raw;
		return plain;
	}
	// An ampersand that is none of the entities above cannot be re-encoded
	// faithfully once decoded, so such a node is not decoded at all.
	if (raw.replace(ENTITY_RE, "").indexOf("&") !== -1) {
		const kept = new LiteText(raw);
		kept.verbatim = true;
		return kept;
	}
	const decoded = new LiteText(decodeEntities(raw));
	decoded.source = raw;
	decoded.sourceData = decoded.data;
	return decoded;
}

function readAttributes(el: LiteElement, source: string): void {
	ATTR_RE.lastIndex = 0;
	for (let match = ATTR_RE.exec(source); match !== null; match = ATTR_RE.exec(source)) {
		const name = match[1] ?? "";
		const raw = match[2] ?? match[3] ?? match[4];
		if (name === "" || el.attrs.has(name)) continue;
		el.attrs.set(
			name,
			raw === undefined ? { value: "" } : { value: decodeEntities(raw), raw: raw.replace(/"/g, "&quot;") },
		);
	}
}

/** Parse `html` into a detached root whose children are the fragment. */
export function parseFragment(html: string): LiteElement {
	const root = new LiteElement("#fragment");
	const stack: LiteElement[] = [root];
	const top = (): LiteElement => stack[stack.length - 1] ?? root;
	const length = html.length;
	let textFrom = 0;
	let at = 0;

	const flushText = (to: number): void => {
		if (to > textFrom) top().appendChild(textNode(html.slice(textFrom, to)));
	};
	const opaque = (from: number, to: number): void => {
		flushText(from);
		top().appendChild(new LiteOpaque(html.slice(from, to)));
		textFrom = at = to;
	};

	while (at < length) {
		const lt = html.indexOf("<", at);
		if (lt < 0) break;
		const next = html[lt + 1];

		if (next === "!" || next === "?") {
			const comment = html.startsWith("<!--", lt);
			const end = comment ? html.indexOf("-->", lt + 4) : html.indexOf(">", lt);
			opaque(lt, end < 0 ? length : end + (comment ? 3 : 1));
			continue;
		}

		if (next === "/") {
			CLOSE_TAG_RE.lastIndex = lt;
			const closing = CLOSE_TAG_RE.exec(html);
			if (!closing) {
				at = lt + 1;
				continue;
			}
			const tag = (closing[1] ?? "").toLowerCase();
			let depth = stack.length - 1;
			while (depth > 0 && stack[depth]?.tag !== tag) depth--;
			if (depth === 0) {
				// Closes nothing that is open: carried through, not interpreted.
				opaque(lt, lt + closing[0].length);
				continue;
			}
			flushText(lt);
			const closed = stack[depth];
			if (closed) closed.close = closing[0];
			stack.length = depth;
			textFrom = at = lt + closing[0].length;
			continue;
		}

		OPEN_TAG_RE.lastIndex = lt;
		const opening = OPEN_TAG_RE.exec(html);
		if (!opening) {
			// A bare `<` in text.
			at = lt + 1;
			continue;
		}
		flushText(lt);
		const el = new LiteElement(opening[1] ?? "");
		const attrSource = opening[2] ?? "";
		el.open = opening[0];
		el.close = "";
		el.selfClosing = /\/\s*$/.test(attrSource);
		readAttributes(el, el.selfClosing ? attrSource.replace(/\/\s*$/, "") : attrSource);
		top().appendChild(el);
		textFrom = at = lt + opening[0].length;

		if (el.selfClosing || VOID_TAGS.has(el.tag)) continue;
		if (RAW_TEXT_TAGS.has(el.tag)) {
			const end = html.toLowerCase().indexOf(`</${el.tag}`, at);
			const bodyEnd = end < 0 ? length : end;
			if (bodyEnd > at) {
				const body = new LiteText(html.slice(at, bodyEnd));
				body.verbatim = true;
				el.appendChild(body);
			}
			textFrom = at = bodyEnd;
			if (end >= 0) {
				CLOSE_TAG_RE.lastIndex = end;
				const closing = CLOSE_TAG_RE.exec(html);
				if (closing) {
					el.close = closing[0];
					textFrom = at = end + closing[0].length;
				}
			}
			continue;
		}
		stack.push(el);
	}

	flushText(length);
	return root;
}

function openTag(el: LiteElement): string {
	let out = `<${el.name}`;
	for (const [name, attr] of el.attrs) {
		const spelled = !el.changed.has(name) && attr.raw !== undefined ? attr.raw : encodeAttr(attr.value);
		out += spelled === "" && attr.raw === undefined && !el.changed.has(name) ? ` ${name}` : ` ${name}="${spelled}"`;
	}
	return out + (el.selfClosing ? "/>" : ">");
}

function write(node: LiteNode, out: string[]): void {
	if (node instanceof LiteText) {
		if (node.verbatim) out.push(node.data);
		else if (node.source !== null && node.data === node.sourceData) out.push(node.source);
		else out.push(encodeText(node.data));
		return;
	}
	if (node instanceof LiteOpaque) {
		out.push(node.raw);
		return;
	}
	if (!(node instanceof LiteElement)) return;
	out.push(node.open !== null && node.changed.size === 0 ? node.open : openTag(node));
	for (const child of node.children) write(child, out);
	out.push(node.close ?? `</${node.name}>`);
}

/** Print the children of `root` — the inverse of {@link parseFragment}. */
export function serializeFragment(root: LiteElement): string {
	const out: string[] = [];
	for (const child of root.children) write(child, out);
	return out.join("");
}

/** A baked icon as detached nodes — the `parseIcon` a build-time host supplies. */
export function parseIconNodes(markup: string): LiteNode[] {
	const nodes = [...parseFragment(markup).children];
	for (const node of nodes) node.remove();
	return nodes;
}
