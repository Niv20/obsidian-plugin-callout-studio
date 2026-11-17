/**
 * web/core.ts — the renderer that draws heading and inline callouts outside
 * Obsidian: on a published page, or in the HTML a site generator is building.
 *
 * Obsidian Publish, Quartz and Digital Garden all render a vault without
 * running its plugins, so `## [!tip] Title` and `text [!warning] text` reach
 * the reader as literal brackets. This is the third render surface, after Live
 * Preview and reading view: it finds those tokens in finished HTML and rebuilds
 * the same DOM the plugin draws in a note.
 *
 * It is one renderer with three hosts, because the three platforms differ in
 * *where* code may run, not in what a callout looks like:
 *
 * - `web/browser.ts` runs it in the visitor's browser (Obsidian Publish);
 * - `web/static/quartz.ts` runs it inside a Quartz build, on the HAST tree;
 * - `web/static/eleventy.ts` runs it inside a Digital Garden build, on the
 *   HTML markdown-it produced.
 *
 * The two build-time hosts have no DOM, so they hand this file
 * `web/static/liteDom.ts` — a DOM cut down to exactly what is called here.
 * That is the contract to keep in mind when editing: **every DOM member used
 * in this file must exist in `liteDom`**, and `tests/webRuntime.test.ts` runs
 * the same cases over both to hold it.
 *
 * Three things follow from where it runs.
 *
 * - **Nothing here may import `obsidian`,** nor anything that does. The class
 *   names come from `editor/tokenClasses.ts` and the grammar from the same
 *   pure modules reading view uses, so the surfaces cannot drift apart; the
 *   registry and the icon painter are replaced by the snapshot in
 *   {@link WebBundleData}. A test holds the bundle to it.
 * - **There is no source line.** Reading view asks `getSectionInfo` whether a
 *   token was escaped; finished HTML has only rendered text, in which
 *   `\[!id]` and `[!id]` are the same characters. An escaped token is therefore
 *   drawn as a callout here — the one place this surface knowingly differs.
 * - **The page is not ours.** Each platform appends its own chrome to a heading
 *   (Quartz an anchor link, Publish a copy-link button) and selects it with a
 *   child combinator, so the title wrapper stops before that chrome instead of
 *   swallowing it. And a block callout the platform has not converted yet is
 *   left for the platform — see {@link isBlockCalloutLead}.
 *
 * Everything is idempotent: a second pass over a processed subtree finds no
 * token left to turn, which is what lets one `MutationObserver` cover lazy
 * rendering, single-page navigation and hover previews without bookkeeping.
 */
import {
	RENDERED_HEADING_TOKEN_RE,
	parseOutlineHeadingText,
	scanVisibleLineForCalloutTokens,
	tokenEnd,
	type LineCalloutToken,
} from "../editor/calloutTokens";
import { matchContentParts, type ContentPart } from "../editor/inlineContent";
import {
	CSS_CALLOUT_LEAD,
	CSS_CALLOUT_PAYLOAD,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_HEADING_TITLE_GAP,
	CSS_HEADING_TOKEN,
	CSS_INLINE_HAS_CONTENT,
	CSS_INLINE_TOKEN,
	CSS_TOKEN_EMPTY,
	CSS_TOKEN_ICON,
	CSS_TOKEN_NAME,
	CSS_UNKNOWN,
} from "../editor/tokenClasses";
import { calloutIdentity, calloutTokenLabel, normalizeCalloutId, splitCalloutMetadata } from "../utils/calloutId";
import type { WebBundleData, WebCalloutDef } from "./webBundleData";

const HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6";

/**
 * Where a page keeps what the author wrote. Publish renders into
 * `.markdown-rendered`, Quartz into an `<article>` (its hover previews clone
 * one), Digital Garden into `<main>`.
 *
 * Tokens are only ever turned inside one of these. A site's navigation, search
 * results and file tree show note text too, and rewriting a platform's own
 * widgets is a different promise from rendering the author's notes. A page with
 * none of them is some other generator, and gets its whole body instead.
 */
export const CONTENT_ROOT_SELECTOR = "article, main, .markdown-rendered, .markdown-preview-view";

/** A table of contents: Quartz and Digital Garden (`.toc`), Publish (`.outline-view`). */
export const TOC_SELECTOR = ".toc, .outline-view";

/** Elements whose text must never become a pill — reading view's list, plus a page's own. */
const PILL_EXCLUDE_SELECTOR = [
	"code",
	"pre",
	".math",
	"mjx-container",
	".katex",
	"script",
	"style",
	"textarea",
	`.${CSS_INLINE_TOKEN}`,
	`.${CSS_HEADING_TOKEN}`,
	".callout-title",
	"a",
	TOC_SELECTOR,
].join(", ");

/** Subtrees whose braces do not count inside a `{…}` payload — as in reading view. */
const CONTENT_OPAQUE_SELECTOR = [
	"code",
	"pre",
	".math",
	"mjx-container",
	".katex",
	"a.internal-link",
	".internal-embed",
	".image-embed",
	`.${CSS_INLINE_TOKEN}`,
].join(", ");

/** Elements that end a payload search outright — as in reading view. */
const CONTENT_STOP_SELECTOR = "br, p, div, blockquote, table, ul, ol, li";

/**
 * The tokens in one text node of a rendered page. Rendered text is its own
 * visible line — the page's renderer already resolved every code span and
 * comment — so the shared scanner is used without the Markdown lexer.
 */
const scanText = (text: string, inlineContent = true): LineCalloutToken[] =>
	scanVisibleLineForCalloutTokens(text, text, { inlineContent });

/** `Node.TEXT_NODE` / `Node.ELEMENT_NODE`, spelled out so nothing depends on the global. */
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
/** `NodeFilter.SHOW_TEXT`. */
const SHOW_TEXT = 4;

/** What one typed id resolved to. `def` is the fallback's when `unknown`. */
interface Resolved {
	def: WebCalloutDef | undefined;
	unknown: boolean;
}

/** The two passes a page needs, bound to one bundle's callouts. */
export interface WebRenderer {
	/** Turn every heading and inline token under (and including) `root`. */
	process(root: HTMLElement): void;
	/** Strip the tokens out of a table of contents' entries. */
	cleanToc(toc: HTMLElement): void;
	/**
	 * One contents entry as text, without its token: the title, or the
	 * callout's label when the heading has no title. `null` when the text does
	 * not open with a heading callout's token and must be left as it is. For a
	 * host whose contents list is data rather than elements (Quartz).
	 */
	outlineTitle(text: string): string | null;
}

/**
 * A platform's own furniture on a heading: Quartz's anchor link, Publish's
 * copy-link button, Obsidian's fold arrow. Never part of the title.
 */
function isChrome(el: Element): boolean {
	return (
		el.getAttribute("role") === "anchor" ||
		el.getAttribute("aria-hidden") === "true" ||
		el.classList.contains("clickable-icon") ||
		el.classList.contains("heading-collapse-indicator") ||
		el.classList.contains("header-anchor")
	);
}

/** The text node a heading's token would open, past any leading chrome. */
function leadingTextNode(h: Element): Text | null {
	for (let child = h.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === TEXT_NODE) {
			if ((child.textContent ?? "").trim().length > 0) return child as Text;
			continue;
		}
		if (child.nodeType === ELEMENT_NODE && isChrome(child as Element)) continue;
		return null;
	}
	return null;
}

/** True when `node` opens a heading — such a token is never an inline pill. */
function isHeadingLeadingTextNode(node: Text): boolean {
	const h = node.parentElement?.closest(HEADING_SELECTOR);
	return h ? leadingTextNode(h) === node : false;
}

/**
 * True when the token at `from` in `node` is the first thing in a
 * `<blockquote>` — which makes it a block callout's header, not an inline pill.
 *
 * Obsidian Publish and Quartz have turned `> [!tip] Title` into their own
 * callout element long before this runs, so there the question never comes up.
 * Digital Garden has not: it converts the blockquote in a later build step, by
 * looking for that very text, and a pill in its place would leave the reader
 * with a plain quotation. A site with no callout support at all keeps the
 * literal text, which is what Obsidian's own syntax means there.
 */
function isBlockCalloutLead(node: Text, from: number): boolean {
	if (node.data.slice(0, from).trim() !== "") return false;
	const quote = node.parentElement?.closest("blockquote");
	if (!quote) return false;
	const walker = quote.ownerDocument.createTreeWalker(quote, SHOW_TEXT);
	for (let first = walker.nextNode(); first !== null; first = walker.nextNode()) {
		if ((first.textContent ?? "").trim() === "") continue;
		return first === node;
	}
	return false;
}

/** The text nodes under `root` that could hold a token. */
function candidateTextNodes(root: HTMLElement): Text[] {
	const walker = root.ownerDocument.createTreeWalker(root, SHOW_TEXT);
	const found: Text[] = [];
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		if ((node.textContent ?? "").indexOf("[!") === -1) continue;
		const parent = node.parentElement;
		if (!parent || parent.closest(PILL_EXCLUDE_SELECTOR)) continue;
		found.push(node as Text);
	}
	return found;
}

/**
 * Where a `{…}` payload closes, starting at the `{` in `startNode`. Reading
 * view's `findContentEnd`, rule for rule: the closing brace must sit in a
 * direct-child text node of the opening node's parent, opaque subtrees count
 * for nothing, and a payload that would close inside nested markup is refused.
 */
function findContentEnd(startNode: Text, startOffset: number): { node: Text; offset: number } | null {
	const parts: ContentPart[] = [{ text: startNode.data }];
	const nodes: Array<Text | null> = [startNode];

	for (let cur = startNode.nextSibling; cur; cur = cur.nextSibling) {
		if (cur.nodeType === TEXT_NODE) {
			parts.push({ text: (cur as Text).data });
			nodes.push(cur as Text);
			continue;
		}
		if (cur.nodeType !== ELEMENT_NODE) continue;
		const el = cur as Element;
		if (el.matches(CONTENT_STOP_SELECTOR)) {
			parts.push({ text: "", stop: true });
			nodes.push(null);
			break;
		}
		if (el.matches(CONTENT_OPAQUE_SELECTOR)) {
			parts.push({ text: "", opaque: true });
			nodes.push(null);
			continue;
		}
		const inner = el.ownerDocument.createTreeWalker(el, SHOW_TEXT);
		for (let n = inner.nextNode(); n !== null; n = inner.nextNode()) {
			const opaque = (n.parentElement?.closest(CONTENT_OPAQUE_SELECTOR) ?? null) !== null;
			parts.push({ text: (n as Text).data, nested: true, opaque });
			nodes.push(null);
		}
	}

	const hit = matchContentParts(parts, 0, startOffset);
	const node = hit ? nodes[hit.part] : null;
	return hit && node ? { node, offset: hit.offset } : null;
}

/** What the renderer needs from wherever it is running. */
export interface WebEnv {
	/**
	 * A baked icon's markup as nodes of the host's own tree. A browser parses it
	 * with `DOMParser`, which is the default; a build has none, and supplies the
	 * fragment parser that built the rest of its tree.
	 */
	parseIcon?: (markup: string) => Node[];
}

/**
 * `DOMParser`, as the plugin's own painter uses it, rather than assigning
 * markup — an inert document first, nodes second.
 */
const parseIconInBrowser = (markup: string): Node[] =>
	Array.from(new DOMParser().parseFromString(markup, "text/html").body.childNodes);

/** Build the renderer for one bundle. */
export function createWebRenderer(data: WebBundleData, env: WebEnv = {}): WebRenderer {
	const parseIcon = env.parseIcon ?? parseIconInBrowser;
	// The registry's own three lookups, most literal first: an id, then an
	// alias, then either in its attribute form (`[!a-b]` for `a b`).
	const byId = new Map<string, WebCalloutDef>();
	const byAlias = new Map<string, WebCalloutDef>();
	const byIdentity = new Map<string, WebCalloutDef>();
	for (const def of data.defs) byId.set(def.id, def);
	for (const def of data.defs) {
		for (const alias of def.aliases ?? []) if (!byAlias.has(alias)) byAlias.set(alias, def);
	}
	for (const def of data.defs) {
		const key = calloutIdentity(def.id);
		if (!byIdentity.has(key)) byIdentity.set(key, def);
	}
	for (const def of data.defs) {
		for (const alias of def.aliases ?? []) {
			const key = calloutIdentity(alias);
			if (!byIdentity.has(key)) byIdentity.set(key, def);
		}
	}
	const fallback = data.fallback === null ? undefined : byId.get(data.fallback);

	const resolve = (rawId: string): Resolved => {
		const id = normalizeCalloutId(rawId);
		const def = byId.get(id) ?? byAlias.get(id) ?? byIdentity.get(calloutIdentity(id));
		return def ? { def, unknown: false } : { def: fallback, unknown: true };
	};

	/** `renderShared.calloutDomId`: the spelling the generated CSS selects on. */
	const domId = (rawId: string, { def, unknown }: Resolved): string => {
		const id = normalizeCalloutId(rawId);
		if (!def || unknown) return id;
		if (id === def.id || def.aliases?.includes(id)) return id;
		const typed = calloutIdentity(id);
		if (typed === calloutIdentity(def.id)) return def.id;
		return def.aliases?.find((alias) => calloutIdentity(alias) === typed) ?? def.id;
	};

	const label = (rawId: string, { def, unknown }: Resolved): string =>
		calloutTokenLabel(
			def && !unknown ? { id: def.id, displayName: def.name, aliases: def.aliases } : undefined,
			rawId,
		);

	const stamp = (el: Element, rawId: string, metadata: string, resolved: Resolved): void => {
		if (resolved.unknown) el.classList.add(CSS_UNKNOWN);
		el.setAttribute("data-callout", domId(rawId, resolved));
		if (metadata) el.setAttribute("data-callout-metadata", metadata);
	};

	/** A baked icon as nodes: parsed once per distinct drawing, cloned per token. */
	const parsedIcons = new Map<string, Node[]>();
	const iconNodes = (markup: string): Node[] => {
		let nodes = parsedIcons.get(markup);
		if (!nodes) {
			nodes = parseIcon(markup);
			parsedIcons.set(markup, nodes);
		}
		return nodes.map((node) => node.cloneNode(true));
	};

	/** The icon span, or null when the callout draws none. */
	const iconSpan = (doc: Document, def: WebCalloutDef | undefined, heading: boolean): HTMLElement | null => {
		if (def?.hideIcon === true) return null;
		const iconEl = doc.createElement("span");
		iconEl.classList.add(CSS_TOKEN_ICON);
		const markup = (heading ? (def?.headingIcon ?? def?.icon) : def?.icon) ?? "";
		if (markup) for (const node of iconNodes(markup)) iconEl.appendChild(node);
		return iconEl;
	};

	/** `renderShared.buildCalloutTokenDom`, for the two variants a page has. */
	const buildToken = (
		doc: Document,
		rawId: string,
		metadata: string,
		heading: boolean,
		showName: boolean,
	): HTMLElement => {
		const resolved = resolve(rawId);
		const root = doc.createElement("span");
		root.classList.add(heading ? CSS_HEADING_TOKEN : CSS_INLINE_TOKEN);
		stamp(root, rawId, metadata, resolved);
		const iconEl = iconSpan(doc, resolved.def, heading);
		if (iconEl) root.appendChild(iconEl);
		else if (!showName) root.classList.add(CSS_TOKEN_EMPTY);
		if (showName) {
			const nameEl = doc.createElement("span");
			nameEl.classList.add(CSS_TOKEN_NAME);
			nameEl.textContent = label(rawId, resolved);
			root.appendChild(nameEl);
		}
		return root;
	};

	/** `renderShared.buildContentPillDom`: the shell, and the element to fill. */
	const buildContentPill = (
		doc: Document,
		rawId: string,
		metadata: string,
	): { root: HTMLElement; payload: HTMLElement } => {
		const resolved = resolve(rawId);
		const root = doc.createElement("span");
		root.classList.add(CSS_INLINE_TOKEN, CSS_INLINE_HAS_CONTENT);
		stamp(root, rawId, metadata, resolved);
		const lead = doc.createElement("span");
		lead.classList.add(CSS_CALLOUT_LEAD);
		const iconEl = iconSpan(doc, resolved.def, false);
		if (iconEl) lead.appendChild(iconEl);
		else lead.classList.add(CSS_TOKEN_EMPTY);
		root.appendChild(lead);
		const payload = doc.createElement("span");
		payload.classList.add(CSS_CALLOUT_PAYLOAD);
		root.appendChild(payload);
		return { root, payload };
	};

	const transformHeading = (h: HTMLElement): void => {
		if (h.classList.contains(CSS_HEADING_LINE)) return;
		const textNode = leadingTextNode(h);
		if (!textNode) return;
		const match = RENDERED_HEADING_TOKEN_RE.exec(textNode.data);
		if (!match) return;
		const parts = splitCalloutMetadata(match[1] ?? "");
		if (!parts.id.trim()) return;

		// The title is everything after the token that the author wrote: the
		// rest of this text node and whatever follows it, up to the platform's
		// trailing chrome.
		let lastContent: Node | null = textNode.data.slice(match[0].length).trim() ? textNode : null;
		for (let cur = textNode.nextSibling; cur; cur = cur.nextSibling) {
			const written =
				cur.nodeType === TEXT_NODE
					? (cur.textContent ?? "").trim().length > 0
					: cur.nodeType === ELEMENT_NODE && !isChrome(cur as Element);
			if (written) lastContent = cur;
		}
		const hasTitle = lastContent !== null;

		const resolved = resolve(parts.id);
		h.classList.add(CSS_HEADING_LINE);
		stamp(h, parts.id, parts.metadata, resolved);

		textNode.data = textNode.data.slice(match[0].length);
		const tokenEl = buildToken(h.ownerDocument, parts.id, parts.metadata, true, !hasTitle);
		h.insertBefore(tokenEl, textNode);

		if (lastContent) {
			const titleEl = h.ownerDocument.createElement("span");
			titleEl.classList.add(CSS_HEADING_TITLE);
			// The stripped prefix took the separating space with it, so the gap
			// comes back as a margin — and only when the source had one.
			if (/[ \t]$/.test(match[0])) titleEl.classList.add(CSS_HEADING_TITLE_GAP);
			h.insertBefore(titleEl, textNode);
			for (let cur: Node | null = textNode; cur;) {
				const next: Node | null = cur === lastContent ? null : cur.nextSibling;
				titleEl.appendChild(cur);
				cur = next;
			}
		}
	};

	/** Pass A — `[!id]{payload}`: move the rendered nodes into a pill. */
	const transformContentPills = (root: HTMLElement): void => {
		for (let guard = 0; guard < 256; guard++) {
			let spliced = false;
			for (const text of candidateTextNodes(root)) {
				for (const token of scanText(text.data)) {
					if (token.role !== "inline") continue;
					if (!token.content && !token.contentOpen) continue;
					const brace = token.to;
					if (text.data[brace] !== "{") continue;
					// An empty payload has nothing to move; pass B widens over it.
					if (token.content && token.content.to === token.content.from + 2) continue;
					if (token.from === 0 && isHeadingLeadingTextNode(text)) continue;
					if (isBlockCalloutLead(text, token.from)) continue;
					const end = findContentEnd(text, brace);
					if (!end) continue;

					const sameNode = end.node === text;
					// Right to left, so the `[` offset survives the cut after `}`.
					end.node.splitText(end.offset + 1);
					const body = text.splitText(token.from);
					const firstContent = body.splitText(brace - token.from + 1);
					const lastContent: Node = sameNode ? firstContent : end.node;
					body.remove();

					const pill = buildContentPill(root.ownerDocument, token.rawId, token.metadata);
					firstContent.parentNode?.insertBefore(pill.root, firstContent);
					for (let cur: Node | null = firstContent; cur;) {
						const next: Node | null = cur === lastContent ? null : cur.nextSibling;
						pill.payload.appendChild(cur);
						cur = next;
					}
					const closer = pill.payload.lastChild;
					if (closer && closer.nodeType === TEXT_NODE) {
						const tail = closer as Text;
						if (tail.data.endsWith("}")) tail.data = tail.data.slice(0, -1);
						if (tail.data === "") tail.remove();
					}
					spliced = true;
					break;
				}
				// Moving nodes invalidates every position taken before it.
				if (spliced) break;
			}
			if (!spliced) break;
		}
	};

	/** Pass B — plain `[!id]`: replace the token text with a pill. */
	const transformInlinePills = (root: HTMLElement): void => {
		const candidates: Array<{ node: Text; from: number; to: number; rawId: string; metadata: string }> = [];
		for (const node of candidateTextNodes(root)) {
			for (const token of scanText(node.data, data.content)) {
				if (token.role !== "inline") continue;
				if (token.from === 0 && isHeadingLeadingTextNode(node)) continue;
				if (isBlockCalloutLead(node, token.from)) continue;
				if (token.contentOpen) continue;
				// A non-empty payload was pass A's; a widened plain pill would eat it.
				if (token.content && token.content.to > token.content.from + 2) continue;
				candidates.push({
					node,
					from: token.from,
					to: tokenEnd(token),
					rawId: token.rawId,
					metadata: token.metadata,
				});
			}
		}
		// In reverse, so earlier offsets in the same node stay valid.
		for (let i = candidates.length - 1; i >= 0; i--) {
			const c = candidates[i];
			if (!c) continue;
			c.node.splitText(c.to);
			const tokenPart = c.node.splitText(c.from);
			tokenPart.replaceWith(buildToken(root.ownerDocument, c.rawId, c.metadata, false, true));
		}
	};

	const process = (root: HTMLElement): void => {
		if (!data.heading && !data.inline) return;
		if ((root.textContent ?? "").indexOf("[!") === -1) return;
		if (root.closest(TOC_SELECTOR)) return;
		if (data.heading) {
			const headings: HTMLElement[] = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
			if (root.matches(HEADING_SELECTOR)) headings.unshift(root);
			for (const h of headings) transformHeading(h);
		}
		if (data.inline) {
			if (data.content) transformContentPills(root);
			transformInlinePills(root);
		}
	};

	const isKnown = (rawId: string): boolean => !resolve(rawId).unknown;

	const outlineTitle = (text: string): string | null => {
		if (!data.heading) return null;
		const lead = (/^\s*/.exec(text) ?? [""])[0].length;
		const token = parseOutlineHeadingText(text.slice(lead), isKnown);
		if (!token) return null;
		// Publish's outline drops the brackets, and `!id Title` is also what
		// a heading literally written that way shows. Only an id that names
		// a real callout is taken as one.
		if (!token.bracketed && !isKnown(token.rawId)) return null;
		const title = token.title.trim() ? token.title : label(token.rawId, resolve(token.rawId));
		return text.slice(0, lead) + title;
	};

	const cleanToc = (toc: HTMLElement): void => {
		if (!data.heading) return;
		if ((toc.textContent ?? "").indexOf("!") === -1) return;
		const walker = toc.ownerDocument.createTreeWalker(toc, SHOW_TEXT);
		const nodes: Text[] = [];
		for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) nodes.push(node as Text);
		for (const node of nodes) {
			const cleaned = outlineTitle(node.data);
			if (cleaned === null) continue;
			// Only an entry's opening text can be a heading's token.
			const entry = node.parentElement;
			if (!entry || entry.closest(`.${CSS_INLINE_TOKEN}`)) continue;
			let first: Node | null = entry.firstChild;
			while (first && first !== node && (first.textContent ?? "").trim() === "") first = first.nextSibling;
			if (first !== node) continue;
			node.data = cleaned;
		}
	};

	return { process, cleanToc, outlineTitle };
}
