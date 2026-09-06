/**
 * reading/calloutPostProcessor.ts — Reading-view rendering for the heading
 * and inline callout roles.
 *
 * Registered as a markdown post-processor (main.ts). Runs once per rendered
 * block with cheap bail-outs, so the per-keystroke cost in reading view is
 * negligible:
 *   1. both roles disabled → return
 *   2. block text contains no `[!` → return
 *
 * Heading blocks (`# [!id] title`) are restyled IN PLACE — the hN element is
 * kept (outline, TOC and anchor links keep working) and gains the bar class,
 * while the `[!id]±` prefix text is swapped for the shared token DOM.
 *
 * Inline `[!id]` occurrences in any other text are replaced with pill spans.
 *
 * Internal links referencing a heading callout (wikilinks and TOC-plugin
 * output) get their display text cleaned — see transformHeadingRefLinks.
 *
 * Escapes: markdown rendering consumes the `\` of `\[!id]`, so the rendered
 * text looks identical to a real token. The block's SOURCE (via
 * ctx.getSectionInfo) is consulted lazily — and the full escape-pairing pass
 * runs only when the source actually contains `\[!`.
 */
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PluginSettings } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import {
	RENDERED_HEADING_TOKEN_RE,
	parseHeadingRefDisplayText,
	scanLineForCalloutTokens,
	tokenEnd,
} from "../editor/calloutTokens";
import { splitCalloutMetadata } from "../utils/calloutId";
import {
	matchContentParts,
	type ContentPart,
} from "../editor/inlineContent";
import {
	CSS_ANIM_IN,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_HEADING_TITLE_GAP,
	CSS_HEADING_TOKEN,
	CSS_INLINE_TOKEN,
	CSS_REF_TOKEN_LINK,
	CSS_TOKEN_NAME,
	CSS_UNKNOWN,
	buildCalloutTokenDom,
	buildContentPillDom,
	isStartupEntranceActive,
	calloutDomId,
	resolveCalloutDef,
	shouldRenderToken,
} from "../editor/renderShared";
import { applyTitleGradient } from "./gradientTitleText";
import { createInlineEscapePlan, type InlineEscapePlan } from "./inlineEscapePlan";

/** Narrow structural host type (avoids importing the concrete plugin class). */
export interface ReadingRenderHost {
	registry: CalloutRegistry;
	settings: PluginSettings;
}

/**
 * Subtrees whose braces do not count while matching a `{…}` payload.
 *
 * This list is a parity contract with Live Preview, which counts braces on
 * `blankInlineMath(stripWikilinks(stripInlineCode(line)))` — so exactly the
 * constructs blanked there must be skipped here, or the two surfaces close a
 * payload at different places. In particular `a.internal-link` is opaque
 * because `stripWikilinks` blanks the whole `[[…]]`, while a plain
 * `[a}b](url)` renders as `a.external-link` and is deliberately NOT opaque —
 * Live Preview counts that `}` too.
 */
const CONTENT_OPAQUE_SELECTOR = [
	"code",
	"pre",
	".math",
	"a.internal-link",
	".internal-embed",
	".image-embed",
	`.${CSS_INLINE_TOKEN}`,
].join(", ");

/**
 * Elements that end the search outright. A `<br>` is a soft line break, and
 * Live Preview scans one line at a time — so a payload could never span one
 * there. The block-level entries are belt and braces for embeds that render
 * something structural inside a paragraph.
 */
const CONTENT_STOP_SELECTOR = "br, p, div, blockquote, table, ul, ol, li";

/** Elements whose text must never be turned into pills. */
const PILL_EXCLUDE_SELECTOR = [
	"code",
	"pre",
	".math",
	`.${CSS_INLINE_TOKEN}`,
	`.${CSS_HEADING_TOKEN}`,
	// Regular-callout titles: Live Preview cannot decorate inside Obsidian's
	// native callout widget title, so reading view skips them too for parity.
	".callout-title",
	"a",
].join(", ");

export function createCalloutReadingPostProcessor(
	host: ReadingRenderHost,
): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
	return (el, ctx) => {
		const headingEnabled = host.settings.headingCallouts.enabled;
		const inlineEnabled = host.settings.inlineCallouts.enabled;
		if (!headingEnabled && !inlineEnabled) return;
		if ((el.textContent ?? "").indexOf("[!") === -1) return;

		// Lazy section source: fetched at most once per block, and only when
		// a candidate match makes it necessary.
		let sectionLines: string[] | null | undefined;
		const getSectionLines = (): string[] | null => {
			if (sectionLines !== undefined) return sectionLines;
			const info = ctx.getSectionInfo(el);
			sectionLines = info
				? info.text
						.split("\n")
						.slice(info.lineStart, info.lineEnd + 1)
				: null;
			return sectionLines;
		};

		// Both heading passes answer to the one setting, so one branch carries
		// them — a second `if (headingEnabled)` reads as a second condition.
		if (headingEnabled) {
			const headings =
				el.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
			// Source lines are only authoritative when el is a single
			// reading-view block (one heading). A multi-heading el is the
			// print/PDF-export path, where getSectionInfo is null anyway —
			// trust the rendered text there.
			const linesGetter =
				headings.length === 1 ? getSectionLines : () => null;
			for (const h of Array.from(headings)) {
				transformHeading(h, host, linesGetter);
			}
			transformHeadingRefLinks(el, host);
		}
		if (inlineEnabled) {
			// Content pills first: they absorb whole runs of already-rendered
			// nodes, and PILL_EXCLUDE_SELECTOR then keeps the plain-pill pass
			// out of everything they swallowed.
			const escapes = createInlineEscapePlan(el, getSectionLines, PILL_EXCLUDE_SELECTOR, isHeadingLeadingTextNode);
			if (host.settings.inlineCallouts.allowContent) transformContentPills(el, host, escapes);
			transformInlinePills(el, host, escapes);
		}
	};
}

/** First non-empty text node directly usable for the heading token match. */
function findLeadingTextNode(h: HTMLElement): Text | null {
	for (const child of Array.from(h.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			if ((child.textContent ?? "").trim().length > 0)
				return child as Text;
			continue;
		}
		// Skip Obsidian's heading collapse indicator (and similar chrome)
		// that precedes the heading text when "Fold heading" is enabled.
		if (
			child.nodeType === Node.ELEMENT_NODE &&
			(child as Element).classList.contains(
				"heading-collapse-indicator",
			)
		) {
			continue;
		}
		// Any other element before the text means the heading does not start
		// with a plain `[!id]` token.
		return null;
	}
	return null;
}

/**
 * Restyle `# [!id] title` headings in place. The block's first source line
 * is authoritative when available: it rejects escaped tokens (`# \[!id]`),
 * heading-like lines inside callouts (`> # [!id]` — those are inline callouts),
 * and link syntax (`# [!id](url)`).
 */
function transformHeading(
	h: HTMLElement,
	host: ReadingRenderHost,
	getSectionLines: () => string[] | null,
): void {
	const textNode = findLeadingTextNode(h);
	if (!textNode) return;
	const renderedMatch = RENDERED_HEADING_TOKEN_RE.exec(
		textNode.textContent ?? "",
	);
	if (!renderedMatch) return;

	let rawId: string;
	let metadata: string;
	let hasTitle: boolean;
	const lines = getSectionLines();
	if (lines) {
		const headToken = scanLineForCalloutTokens(lines[0] ?? "").find(
			(t) => t.role === "heading",
		);
		if (!headToken) return; // escaped / link / not a heading-callout block
		rawId = headToken.rawId;
		metadata = headToken.metadata;
		hasTitle = headToken.hasTitle;
	} else {
		// No source info (embeds, some export paths): trust the rendered text.
		const parts = splitCalloutMetadata(renderedMatch[1] ?? "");
		rawId = parts.id;
		metadata = parts.metadata;
		hasTitle =
			(textNode.textContent ?? "").length > renderedMatch[0].length ||
			textNode.nextSibling !== null;
		if (!rawId.trim()) return;
	}

	const resolved = resolveCalloutDef(host.registry, rawId);
	// The theme owns this callout: leave the heading exactly as Obsidian
	// rendered it, `[!id]` prefix and all. Before the first classList.add, so
	// nothing of ours reaches the element.
	if (!shouldRenderToken(resolved)) return;
	const { def, unknown } = resolved;
	h.classList.add(CSS_HEADING_LINE);
	if (unknown) h.classList.add(CSS_UNKNOWN);
	// This hN is created fresh with the bar class, so the Live Preview
	// background-color transition can't fire on it — animate via keyframe
	// instead, but only during the startup entrance window.
	if (isStartupEntranceActive()) h.classList.add(CSS_ANIM_IN);
	h.setAttribute("data-callout", calloutDomId(rawId, resolved));
	// Mirrors what Obsidian stamps on a block callout, so a theme can hook
	// this role the same way. Omitted when absent — an empty attribute matches.
	if (metadata) h.setAttribute("data-callout-metadata", metadata);

	// Strip the `[!id] ` prefix from the rendered text and put the token
	// DOM (icon + optional name) in its place.
	textNode.textContent = (textNode.textContent ?? "").slice(
		renderedMatch[0].length,
	);
	const tokenEl = buildCalloutTokenDom({
		rawId,
		metadata,
		registry: host.registry,
		variant: "heading",
		showName: !hasTitle,
	});
	h.insertBefore(tokenEl, textNode);

	// Give the title its own inline box, hugging the words, so a gradient
	// title sweep can end on the last letter instead of at the far edge of the
	// full-width bar (see CSS_HEADING_TITLE). Everything trailing the token is
	// the title — inline markup included. Obsidian's native collapse indicator
	// is prepended to the hN, so it stays ahead of the token either way.
	if (hasTitle) {
		const titleEl = createSpan();
		titleEl.classList.add(CSS_HEADING_TITLE);
		// The stripped prefix ends in the separating space only when the source
		// had one; a title starting right at `]` gets no gap (CSS_HEADING_TITLE_GAP).
		if (/[ \t]$/.test(renderedMatch[0])) {
			titleEl.classList.add(CSS_HEADING_TITLE_GAP);
		}
		h.insertBefore(titleEl, tokenEl.nextSibling);
		while (titleEl.nextSibling) titleEl.appendChild(titleEl.nextSibling);
	}

	// PDF export: bake the swept title's per-grapheme fallback colors now,
	// while these nodes exist. This post-processor is registered AFTER the
	// one that runs CSSInjector.paintIcons, so paintIcons already swept the
	// container before the heading token/title were built — it never sees
	// them during export. (Regular-callout titles are Obsidian's own DOM,
	// present when paintIcons runs, and are handled there instead.) On screen
	// the sweep is pure CSS and these spans stay inert. See gradientTitleText.
	if (def && !unknown && def.bgGradient?.textGradient) {
		const swept = hasTitle
			? h.querySelector<HTMLElement>(`.${CSS_HEADING_TITLE}`)
			: tokenEl.querySelector<HTMLElement>(`.${CSS_TOKEN_NAME}`);
		if (swept) applyTitleGradient(swept, def);
	}
}

/**
 * Handle heading-callout references in rendered internal links. Two jobs:
 *
 * 1. Navigation repair (always runs): a title-less `[[#[!id]]]` ends in a
 *    `]]]` run that Obsidian's link parser cuts at the first `]]`, leaving the
 *    anchor target truncated to `#[!id` (missing the token's `]`) — which no
 *    longer resolves the `#[!id]` heading. The closing `]` is restored on
 *    `data-href`/`href` so a plain click anywhere on the link jumps to the
 *    target, matching Live Preview's HeadingRefLinkWidget navigation.
 * 2. Display cleaning (only when refCleanTitles is on): strip the `[!id]`
 *    token from the display text and (optionally) put the callout's colored
 *    icon in its place. Covers plain wikilinks (`[[#[!id] Title]]` displays
 *    `#[!id] Title`) and links generated by TOC plugins, whose alias is the
 *    bare heading text (`[!id] Title`) — TOC code blocks render through
 *    MarkdownRenderer, which runs this post-processor in both preview modes.
 *
 * For non-truncated references the href/data-href is left untouched. Aliased
 * links never match (their display text carries no token). Links inside a
 * native callout's title are skipped for parity with Live Preview, which
 * leaves whole `> [!id]` lines to Obsidian.
 */
function transformHeadingRefLinks(
	el: HTMLElement,
	host: ReadingRenderHost,
): void {
	const anchors = el.querySelectorAll<HTMLAnchorElement>("a.internal-link");
	if (anchors.length === 0) return;
	const doc = el.ownerDocument;
	for (const anchor of Array.from(anchors)) {
		const href =
			anchor.getAttribute("data-href") ??
			anchor.getAttribute("href") ??
			"";
		if (!href.includes("#")) continue;
		if (anchor.closest(".callout-title")) continue;
		const textNode = anchor.firstChild;
		if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;
		const token = parseHeadingRefDisplayText(textNode.nodeValue ?? "");
		if (!token) continue;

		// Navigation repair — always, independent of the cosmetic cleaning
		// below. A truncated token means Obsidian cut the link at the first
		// `]]` of the `]]]` run, so the anchor target lost the token's closing
		// `]` (e.g. `#[!example`). Restore it so native reading-view
		// navigation resolves the full `#[!example]` heading. Matching the
		// truncated tail keeps this precise and idempotent (once repaired the
		// value ends in `]` and no longer matches).
		if (token.truncated) {
			// `rawContent`, not `rawId`: this has to match the raw link text
			// character for character, so any `|metadata` must stay in.
			const suffix = `[!${token.rawContent}`;
			for (const attr of ["data-href", "href"] as const) {
				const val = anchor.getAttribute(attr);
				if (val !== null && val.endsWith(suffix)) {
					anchor.setAttribute(attr, `${val}]`);
				}
			}
		}

		// Everything below only changes how the link reads; skip it when the
		// user turned title-cleaning off — navigation is already fixed.
		if (!host.settings.headingCallouts.refCleanTitles) continue;

		const refResolved = resolveCalloutDef(host.registry, token.rawId);
		// Theme-owned: the link keeps the raw `[!id]` text it already shows.
		if (!shouldRenderToken(refResolved)) continue;
		const { def, unknown } = refResolved;
		const title =
			token.title.trim() !== ""
				? token.title
				: unknown || !def
					? token.rawId.trim()
					: def.displayName;

		// A bare same-file `#` prefix is dropped (matching Live Preview);
		// `Note#`/`Note > ` prefixes stay. Then icon, then the cleaned
		// title — the icon sits exactly where the token was.
		textNode.nodeValue = token.prefix === "#" ? "" : token.prefix;
		const after = textNode.nextSibling;
		if (host.settings.headingCallouts.refShowIcon && def) {
			const iconEl = buildCalloutTokenDom({
				rawId: token.rawId,
				registry: host.registry,
				variant: "ref",
				showName: false,
			});
			// Inside the anchor — continue the link underline under the icon.
			iconEl.classList.add(CSS_REF_TOKEN_LINK);
			anchor.insertBefore(iconEl, after);
		}
		anchor.insertBefore(doc.createTextNode(title), after);

		// The truncated token left its own `]` as stray text right after the
		// anchor — swallow that one bracket now that the display is cleaned.
		if (token.truncated) {
			const stray = anchor.nextSibling;
			if (
				stray &&
				stray.nodeType === Node.TEXT_NODE &&
				(stray.nodeValue ?? "").startsWith("]")
			) {
				const rest = (stray.nodeValue ?? "").slice(1);
				if (rest === "") stray.remove();
				else stray.nodeValue = rest;
			}
		}
	}
}

/**
 * True when `node` is the leading text node of a heading element. A token
 * starting there is heading-role by definition (it followed `#…` in source)
 * and must never degrade into an inline callout — even when transformHeading
 * skipped the heading (export DOM shapes, unexpected chrome before the text).
 * After a successful heading transform the token DOM element precedes the
 * remaining title text, so findLeadingTextNode returns null and genuine
 * inline tokens inside the title are unaffected.
 *
 * **Its callers must never condition it on `headingCallouts.enabled`.** The
 * role being off is precisely the case the guard exists for: Live Preview
 * `continue`s on `role === "heading"` and leaves the raw `[!id]` standing, so a
 * reading view that pilled it instead would make the same note read two
 * different ways. Switching the role off must stop the *bar*, not swap it for a
 * pill.
 */
function isHeadingLeadingTextNode(node: Text): boolean {
	const h = node.parentElement?.closest<HTMLElement>("h1,h2,h3,h4,h5,h6");
	if (!h) return false;
	return findLeadingTextNode(h) === node;
}

/** Where a `{…}` payload closes: the text node holding `}`, and its offset. */
interface ContentEnd {
	node: Text;
	/** Offset of the closing `}` within that node. */
	offset: number;
}

/**
 * Find where an inline callout's `{…}` payload closes, starting at the `{` in
 * `startNode`.
 *
 * Text-node splitting alone cannot do this: by the time this post-processor
 * runs, `[!warning]{a **b** c}` has already been rendered into three siblings —
 * `"…[!warning]{a "`, `<strong>b</strong>`, `" c}"` — so the closing brace is
 * simply not in the node the payload opened in. The walk therefore advances
 * over following siblings, counting depth.
 *
 * It is deliberately strict about shape, and returns null rather than guess:
 *
 * - The search never leaves the opening node's parent, and the closing `}` must
 *   be in a DIRECT child text node of that parent. Braces inside a nested
 *   element still *count* (Live Preview counts them), but a payload that would
 *   close inside one is interleaved markup — `**[!a]{bold** text}` — and stays
 *   literal text instead of being torn apart.
 * - Opaque subtrees contribute nothing, and stop elements abort (see the two
 *   selectors above).
 */
function findContentEnd(startNode: Text, startOffset: number): ContentEnd | null {
	if (!startNode.parentNode) return null;

	// Flatten the sibling run into segments the pure matcher understands, and
	// keep the Text node behind each closable segment so a hit can be mapped
	// back to the DOM. Only direct-child text nodes are closable: a payload
	// ending inside a nested element is interleaved markup we refuse to wrap.
	const parts: ContentPart[] = [{ text: startNode.data }];
	const nodes: Array<Text | null> = [startNode];

	for (let cur = startNode.nextSibling; cur; cur = cur.nextSibling) {
		if (cur.nodeType === Node.TEXT_NODE) {
			parts.push({ text: (cur as Text).data });
			nodes.push(cur as Text);
			continue;
		}
		if (cur.nodeType !== Node.ELEMENT_NODE) continue;
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
		// Nested inline markup (bold, italic, external links, …): its braces
		// count, but closing inside it refuses the match.
		const inner = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		for (let n = inner.nextNode(); n !== null; n = inner.nextNode()) {
			const opaque =
				(n.parentElement as Element | null)?.closest(
					CONTENT_OPAQUE_SELECTOR,
				) !== null;
			parts.push({ text: (n as Text).data, nested: true, opaque });
			nodes.push(null);
		}
	}

	const hit = matchContentParts(parts, 0, startOffset);
	const node = hit ? nodes[hit.part] : null;
	return node ? { node, offset: hit!.offset } : null;
}

/**
 * Turn one matched payload into a pill: split the text nodes at the `[` and the
 * `}`, insert the pill shell, and MOVE every node between the two into it.
 *
 * Moving rather than re-rendering is the point — `<strong>`, `<code>` and
 * `<a>` produced by Obsidian's own renderer arrive intact, so the payload keeps
 * normal inline Markdown for free.
 */
function spliceContentPill(
	host: ReadingRenderHost,
	openNode: Text,
	tokenFrom: number,
	braceOffset: number,
	end: ContentEnd,
	rawId: string,
	metadata: string,
	escapes: InlineEscapePlan,
): void {
	// Identity, before any split: splitText keeps the original node as the head
	// and returns a new tail, so `end.node === openNode` only reads true here.
	const sameNode = end.node === openNode;
	// Right-to-left: cutting after the `}` first leaves the `[` offset valid
	// when both land in the same node.
	escapes.split(end.node, end.offset + 1);
	// `openNode` keeps the text before `[`; `body` starts at `[`.
	const body = escapes.split(openNode, tokenFrom);
	// Drop `[!id]{` — the lead cap stands in for it. When the payload closed in
	// this same node, the split above moved the tail into `body` as well.
	const firstContent = escapes.split(body, braceOffset - tokenFrom + 1);
	const lastContent = sameNode ? firstContent : end.node;
	body.remove();

	const { root, payload } = buildContentPillDom({
		rawId,
		metadata,
		registry: host.registry,
	});
	firstContent.parentNode?.insertBefore(root, firstContent);

	// Move [firstContent … lastContent] into the payload element — never onto
	// the pill root, which is a flex container and would give each run of text
	// its own anonymous item (see CSS_CALLOUT_PAYLOAD).
	for (let cur: Node | null = firstContent; cur; ) {
		const next: Node | null = cur === lastContent ? null : cur.nextSibling;
		payload.appendChild(cur);
		cur = next;
	}
	// The closing `}` is the last character of the last moved node; drop it.
	const closer = payload.lastChild;
	if (closer && closer.nodeType === Node.TEXT_NODE) {
		const text = closer as Text;
		if (text.data.endsWith("}")) text.data = text.data.slice(0, -1);
		if (text.data === "") text.remove();
	}
}

/**
 * Pass A — content pills (`[!warning]{be careful}`).
 *
 * Runs before the plain-pill pass and restarts its walk after every splice:
 * moving nodes invalidates any positions taken before it, and re-deriving is
 * far easier to trust than patching offsets. Bounded by the number of content
 * pills in one rendered block, so the repetition costs nothing real.
 *
 * The shared escape plan follows split text across both passes.
 */
function transformContentPills(el: HTMLElement, host: ReadingRenderHost, escapes: InlineEscapePlan): number {
	const doc = el.ownerDocument;
	let built = 0;

	for (let guard = 0; guard < 256; guard++) {
		const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				if ((node.textContent ?? "").indexOf("[!") === -1)
					return NodeFilter.FILTER_REJECT;
				const parent = node.parentElement;
				if (!parent || parent.closest(PILL_EXCLUDE_SELECTOR))
					return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			},
		});

		let spliced = false;
		for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
			const text = node as Text;
			const tokens = scanLineForCalloutTokens(text.data);
			for (const token of tokens) {
				if (token.role !== "inline") continue;
				// The payload may be closed inside this node (`content`) or run
				// past its end into rendered siblings (`contentOpen`) — both are
				// candidates; only the walk can tell them apart.
				if (!token.content && !token.contentOpen) continue;
				const braceOffset = token.to;
				if (text.data[braceOffset] !== "{") continue;
				// Empty payload: nothing to move, so the plain pill widened over
				// the braces renders it better. Left to pass B.
				if (token.content && token.content.to === token.content.from + 2) {
					continue;
				}
				if (token.from === 0 && isHeadingLeadingTextNode(text)) {
					continue;
				}
				if (!escapes.allows(text, token.from)) continue;
				if (!shouldRenderToken(resolveCalloutDef(host.registry, token.rawId))) {
					continue;
				}
				const end = findContentEnd(text, braceOffset);
				if (!end) continue;
				spliceContentPill(
					host,
					text,
					token.from,
					braceOffset,
					end,
					token.rawId,
					token.metadata,
					escapes,
				);
				built++;
				spliced = true;
				break;
			}
			if (spliced) break;
		}
		if (!spliced) break;
	}
	return built;
}

/** A pill candidate found in the rendered DOM. */
interface PillCandidate {
	node: Text;
	from: number;
	to: number;
	rawId: string;
	metadata: string;
}

/**
 * Replace `[!id]` occurrences in the block's text nodes with pill spans.
 * Runs after the heading transform, so a heading's own token is already
 * consumed and only genuine inline occurrences remain.
 */
function transformInlinePills(
	el: HTMLElement,
	host: ReadingRenderHost,
	escapes: InlineEscapePlan,
): void {
	const doc = el.ownerDocument;
	const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => {
			if ((node.textContent ?? "").indexOf("[!") === -1)
				return NodeFilter.FILTER_REJECT;
			const parent = node.parentElement;
			if (!parent || parent.closest(PILL_EXCLUDE_SELECTOR))
				return NodeFilter.FILTER_REJECT;
			return NodeFilter.FILTER_ACCEPT;
		},
	});

	// Snapshot candidates before mutating (other plugins' post-processors and
	// our own splitting must not confuse the walk).
	const candidates: PillCandidate[] = [];
	for (
		let node = walker.nextNode();
		node !== null;
		node = walker.nextNode()
	) {
		const text = node.textContent ?? "";
		// Rendered text is never a blockquote/heading source line, so every
		// token the shared classifier finds here is an inline candidate.
		for (const token of scanLineForCalloutTokens(text, {
			inlineContent: host.settings.inlineCallouts.allowContent,
		})) {
			if (token.role !== "inline") continue;
			if (token.from === 0 && isHeadingLeadingTextNode(node as Text)) {
				continue;
			}
			// A payload still being typed renders nothing at all, matching Live
			// Preview — a pill in front of half-written text is noise.
			if (token.contentOpen) continue;
			// A non-empty payload belongs to pass A. What reaches here is pass A
			// disagreeing with this scan inside one node (its brace walk reads
			// the raw text, the scan blanks code and math) or hitting its
			// 256-splice cap — and a widened plain pill would eat the payload.
			if (token.content && token.content.to > token.content.from + 2) {
				continue;
			}
			// What's left is a plain pill — widened over an empty `{}` when the
			// author wrote one, so the braces don't survive as stray text.
			candidates.push({
				node: node as Text,
				from: token.from,
				to: tokenEnd(token),
				rawId: token.rawId,
				metadata: token.metadata,
			});
		}
	}
	if (candidates.length === 0) return;

	// Replace per node in reverse order so earlier offsets stay valid.
	for (let i = candidates.length - 1; i >= 0; i--) {
		const c = candidates[i]!;
		if (!escapes.allows(c.node, c.from)) continue;
		// Theme-owned: leave the `[!id]` as the literal text it already is.
		const resolved = resolveCalloutDef(host.registry, c.rawId);
		if (!shouldRenderToken(resolved)) continue;
		// First split leaves the post-token tail in place; the second isolates
		// the token text itself, which the pill then replaces.
		escapes.split(c.node, c.to);
		const tokenPart = escapes.split(c.node, c.from);
		const pill = buildCalloutTokenDom({
			rawId: c.rawId,
			metadata: c.metadata,
			registry: host.registry,
			variant: "inline",
			showName: true,
		});
		tokenPart.replaceWith(pill);

		// PDF export: bake the pill label's per-grapheme colors now (same
		// reason as the heading token above — paintIcons ran before this pill
		// existed). The sweep lives on the pill root but the text is in its
		// name span, so that is what gets wrapped.
		const { def, unknown } = resolved;
		if (def && !unknown && def.bgGradient?.textGradient) {
			const nameEl = pill.querySelector<HTMLElement>(`.${CSS_TOKEN_NAME}`);
			if (nameEl) applyTitleGradient(nameEl, def);
		}
	}
}
