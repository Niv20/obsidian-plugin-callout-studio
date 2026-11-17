/**
 * web/browser.ts — the host that runs the renderer in a visitor's browser.
 *
 * Used where a site offers nothing earlier to hook into: Obsidian Publish,
 * which has no build of its own and only loads `publish.js`. Quartz and
 * Digital Garden build their pages in Node, so they get the renderer at build
 * time instead (`web/static/`) and their readers download none of this.
 *
 * It ran a second target too until 2026-11-16, one script for any other site,
 * which also carried the stylesheet and injected it, and mirrored Quartz's
 * dark mode for a Quartz site that loaded it by hand. Publish needs neither:
 * `publish.css` holds the rules, and Publish sets `.theme-dark` itself.
 * `docs/internals-docs/web-target-another-site.md` keeps both.
 *
 * A host carries no renderer of its own. `web/core.ts` is compiled once and
 * each host is compiled without it, so the exported file is the core, then a
 * host, then one call — and that call is where the two meet: every function
 * here takes the core as its first argument. The import below is types only,
 * and has to stay that way; `scripts/lib/webAssets.mjs` fails the build if a
 * host bundle grows a copy of the grammar.
 *
 * What a browser adds to the renderer is time. The page changes after it
 * loads — Publish renders sections lazily, and swaps the content when the
 * reader follows a link — so one `MutationObserver` re-runs the pass, which is
 * safe because a pass over finished DOM changes nothing.
 */
import type * as Core from "./core";
import type { WebBundleData } from "./webBundleData";

type CoreApi = typeof Core;
type WebRenderer = Core.WebRenderer;

/** `Node.ELEMENT_NODE`, spelled out so nothing depends on the global. */
const ELEMENT_NODE = 1;

/**
 * Run one pass over `node`: the content inside it, the tables of contents
 * inside it, or — when it sits inside either already — just itself.
 *
 * Tokens are only ever turned inside a content root. A site's navigation,
 * search results and file tree show note text too, and rewriting a platform's
 * own widgets is a different promise from rendering the author's notes. A page
 * with no content root at all gets its whole body, rather than nothing.
 */
export function sweep(core: CoreApi, renderer: WebRenderer, node: HTMLElement): void {
	const doc = node.ownerDocument;
	const toc = node.closest<HTMLElement>(core.TOC_SELECTOR);
	if (toc) {
		renderer.cleanToc(toc);
		return;
	}
	if (node.closest(core.CONTENT_ROOT_SELECTOR)) {
		renderer.process(node);
		return;
	}
	const roots = Array.from(node.querySelectorAll<HTMLElement>(core.CONTENT_ROOT_SELECTOR));
	if (roots.length === 0 && !doc.querySelector(core.CONTENT_ROOT_SELECTOR)) renderer.process(node);
	for (const root of roots) renderer.process(root);
	for (const found of Array.from(node.querySelectorAll<HTMLElement>(core.TOC_SELECTOR))) renderer.cleanToc(found);
}

/** The slice of Obsidian Publish's `window.publish` this file uses. */
interface PublishApi {
	registerMarkdownPostProcessor?: (processor: (el: HTMLElement) => void) => unknown;
}

interface RuntimeWindow extends Window {
	__calloutStudioWeb?: boolean;
	publish?: PublishApi;
}

/**
 * Start rendering this page. Safe to call before the DOM is ready, and a second
 * call — the same file loaded twice, or pasted into the console — does nothing.
 *
 * Nothing is styled here: the Obsidian Publish export leaves the stylesheet
 * out of the script, since its rules are in `publish.css`, which the site
 * loads before it paints anything.
 */
export function init(core: CoreApi, data: WebBundleData): void {
	const win = window as RuntimeWindow;
	const doc = document;
	if (win.__calloutStudioWeb) return;
	win.__calloutStudioWeb = true;

	const renderer = core.createWebRenderer(data);

	// Publish hands every block to its post-processors before painting it, so a
	// token there is turned before the reader can see it. Registered now, not
	// on DOM-ready: `publish.js` runs ahead of the first render.
	win.publish?.registerMarkdownPostProcessor?.((el) => renderer.process(el));

	const start = (): void => {
		sweep(core, renderer, doc.body);

		// One observer for everything that arrives later: Publish's lazily
		// rendered sections, its navigation between notes, hover previews.
		// Text changes are watched too, because a navigation that morphs the
		// page in place rewrites a text node instead of replacing its element.
		// A pass that changes nothing queues nothing, so this settles on its own.
		new MutationObserver((records) => {
			const seen = new Set<Node>();
			for (const record of records) {
				const target = record.target.nodeType === ELEMENT_NODE ? record.target : record.target.parentElement;
				if (!target || seen.has(target)) continue;
				seen.add(target);
				sweep(core, renderer, target as HTMLElement);
			}
		}).observe(doc.body, { childList: true, subtree: true, characterData: true });
	};

	if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
	else start();
}
