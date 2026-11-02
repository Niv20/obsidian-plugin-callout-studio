/**
 * editor/livepreview/contentPillRender.ts — the `{…}` payload of a Live Preview
 * content pill, rendered as inline markdown.
 *
 * Reading view never needs this: by the time its post-processor runs, Obsidian
 * has already rendered the payload and the pill is built by MOVING those nodes
 * (see reading/calloutPostProcessor.ts). Live Preview has only the raw source,
 * because the whole `[!id]{…}` is replaced by one widget — which is precisely
 * what makes the pill a single indivisible element — so it has to produce the
 * same DOM itself. Both surfaces therefore end up with the same shape, and this
 * module exists to keep it that way.
 *
 * Two things here are load-bearing rather than incidental:
 *
 * - **The unwrap guard.** MarkdownRenderer always emits block content; a pill
 *   can only hold inline content. Anything that does not come back as exactly
 *   one `<p>` (`[!x]{- a}` parses as a list, `[!x]{# h}` as a heading) falls back
 *   to the literal text instead of injecting a block box into a line of prose.
 * - **The cache.** Live Preview rebuilds its decorations on every keystroke,
 *   every scroll and every selection move, and each rebuild constructs fresh
 *   widgets. Rendering is asynchronous, so without a cache every pill on screen
 *   would blank and refill one frame later, continuously. On a hit the payload
 *   is filled in synchronously inside toDOM, which is the normal case.
 */
import { MarkdownRenderer } from "obsidian";
import type { App, Component } from "obsidian";

/**
 * Cache ceiling. Keyed per (source path, payload text), so this is "distinct
 * pills the user has looked at", not "pills in the vault" — a few hundred covers
 * heavy scrolling through a long note with room to spare, and the whole thing is
 * dropped on unload.
 */
const CACHE_LIMIT = 256;

/** Rendered payloads, insertion-ordered so the oldest entry evicts first. */
const cache = new Map<string, DocumentFragment>();

/**
 * Drop every cached payload. Called on unload, and on refreshCallouts() — a
 * payload can itself contain a callout token, so a registry edit changes what
 * some cached fragments should look like.
 */
export function clearContentPillCache(): void {
	cache.clear();
}

/** Cache key. NUL can't occur in either half, so the join is unambiguous. */
function cacheKey(payload: string, sourcePath: string): string {
	return `${sourcePath}\0${payload}`;
}

function remember(key: string, fragment: DocumentFragment): void {
	if (cache.size >= CACHE_LIMIT) {
		const oldest = cache.keys().next();
		if (!oldest.done) cache.delete(oldest.value);
	}
	cache.set(key, fragment);
}

/** One child of a finished MarkdownRenderer container, for the guard below. */
export type RenderedChild = { kind: "text"; text: string } | { kind: "element"; tag: string };

/**
 * The unwrap guard, as a rule rather than as DOM: did this payload render as
 * exactly one paragraph?
 *
 * Whitespace-only text nodes around the paragraph are the renderer's own
 * formatting, not evidence of block content, so they don't count. Anything else
 * — a list, a heading, two paragraphs, a bare text node — means the payload was
 * block markdown and has no business inside a line of prose.
 */
export function rendersAsOneParagraph(children: readonly RenderedChild[]): boolean {
	const meaningful = children.filter((child) => child.kind !== "text" || child.text.trim() !== "");
	const only = meaningful.length === 1 ? meaningful[0] : undefined;
	return only?.kind === "element" && only.tag === "P";
}

/**
 * Lift the inline content out of a finished MarkdownRenderer container, or
 * return null when {@link rendersAsOneParagraph} refuses it.
 */
function inlineFragment(container: HTMLElement): DocumentFragment | null {
	const children = Array.from(container.childNodes);
	const shape: RenderedChild[] = children.map((node) =>
		node.nodeType === Node.TEXT_NODE
			? { kind: "text", text: node.textContent ?? "" }
			: { kind: "element", tag: (node as Element).tagName ?? "" },
	);
	if (!rendersAsOneParagraph(shape)) return null;
	const paragraph = children.find((node) => node.nodeType !== Node.TEXT_NODE);
	if (!paragraph) return null;
	// Obsidian's global helper, so the fragment belongs to the main document.
	// That is right for a cache shared across windows: whichever window a clone
	// lands in adopts it on insert, and a popout would otherwise pin its own
	// document alive through every entry it happened to render first.
	const fragment = createFragment();
	while (paragraph.firstChild) fragment.appendChild(paragraph.firstChild);
	return fragment;
}

/**
 * Render `payload` as inline markdown and append it to `host`.
 *
 * Synchronous on a cache hit. On a miss the pill is briefly icon-only and the
 * payload lands a frame or two later — the same first-paint cost reading view
 * pays, and only once per distinct payload.
 *
 * `component` owns whatever the render registers (link hover, embeds); the
 * widget unloads it in destroy(). Appending after the widget's DOM has been
 * discarded is harmless: the nodes go into a detached tree and are collected.
 */
export function renderPayloadInto(
	app: App,
	host: HTMLElement,
	payload: string,
	sourcePath: string,
	component: Component,
): void {
	const key = cacheKey(payload, sourcePath);
	const hit = cache.get(key);
	if (hit) {
		host.appendChild(hit.cloneNode(true));
		return;
	}
	const doc = host.ownerDocument;
	const literal = (): void => {
		host.appendChild(doc.createTextNode(payload));
	};
	// Rendered detached, so a rejected or block-shaped result never reaches the
	// pill at all.
	const staging = createDiv();
	void MarkdownRenderer.render(app, payload, staging, sourcePath, component)
		.then(() => {
			const fragment = inlineFragment(staging);
			if (!fragment) {
				literal();
				return;
			}
			remember(key, fragment);
			host.appendChild(fragment.cloneNode(true));
		})
		.catch(literal);
}
